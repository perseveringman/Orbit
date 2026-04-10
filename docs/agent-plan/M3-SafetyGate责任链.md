# M3：Safety Gate 责任链 — 深度开发计划

> **里程碑**：M3 Safety Gate 责任链  
> **状态**：设计完成，待实现  
> **关联模块**：`packages/agent-core/src/safety-gate.ts`（当前 139 行）  
> **目标**：将当前的简单正则扫描 + 二态审批升级为五层责任链架构，补齐凭证脱敏、数据出境控制、审批暂停-恢复、执行审计四大缺失能力

---

## 0. 现状问题分析

当前 `SafetyGate` 的实现（`packages/agent-core/src/safety-gate.ts`）仅包含四个方法：

| 方法 | 能力 | 缺陷 |
|------|------|------|
| `scanContext(content)` | 12 条正则扫描 | 覆盖率极低：无隐藏字符检测、无多语种注入、无编码混淆检测 |
| `checkCapability(def, ctx)` | 作用域比对 | 无动态策略、无上下文感知的风险升降级 |
| `requiresApproval(def)` | `R2+` 二态判定 | 无暂停-恢复、无记忆选择、无批量审批 |
| `getApprovalTier(risk)` | 静态映射 | 无出境控制、无脱敏、无审计 |

**五大缺失**：

1. **无完整责任链**：扫描与审批分离，没有统一的链式执行路径
2. **无凭证脱敏**：Hermes 有自动剥离 `ghp_*`、`sk-*`、`Bearer` 等，Orbit 完全缺失
3. **无暂停-恢复机制**：审批是二态布尔值，不能暂停 run 并在批准后从 Session Lineage 恢复
4. **无审计日志**：能力调用无结构化 trace 记录
5. **无数据出境控制**：Orbit 存储用户最私密数据（愿景、日记、健康、财务），却无出境守门

---

## 1. 责任链架构设计

### 1.1 五层 SafetyChecker 接口定义

责任链的核心抽象是 `SafetyChecker` 接口。每一层（Layer）实现此接口，链式执行时按固定顺序依次调用。任一层返回 `denied` 则短路终止，返回 `suspended` 则暂停当前 run 等待恢复。

```typescript
// packages/agent-core/src/safety/types.ts

/**
 * 每一层 checker 的执行结果。
 * - passed:    本层通过，继续下一层
 * - denied:    本层拒绝，整条链终止
 * - suspended: 本层要求暂停（如等待审批），run 进入 awaiting-approval
 */
export type CheckVerdict = 'passed' | 'denied' | 'suspended';

/**
 * 单层检查的输出。
 */
export interface LayerCheckResult {
  readonly verdict: CheckVerdict;
  readonly layerId: string;              // 'context-scan' | 'capability-policy' | 'approval' | 'data-egress' | 'audit'
  readonly reason?: string;              // 人类可读的拒绝/暂停原因
  readonly threats?: readonly string[];  // 仅 context-scan 层填充
  readonly metadata?: Readonly<Record<string, unknown>>; // 层特定数据（审批ID、脱敏字段列表等）
}

/**
 * 流经整条责任链的请求上下文（mutable envelope）。
 * 每一层可以读取、也可以向 envelope 追加信息（如脱敏后的内容）。
 */
export interface SafetyEnvelope {
  // ---- 输入（由调用方填充）----
  readonly capabilityCall: CapabilityCallDescriptor;
  readonly session: SessionDescriptor;
  readonly rawInput: string;        // 原始用户输入 / tool arguments

  // ---- 可变状态（各层可修改）----
  sanitizedInput: string;           // 经脱敏处理后的输入（初始 = rawInput）
  threats: string[];                // 累积威胁标记
  approvalRequest?: ApprovalRequest;// 审批层填充
  egressDecision?: EgressDecision;  // 出境层填充
  auditEntry?: AuditEntry;          // 审计层填充
  layerResults: LayerCheckResult[]; // 各层执行结果的有序列表
}

/**
 * 五层 checker 的统一接口。
 * 实现此接口即可插入责任链。
 */
export interface SafetyChecker {
  readonly layerId: string;
  readonly order: number; // 0-4，决定执行顺序
  check(envelope: SafetyEnvelope): Promise<LayerCheckResult>;
}
```

### 1.2 CapabilityCallDescriptor 与 SessionDescriptor

```typescript
// packages/agent-core/src/safety/types.ts（续）

export interface CapabilityCallDescriptor {
  readonly toolName: string;
  readonly toolDefinition: ToolDefinition;
  readonly arguments: Readonly<Record<string, unknown>>;
  readonly callerDomain: AgentDomain | 'orchestrator';
  readonly callId: string;
}

export interface SessionDescriptor {
  readonly sessionId: string;
  readonly runId: string;
  readonly surface: AgentSurface;
  readonly scopeLimit: ScopeLimit;
  readonly workspaceId: string;
  readonly userId: string;
}

export type EgressVerdict = 'allow' | 'ask' | 'deny';

export interface EgressDecision {
  readonly verdict: EgressVerdict;
  readonly targetService: string;       // e.g. 'openai', 'anthropic', 'mcp:github'
  readonly fieldsRedacted: string[];    // 被脱敏的字段路径
  readonly originalHash?: string;       // 脱敏前内容的 SHA-256，用于审计回溯
  readonly reason?: string;
}
```

### 1.3 链式执行引擎 SafetyChain

```typescript
// packages/agent-core/src/safety/safety-chain.ts

import type { SafetyChecker, SafetyEnvelope, LayerCheckResult, CheckVerdict } from './types.js';

/**
 * 五层责任链的最终执行结果。
 */
export interface ChainResult {
  readonly verdict: CheckVerdict;       // 整条链的最终判定
  readonly layers: readonly LayerCheckResult[];
  readonly envelope: SafetyEnvelope;    // 包含脱敏后输入、审计条目等
}

export class SafetyChain {
  private readonly checkers: SafetyChecker[];

  constructor(checkers: SafetyChecker[]) {
    // 按 order 升序排列，确保执行顺序固定
    this.checkers = [...checkers].sort((a, b) => a.order - b.order);
  }

  /**
   * 逐层执行。短路语义：
   * - denied  → 立即终止，不执行后续层
   * - suspended → 立即终止（run 暂停），不执行后续层
   * - passed  → 继续下一层
   *
   * 最后一层（audit）始终执行——即使前面的层已经拒绝，
   * 也需要记录"被拒绝"这件事。
   */
  async execute(envelope: SafetyEnvelope): Promise<ChainResult> {
    let finalVerdict: CheckVerdict = 'passed';

    for (const checker of this.checkers) {
      // 审计层（order=4）无论前置层是否拒绝都执行
      if (finalVerdict !== 'passed' && checker.layerId !== 'audit') {
        continue;
      }

      const result = await checker.check(envelope);
      envelope.layerResults.push(result);

      if (result.verdict === 'denied' || result.verdict === 'suspended') {
        finalVerdict = result.verdict;
        // 不 break，让审计层有机会执行
      }
    }

    return {
      verdict: finalVerdict,
      layers: envelope.layerResults,
      envelope,
    };
  }

  /**
   * 运行时替换某一层（热插拔）。
   * 用于测试或按工作区策略替换默认实现。
   */
  replaceLayer(layerId: string, newChecker: SafetyChecker): void {
    const idx = this.checkers.findIndex((c) => c.layerId === layerId);
    if (idx === -1) {
      throw new Error(`SafetyChain: layer "${layerId}" not found`);
    }
    this.checkers[idx] = newChecker;
    this.checkers.sort((a, b) => a.order - b.order);
  }

  /**
   * 获取当前链中所有层的 ID（调试用）。
   */
  getLayerIds(): readonly string[] {
    return this.checkers.map((c) => c.layerId);
  }
}
```

### 1.4 五层执行顺序与职责一览

| 顺序 | layerId | 类 | 职责 | 短路语义 |
|------|---------|-----|------|----------|
| 0 | `context-scan` | `ContextScanner` | 注入检测、隐藏字符、威胁模式匹配 | 发现高危威胁 → denied |
| 1 | `capability-policy` | `CapabilityPolicyChecker` | 作用域、入口、对象范围的策略校验 | 越权 → denied |
| 2 | `approval` | `ApprovalGate` | 根据 risk_level + approval_policy 决定 A0-A3 | A2/A3 → suspended |
| 3 | `data-egress` | `DataEgressController` | 出境三态判定 + 自动脱敏 | deny → denied; ask → suspended |
| 4 | `audit` | `AuditTrail` | 结构化审计日志记录 | 永不拒绝，始终 passed |

### 1.5 与 Orchestrator 的集成

当前 `Orchestrator.execute()` 中的安全检查调用（`orchestrator.ts:232-273`）需要重构为：

```typescript
// orchestrator.ts – 重构后的 tool call 处理片段

for (const tc of choice.message.toolCalls) {
  const toolDef = availableTools.find((t) => t.name === tc.name);
  if (!toolDef) continue;

  // 构造 SafetyEnvelope
  const envelope: SafetyEnvelope = {
    capabilityCall: {
      toolName: tc.name,
      toolDefinition: toolDef,
      arguments: JSON.parse(tc.arguments),
      callerDomain: domain,
      callId: generateId('call'),
    },
    session: {
      sessionId: input.session.id,
      runId,
      surface: input.session.surface,
      scopeLimit: toolDef.scopeLimit,
      workspaceId: input.session.workspaceId,
      userId: '', // 从 session context 获取
    },
    rawInput: tc.arguments,
    sanitizedInput: tc.arguments,
    threats: [],
    layerResults: [],
  };

  // 执行五层责任链
  const chainResult = await this.safetyChain.execute(envelope);

  switch (chainResult.verdict) {
    case 'denied': {
      const reason = chainResult.layers.find(l => l.verdict === 'denied')?.reason ?? 'Blocked by safety gate';
      conversation.push({ id: generateId('msg'), role: 'tool', content: `Error: ${reason}`, toolCallId: tc.id, timestamp: new Date().toISOString() });
      continue;
    }
    case 'suspended': {
      // 审批暂停：创建审批请求，run 进入 awaiting-approval
      if (envelope.approvalRequest) {
        pendingApprovals.push(envelope.approvalRequest);
      }
      steps.push({ id: generateId('step'), runId, kind: 'approval-wait', content: `Awaiting approval for ${tc.name}`, toolName: tc.name, approvalRequestId: envelope.approvalRequest?.id, timestamp: new Date().toISOString() });
      continue;
    }
    case 'passed': {
      // 使用脱敏后的输入执行工具
      const sanitizedArgs = JSON.parse(envelope.sanitizedInput);
      const result = await this.registry.dispatch(tc.name, sanitizedArgs);
      // ... 记录 steps 与 conversation
    }
  }
}
```

---

## 2. 上下文安全扫描器 (ContextScanner)

### 2.1 威胁模式分类体系

当前 `THREAT_PATTERNS` 仅有 12 条正则，按照 Hermes 的 30+ 条危险模式正则库和 Claude Code 的多层检测策略，需要扩展为完整的六类威胁库：

```typescript
// packages/agent-core/src/safety/context-scanner.ts

export const enum ThreatCategory {
  PromptInjection = 'prompt-injection',
  PrivilegeEscalation = 'privilege-escalation',
  DestructiveCommand = 'destructive-command',
  CodeExecution = 'code-execution',
  CredentialLeak = 'credential-leak',
  DataExfiltration = 'data-exfiltration',
  HiddenCharacter = 'hidden-character',
}

export interface ThreatPattern {
  readonly id: string;
  readonly category: ThreatCategory;
  readonly pattern: RegExp;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly description: string;
}
```

### 2.2 扩展威胁模式库

从 12 条扩展到约 45 条，分为以下子类：

**Prompt Injection（15 条）**：

```typescript
// 基础注入
{ id: 'pi-ignore-instructions', category: 'prompt-injection', severity: 'critical',
  pattern: /ignore\s+(previous|above|all|prior|earlier|system)\s+(instructions|prompts?|rules?|context)/i },
{ id: 'pi-persona-override', category: 'prompt-injection', severity: 'critical',
  pattern: /you\s+are\s+now\s+(a|an)\s+/i },
{ id: 'pi-system-tag', category: 'prompt-injection', severity: 'high',
  pattern: /\bsystem\s*:\s*/i },
{ id: 'pi-new-instructions', category: 'prompt-injection', severity: 'critical',
  pattern: /new\s+(system\s+)?instructions?\s*:/i },
{ id: 'pi-jailbreak-dan', category: 'prompt-injection', severity: 'critical',
  pattern: /\b(DAN|do\s+anything\s+now)\b/i },
{ id: 'pi-developer-mode', category: 'prompt-injection', severity: 'critical',
  pattern: /\b(developer|maintenance|debug|admin)\s+mode\b/i },
{ id: 'pi-roleplay-override', category: 'prompt-injection', severity: 'high',
  pattern: /\bact\s+as\s+(if\s+you\s+(are|were)|a|an)\b/i },
{ id: 'pi-forget-rules', category: 'prompt-injection', severity: 'critical',
  pattern: /\bforget\s+(all\s+)?(your\s+)?(rules?|instructions?|guidelines?|constraints?)\b/i },
{ id: 'pi-output-prompt', category: 'prompt-injection', severity: 'high',
  pattern: /\b(output|print|repeat|show|display|reveal)\s+(your\s+)?(system\s+)?(prompt|instructions?)\b/i },
{ id: 'pi-base64-payload', category: 'prompt-injection', severity: 'medium',
  pattern: /\batob\s*\(|Buffer\.from\s*\([^)]*,\s*['"]base64['"]\)/i },

// 多语种注入（Orbit 面向中英繁三语用户）
{ id: 'pi-cn-ignore', category: 'prompt-injection', severity: 'critical',
  pattern: /忽略(之前|上面|以上|所有|全部)(的)?(指令|指示|规则|提示|系统消息)/i },
{ id: 'pi-cn-persona', category: 'prompt-injection', severity: 'critical',
  pattern: /你现在是(一个|一名)?/i },
{ id: 'pi-cn-new-role', category: 'prompt-injection', severity: 'high',
  pattern: /(扮演|假装|模拟|充当)(一个|一名)?/i },
{ id: 'pi-tw-ignore', category: 'prompt-injection', severity: 'critical',
  pattern: /忽略(之前|上面|以上|所有|全部)(的)?(指令|指示|規則|提示)/i },

// 间接注入（embedded in content from external sources）
{ id: 'pi-markdown-hidden', category: 'prompt-injection', severity: 'medium',
  pattern: /\[.*?\]\(data:text\/html/i },
```

**隐藏字符检测（8 条）**：

```typescript
// 零宽字符
{ id: 'hc-zwsp', category: 'hidden-character', severity: 'high',
  pattern: /[\u200B\u200C\u200D\uFEFF]/g },
// RTL override（可用于视觉欺骗）
{ id: 'hc-rtl-override', category: 'hidden-character', severity: 'high',
  pattern: /[\u202A-\u202E\u2066-\u2069]/g },
// 同形字符攻击（Cyrillic/Greek 看起来像 Latin）
{ id: 'hc-homoglyph', category: 'hidden-character', severity: 'medium',
  pattern: /[\u0400-\u04FF].*[a-zA-Z]|[a-zA-Z].*[\u0400-\u04FF]/g },
// ASCII 控制字符（除 \n \r \t 外）
{ id: 'hc-control-chars', category: 'hidden-character', severity: 'medium',
  pattern: /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g },
// 不可见的 tag 字符（U+E0000-U+E007F）
{ id: 'hc-tag-chars', category: 'hidden-character', severity: 'high',
  pattern: /[\uDB40][\uDC00-\uDC7F]/g },
// 私有使用区字符
{ id: 'hc-private-use', category: 'hidden-character', severity: 'low',
  pattern: /[\uE000-\uF8FF]/g },
// 超长 Unicode escape 序列（试图绕过正则）
{ id: 'hc-unicode-escape', category: 'hidden-character', severity: 'medium',
  pattern: /\\u\{[0-9a-fA-F]{5,}\}/g },
// 组合字符堆叠（zalgo text）
{ id: 'hc-zalgo', category: 'hidden-character', severity: 'medium',
  pattern: /[\u0300-\u036F]{4,}/g },
```

**凭证泄露（8 条）**（参考 Hermes 凭证清洗规则）：

```typescript
// GitHub PAT
{ id: 'cl-github-pat', category: 'credential-leak', severity: 'critical',
  pattern: /\bghp_[A-Za-z0-9]{36,}\b/ },
// GitHub OAuth
{ id: 'cl-github-oauth', category: 'credential-leak', severity: 'critical',
  pattern: /\bgho_[A-Za-z0-9]{36,}\b/ },
// OpenAI API key
{ id: 'cl-openai-key', category: 'credential-leak', severity: 'critical',
  pattern: /\bsk-[A-Za-z0-9]{20,}\b/ },
// Bearer token
{ id: 'cl-bearer-token', category: 'credential-leak', severity: 'critical',
  pattern: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/i },
// AWS access key
{ id: 'cl-aws-key', category: 'credential-leak', severity: 'critical',
  pattern: /\bAKIA[0-9A-Z]{16}\b/ },
// 通用 secret/password/token 赋值
{ id: 'cl-generic-secret', category: 'credential-leak', severity: 'high',
  pattern: /\b(password|secret|token|api[_-]?key|private[_-]?key)\s*[:=]\s*['"][^'"]{8,}['"]/i },
// Anthropic API key
{ id: 'cl-anthropic-key', category: 'credential-leak', severity: 'critical',
  pattern: /\bsk-ant-[A-Za-z0-9\-]{20,}\b/ },
// Orbit master key（自保护）
{ id: 'cl-orbit-master', category: 'credential-leak', severity: 'critical',
  pattern: /\borbit[_-]master[_-]key\s*[:=]/i },
```

**其余类别（14 条）**：包括破坏性命令（`rm -rf`、`DROP TABLE`、`DELETE FROM`、`FORMAT`）、代码执行（`eval`、`exec`、`Function()`、`child_process`）、数据外泄（`fetch` 外部 URL、`XMLHttpRequest`、`WebSocket` 连接外部地址）等。完整列表在实现时定义，此处省略以控制文档篇幅。

### 2.3 分级扫描策略

不是所有内容都需要跑全部 45 条正则。按照性能优化原则，采用分级扫描：

```typescript
export const enum ScanLevel {
  Quick = 'quick',     // 仅 critical severity，12 条核心规则
  Standard = 'standard', // critical + high，约 25 条
  Deep = 'deep',       // 全部 45 条
}

// 触发深度扫描的条件：
// - 来自外部源的内容（web-fetch 结果、MCP 返回、RSS 解析结果）
// - 当前能力的 data_boundary 为 'sensitive-redact'
// - 用户显式配置了严格模式

export class ContextScanner implements SafetyChecker {
  readonly layerId = 'context-scan';
  readonly order = 0;

  private readonly patterns: Map<ScanLevel, ThreatPattern[]>;

  constructor(customPatterns?: ThreatPattern[]) {
    this.patterns = this.buildPatternIndex(customPatterns);
  }

  async check(envelope: SafetyEnvelope): Promise<LayerCheckResult> {
    const level = this.determineScanLevel(envelope);
    const patternsToRun = this.patterns.get(level) ?? [];
    const content = envelope.rawInput;
    const threats: string[] = [];
    let hasCritical = false;

    for (const tp of patternsToRun) {
      // 重置 lastIndex（对 global 正则很重要）
      tp.pattern.lastIndex = 0;
      if (tp.pattern.test(content)) {
        threats.push(tp.id);
        if (tp.severity === 'critical') hasCritical = true;
      }
    }

    envelope.threats.push(...threats);

    if (hasCritical) {
      return {
        verdict: 'denied',
        layerId: this.layerId,
        reason: `Critical threat detected: ${threats.filter(t => this.getSeverity(t) === 'critical').join(', ')}`,
        threats,
      };
    }

    if (threats.length > 0) {
      return {
        verdict: 'passed', // 非 critical 的威胁标记但不阻断
        layerId: this.layerId,
        reason: `Warnings: ${threats.join(', ')}`,
        threats,
      };
    }

    return { verdict: 'passed', layerId: this.layerId, threats: [] };
  }

  private determineScanLevel(envelope: SafetyEnvelope): ScanLevel {
    const db = envelope.capabilityCall.toolDefinition.dataBoundary;
    if (db === 'sensitive-redact') return ScanLevel.Deep;
    if (envelope.capabilityCall.toolDefinition.riskLevel === 'R3-external-write') return ScanLevel.Deep;
    if (envelope.capabilityCall.toolDefinition.riskLevel === 'R2-external-read') return ScanLevel.Standard;
    return ScanLevel.Quick;
  }

  // 性能优化：预编译，所有正则在构造时创建，不在每次扫描时重建
  private buildPatternIndex(custom?: ThreatPattern[]): Map<ScanLevel, ThreatPattern[]> {
    const all = [...BUILTIN_THREAT_PATTERNS, ...(custom ?? [])];
    const quick = all.filter(p => p.severity === 'critical');
    const standard = all.filter(p => p.severity === 'critical' || p.severity === 'high');
    return new Map([
      [ScanLevel.Quick, quick],
      [ScanLevel.Standard, standard],
      [ScanLevel.Deep, all],
    ]);
  }
}
```

### 2.4 性能考量

- **预编译正则**：所有正则在 `ContextScanner` 构造时完成编译，存储在 `Map` 中，避免每次调用时重建
- **短路评估**：Quick 级别仅 12 条规则，对 R0-read 级别能力的开销极小
- **批量扫描**：对同一 run 内的多个 tool call，将它们的 arguments 合并为一次 Deep 扫描（如果有任一 tool 触发 Deep 级别）
- **正则安全**：避免使用回溯性能炸弹（catastrophic backtracking）。所有正则必须通过 `safe-regex` 或等效工具检查。对于全局正则（带 `g` flag），每次使用前重置 `lastIndex`

---

## 3. 能力策略检查器 (CapabilityPolicyChecker)

### 3.1 设计概述

能力策略检查器是当前 `SafetyGate.checkCapability()` 的增强版。它在上下文扫描之后执行，负责判定当前 capability 调用是否在此入口（surface）、对象范围（scope）、调用者身份（domain agent）下被允许。

```typescript
// packages/agent-core/src/safety/capability-policy-checker.ts

export class CapabilityPolicyChecker implements SafetyChecker {
  readonly layerId = 'capability-policy';
  readonly order = 1;

  async check(envelope: SafetyEnvelope): Promise<LayerCheckResult> {
    const { capabilityCall, session } = envelope;
    const def = capabilityCall.toolDefinition;

    // 1. Surface scope check（保留原有逻辑）
    const surfaceMaxIdx = SCOPE_LIMITS.indexOf(SURFACE_MAX_SCOPE[session.surface]);
    const toolScopeIdx = SCOPE_LIMITS.indexOf(def.scopeLimit);
    if (toolScopeIdx > surfaceMaxIdx) {
      return {
        verdict: 'denied',
        layerId: this.layerId,
        reason: `Tool scope "${def.scopeLimit}" exceeds surface "${session.surface}" max scope "${SURFACE_MAX_SCOPE[session.surface]}"`,
      };
    }

    // 2. Context scope check
    const contextScopeIdx = SCOPE_LIMITS.indexOf(session.scopeLimit);
    if (toolScopeIdx > contextScopeIdx) {
      return {
        verdict: 'denied',
        layerId: this.layerId,
        reason: `Tool scope "${def.scopeLimit}" exceeds context scope "${session.scopeLimit}"`,
      };
    }

    // 3. Domain agent allowed/blocked capabilities check
    const domainConfig = DOMAIN_AGENT_CONFIGS[capabilityCall.callerDomain as AgentDomain];
    if (domainConfig) {
      if (domainConfig.blockedCapabilities.includes(capabilityCall.toolName)) {
        return {
          verdict: 'denied',
          layerId: this.layerId,
          reason: `Capability "${capabilityCall.toolName}" is blocked for domain "${capabilityCall.callerDomain}"`,
        };
      }
      if (domainConfig.allowedCapabilities.length > 0 &&
          !domainConfig.allowedCapabilities.includes(capabilityCall.toolName)) {
        return {
          verdict: 'denied',
          layerId: this.layerId,
          reason: `Capability "${capabilityCall.toolName}" is not in the allowed list for domain "${capabilityCall.callerDomain}"`,
        };
      }
    }

    // 4. 威胁感知的动态升级：如果 context-scan 层标记了威胁，限制 R1+ 能力
    if (envelope.threats.length > 0) {
      const riskIdx = RISK_LEVELS.indexOf(def.riskLevel);
      if (riskIdx >= 1) {
        return {
          verdict: 'denied',
          layerId: this.layerId,
          reason: `Threat markers [${envelope.threats.join(', ')}] present; blocking ${def.riskLevel} capability`,
        };
      }
    }

    return { verdict: 'passed', layerId: this.layerId };
  }
}
```

### 3.2 fail-closed 原则

参考 Claude Code 的 `buildTool()` 默认值设计：

- 未注册的 capability 默认 `R3-external-write` + `A3-dual-confirm`
- 新增 capability 如果忘记声明 `riskLevel`，系统以最保守策略处理
- `CapabilityPolicyChecker` 对缺少 `toolDefinition` 的调用直接 `denied`

---

## 4. 审批工作流 (ApprovalGate)

### 4.1 A0-A3 四档审批的完整状态机

```
                    ┌──────────────────────────────────────────────┐
                    │            ApprovalGate.check()              │
                    └──────────────┬───────────────────────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │  确定审批档位 (A0/A1/A2/A3)  │
                    └──────────────┬───────────────┘
                                   │
              ┌────────────┬───────┴───────┬────────────┐
              ▼            ▼               ▼            ▼
         ┌────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐
         │ A0-auto│  │A1-transp.│  │A2-confirm│  │A3-dual-cf.│
         │ passed │  │ passed + │  │ suspended│  │ suspended │
         │        │  │ log only │  │ → 1人审批│  │ → 2阶段审批│
         └────────┘  └──────────┘  └──────────┘  └───────────┘
                                        │              │
                                        ▼              ▼
                                 ┌─────────────────────────┐
                                 │   创建 ApprovalRequest   │
                                 │   run → awaiting-approval│
                                 │   session.lineage +=     │
                                 │   blocked_by_approval    │
                                 └──────────┬──────────────┘
                                            │
                            ┌───────────────┼──────────────┐
                            ▼               ▼              ▼
                     ┌──────────┐    ┌──────────┐   ┌──────────┐
                     │ approved │    │ rejected │   │ expired  │
                     │ → resume │    │ → denied │   │ → denied │
                     └──────────┘    └──────────┘   └──────────┘
```

### 4.2 完整实现

```typescript
// packages/agent-core/src/safety/approval-gate.ts

import type {
  SafetyChecker, SafetyEnvelope, LayerCheckResult,
  ApprovalRequest, ApprovalPolicy, RiskLevel,
} from './types.js';

/**
 * 审批记忆：用户对某类能力的持久选择。
 */
export type ApprovalMemoryScope = 'once' | 'session' | 'always' | 'deny';

export interface ApprovalMemoryEntry {
  readonly capabilityPattern: string;  // 支持通配符，如 'research.*' 或精确名称
  readonly scope: ApprovalMemoryScope;
  readonly decision: 'approved' | 'rejected';
  readonly sessionId?: string;         // scope='session' 时有值
  readonly createdAt: string;
  readonly expiresAt?: string;
}

export interface ApprovalMemoryStore {
  lookup(capabilityName: string, sessionId: string): Promise<ApprovalMemoryEntry | null>;
  save(entry: ApprovalMemoryEntry): Promise<void>;
  clear(capabilityPattern: string): Promise<void>;
}

/**
 * 拒绝追踪器：记录被拒绝的能力调用，支持自动降级。
 */
export interface RejectionTracker {
  recordRejection(capabilityName: string, sessionId: string): Promise<void>;
  getRecentRejections(capabilityName: string, windowMs: number): Promise<number>;
}

const RISK_TO_APPROVAL: Record<RiskLevel, ApprovalPolicy> = {
  'R0-read': 'A0-auto',
  'R1-internal-write': 'A1-transparent',
  'R2-external-read': 'A2-confirm',
  'R3-external-write': 'A3-dual-confirm',
};

export class ApprovalGate implements SafetyChecker {
  readonly layerId = 'approval';
  readonly order = 2;

  private readonly memoryStore: ApprovalMemoryStore;
  private readonly rejectionTracker: RejectionTracker;

  constructor(memoryStore: ApprovalMemoryStore, rejectionTracker: RejectionTracker) {
    this.memoryStore = memoryStore;
    this.rejectionTracker = rejectionTracker;
  }

  async check(envelope: SafetyEnvelope): Promise<LayerCheckResult> {
    const def = envelope.capabilityCall.toolDefinition;
    let tier = this.resolveApprovalTier(def, envelope);

    // ---- 自动降级检查 ----
    // 如果此能力在短时间内被多次拒绝，自动升级审批档位
    const recentRejections = await this.rejectionTracker.getRecentRejections(
      envelope.capabilityCall.toolName,
      5 * 60 * 1000, // 5 分钟窗口
    );
    if (recentRejections >= 3) {
      tier = this.escalateTier(tier);
    }

    // ---- 审批记忆查询 ----
    const memory = await this.memoryStore.lookup(
      envelope.capabilityCall.toolName,
      envelope.session.sessionId,
    );
    if (memory) {
      if (memory.decision === 'approved' && this.isMemoryValid(memory, envelope)) {
        return { verdict: 'passed', layerId: this.layerId, metadata: { tier, fromMemory: true } };
      }
      if (memory.decision === 'rejected' && memory.scope === 'always') {
        await this.rejectionTracker.recordRejection(
          envelope.capabilityCall.toolName,
          envelope.session.sessionId,
        );
        return { verdict: 'denied', layerId: this.layerId, reason: 'Permanently denied by user preference' };
      }
    }

    // ---- 按档位判定 ----
    switch (tier) {
      case 'A0-auto':
        return { verdict: 'passed', layerId: this.layerId, metadata: { tier } };

      case 'A1-transparent':
        // 透明执行但记录日志，不暂停
        return {
          verdict: 'passed',
          layerId: this.layerId,
          metadata: { tier, transparent: true },
        };

      case 'A2-confirm':
      case 'A3-dual-confirm': {
        // 创建审批请求，暂停 run
        const request: ApprovalRequest = {
          id: generateId('apr'),
          runId: envelope.session.runId,
          capabilityName: envelope.capabilityCall.toolName,
          riskLevel: def.riskLevel,
          policy: tier,
          reason: this.buildApprovalReason(envelope),
          impactSummary: this.buildImpactSummary(envelope),
          status: 'pending',
          createdAt: new Date().toISOString(),
        };
        envelope.approvalRequest = request;

        return {
          verdict: 'suspended',
          layerId: this.layerId,
          reason: `Requires ${tier} approval`,
          metadata: { tier, approvalId: request.id },
        };
      }
    }
  }

  /**
   * 威胁感知的动态升级：
   * 如果存在未处理的威胁标记，所有档位至少升到 A2。
   */
  private resolveApprovalTier(def: ToolDefinition, envelope: SafetyEnvelope): ApprovalPolicy {
    let tier = def.approvalPolicy ?? RISK_TO_APPROVAL[def.riskLevel];
    if (envelope.threats.length > 0) {
      const currentIdx = APPROVAL_POLICIES.indexOf(tier);
      const minIdx = APPROVAL_POLICIES.indexOf('A2-confirm');
      if (currentIdx < minIdx) {
        tier = 'A2-confirm';
      }
    }
    return tier;
  }

  private escalateTier(tier: ApprovalPolicy): ApprovalPolicy {
    const idx = APPROVAL_POLICIES.indexOf(tier);
    const nextIdx = Math.min(idx + 1, APPROVAL_POLICIES.length - 1);
    return APPROVAL_POLICIES[nextIdx];
  }

  private isMemoryValid(memory: ApprovalMemoryEntry, envelope: SafetyEnvelope): boolean {
    if (memory.scope === 'once') return false; // 一次性已用尽
    if (memory.scope === 'session' && memory.sessionId !== envelope.session.sessionId) return false;
    if (memory.expiresAt && new Date(memory.expiresAt) < new Date()) return false;
    return true;
  }

  private buildApprovalReason(envelope: SafetyEnvelope): string {
    const def = envelope.capabilityCall.toolDefinition;
    const parts: string[] = [];
    parts.push(`Capability "${envelope.capabilityCall.toolName}" (${def.riskLevel})`);
    if (envelope.threats.length > 0) {
      parts.push(`Threat markers: ${envelope.threats.join(', ')}`);
    }
    return parts.join('; ');
  }

  private buildImpactSummary(envelope: SafetyEnvelope): string {
    return `Tool "${envelope.capabilityCall.toolName}" invoked by ${envelope.capabilityCall.callerDomain} on surface ${envelope.session.surface}`;
  }
}
```

### 4.3 审批暂停 run → 恢复执行的机制

审批暂停-恢复与 Session Lineage 紧密集成。核心流程：

```
1. ApprovalGate 返回 suspended
2. Orchestrator 将 run.status 设为 'awaiting-approval'
3. Session.lineage 追加 { type: 'blocked_by_approval', sourceId: approvalRequest.id }
4. Session.status 设为 'paused'
5. 前端展示审批卡片（能力名称、风险等级、影响摘要、remember 选项）

--- 用户操作 ---

6a. 用户批准 → ApprovalRequest.status = 'approved'
    - 如果选择 remember: once/session/always → 写入 ApprovalMemoryStore
    - Orchestrator 创建新 run（lineage: resumed_from_job）
    - 从暂停点继续执行
    
6b. 用户拒绝 → ApprovalRequest.status = 'rejected'
    - 如果选择 deny always → 写入 ApprovalMemoryStore
    - 记录拒绝到 RejectionTracker
    - run.status = 'failed'
    - Session.lineage 保留 blocked_by_approval 记录
    
6c. 超时 → ApprovalRequest.status = 'expired'
    - 默认 30 分钟超时
    - run.status = 'failed'
```

恢复执行器的接口：

```typescript
// packages/agent-core/src/safety/approval-resume.ts

export interface ApprovalResumeContext {
  readonly originalRunId: string;
  readonly approvalRequestId: string;
  readonly decision: 'approved' | 'rejected';
  readonly rememberScope: ApprovalMemoryScope;
}

export class ApprovalResumeHandler {
  constructor(
    private readonly orchestrator: Orchestrator,
    private readonly memoryStore: ApprovalMemoryStore,
    private readonly rejectionTracker: RejectionTracker,
  ) {}

  async resume(ctx: ApprovalResumeContext): Promise<OrchestratorOutput | null> {
    // 1. 写入审批记忆
    if (ctx.rememberScope !== 'once') {
      await this.memoryStore.save({
        capabilityPattern: /* 从原始请求中获取 */,
        scope: ctx.rememberScope,
        decision: ctx.decision === 'approved' ? 'approved' : 'rejected',
        createdAt: new Date().toISOString(),
      });
    }

    // 2. 拒绝路径
    if (ctx.decision === 'rejected') {
      await this.rejectionTracker.recordRejection(/* ... */);
      return null;
    }

    // 3. 批准路径：从 Session Lineage 恢复
    // 创建新 session 继承原 session 的 lineage
    // lineage: [{ type: 'resumed_from_job', sourceId: ctx.originalRunId }]
    // 重放被暂停的 tool call
    return this.orchestrator.resumeFromApproval(ctx);
  }
}
```

### 4.4 批量审批

当一次 run 中有多个 tool call 需要审批时，支持批量操作：

```typescript
export interface BatchApprovalRequest {
  readonly requests: readonly ApprovalRequest[];
  readonly commonPolicy: ApprovalPolicy; // 取最高档
}

// 前端展示为一张合并卡片，用户可以：
// - "全部批准" + remember scope
// - "全部拒绝"
// - 逐个审批
```

---

## 5. 数据出境控制 (DataEgressController)

### 5.1 三态控制模型

Orbit 存储用户最私密的数据——愿景、日记、健康计划、财务目标。数据出境控制是安全架构的核心。

```typescript
// packages/agent-core/src/safety/data-egress-controller.ts

/**
 * 对象类型 → 敏感级别映射。
 * 决定该类对象的默认出境策略。
 */
export const OBJECT_SENSITIVITY: Record<string, SensitivityLevel> = {
  // 高敏感：默认 deny
  'vision':           'critical',   // 用户愿景、人生目标
  'directive':        'critical',   // 行为准则
  'journal_entry':    'critical',   // 日记
  'health_record':    'critical',   // 健康记录
  'financial_goal':   'critical',   // 财务目标
  'credential':       'critical',   // 凭证

  // 中敏感：默认 ask
  'task':             'high',       // 任务（可能含敏感内容）
  'note':             'high',       // 笔记
  'research_space':   'high',       // 研究空间
  'draft':            'high',       // 写作草稿
  'review':           'high',       // 回顾

  // 低敏感：默认 allow
  'article':          'medium',     // 公开文章
  'highlight':        'medium',     // 高亮
  'bookmark':         'low',        // 书签
  'tag':              'low',        // 标签
  'link':             'low',        // 关系链接
};

export type SensitivityLevel = 'critical' | 'high' | 'medium' | 'low';

const SENSITIVITY_TO_EGRESS: Record<SensitivityLevel, EgressVerdict> = {
  'critical': 'deny',
  'high':     'ask',
  'medium':   'allow',
  'low':      'allow',
};
```

### 5.2 DataEgressController 实现

```typescript
export class DataEgressController implements SafetyChecker {
  readonly layerId = 'data-egress';
  readonly order = 3;

  private readonly redactionEngine: RedactionEngine;
  private readonly egressPolicyStore: EgressPolicyStore;

  constructor(redactionEngine: RedactionEngine, egressPolicyStore: EgressPolicyStore) {
    this.redactionEngine = redactionEngine;
    this.egressPolicyStore = egressPolicyStore;
  }

  async check(envelope: SafetyEnvelope): Promise<LayerCheckResult> {
    const def = envelope.capabilityCall.toolDefinition;

    // 纯本地操作不需要出境控制
    if (def.dataBoundary === 'local-only') {
      return { verdict: 'passed', layerId: this.layerId };
    }

    // 1. 确定目标服务
    const targetService = this.resolveTargetService(envelope);

    // 2. 分析输入中的敏感内容
    const sensitiveFields = this.detectSensitiveContent(envelope.sanitizedInput);

    // 3. 确定出境判定
    let verdict: EgressVerdict = 'allow';

    // 检查 tool definition 的 dataBoundary
    if (def.dataBoundary === 'sensitive-redact') {
      // 需要脱敏处理
      const redacted = await this.redactionEngine.redact(
        envelope.sanitizedInput,
        sensitiveFields,
      );
      envelope.sanitizedInput = redacted.output;

      verdict = 'allow'; // 脱敏后允许出境
    } else if (def.dataBoundary === 'can-egress') {
      // 检查对象敏感级别
      const objectTypes = this.extractObjectTypes(envelope);
      const maxSensitivity = this.getMaxSensitivity(objectTypes);
      verdict = SENSITIVITY_TO_EGRESS[maxSensitivity];
    }

    // 4. 用户自定义策略覆盖
    const userPolicy = await this.egressPolicyStore.getPolicy(
      envelope.capabilityCall.toolName,
      targetService,
    );
    if (userPolicy) {
      verdict = userPolicy;
    }

    // 5. 填充出境决策
    const egressDecision: EgressDecision = {
      verdict,
      targetService,
      fieldsRedacted: sensitiveFields.map(f => f.path),
      originalHash: verdict !== 'allow'
        ? await this.hashContent(envelope.rawInput)
        : undefined,
      reason: verdict === 'deny'
        ? 'Content contains critical-sensitivity data not allowed for egress'
        : undefined,
    };
    envelope.egressDecision = egressDecision;

    // 6. 映射到 CheckVerdict
    switch (verdict) {
      case 'allow':
        return { verdict: 'passed', layerId: this.layerId, metadata: { egressDecision } };
      case 'ask':
        return { verdict: 'suspended', layerId: this.layerId, reason: `Data egress to "${targetService}" requires user consent`, metadata: { egressDecision } };
      case 'deny':
        return { verdict: 'denied', layerId: this.layerId, reason: `Data egress to "${targetService}" denied: contains critical-sensitivity content`, metadata: { egressDecision } };
    }
  }
}
```

### 5.3 自动脱敏引擎 (RedactionEngine)

脱敏引擎负责三类处理：凭证清洗、PII 检测、敏感字段替换。

```typescript
// packages/agent-core/src/safety/redaction-engine.ts

export interface SensitiveField {
  readonly path: string;     // JSON path 或文本位置
  readonly type: RedactionType;
  readonly originalLength: number;
}

export type RedactionType =
  | 'credential'     // API key, token, password
  | 'pii-email'      // 邮箱地址
  | 'pii-phone'      // 电话号码
  | 'pii-name'       // 人名（需要 NER，暂用启发式）
  | 'pii-address'    // 地址
  | 'pii-id-number'  // 身份证号、护照号
  | 'financial'      // 银行账号、信用卡号
  | 'health'         // 健康数据
  | 'object-content' // 对象正文（vision/journal 等）

export interface RedactionResult {
  readonly output: string;
  readonly fieldsRedacted: readonly SensitiveField[];
  readonly originalHash: string;
}

export class RedactionEngine {
  /**
   * 凭证清洗正则（参考 Hermes _sanitize_error 的规则集）。
   */
  private static readonly CREDENTIAL_PATTERNS: readonly { pattern: RegExp; replacement: string }[] = [
    { pattern: /\bghp_[A-Za-z0-9]{36,}\b/g, replacement: '[REDACTED:github-pat]' },
    { pattern: /\bgho_[A-Za-z0-9]{36,}\b/g, replacement: '[REDACTED:github-oauth]' },
    { pattern: /\bsk-[A-Za-z0-9]{20,}\b/g, replacement: '[REDACTED:api-key]' },
    { pattern: /\bsk-ant-[A-Za-z0-9\-]{20,}\b/g, replacement: '[REDACTED:anthropic-key]' },
    { pattern: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, replacement: 'Bearer [REDACTED]' },
    { pattern: /\bAKIA[0-9A-Z]{16}\b/g, replacement: '[REDACTED:aws-key]' },
    { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: '[REDACTED:email]' },
    { pattern: /\b\d{3}[-.\s]?\d{4}[-.\s]?\d{4}\b/g, replacement: '[REDACTED:phone]' },
    { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, replacement: '[REDACTED:card]' },
    { pattern: /\borbit[_-]master[_-]key\s*[:=]\s*\S+/gi, replacement: 'orbit_master_key=[REDACTED]' },
  ];

  /**
   * 对文本执行全套脱敏。
   */
  async redact(content: string, knownFields: SensitiveField[]): Promise<RedactionResult> {
    const originalHash = await this.sha256(content);
    let output = content;
    const redactedFields: SensitiveField[] = [...knownFields];

    // 1. 凭证清洗（正则匹配）
    for (const { pattern, replacement } of RedactionEngine.CREDENTIAL_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(output)) {
        pattern.lastIndex = 0;
        output = output.replace(pattern, replacement);
        redactedFields.push({ path: 'text', type: 'credential', originalLength: content.length });
      }
    }

    // 2. PII 检测（启发式 + 正则）
    output = this.redactPII(output, redactedFields);

    // 3. 敏感对象内容替换（按字段路径处理 JSON）
    output = this.redactObjectFields(output, knownFields);

    return { output, fieldsRedacted: redactedFields, originalHash };
  }

  /**
   * 对 JSON 结构中的敏感字段进行替换。
   * 例如 vision.content → 只保留前 50 字符 + hash。
   */
  private redactObjectFields(content: string, fields: SensitiveField[]): string {
    try {
      const obj = JSON.parse(content);
      for (const field of fields) {
        if (field.type === 'object-content') {
          const value = this.getByPath(obj, field.path);
          if (typeof value === 'string' && value.length > 50) {
            this.setByPath(obj, field.path,
              `[REDACTED: ${value.slice(0, 50)}... (${value.length} chars)]`);
          }
        }
      }
      return JSON.stringify(obj);
    } catch {
      return content; // 不是 JSON，跳过对象字段处理
    }
  }

  private redactPII(text: string, fields: SensitiveField[]): string {
    // 中国身份证号
    text = text.replace(/\b\d{6}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/g, (m) => {
      fields.push({ path: 'text', type: 'pii-id-number', originalLength: m.length });
      return '[REDACTED:id-number]';
    });
    return text;
  }

  private async sha256(text: string): Promise<string> {
    // 使用 Web Crypto API 或 Node.js crypto
    // 此处为伪代码，实际实现根据运行时环境选择
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
```

### 5.4 出境审计

每次数据出境都记录结构化日志：

```typescript
export interface EgressAuditRecord {
  readonly id: string;
  readonly timestamp: string;
  readonly capabilityName: string;
  readonly targetService: string;
  readonly verdict: EgressVerdict;
  readonly sensitivityLevel: SensitivityLevel;
  readonly fieldsRedacted: readonly string[];
  readonly originalContentHash: string;  // 脱敏前的 SHA-256
  readonly sanitizedContentHash: string; // 脱敏后的 SHA-256
  readonly sessionId: string;
  readonly runId: string;
  readonly userId: string;
}
```

### 5.5 EgressPolicyStore 接口

用户可自定义出境策略（覆盖默认映射）：

```typescript
export interface EgressPolicyStore {
  getPolicy(capabilityName: string, targetService: string): Promise<EgressVerdict | null>;
  setPolicy(capabilityName: string, targetService: string, verdict: EgressVerdict): Promise<void>;
  listPolicies(): Promise<readonly { capability: string; service: string; verdict: EgressVerdict }[]>;
}
```

---

## 6. 执行审计 (AuditTrail)

### 6.1 结构化审计日志格式

```typescript
// packages/agent-core/src/safety/audit-trail.ts

export interface AuditEntry {
  readonly id: string;
  readonly timestamp: string;

  // ---- 谁触发 ----
  readonly actor: {
    readonly userId: string;
    readonly sessionId: string;
    readonly runId: string;
    readonly agentDomain: AgentDomain | 'orchestrator';
    readonly surface: AgentSurface;
  };

  // ---- 什么能力 ----
  readonly capability: {
    readonly name: string;
    readonly riskLevel: RiskLevel;
    readonly approvalPolicy: ApprovalPolicy;
    readonly dataBoundary: DataBoundary;
  };

  // ---- 输入输出摘要 ----
  readonly input: {
    readonly summary: string;        // 前 200 字符
    readonly contentHash: string;    // 完整内容的 SHA-256
    readonly tokenEstimate: number;
  };
  readonly output?: {
    readonly summary: string;
    readonly contentHash: string;
    readonly tokenEstimate: number;
    readonly success: boolean;
  };

  // ---- 对象影响 ----
  readonly objectImpact: {
    readonly objectsRead: readonly string[];     // 对象 ID 列表
    readonly objectsWritten: readonly string[];
    readonly objectsDeleted: readonly string[];
  };

  // ---- 审批链 ----
  readonly approvalChain: {
    readonly required: boolean;
    readonly tier: ApprovalPolicy;
    readonly requestId?: string;
    readonly decision?: 'approved' | 'rejected' | 'expired';
    readonly decidedAt?: string;
    readonly rememberScope?: ApprovalMemoryScope;
  };

  // ---- 出境记录 ----
  readonly egress?: {
    readonly targetService: string;
    readonly verdict: EgressVerdict;
    readonly fieldsRedacted: readonly string[];
  };

  // ---- 安全检查结果 ----
  readonly safetyChain: {
    readonly finalVerdict: CheckVerdict;
    readonly layerResults: readonly {
      readonly layerId: string;
      readonly verdict: CheckVerdict;
      readonly reason?: string;
      readonly durationMs: number;
    }[];
    readonly totalDurationMs: number;
    readonly threats: readonly string[];
  };
}
```

### 6.2 AuditTrail 作为第五层 Checker

```typescript
export interface AuditSink {
  write(entry: AuditEntry): Promise<void>;
  query(filter: AuditQueryFilter): Promise<readonly AuditEntry[]>;
  replay(targetId: string, targetType: 'session' | 'run' | 'capability' | 'object'): Promise<readonly AuditEntry[]>;
}

export interface AuditQueryFilter {
  readonly sessionId?: string;
  readonly runId?: string;
  readonly capabilityName?: string;
  readonly objectId?: string;
  readonly timeRange?: { from: string; to: string };
  readonly verdict?: CheckVerdict;
  readonly limit?: number;
}

export class AuditTrail implements SafetyChecker {
  readonly layerId = 'audit';
  readonly order = 4;

  private readonly sink: AuditSink;

  constructor(sink: AuditSink) {
    this.sink = sink;
  }

  /**
   * 审计层始终返回 passed（不影响链执行结果）。
   * 其核心工作是汇总前四层的结果，生成结构化审计条目。
   */
  async check(envelope: SafetyEnvelope): Promise<LayerCheckResult> {
    const startTime = Date.now();

    const finalVerdict = this.deriveFinalVerdict(envelope.layerResults);

    const entry: AuditEntry = {
      id: generateId('aud'),
      timestamp: new Date().toISOString(),
      actor: {
        userId: envelope.session.userId,
        sessionId: envelope.session.sessionId,
        runId: envelope.session.runId,
        agentDomain: envelope.capabilityCall.callerDomain,
        surface: envelope.session.surface,
      },
      capability: {
        name: envelope.capabilityCall.toolName,
        riskLevel: envelope.capabilityCall.toolDefinition.riskLevel,
        approvalPolicy: envelope.capabilityCall.toolDefinition.approvalPolicy,
        dataBoundary: envelope.capabilityCall.toolDefinition.dataBoundary,
      },
      input: {
        summary: envelope.rawInput.slice(0, 200),
        contentHash: await this.sha256(envelope.rawInput),
        tokenEstimate: Math.ceil(envelope.rawInput.length / 4),
      },
      objectImpact: {
        objectsRead: [],   // 由 Orchestrator 在执行后补充
        objectsWritten: [],
        objectsDeleted: [],
      },
      approvalChain: this.extractApprovalInfo(envelope),
      egress: envelope.egressDecision ? {
        targetService: envelope.egressDecision.targetService,
        verdict: envelope.egressDecision.verdict,
        fieldsRedacted: envelope.egressDecision.fieldsRedacted,
      } : undefined,
      safetyChain: {
        finalVerdict,
        layerResults: envelope.layerResults.map(lr => ({
          layerId: lr.layerId,
          verdict: lr.verdict,
          reason: lr.reason,
          durationMs: 0, // 各层自行测量
        })),
        totalDurationMs: Date.now() - startTime,
        threats: envelope.threats,
      },
    };

    envelope.auditEntry = entry;
    await this.sink.write(entry);

    return { verdict: 'passed', layerId: this.layerId, metadata: { auditId: entry.id } };
  }

  private deriveFinalVerdict(results: LayerCheckResult[]): CheckVerdict {
    if (results.some(r => r.verdict === 'denied')) return 'denied';
    if (results.some(r => r.verdict === 'suspended')) return 'suspended';
    return 'passed';
  }
}
```

### 6.3 与 M1 事件流管道的集成

审计事件需要与 Orbit 事件系统（M1）集成，但保持安全隔离：

```typescript
/**
 * AuditEventBridge 将审计条目转换为事件流事件，
 * 但只发布安全摘要（不含完整输入输出）。
 */
export class AuditEventBridge {
  constructor(private readonly eventBus: EventBus) {}

  publishAuditEvent(entry: AuditEntry): void {
    this.eventBus.emit({
      type: 'agent.capability.executed',
      payload: {
        capabilityName: entry.capability.name,
        riskLevel: entry.capability.riskLevel,
        verdict: entry.safetyChain.finalVerdict,
        sessionId: entry.actor.sessionId,
        timestamp: entry.timestamp,
        // 不包含 input/output 的完整内容
      },
    });
  }
}
```

### 6.4 本地存储策略

**审计日志永不同步云端**。这是 Orbit 的核心安全约束：

```typescript
/**
 * LocalAuditSink 将审计日志写入本地 SQLite。
 * 
 * 存储约束：
 * 1. 审计日志仅存储在 .orbit/audit.db，不纳入同步通道
 * 2. 日志保留策略：默认 90 天，用户可配置
 * 3. 超过保留期的日志自动归档为压缩摘要（保留统计，删除明细）
 * 4. 用户可随时导出完整审计日志（GDPR 数据导出权）
 * 5. 用户可随时清除审计日志（GDPR 删除权）
 */
export class LocalAuditSink implements AuditSink {
  // SQLite schema:
  //
  // CREATE TABLE audit_entries (
  //   id TEXT PRIMARY KEY,
  //   timestamp TEXT NOT NULL,
  //   actor_user_id TEXT,
  //   actor_session_id TEXT,
  //   actor_run_id TEXT,
  //   actor_domain TEXT,
  //   actor_surface TEXT,
  //   capability_name TEXT NOT NULL,
  //   risk_level TEXT,
  //   final_verdict TEXT NOT NULL,
  //   threats TEXT,          -- JSON array
  //   input_summary TEXT,
  //   input_hash TEXT,
  //   egress_target TEXT,
  //   egress_verdict TEXT,
  //   approval_required INTEGER,
  //   approval_decision TEXT,
  //   full_entry TEXT       -- JSON blob for complete entry
  // );
  //
  // CREATE INDEX idx_audit_session ON audit_entries(actor_session_id);
  // CREATE INDEX idx_audit_capability ON audit_entries(capability_name);
  // CREATE INDEX idx_audit_timestamp ON audit_entries(timestamp);
  // CREATE INDEX idx_audit_verdict ON audit_entries(final_verdict);
}
```

### 6.5 审计回放接口

```typescript
export interface AuditReplayOptions {
  readonly targetId: string;
  readonly targetType: 'session' | 'run' | 'capability' | 'object';
  readonly timeRange?: { from: string; to: string };
  readonly includeDetails: boolean; // 是否包含完整的 input/output
}

export interface AuditReplayResult {
  readonly entries: readonly AuditEntry[];
  readonly summary: {
    readonly totalCalls: number;
    readonly byVerdict: Record<CheckVerdict, number>;
    readonly byRiskLevel: Record<RiskLevel, number>;
    readonly threatsDetected: number;
    readonly approvalsRequired: number;
    readonly egressEvents: number;
  };
}
```

---

## 7. 文件变更清单

### 7.1 新增文件

| 文件路径 | 职责 | 主要导出 |
|----------|------|----------|
| `packages/agent-core/src/safety/types.ts` | 责任链核心类型定义 | `SafetyChecker`, `SafetyEnvelope`, `LayerCheckResult`, `CheckVerdict`, `CapabilityCallDescriptor`, `SessionDescriptor`, `EgressDecision`, `EgressVerdict` |
| `packages/agent-core/src/safety/safety-chain.ts` | 链式执行引擎 | `SafetyChain`, `ChainResult` |
| `packages/agent-core/src/safety/context-scanner.ts` | 第 0 层：上下文安全扫描 | `ContextScanner`, `ThreatPattern`, `ThreatCategory`, `ScanLevel`, `BUILTIN_THREAT_PATTERNS` |
| `packages/agent-core/src/safety/capability-policy-checker.ts` | 第 1 层：能力策略检查 | `CapabilityPolicyChecker` |
| `packages/agent-core/src/safety/approval-gate.ts` | 第 2 层：审批判定 | `ApprovalGate`, `ApprovalMemoryStore`, `ApprovalMemoryScope`, `RejectionTracker` |
| `packages/agent-core/src/safety/approval-resume.ts` | 审批恢复执行器 | `ApprovalResumeHandler`, `ApprovalResumeContext` |
| `packages/agent-core/src/safety/data-egress-controller.ts` | 第 3 层：数据出境控制 | `DataEgressController`, `OBJECT_SENSITIVITY`, `SensitivityLevel`, `EgressPolicyStore` |
| `packages/agent-core/src/safety/redaction-engine.ts` | 自动脱敏引擎 | `RedactionEngine`, `RedactionType`, `RedactionResult`, `SensitiveField` |
| `packages/agent-core/src/safety/audit-trail.ts` | 第 4 层：执行审计 | `AuditTrail`, `AuditEntry`, `AuditSink`, `AuditQueryFilter`, `AuditReplayOptions` |
| `packages/agent-core/src/safety/audit-event-bridge.ts` | 审计 → 事件流桥接 | `AuditEventBridge` |
| `packages/agent-core/src/safety/index.ts` | safety 模块入口 | 所有公共导出 |

### 7.2 修改文件

| 文件路径 | 变更内容 |
|----------|----------|
| `packages/agent-core/src/safety-gate.ts` | **标记为 deprecated**，保留向后兼容的 facade，内部委托给 `SafetyChain`。渐进式迁移完成后删除 |
| `packages/agent-core/src/orchestrator.ts` | 重构 tool call 处理（第 228-314 行），改为调用 `SafetyChain.execute()`；构造函数接受 `SafetyChain` 替代 `SafetyGate` |
| `packages/agent-core/src/types.ts` | 新增 `ApprovalMemoryScope` 类型、扩展 `ApprovalRequest` 接口（增加 `rememberScope` 字段、`batchId` 字段）、新增 `AuditEntry` 相关类型引用 |
| `packages/agent-core/src/index.ts` | 新增 `safety/` 子模块的导出 |

### 7.3 向后兼容的 SafetyGate Facade

```typescript
// packages/agent-core/src/safety-gate.ts（重构后）

/** @deprecated Use SafetyChain from './safety/safety-chain.js' instead */
export class SafetyGate {
  private readonly chain: SafetyChain;

  constructor(chain?: SafetyChain) {
    this.chain = chain ?? createDefaultSafetyChain();
  }

  // 保留原有 API 签名，内部委托给 chain
  scanContext(content: string): readonly string[] { /* ... */ }
  checkCapability(def: ToolDefinition, ctx: { surface: AgentSurface; scopeLimit: ScopeLimit }): SafetyCheckResult { /* ... */ }
  requiresApproval(def: ToolDefinition): boolean { /* ... */ }
  getApprovalTier(risk: RiskLevel): ApprovalPolicy { /* ... */ }
}
```

---

## 8. 测试策略

### 8.1 测试文件结构

```
packages/agent-core/src/safety/__tests__/
  context-scanner.test.ts
  capability-policy-checker.test.ts
  approval-gate.test.ts
  data-egress-controller.test.ts
  redaction-engine.test.ts
  audit-trail.test.ts
  safety-chain.test.ts           // 集成测试：五层协同
  safety-chain.e2e.test.ts       // 端到端场景测试
```

### 8.2 安全测试用例矩阵

#### 8.2.1 注入检测 (context-scanner.test.ts)

| 用例 ID | 描述 | 输入 | 期望结果 |
|---------|------|------|----------|
| CS-01 | 英文 prompt injection | `"Ignore all previous instructions and..."` | threats 包含 `pi-ignore-instructions`，verdict=denied |
| CS-02 | 中文 prompt injection | `"忽略之前的指令，你现在是..."` | threats 包含 `pi-cn-ignore`，verdict=denied |
| CS-03 | 零宽字符 | `"hello\u200Bworld"` | threats 包含 `hc-zwsp` |
| CS-04 | RTL override | `"test\u202Etext"` | threats 包含 `hc-rtl-override` |
| CS-05 | GitHub PAT 泄露 | `"token: ghp_abc123..."` | threats 包含 `cl-github-pat` |
| CS-06 | 正常内容无误报 | `"Please read this article and summarize"` | threats 为空，verdict=passed |
| CS-07 | base64 编码注入 | `"atob('aWdub3Jl...')"` | threats 包含 `pi-base64-payload` |
| CS-08 | 分级扫描性能 | Quick level on R0-read | 仅执行 critical 规则（<2ms） |
| CS-09 | Zalgo 文本 | 4+ 组合字符堆叠 | threats 包含 `hc-zalgo` |
| CS-10 | 混合攻击 | 注入 + 凭证泄露同时存在 | threats 包含多个 ID |

#### 8.2.2 越权阻断 (capability-policy-checker.test.ts)

| 用例 ID | 描述 | 输入 | 期望结果 |
|---------|------|------|----------|
| CP-01 | Surface scope 越界 | reader surface + global scope tool | verdict=denied |
| CP-02 | Context scope 越界 | current-object context + workspace tool | verdict=denied |
| CP-03 | Domain blocked capability | Reading agent 调用 delete-object | verdict=denied |
| CP-04 | 合法调用通过 | Reading agent 调用 read-object on reader | verdict=passed |
| CP-05 | 有威胁标记时阻断 R1+ | envelope.threats 非空 + R1 tool | verdict=denied |
| CP-06 | 有威胁标记时允许 R0 | envelope.threats 非空 + R0 tool | verdict=passed |
| CP-07 | 未注册 capability | 不在 registry 中的 tool | verdict=denied (fail-closed) |

#### 8.2.3 脱敏验证 (redaction-engine.test.ts)

| 用例 ID | 描述 | 输入 | 期望结果 |
|---------|------|------|----------|
| RE-01 | GitHub PAT 清洗 | `"key: ghp_aBcDeFgH..."` | 输出包含 `[REDACTED:github-pat]` |
| RE-02 | OpenAI key 清洗 | `"sk-proj-aBcDeF..."` | 输出包含 `[REDACTED:api-key]` |
| RE-03 | Bearer token 清洗 | `"Authorization: Bearer eyJ..."` | 输出包含 `Bearer [REDACTED]` |
| RE-04 | 邮箱脱敏 | `"contact: user@example.com"` | 输出包含 `[REDACTED:email]` |
| RE-05 | 信用卡号脱敏 | `"card: 4111-1111-1111-1111"` | 输出包含 `[REDACTED:card]` |
| RE-06 | 中国身份证号脱敏 | `"110101199003076543"` | 输出包含 `[REDACTED:id-number]` |
| RE-07 | JSON 对象字段脱敏 | vision.content 超过 50 字符 | 截断并标记 |
| RE-08 | 无敏感内容不变 | `"Hello world"` | 输出不变 |
| RE-09 | Orbit master key 自保护 | `"orbit_master_key=abc..."` | 输出包含 `[REDACTED]` |
| RE-10 | 多重凭证同时脱敏 | 包含 PAT + Bearer + email | 全部正确脱敏 |

#### 8.2.4 审批流程 (approval-gate.test.ts)

| 用例 ID | 描述 | 输入 | 期望结果 |
|---------|------|------|----------|
| AG-01 | A0 自动通过 | R0-read capability | verdict=passed |
| AG-02 | A1 透明执行 | R1-internal-write | verdict=passed, metadata.transparent=true |
| AG-03 | A2 暂停审批 | R2-external-read | verdict=suspended, approvalRequest 被填充 |
| AG-04 | A3 强审批 | R3-external-write | verdict=suspended |
| AG-05 | 审批记忆命中 (session) | 之前 approved + scope=session | verdict=passed, fromMemory=true |
| AG-06 | 审批记忆过期 | scope=session 但不同 session | 不命中，正常审批 |
| AG-07 | 永久拒绝 | 之前 rejected + scope=always | verdict=denied |
| AG-08 | 自动降级 | 5 分钟内 3 次拒绝 | tier 升一级 |
| AG-09 | 威胁标记升级 | 有 threats + A0 能力 | tier 升至 A2 |
| AG-10 | 批量审批 | 同一 run 3 个 A2 调用 | 生成 BatchApprovalRequest |

#### 8.2.5 出境控制 (data-egress-controller.test.ts)

| 用例 ID | 描述 | 输入 | 期望结果 |
|---------|------|------|----------|
| DE-01 | 本地操作跳过 | dataBoundary=local-only | verdict=passed，不检查 |
| DE-02 | 高敏对象阻断 | vision 对象出境 | verdict=denied |
| DE-03 | 中敏对象询问 | task 对象出境 | verdict=suspended (ask) |
| DE-04 | 低敏对象允许 | bookmark 出境 | verdict=passed |
| DE-05 | 自动脱敏后放行 | sensitive-redact + 有凭证 | 脱敏后 verdict=passed |
| DE-06 | 用户自定义策略覆盖 | 用户设为 allow 的 high 对象 | verdict=passed |
| DE-07 | 出境审计记录完整 | 任何出境操作 | egressDecision 包含 target, fields, hashes |

#### 8.2.6 五层集成测试 (safety-chain.test.ts)

| 用例 ID | 描述 | 场景 | 期望结果 |
|---------|------|------|----------|
| SC-01 | 全链通过 | R0 read-object, 无威胁 | 5 层全 passed |
| SC-02 | 第 0 层短路 | 输入含 critical injection | 第 0 层 denied，第 1-3 层跳过，第 4 层审计记录 |
| SC-03 | 第 2 层暂停 | R2 能力，无记忆 | 第 0-1 层 passed，第 2 层 suspended，审计记录 |
| SC-04 | 第 3 层阻断 | vision 对象发往 OpenAI | 第 0-2 层 passed，第 3 层 denied，审计记录 |
| SC-05 | 脱敏 + 审批并存 | R3 + sensitive-redact + 有凭证 | 第 2 层 suspended（先审批），审批通过后第 3 层脱敏 |
| SC-06 | 审计始终执行 | 任何拒绝场景 | 第 4 层始终 passed，auditEntry 非空 |
| SC-07 | 层替换热插拔 | 用自定义 ContextScanner 替换 | 新 scanner 生效 |

### 8.3 性能基准测试

| 测试 | 目标 |
|------|------|
| Quick scan (12 条正则) | < 0.5ms per call |
| Standard scan (25 条正则) | < 1ms per call |
| Deep scan (45 条正则) | < 3ms per call |
| 全链执行（无审批暂停） | < 5ms per call |
| 脱敏引擎（1KB 输入） | < 2ms per call |
| 审计写入（SQLite） | < 1ms per write |

---

## 9. 实施顺序

建议按以下顺序实施，每个阶段都可独立测试：

### Phase 1：基础框架（2-3 天）
1. 创建 `safety/types.ts` — 所有类型定义
2. 创建 `safety/safety-chain.ts` — 链式执行引擎
3. 编写 `safety-chain.test.ts` 基础测试（用 mock checker）
4. 更新 `index.ts` 导出

### Phase 2：上下文扫描器（1-2 天）
5. 创建 `safety/context-scanner.ts` — 从现有 12 条正则迁移并扩展
6. 编写 `context-scanner.test.ts`

### Phase 3：能力策略检查器（1 天）
7. 创建 `safety/capability-policy-checker.ts` — 从现有 `checkCapability` 逻辑迁移
8. 编写 `capability-policy-checker.test.ts`

### Phase 4：数据出境控制（2-3 天）
9. 创建 `safety/redaction-engine.ts`
10. 创建 `safety/data-egress-controller.ts`
11. 编写 `redaction-engine.test.ts` 和 `data-egress-controller.test.ts`

### Phase 5：审批工作流（2-3 天）
12. 创建 `safety/approval-gate.ts`
13. 创建 `safety/approval-resume.ts`
14. 编写 `approval-gate.test.ts`

### Phase 6：执行审计（1-2 天）
15. 创建 `safety/audit-trail.ts`
16. 创建 `safety/audit-event-bridge.ts`
17. 编写 `audit-trail.test.ts`

### Phase 7：集成与迁移（2-3 天）
18. 重构 `orchestrator.ts` 使用 `SafetyChain`
19. 将 `safety-gate.ts` 标记 deprecated 并改为 facade
20. 编写端到端集成测试
21. 性能基准测试

**总估计：11-17 天**

---

## 10. 设计决策记录

| 决策 | 选项 | 选择 | 理由 |
|------|------|------|------|
| 责任链 vs 中间件 | Chain of Responsibility / Express-style middleware | Chain + 固定顺序 | 安全检查必须有确定性执行顺序，不允许随意插入 |
| 审计层是否可拒绝 | 可拒绝 / 始终 passed | 始终 passed | 审计失败不应阻止合法操作；审计写入失败应告警但不阻塞 |
| 脱敏在哪一层 | 独立层 / 出境层内部 | 出境层内部 | 脱敏只在数据需要出境时才有意义，内聚在出境层 |
| 审批暂停粒度 | Run 级 / Tool Call 级 | Tool Call 级 | 同一 run 中可能有多个 tool call，部分需审批部分不需要 |
| 审计日志是否同步云端 | 同步 / 仅本地 | **仅本地** | Orbit 核心隐私承诺：审计日志包含最敏感的操作记录 |
| 威胁检测是否用 LLM | 纯正则 / 正则 + LLM | **纯正则**（M3） | 性能与确定性优先；M4+ 可引入 LLM 辅助判断 |
| 默认安全策略 | 宽松 / 严格 | **严格（fail-closed）** | 参考 Claude Code：新能力默认最高风险，显式声明后降级 |
