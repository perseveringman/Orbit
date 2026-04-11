# 对话 UI 复刻 Claude Code 交互模型 — 设计规格

> **日期**: 2026-04-11
> **状态**: Draft
> **涉及包**: `@orbit/conversation-ui` (新建), `@orbit/agent-core` (扩展), `apps/desktop`, `apps/web`

---

## 1. 问题陈述

当前 Orbit Agent Hub 的 ChatPage 是一个 237 行的简单气泡 UI，仅支持用户/助手两种角色的文本消息，无流式输出、无工具调用展示、无分组折叠、无搜索。需要将其升级为一个完整的对话系统，复刻 Claude Code 的交互模型和信息架构，但使用 HeroUI v3 + Tailwind CSS 重新设计视觉。

### 复刻范围

从 Claude Code 源码分析得出的核心能力清单：

| 能力 | Claude Code 实现 | 本次复刻 |
|---|---|---|
| 消息类型分发 | `Message.tsx` switch 语句 → 30+ 组件 | `MessageRow.tsx` switch → 11 组件 |
| 流式文本渲染 | `streamingText` + 动画光标 | `useStreamingState` + 闪烁 `▊` 光标 |
| 工具调用卡片 | `AssistantToolUseMessage` + `ToolUseLoader` | HeroUI Card + Chip + Spinner |
| 分组折叠 | `GroupedToolUseContent` / `CollapsedReadSearchContent` | `GroupedToolUse` / `CollapsedReadSearch` |
| 思考块 | `AssistantThinkingMessage` 可折叠 | `ThinkingBlock` 可折叠 |
| 权限审批 | 内联权限请求 + 按钮 | `PermissionApproval` 横幅 |
| 对话搜索 | `warmSearchIndex` + 高亮匹配 | `useConversationSearch` hook |
| 输入区 | `PromptInput.tsx` 多行 + 历史 + 附件 | `PromptInput` 多行 + 历史 |
| 自动滚动 | sticky scroll + 手动滚动检测 | `useAutoScroll` hook |
| 键盘导航 | vim-like `j/k/G/g` + Ctrl+C 中断 | Enter/Shift+Enter/Ctrl+F/Ctrl+C/Esc |
| 虚拟滚动 | `VirtualMessageList.tsx` | 待定（消息量不大时可先不做） |

### 不在范围内

- vim 模式编辑 (vim keybindings)
- 语音输入 (voice recording waveform)
- IDE 集成 (@mentions, useIdeAtMentioned)
- 多 Agent 协同/teammate 视图
- 终端视觉风格复刻（使用 HeroUI 原生设计语言）
- i18n（初期硬编码中文，后续抽 key）

---

## 2. 架构方案

**方案 A: Flat Component Library**（已选定）

新建 `@orbit/conversation-ui` 包，包含消息类型、规范化管道、React 组件和 hooks。宿主（ChatPage）负责组装。

### 包结构

```
packages/conversation-ui/
  src/
    index.ts                         # barrel export
    types.ts                         # RenderableMessage 视图模型
    normalize.ts                     # AgentMessage[] → RenderableMessage[] 管道
    components/
      ConversationStream.tsx         # 消息流容器（自动滚动）
      ConversationHeader.tsx         # 头部：模型标签、搜索、设置
      MessageRow.tsx                 # 消息类型分发器
      messages/
        UserTextMessage.tsx          # 用户文本消息
        UserImageMessage.tsx         # 用户图片消息
        AssistantTextMessage.tsx     # 助手文本回复（Markdown 渲染）
        AssistantToolUseMessage.tsx  # 单个工具调用卡片
        ThinkingBlock.tsx            # 思考块（可折叠）
        GroupedToolUse.tsx           # 连续工具调用合并组
        CollapsedReadSearch.tsx      # Read/Search 折叠组
        SystemMessage.tsx            # 系统通知
        ErrorMessage.tsx             # 错误消息
        PermissionApproval.tsx       # 权限审批横幅
        StreamingMessage.tsx         # 流式渲染（光标 + 脉冲）
      input/
        PromptInput.tsx              # 输入区
        InputFooter.tsx              # 模型/token/模式指示器
      panels/
        SessionSidePanel.tsx         # 右侧面板容器
        SessionInfo.tsx              # 会话统计
        ToolCallTimeline.tsx         # 工具调用时间线
        PermissionStatus.tsx         # 权限状态
    hooks/
      useStreamingState.ts           # 封装 StreamingAccumulator
      useAutoScroll.ts               # 自动滚动 + "新消息" 按钮
      useConversationSearch.ts       # Ctrl+F 搜索
      useConversationHistory.ts      # ↑/↓ 历史导航
  tests/
    normalize.test.ts
    components/                      # 每组件一个测试
    hooks/
  package.json
  tsconfig.json
```

### 依赖

```json
{
  "dependencies": {
    "@heroui/react": "^3.0.2",
    "@heroui/styles": "^3.0.2",
    "@orbit/agent-core": "workspace:*",
    "react": "^19.2.5",
    "react-dom": "^19.2.5"
  },
  "devDependencies": {
    "tailwindcss": "^4.2.2",
    "@testing-library/react": "^16.x",
    "vitest": "^3.1.1",
    "typescript": "^5.8.3"
  }
}
```

---

## 3. 数据模型

### 3.1 核心类型（types.ts）

基于 `@orbit/agent-core` 的 `AgentMessage`，扩展为 UI 可渲染的视图模型：

```typescript
/** 消息渲染类型 */
export type RenderableMessageType =
  | 'user-text'
  | 'user-image'
  | 'assistant-text'
  | 'assistant-tool-use'
  | 'assistant-thinking'
  | 'grouped-tool-use'
  | 'collapsed-read-search'
  | 'system'
  | 'error'
  | 'permission-request'
  | 'streaming';

/** UI 可渲染消息 */
export interface RenderableMessage {
  readonly id: string;
  readonly type: RenderableMessageType;
  readonly timestamp: string;
  readonly content: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly toolCalls?: readonly RenderableToolCall[];
  readonly children?: readonly RenderableMessage[];
  readonly isCollapsed?: boolean;
  readonly isStreaming?: boolean;
}

/** 工具调用视图模型 */
export interface RenderableToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: Record<string, unknown>;
  readonly status: 'pending' | 'running' | 'success' | 'error';
  readonly result?: string;
  readonly durationMs?: number;
  readonly errorMessage?: string;
}

/** 工具类型分类（决定颜色编码） */
export type ToolCategory = 'read' | 'edit' | 'bash' | 'search' | 'other';

/**
 * UI 层流式状态 — 区别于 @orbit/agent-core 的 StreamingState。
 * useStreamingState hook 负责将 agent-core 的 Map<string, ToolCallState>
 * 转换为 RenderableToolCall[]，并提取 thinking 字段。
 */
export interface UIStreamingState {
  readonly content: string;
  readonly isStreaming: boolean;
  readonly toolCalls: readonly RenderableToolCall[];
  readonly thinking?: string;
  readonly lastUpdate: number;
}

/** 会话统计（右侧面板用） */
export interface SessionStats {
  readonly messageCount: number;
  readonly toolCallCount: number;
  readonly totalTokens: number;
  readonly estimatedCostUsd: number;
  readonly durationMs: number;
  readonly status: 'active' | 'paused' | 'completed' | 'failed';
}
```

### 3.2 规范化管道（normalize.ts）

将 `AgentMessage[]` 线性数组转换为 `RenderableMessage[]` 嵌套/分组结构：

```typescript
export function normalizeMessages(
  messages: readonly AgentMessage[],
  options?: NormalizeOptions
): readonly RenderableMessage[];

interface NormalizeOptions {
  /** 连续工具调用合并阈值，默认 2 */
  readonly groupThreshold?: number;
  /** 是否折叠连续 Read/Search，默认 true */
  readonly collapseReadSearch?: boolean;
}
```

**规范化规则**（复刻 Claude Code `normalizeMessages` 逻辑）：

1. **身份映射**：每条 `AgentMessage` 基本映射为一条 `RenderableMessage`
2. **思考提取**：assistant 消息的 `metadata.thinking` 字段 → 独立 `assistant-thinking` 消息。注意 `metadata` 在 agent-core 中是 `Record<string, unknown>`，`thinking` 字段是约定俗成的键名，由 provider 层在 Anthropic extended thinking 响应中填充。实现时应做类型守卫 `typeof metadata?.thinking === 'string'`。
3. **工具调用配对**：assistant 的 `toolCalls` + 后续 `role: 'tool'` 的结果 → 合并到 `RenderableToolCall.result`。注意 `AgentToolCall.arguments` 在 agent-core 中是 `string`（JSON 序列化），normalize 时需 `JSON.parse()` 转为 `Record<string, unknown>`。
4. **分组检测**：连续 ≥ `groupThreshold` 个工具调用（无中间文本）→ `grouped-tool-use` 容器
5. **Read/Search 折叠**：连续 Read/View/Grep/Glob 调用 → `collapsed-read-search` 容器
6. **流式注入**：`normalizeMessages` 本身不处理流式状态。`ConversationStream` 在渲染时将 `streamingState` prop 追加为一条 `streaming` 类型的 `RenderableMessage`，即流式消息注入发生在组件层而非 normalize 管道。

---

## 4. 组件设计

### 4.1 ConversationStream

消息流容器，负责渲染消息列表和自动滚动。

```typescript
interface ConversationStreamProps {
  readonly messages: readonly RenderableMessage[];
  readonly streamingState?: UIStreamingState;
  readonly searchQuery?: string;
  readonly onToggleCollapse?: (messageId: string) => void;
  readonly onApprove?: (approvalId: string) => void;
  readonly onReject?: (approvalId: string) => void;
}
```

- 使用 `useAutoScroll` hook 管理滚动行为
- 消息量 < 500 时直接 DOM 渲染，未来可升级虚拟滚动
- 搜索高亮通过 `searchQuery` prop 传递到每个 MessageRow

### 4.2 MessageRow — 类型分发器

复刻 Claude Code 的 `Message.tsx` switch 模式：

```typescript
function MessageRow({ message, searchQuery, onToggleCollapse, onApprove, onReject }: Props) {
  switch (message.type) {
    case 'user-text':             return <UserTextMessage ... />;
    case 'user-image':            return <UserImageMessage ... />;
    case 'assistant-text':        return <AssistantTextMessage ... />;
    case 'assistant-tool-use':    return <AssistantToolUseMessage ... />;
    case 'assistant-thinking':    return <ThinkingBlock ... />;
    case 'grouped-tool-use':      return <GroupedToolUse ... />;
    case 'collapsed-read-search': return <CollapsedReadSearch ... />;
    case 'system':                return <SystemMessage ... />;
    case 'error':                 return <ErrorMessage ... />;
    case 'permission-request':    return <PermissionApproval ... />;
    case 'streaming':             return <StreamingMessage ... />;
  }
}
```

### 4.3 消息组件

每个消息组件 < 200 行，使用 HeroUI 组件 + Tailwind 类：

| 组件 | HeroUI 组件 | 核心视觉 |
|---|---|---|
| `UserTextMessage` | — | 右对齐气泡，`bg-primary text-primary-foreground`，圆角 |
| `AssistantTextMessage` | — | 左对齐，`text-foreground`，avatar 标识，Markdown 渲染 |
| `AssistantToolUseMessage` | `Card`, `Chip` | 工具卡片，颜色标签区分工具类型，可展开 |
| `ThinkingBlock` | `Card` | 折叠卡片，`▶ 思考中… 1.2s`，展开显示内容 |
| `GroupedToolUse` | `Card` | 容器卡片包含 N 个子工具调用行 |
| `CollapsedReadSearch` | `Chip` | 单行 `"读取了 5 个文件"`，点击展开为列表 |
| `SystemMessage` | — | 左侧带竖线标记，`text-muted`，小号字体 |
| `ErrorMessage` | `Card` | 红色边框 Card，错误详情 + 重试按钮 |
| `PermissionApproval` | `Card`, `Button` | 黄色边框 Card，[允许] [拒绝] [始终允许] 按钮 |
| `StreamingMessage` | — | 同 AssistantTextMessage 但尾部追加闪烁 `▊` 光标 |

### 4.4 工具调用颜色编码

```typescript
export function getToolCategory(toolName: string): ToolCategory {
  if (['Read', 'View'].includes(toolName)) return 'read';
  if (['Edit', 'Write', 'MultiEdit'].includes(toolName)) return 'edit';
  if (['Bash', 'Execute'].includes(toolName)) return 'bash';
  if (['Grep', 'Glob', 'Search'].includes(toolName)) return 'search';
  return 'other';
}

const TOOL_COLORS: Record<ToolCategory, { bg: string; text: string; label: string }> = {
  read:   { bg: 'bg-success-soft', text: 'text-success', label: 'success' },
  edit:   { bg: 'bg-accent-soft',  text: 'text-accent',  label: 'accent'  },
  bash:   { bg: 'bg-warning-soft', text: 'text-warning', label: 'warning' },
  search: { bg: 'bg-secondary',    text: 'text-secondary-foreground', label: 'secondary' },
  other:  { bg: 'bg-surface-secondary', text: 'text-muted', label: 'default' },
};
// 注意：bg-success-soft, bg-accent-soft, bg-warning-soft 等 token 可能需要在 Tailwind 主题中定义。
// Phase 1 应验证 HeroUI v3 + 项目主题是否包含这些 token，不存在时回退到标准 HeroUI 颜色。
```

### 4.5 PromptInput

```typescript
interface PromptInputProps {
  readonly onSend: (message: string) => void;
  readonly onCancel?: () => void;
  readonly isStreaming?: boolean;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly modelName?: string;
  readonly toolCount?: number;
  readonly tokenCount?: number;
}
```

- **多行**：`<textarea>` 最小 1 行，最大 50vh，自动增长
- **Enter** 发送，**Shift+Enter** 换行
- **Ctrl+C**（流式时）→ 调用 `onCancel` 中断
- **↑**（输入为空时）→ 回填上一条用户消息
- **InputFooter**：模型名 · 工具数 · token 计数

### 4.6 SessionSidePanel

右侧 240px 面板，包含三个子组件：

- **SessionInfo**：消息数、工具调用数、耗时、token、费用
- **ToolCallTimeline**：按时间排列的工具调用列表，显示状态（✓/⏳/✗）
- **PermissionStatus**：当前权限模式（文件读取 ✓、文件写入 需审批、命令执行 需审批）

面板可通过按钮收起/展开。

---

## 5. 流式 IPC 管道

### 5.1 IPC 协议

复用 `@orbit/agent-core/frontend/ipc-protocol.ts` 已有的消息协议，而非新建 IPC 频道：

```typescript
// 已有协议（ipc-protocol.ts）
FrontendMessage: 'agent:send' | 'agent:cancel' | 'agent:approve' | ...
BackendMessage:  'agent:event' (wraps OrbitAgentEvent including agent:stream-delta, agent:tool-call, agent:completed, agent:error)
MessageTransport: { send(msg), onMessage(cb), destroy() }
```

`useStreamingState` 通过 `MessageTransport.onMessage()` 订阅 `BackendMessage`，根据内部 `OrbitAgentEvent.type` 分发到 `StreamingAccumulator`。不需要新增 Electron IPC 频道。

对于 Desktop 端，需要扩展 `DesktopBridge`（`preload/index.ts` + `contracts.ts`）来暴露流式方法：

```typescript
// 扩展 DesktopBridge 接口
interface DesktopBridge {
  // 已有
  llmProxy(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  // 新增 — 流式
  startStream(request: StreamRequest): void;
  cancelStream(requestId: string): void;
  onStreamEvent(callback: (event: OrbitAgentEvent) => void): () => void; // returns unsubscribe
}
```

这些方法在 preload 脚本中通过 `contextBridge.exposeInMainWorld` 安全暴露，renderer 不直接访问 `ipcRenderer`。

### 5.2 Main Process 处理

```typescript
// main process handler — 通过 ipcMain.handle 接收请求，通过 event.sender.send 发送 BackendMessage
ipcMain.handle('agent:stream-start', async (event, request: StreamRequest) => {
  const { requestId, provider, messages, tools } = request;
  const response = await fetch(providerUrl, { method: 'POST', body, headers });
  const reader = response.body.getReader();

  // 逐 chunk 转发为 OrbitAgentEvent
  for await (const chunk of parseSSEStream(reader)) {
    if (chunk.type === 'content_block_delta') {
      const agentEvent: AgentStreamDeltaEvent = {
        type: 'agent:stream-delta', delta: chunk.delta.text,
        runId: requestId, timestamp: Date.now()
      };
      event.sender.send('agent:event', agentEvent);
    } else if (chunk.type === 'content_block_start' && chunk.content_block.type === 'tool_use') {
      const agentEvent: AgentToolCallEvent = {
        type: 'agent:tool-call', ...chunk.content_block,
        runId: requestId, timestamp: Date.now()
      };
      event.sender.send('agent:event', agentEvent);
    }
  }
  const doneEvent: AgentCompletedEvent = {
    type: 'agent:completed', runId: requestId,
    usage: finalUsage, timestamp: Date.now()
  };
  event.sender.send('agent:event', doneEvent);
});
```

### 5.3 Renderer 端集成

```typescript
// useStreamingState.ts
// 注意：renderer 不直接访问 ipcRenderer，通过 DesktopBridge 暴露的安全方法订阅事件。

export function useStreamingState() {
  const [state, setState] = useState<UIStreamingState>(INITIAL_STATE);
  const accumulator = useRef(new StreamingAccumulator());

  useEffect(() => {
    // 通过 DesktopBridge 安全订阅（非直接 ipcRenderer）
    const unsubscribe = window.orbitDesktop.onStreamEvent((agentEvent: OrbitAgentEvent) => {
      const coreState = accumulator.current.processEvent(agentEvent);
      // 将 agent-core 的 Map<string, ToolCallState> 转换为 RenderableToolCall[]
      const toolCalls: RenderableToolCall[] = Array.from(coreState.toolCalls.entries()).map(
        ([id, tc]) => ({
          id,
          name: tc.name,
          arguments: safeJsonParse(tc.args),  // B1 补充: string → Record<string, unknown>
          status: tc.complete ? 'success' : 'running',
        })
      );
      setState({
        content: coreState.content,
        isStreaming: coreState.isStreaming,
        toolCalls,
        thinking: coreState.thinking ?? undefined,
        lastUpdate: Date.now(),
      });
    });
    return unsubscribe;
  }, []);

  return { state, startStream, cancelStream };
}

/** 安全 JSON 解析工具参数（agent-core 的 arguments 是 string） */
function safeJsonParse(str: string): Record<string, unknown> {
  try { return JSON.parse(str); }
  catch { return { raw: str }; }
}
```

### 5.4 Web 端降级

`apps/web` 没有 IPC，使用 fetch + ReadableStream：

```typescript
async function* streamChat(url: string, body: object): AsyncGenerator<StreamChunk> {
  const response = await fetch(url, { method: 'POST', body: JSON.stringify(body) });
  yield* parseSSEStream(response);
}
```

---

## 6. 宿主集成

### 6.1 ChatPage.tsx（替换现有）

```typescript
// apps/desktop/src/renderer-entry/agent-hub/pages/ChatPage.tsx
import {
  ConversationStream, ConversationHeader, PromptInput,
  SessionSidePanel, normalizeMessages, useStreamingState
} from '@orbit/conversation-ui';

export function ChatPage() {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const { state: streaming, startStream, cancelStream } = useStreamingState(); // returns UIStreamingState
  const renderable = useMemo(() => normalizeMessages(messages), [messages]);

  const handleSend = async (text: string) => {
    const userMsg = createAgentMessage('user', text);
    setMessages(prev => [...prev, userMsg]);
    await startStream({ messages: [...messages, userMsg], provider: getActiveProvider() });
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col">
        <ConversationHeader model={activeModel} onSearch={...} />
        <ConversationStream messages={renderable} streamingState={streaming} />
        <PromptInput onSend={handleSend} onCancel={cancelStream} isStreaming={streaming.isStreaming} />
      </div>
      <SessionSidePanel stats={sessionStats} />
    </div>
  );
}
```

### 6.2 apps/web 集成

同样导入 `@orbit/conversation-ui`，使用 fetch 替代 IPC 的 `useStreamingState` 变体。

---

## 7. 键盘交互与搜索

### 7.1 键盘快捷键

| 快捷键 | 作用域 | 行为 |
|---|---|---|
| `Enter` | 输入区 | 发送消息 |
| `Shift+Enter` | 输入区 | 换行 |
| `↑` | 输入区（空） | 回填上一条用户消息 |
| `Ctrl/Cmd+F` | 全局 | 打开/关闭对话搜索 |
| `Escape` | 搜索/流式 | 关闭搜索栏 / 取消流式 |
| `Ctrl+C` | 流式中 | 中断当前流式响应 |
| `n / N` | 搜索中 | 下一个/上一个匹配 |

### 7.2 对话搜索（useConversationSearch）

```typescript
interface ConversationSearchState {
  readonly isOpen: boolean;
  readonly query: string;
  readonly matches: readonly { messageId: string; offset: number }[];
  readonly currentMatchIndex: number;
}
```

- 延迟构建搜索索引（首次 Ctrl+F 时 warm up）
- 大小写不敏感
- 高亮匹配文本（`<mark>` 标签 + `bg-warning-soft`）
- n/N 或搜索框内 ↑/↓ 在匹配间跳转

### 7.3 自动滚动（useAutoScroll）

```typescript
interface AutoScrollState {
  readonly isAtBottom: boolean;
  readonly hasNewMessages: boolean;
}
```

- 滚动容器 `onScroll` 检测是否在底部（阈值 50px）
- 新消息到达 + `isAtBottom` → 平滑滚动到底
- 新消息到达 + `!isAtBottom` → 显示 "↓ 新消息" 浮动按钮
- 点击浮动按钮 → `scrollTo({ bottom: 0, behavior: 'smooth' })`

---

## 8. 错误处理

| 场景 | 错误来源 | UI 表现 |
|---|---|---|
| 网络断开 | `agent:event` error / fetch error | `ErrorMessage` + 重试按钮 |
| API 限流 (429) | provider response | `ErrorMessage` + 自动重试倒计时 |
| Token 超限 | provider response | 黄色警告系统消息 + 建议压缩 |
| 工具执行失败 | `agent:tool-result` success=false | 工具卡片红色状态 + 错误详情 |
| IPC 桥接断开 | `DesktopBridge` 超时 | 全局横幅 "主进程无响应" |
| 无效消息格式 | normalize 管道 | 跳过 + console.warn |

---

## 9. 测试策略

### 9.1 单元测试

| 文件 | 测试重点 |
|---|---|
| `normalize.test.ts` | 分组检测、折叠逻辑、思考提取、工具配对、边界情况 |
| `types.test.ts` | 类型守卫函数 |
| `useStreamingState.test.ts` | chunk 序列 → state 变化 |
| `useAutoScroll.test.ts` | 滚动位置检测、新消息触发 |
| `useConversationSearch.test.ts` | 搜索匹配、导航 |

### 9.2 组件测试

每个消息组件一个测试文件，使用 `@testing-library/react`：

- 验证 props → 正确渲染
- 验证交互（点击折叠/展开、审批按钮）
- 验证搜索高亮

### 9.3 集成测试

`ConversationStream` 用固定消息数组渲染完整对话流：

- 验证消息顺序
- 验证分组折叠
- 验证自动滚动

---

## 10. 实施阶段

### Phase 1: 包脚手架 + 类型 + normalize 管道
- 新建 `@orbit/conversation-ui` 包
- 实现 `types.ts`、`normalize.ts` + 测试
- 纯逻辑，无 UI

### Phase 2: 消息组件
- 实现 11 个消息组件 + `MessageRow` 分发器
- 实现 `ConversationStream` 容器
- 实现 `ConversationHeader`
- 可用固定数据渲染完整对话流

### Phase 3: 输入区 + 面板
- 实现 `PromptInput` + `InputFooter`
- 实现 `SessionSidePanel` 三个子组件
- 实现 hooks: `useAutoScroll`, `useConversationHistory`

### Phase 4: 流式 IPC
- 扩展 `DesktopBridge` 接口（`startStream`, `cancelStream`, `onStreamEvent`）
- 扩展 preload 脚本通过 `contextBridge` 安全暴露流式方法
- Main process 接收 `agent:stream-start`，通过 `agent:event` 频道转发 `OrbitAgentEvent`
- `useStreamingState` hook 通过 `DesktopBridge.onStreamEvent` 订阅事件
- `StreamingMessage` 组件动画

### Phase 5: 搜索 + 权限 + 错误处理
- `useConversationSearch` hook
- `PermissionApproval` 集成 agent-core `ApprovalManager`
- 错误处理逻辑 + 重试

### Phase 6: 宿主集成
- 替换 desktop `ChatPage.tsx`
- 集成 web `ChatPage` (if exists)
- 移除旧 `AgentChatPanel` 引用
- 端到端验证

### Phase 7: 验证
- 全包 typecheck
- 全包 build
- 测试覆盖 ≥ 80%
- Git commit
