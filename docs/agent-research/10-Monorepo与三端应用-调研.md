# 10-Monorepo与三端应用：Hermes / Claude Code 调研报告

> **调研目标**：从 Hermes Agent 与 Claude Code 两个成熟 AI Agent 项目中，提取在**代码组织、模块化、多平台适配**方面对 Orbit「Monorepo 与三端应用」设计方案的可借鉴经验，识别不适用的设计，并给出具体建议。

---

## 1. Orbit 设计方案摘要

Orbit 的第 10 号设计专题《Monorepo 与三端应用》提出了一套**一套领域核心 + 两套表现层家族 + 三个客户端宿主 + 一个服务宿主**的整体架构。核心设计判断包括：

- **桌面端保留 Electron**，承担深度工作主场（文件系统、长任务、富编辑器、系统集成）。
- **Web 与 Desktop 高复用**，共享同一个 DOM App Shell（React Router、ui-dom、editor-dom、feature-workbench），仅在 Host API、权限能力、分发方式上分叉。
- **iOS 复用"脑"不复用"桌面身体"**，共享对象模型、状态机、数据协议、Agent 能力内核、设计 token 与文案，但 UI 采用原生化表达（ui-native）。
- **服务端进入 monorepo 参与契约治理**，但保持独立部署。API DTO、错误码、通知事件在 `api-types` 中同源定义。

目录结构按**共享稳定性**分五层：领域层（纯 TypeScript，无平台依赖）→ 协议层 → 表现层 → 运行时适配层 → 应用层。所有平台差异通过 `platform-contracts` + adapter 模式注入，禁止在领域层出现 if-else 平台判断。

构建使用 pnpm workspace + Turborepo + TypeScript project references；测试覆盖合约测试、组件测试、adapter contract tests；发布按 Desktop（Electron Forge）/ Web（持续部署）/ iOS（Expo EAS）/ Server（容器化）各自独立节奏。

总体来说，这是一个**高度结构化、契约驱动、以领域核心为不变量**的多端架构设计。接下来我们从 Hermes 和 Claude Code 两个项目中寻找支撑或补充该方案的实践经验。

---

## 2. Hermes 可借鉴之处

### 2.1 Gateway 架构：多渠道接入的平台适配器模式

Hermes 最独特的架构贡献是其 **Gateway 多平台适配层**。它通过 `BasePlatformAdapter` 抽象类统一了 16+ 消息平台（Telegram、Discord、WhatsApp、Slack、企业微信、钉钉、飞书等）的接入方式。每个平台适配器只需实现消息收发、会话管理与平台特定能力，核心 Agent 逻辑完全不感知运行在哪个平台上。

这与 Orbit 的 `platform-contracts` 设计理念高度一致。Orbit 定义了 `WorkspacePort`、`DatabasePort`、`SyncPort`、`CapabilityHostPort` 等接口，由 Electron / Browser / iOS 各自实现。Hermes 的 Gateway 模式验证了这种"契约 + 适配器"架构在多平台场景下的实际可行性——即使平台差异很大（从 Telegram Bot API 到 WeChat Work Webhook），只要抽象层设计合理，核心逻辑可以完全复用。

**启发**：Hermes 的平台适配器还包含代理检测（自动检测 macOS 系统代理、SOCKS 穿越）、会话状态管理（`_active_sessions`、`_pending_messages`）、后台任务集（`_background_tasks`）等通用基础设施。Orbit 的 `platform-contracts` 也应考虑在接口中定义生命周期钩子（初始化、暂停、恢复、销毁）和网络感知能力，而不仅仅是功能性端口。

### 2.2 命令注册表：单一事实来源驱动多端行为

Hermes 的命令系统采用集中式 `COMMAND_REGISTRY`，一个 `CommandDef` 数据结构同时驱动 CLI 处理器、Gateway 分发器、帮助系统、Tab 补全和各消息平台菜单。每个命令通过 `cli_only` / `gateway_only` 标志声明其平台可用性。

这个模式对 Orbit 的 Agent 能力跨端管理有直接参考价值。Orbit 设计方案中 `ToolManifest` 已经包含了 `platformAvailability: ('desktop' | 'web' | 'ios')[]` 字段，与 Hermes 的做法异曲同工。但 Hermes 的实践进一步证明：**把命令/能力注册表做成单一事实来源**可以显著降低多平台维护成本。同一份 manifest 不仅驱动运行时，还能自动生成帮助文档、补全提示、权限检查规则。

### 2.3 工具集按安全级别分区的并发执行策略

Hermes 将工具分为 `_PARALLEL_SAFE_TOOLS`（只读安全工具，可并行）和 `_PATH_SCOPED_TOOLS`（路径作用域工具，路径不重叠时可并行），使用 `ThreadPoolExecutor`（最多 8 worker）并发执行。这种**基于工具安全属性的并发决策**模式对 Orbit 的三端 Agent 工具编排有参考价值。

桌面端能力强、可以更激进地并行执行；Web 端受限于浏览器沙箱，需要更保守；iOS 端受后台限制，需要最谨慎。Orbit 可以在 `ToolManifest` 中增加 `concurrencySafety` 元数据（如 `readonly` / `path-scoped` / `exclusive`），让 Agent 运行时根据平台和工具安全性自动决定并发策略。

### 2.4 YAML 驱动的配置与皮肤系统

Hermes 的配置采用 YAML 文件 + 环境变量层级叠加，皮肤系统通过 `SkinConfig` 数据结构定义颜色、图标、品牌、Spinner 等视觉元素，支持用户自定义覆盖内置主题。这种数据驱动的主题机制对 Orbit 的 `ui-tokens` 包有启发：token 不仅可以是代码中的常量，也可以支持运行时从配置文件注入，为未来的插件化主题或企业定制留出空间。

---

## 3. Claude Code 可借鉴之处

### 3.1 深层模块化架构：目录即模块，关注点彻底分离

Claude Code 的代码组织是本次调研中最值得 Orbit 借鉴的实践。它拥有约 1884 个 TypeScript/TSX 文件，采用**深层模块化 + 关注点分离**：

- 每个工具一个独立目录（如 `tools/BashTool/`），内含实现、测试、类型定义
- 100+ React 组件，80+ Hooks，清晰的四层架构（表现层 → 协调层 → 服务层 → 工具层 → 状态层 → 基础设施层）
- 核心循环代码约 1700 行（`query.ts`）+ 900 行（`QueryEngine.ts`），对比 Hermes 的单体 7500 行 `run_agent.py`

这直接验证了 Orbit 的分包策略。Orbit 规划了约 25+ 个包（domain、object-graph、data-protocol、sync-core、agent-core 等），每个包有明确职责边界和依赖规则。Claude Code 证明在 TypeScript 生态中，这种"目录即模块"的深层模块化不仅可行，而且随着代码量增长（1884 个文件），仍然能保持结构清晰。

**关键启发**：Claude Code 的工具目录模式（`tools/BashTool/index.ts + BashTool.test.ts + types.ts`）应直接应用于 Orbit 的 `agent-core` 和 `capability-core`。每个 MCP 工具或内置能力应该是一个自包含的目录，而不是散落在各处的函数。

### 3.2 异步生成器管道：流式架构的最佳范式

Claude Code 的核心循环采用 `async generator` 管道模式：

```
QueryEngine.submitMessage() → query() → queryLoop() → runTools() → tool.call()
```

每一层通过 `yield` 流式传递事件，上层消费者通过 `for await...of` 逐步处理。这种架构天然支持背压控制、流式 UI 更新和取消传播（`AbortController`）。

对 Orbit 而言，Agent 对话、同步事件流、索引进度、转写结果等许多场景都是流式的。Claude Code 的管道模式证明，在 TypeScript 中用 `AsyncGenerator` 可以优雅地统一这些流式数据路径。Orbit 的 `agent-core` 应该以 async generator 为核心抽象，而不是回调函数，这样在三端都能以一致的方式消费 Agent 事件流。

### 3.3 分层入口与启动性能优化

Claude Code 极度注重启动性能。它在 `cli.tsx` 中实现了零加载快速路径（`--version` 直接返回），所有 import 均为动态异步导入，使用 `memoize` 确保初始化幂等，并通过 `profileCheckpoint` 追踪每个启动阶段的耗时（从 0ms 到首次 API 调用约 200ms）。

Orbit 的桌面端需要长驻运行，启动性能尤为重要。Claude Code 的实践建议 Orbit 的 Electron 应用也应实现：
- **分层启动**：先渲染壳（窗口、菜单），再异步初始化数据库、同步引擎、Agent 运行时
- **动态导入**：feature-workbench 中的各功能模块（Reader、Writing、Research）应按需加载
- **性能追踪**：在关键路径植入 checkpoint，量化启动回归

### 3.4 SDK 模式与多 I/O 后端

Claude Code 不仅是 CLI 工具，还通过 `QueryEngine` 暴露 SDK 接口，支持三种 I/O 后端：Terminal I/O（直接终端）、StructuredIO（JSON schema，给 IDE 插件用）、RemoteIO（WebSocket/SSE 远程执行）。这种**核心引擎 + 多 I/O 后端**的分层设计与 Orbit 的"领域核心 + 多宿主"理念完全一致。

Orbit 的 `agent-core` 也应该暴露类似的纯逻辑 SDK 层。这样桌面端的 Electron main 进程、Web 端的 Service Worker、iOS 端的 React Native bridge 都能以最适合自己的 I/O 方式消费同一个 Agent 引擎。Claude Code 的 `--output-format stream-json` 和 `--input-format stream-json` 机制表明，一个设计良好的 Agent 内核可以完全不关心自己运行在终端、IDE 还是远程服务器上。

### 3.5 React + Ink 终端 UI 引擎：组件化的验证

Claude Code 用 React + Ink + Yoga 布局引擎构建了完整的终端 UI 系统——100+ 组件、Vim 状态机、虚拟 DOM diff、Flexbox 布局、follow-scroll 智能跟踪、设计系统组件库（Dialog、Tabs、ThemedBox、ProgressBar 等）。虽然 Orbit 不需要终端 UI，但这个实践验证了**React 组件模型可以驱动非浏览器渲染目标**。

这对 Orbit 的 `ui-native`（React Native）策略有启发意义：如果 React 组件模型连终端都能驱动，那么在 React Native 场景下，只要 view model 和交互逻辑抽象正确（放在 `app-viewmodels`），iOS 端的组件实现可以充分利用 React 的组合模型，而不需要完全抛弃桌面端积累的交互模式。

### 3.6 特性门控与条件加载

Claude Code 大量使用 `feature()` 函数门控功能模块的加载：

```typescript
const voiceCommand = feature('VOICE_MODE')
  ? require('./commands/voice/index.js').default
  : null
```

这对 Orbit 的三端能力管理非常实用。三端的能力集不同（桌面完整、Web 受限、iOS 移动优先），可以通过统一的特性标记系统控制模块加载和功能可见性。这比在代码中 `if (platform === 'ios')` 更优雅，也更容易做灰度发布和 A/B 测试。

---

## 4. 不适用的设计

### 4.1 Hermes 的单体核心文件模式（不适用）

Hermes 的 `run_agent.py` 约 7500 行，`AIAgent` 类构造函数接受 53 个参数，集中了几乎所有核心逻辑。这种"一个类统治一切"的模式在项目快速迭代期可以减少跨文件协调成本，但随着代码量增长已经显现出维护困难。Orbit 的 25+ 包分层方案明确拒绝了这种模式，这个决策是正确的。

### 4.2 Hermes 的多模型通用适配层（不适用于 Monorepo 架构层面）

Hermes 支持 10+ LLM 提供商（OpenAI、Anthropic、Google、Mistral、Ollama 等），这需要复杂的适配器层和兼容性处理（如处理 Ollama 的 index 0 重用问题）。Orbit 的 Agent 方案更聚焦，不需要在 monorepo 架构层面为多模型兼容性投入结构成本。LLM 适配如果需要，应该封装在 `agent-core` 内部，不外溢到其他包。

### 4.3 Claude Code 的 Anthropic 深度绑定（不适用）

Claude Code 与 Anthropic API 深度绑定，利用 prompt caching、extended thinking 等专有特性优化体验。这种单一供应商锁定策略不符合 Orbit 的产品定位——Orbit 是认知工作台而非某家 AI 厂商的终端工具。`agent-core` 应该通过抽象接口封装 LLM 调用，保持供应商中立。

### 4.4 Claude Code 的自研终端渲染引擎（不适用）

Claude Code 投入巨大工程量构建了 Ink 终端渲染引擎（Yoga 布局、虚拟 DOM、React Concurrent Mode）。这是终端 CLI 场景的合理投入，但 Orbit 的三端都有更成熟的渲染方案——桌面/Web 用标准 React DOM + TipTap 编辑器，iOS 用 React Native。自研渲染引擎的 ROI 不合理。

### 4.5 Hermes 的 16 平台消息网关（不适用）

Hermes 的 Gateway 支持 Telegram、Discord、WhatsApp 等 16+ 消息平台。Orbit 是一个产品级工作台，不是 AI Agent 聚合器，不需要把自身投射到各种消息平台上。但其 `BasePlatformAdapter` 的抽象模式（如前所述）仍然有参考价值。

### 4.6 Hermes 的同步/异步桥接层（不适用）

由于 Python 的同步主循环与异步 Gateway 共存，Hermes 需要复杂的 `_run_async()` 桥接层（每个线程维护持久事件循环、运行中循环检测等）。Orbit 全面采用 TypeScript，可以原生 async/await，不需要这层桥接复杂度。

---

## 5. 具体建议

### 建议一：为 `platform-contracts` 增加生命周期与网络感知接口

**来源**：Hermes Gateway 的 `BasePlatformAdapter` 设计

当前 Orbit 的 `platform-contracts` 聚焦于功能性接口（WorkspacePort、DatabasePort 等）。建议增加：

```typescript
interface PlatformLifecyclePort {
  onActivate(): Promise<void>;
  onDeactivate(): Promise<void>;
  onLowMemory(): Promise<void>;
  getNetworkStatus(): NetworkStatus;
  onNetworkChange(callback: (status: NetworkStatus) => void): Disposable;
}
```

这在三端的差异巨大：Electron 几乎常驻前台；Web 有 Page Visibility API 和 Service Worker 生命周期；iOS 有严格的后台限制和网络状态变化。如果不在契约层定义这些语义，各端会各自发明一套生命周期管理，最终导致同步引擎、Agent 运行时在不同端的行为不一致。

### 建议二：agent-core 采用 AsyncGenerator 管道模式作为核心抽象

**来源**：Claude Code 的 `query()` → `queryLoop()` → `runTools()` 异步生成器管道

Orbit 的 Agent 对话、工具执行结果、同步事件、索引进度等都是流式数据。建议 `agent-core` 的核心接口以 `AsyncGenerator` 为统一抽象：

```typescript
// agent-core 核心接口
async function* runAgent(
  input: AgentInput,
  capabilities: CapabilityHostPort,
  signal: AbortSignal,
): AsyncGenerator<AgentEvent> {
  // yield planning events
  // yield tool execution events  
  // yield completion events
}
```

三端消费同一个 generator：桌面端渲染完整的 Agent 面板，Web 端流式更新消息列表，iOS 端显示精简的进度通知。这种模式天然支持背压（消费端处理不过来时，generator 会暂停），也天然支持取消（通过 `AbortSignal`）。Claude Code 的实践证明这种模式在千行级别的复杂 Agent 循环中仍然清晰可维护。

### 建议三：工具 / 能力目录模式——每个能力一个自包含目录

**来源**：Claude Code 的 `tools/BashTool/`、`tools/FileEditTool/` 目录模式

Orbit 的 `capability-core` 和 `agent-core` 中的每个工具/能力应采用目录模式：

```
packages/capability-core/
  capabilities/
    file-capture/
      index.ts          # 能力定义与实现
      manifest.ts       # ToolManifest（含 platformAvailability、concurrencySafety）
      types.ts          # 输入输出类型
      file-capture.test.ts
    web-search/
      ...
    voice-transcribe/
      ...
```

这样每个能力是自包含的，可以独立测试、按平台条件加载、在 CI 中按影响范围触发。Claude Code 在 1884 个文件的规模下维持了这种模式的一致性，证明它可以伴随项目规模线性增长。

### 建议四：引入统一特性标记系统替代平台 if-else

**来源**：Claude Code 的 `feature()` 门控机制

Orbit 应该建立一个跨三端 + 服务端的统一特性标记系统：

```typescript
// packages/tooling/feature-flags.ts
export function feature(flag: FeatureFlag): boolean;

// 使用方式
if (feature('VOICE_INPUT')) {
  // 加载语音输入模块
}
if (feature('ADVANCED_AGENT_TOOLS')) {
  // 加载高级 Agent 工具集
}
```

特性标记的来源可以是：编译时常量（区分平台）、运行时配置（灰度发布）、远程控制（feature flag 服务）。这比在代码中硬编码 `platform === 'ios'` 更灵活，也更容易做跨端 A/B 测试。Claude Code 通过这种方式控制语音模式、新 UI 等实验性功能的加载，在不影响主流程稳定性的前提下快速迭代。

### 建议五：为共享包建立合约测试矩阵，验证跨端行为一致性

**来源**：综合 Hermes 的多平台适配经验 + Claude Code 的分层测试实践

Orbit 设计方案已经提到了 contract tests，但建议进一步系统化：

1. **平台适配器合约测试**：`platform-contracts` 定义的每个接口应有一套平台无关的合约测试套件。每个平台适配器（platform-electron、platform-web、platform-ios）运行同一套合约测试，确保接口语义一致。这类似于 Hermes 的多平台适配器都要通过统一消息收发测试的做法。

2. **API 契约测试**：`api-types` 中定义的每个 DTO、错误码、通知事件都应有 schema 验证测试。服务端和客户端各自生成/消费同一份 schema 并验证兼容性。

3. **版本兼容矩阵测试**：sync protocol、tool manifest、server API 的版本升级必须通过向后兼容测试。Orbit 设计方案提到了"显式版本号与兼容矩阵"，建议在 CI 中用旧版本 payload 跑新版本解析器，确保不会因为某次升级破坏跨端同步。

---

## 6. 总结

Hermes 和 Claude Code 代表了两种截然不同的架构哲学——Hermes 是"广度优先的开放平原"，Claude Code 是"深度优先的精心花园"。Orbit 的三端 Monorepo 方案需要从两者中各取所长：

**从 Hermes 学习的是"如何在多平台差异巨大时保持核心逻辑统一"**。Hermes 用一份 Agent 代码驱动 16 个消息平台，靠的是严格的平台适配器抽象和集中式能力注册表。这与 Orbit 的 `platform-contracts` + `ToolManifest` 设计方向一致，但 Hermes 的实践提醒我们：适配器不仅要覆盖功能接口，还要覆盖生命周期、网络感知和并发安全等横切关注点。

**从 Claude Code 学习的是"如何在大规模 TypeScript 项目中保持模块化和流式架构的一致性"**。Claude Code 用 1884 个文件、async generator 管道、目录级模块、特性门控等实践证明了 Orbit 所规划的"25+ 包 × 五层分割"架构在 TypeScript 生态中是完全可行的。特别是 async generator 管道模式和自包含工具目录模式，应该成为 Orbit `agent-core` 和 `capability-core` 的核心代码组织范式。

**需要避免的是两者各自的极端**：不学 Hermes 的单体核心文件和同步/异步桥接复杂度，也不学 Claude Code 的供应商锁定和自研渲染引擎。Orbit 的独特价值在于——它既不是通用 AI Agent 平台，也不是某个 AI 厂商的终端工具，而是一个以对象网络为核心、以本地优先为基础、以跨端一致为目标的认知工作台。Monorepo 架构的设计应始终服务于这个定位：让领域核心稳定不变，让平台差异被契约吸收，让三端用户在切换设备时切换的是交互密度，而不是切换"另一个 Orbit"。
