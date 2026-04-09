# 10-Monorepo与三端应用

## 1. 设计定位

本专题定义 Orbit Reboot 的**代码组织与运行时分层**：它不是“把三个端放进同一个仓库”这么简单，而是要建立一个能同时承载 **Electron 桌面端、Web 端、iOS 端与零知识同步服务端** 的统一产品底座，使对象系统、Local-first 数据流、Agent 编排、MCP 能力层、服务端 API 契约与设计系统都能长期演化，而不被某一端的技术栈绑死。

本专题采用四个核心判断：

1. **桌面端继续使用 Electron**。原因不是历史惯性，而是新项目仍然需要：真实文件系统、长时后台任务、稳定嵌入式运行时、丰富桌面能力、成熟的编辑器与知识工作台生态。Orbit 的深度工作场景——多栏工作台、文件优先、Block 编辑、Agent 工具执行、索引与同步常驻——更像“本地操作系统上的认知工作台”，而不是轻量壳应用。
2. **Web 与 Desktop 应尽可能高复用**。二者都运行在 DOM / Chromium 心智模型中，适合共享同一套 React 页面结构、编辑器内核、设计 token、交互模式与多数业务组件。桌面端不应该维护第二套 UI，只在 Host 层补上 Electron 独有能力。
3. **iOS 不强求 UI 等形复用，而要最大化复用业务内核**。移动端的交互密度、导航模型、输入方式、后台限制与系统能力边界都不同，但对象模型、状态机、同步协议、Agent tool schema、查询与命令接口必须与 Web / Desktop 共用。
4. **服务端要进入同一 monorepo 参与契约治理，但保持独立部署**。账号、设备、同步、blob、GDPR 这些契约如果只存在于文档或独立仓库里，三端最终会各自对接一份“想象中的后端”。但服务端也不是第四个前端，而是一个独立 deployable 的云端宿主。

因此，最终方案不是“一套 UI 打天下”，而是**一套领域核心 + 两套表现层家族 + 三个客户端宿主 + 一个服务宿主**：

- 一套领域核心：对象模型、状态模型、同步协议、Agent core、能力契约
- 两套表现层家族：`DOM Workbench`（Web/Desktop）与 `Native Mobile`（iOS）
- 三个客户端宿主：Electron Host、Browser Host、iOS Native Host
- 一个服务宿主：Server Host（Auth / Device / Sync / Blob / Admin）

## 2. 关键用户场景

### 场景 A：桌面端是深度工作主场

用户在桌面端同时打开 Reader、Research、Writing、Journal、Agent 面板与对象关系侧栏。系统要持续监听本地 workspace、索引 Markdown 与附件、运行转写/翻译/同步任务，并允许 Agent 调用本地能力、文件系统与外部 MCP 工具。这要求桌面端具备稳定的多窗口、多进程、长期驻留与系统级权限模型。

### 场景 B：Web 端是“随处可进入”的同构工作台

用户在另一台电脑或临时设备上登录 Orbit，希望看到与桌面端高度一致的对象结构、编辑界面、阅读界面与 Agent 交互，而不是一个被阉割成“只读后台”的网页版。因此 Web 端必须尽量复用桌面端的页面编排、组件体系与状态容器，只在文件访问、后台任务、系统调用上降级。

### 场景 C：iOS 端是捕捉、查看、轻编辑、Agent 陪伴入口

用户在通勤、步行、碎片时间里，从分享面板保存内容、快速记一条 note、查看今天的 action、继续阅读、对一段高亮发问、把语音转成 journal。此时最重要的不是桌面级多栏 UI，而是同一对象网络、同一任务状态、同一 Agent 能力语义在手机上以更原生的方式可达。

### 场景 D：三端切换时对象与行为保持同一语义

同一条高亮、同一篇研究卡片、同一段文档 block、同一个 action、同一个 Agent 记忆引用，在桌面、Web、iOS 上都必须有同一 object id、同一关系边、同一事件记录与同一权限语义。用户切端时切换的是宿主与交互密度，不是切换“另一个 Orbit”。

## 3. 核心设计

### 3.1 Monorepo 总体原则

推荐采用 **pnpm workspace + Turborepo** 作为最终 monorepo 基座。

- `pnpm workspace` 负责依赖统一、锁文件统一、workspace link
- `Turborepo` 负责任务图、增量缓存、按影响范围构建与测试
- TypeScript project references 负责类型边界与构建顺序
- Changesets 仅用于**需要对外发布**的包；内部包默认 lockstep，不做独立产品语义版本

Monorepo 不是按“技术类别”随意切包，而是按**共享稳定性**切层：

1. **领域层**：纯 TypeScript，无平台依赖
2. **协议层**：数据、同步、能力、Agent 契约，以及 client/server API DTO
3. **表现层**：DOM UI 家族 / Native UI 家族
4. **运行时适配层**：Electron / Browser / iOS / Server
5. **应用层**：真正可运行的三个客户端 app + 一个 server app

### 3.2 最终推荐目录结构

```text
apps/
  desktop/
    src/main/                  # Electron main：窗口、菜单、协议、系统能力
    src/preload/               # 安全桥接
    src/renderer-entry/        # 仅宿主入口，挂载 shared DOM app
    package.json
  web/
    src/entry/                 # Browser host，挂载 shared DOM app
    public/
    package.json
  ios/
    app/                       # Expo Router / RN 入口
    modules/                   # iOS 原生模块桥接（如需要）
    package.json
  server/
    src/http/                  # Hono 路由：auth/device/sync/blob/admin
    src/realtime/              # WebSocket / SSE / APNs 通知
    src/jobs/                  # 导出、删除、清理等后台任务
    src/bootstrap/             # 配置、依赖注入、服务启动
    package.json

packages/
  domain/                      # 对象类型、links/events、命令/查询模型、状态机
  object-graph/                # object_index / links / events 的查询与关系逻辑
  data-protocol/               # repository interfaces、DTO、schema codec、mutation envelope
  api-types/                   # Auth/Device/Sync/Blob/Admin DTO、事件、错误码
  db-schema/                   # SQLite schema、迁移、跨端一致性校验
  sync-core/                   # local-first 同步协议、冲突策略、变更日志
  server-core/                 # 账号/设备/同步/GDPR 用例，不绑定 Web 框架
  server-db-schema/            # PostgreSQL schema、迁移、查询模型
  server-infra/                # JWT、R2/S3、Postgres、APNs、rate limit 适配器
  workspace-core/              # sources/wiki/.orbit 目录协议、文件索引协议
  agent-core/                  # planner、tool runtime、memory contract、handoff summary
  capability-core/             # MCP/tool schema、权限声明、能力注册模型
  app-viewmodels/              # 跨端可复用的 view model、selectors、use-cases
  ui-tokens/                   # token、主题、图标语义、排版尺度
  ui-dom/                      # Web/Desktop 共用 React DOM 组件
  ui-native/                   # iOS React Native 组件
  editor-dom/                  # TipTap/Block Editor/拖拽/浮层，仅 Web/Desktop
  feature-workbench/           # Reader/Notes/Research/Writing 等 DOM 组合页面
  feature-mobile/              # iOS 端页面装配与交互模式
  platform-contracts/          # FileSystemPort、DatabasePort、CapabilityHost 等接口
  platform-electron/           # contracts 的 Electron 实现
  platform-web/                # contracts 的 Browser 实现
  platform-ios/                # contracts 的 iOS / Expo 实现
  i18n/                        # 三语文案、locale schema、格式化规则
  test-kit/                    # 合约测试、fixture、跨端回归测试工具
  tooling/                     # eslint/tsconfig/vitest/tailwind/vite shared config
```

关键决策：

- **`apps` 只做宿主，不承载业务真相**。
- **所有“是否共享”的讨论都先落到 `packages`**。
- **平台差异通过 `platform-contracts` + adapter 实现，不通过 if-else 污染领域层**。
- **`apps/server` 是 monorepo 内的独立部署单元，不和三端发布节奏强绑定**。
- **所有 auth/device/sync/blob/admin DTO、通知事件与错误码先定义在 `api-types`，再分别实现**。

### 3.3 应用层 / 共享层拆分规则

| 层级 | 客户端 + 服务端共享 | 三端共享 | Web + Desktop 共享 | 仅单宿主 |
|---|---|---|---|---|
| 领域模型 | `domain`、`object-graph`、`data-protocol`、`sync-core` 的对象/变更契约 | 同左 | 无 | 无 |
| API / 协议 | `api-types`、schema codec、error code、notification event | 客户端消费同一套请求/响应语义 | 无 | Hono 路由、客户端 HTTP / WebSocket adapter |
| 状态与用例 | 无 | `app-viewmodels`、selectors、commands、query hooks 抽象 | 同一批 DOM 工作台流程 | iOS 导航状态与手势状态 |
| UI | 无 | token、图标语义、颜色、文案 key | `ui-dom`、`editor-dom`、大部分 workbench 组件 | `ui-native`、原生导航栏、Share Sheet 页面 |
| 服务实现 | `server-core` 复用领域与协议 | 无 | 无 | `server-db-schema`、`server-infra`、后台任务、通知网关 |
| 平台能力 | 网络鉴权、session、cursor 等云端语义通过 shared contract 对齐 | 接口共享 | Browser / Electron 的近似 DOM 能力 | 文件系统、后台任务、通知、分享扩展、对象存储等实现差异 |

落地规则：

1. `domain` 到 `agent-core` 禁止 import React、Electron、Expo、Hono 或 Postgres SDK。
2. `ui-dom` 禁止 import Electron API；只能消费 `platform-contracts` 暴露的安全接口。
3. `ui-native` 不复用 DOM 组件，只复用 token、文案、view model、对象查询与命令。
4. 宿主 app 只负责装配 runtime：注入 adapter、权限模型、入口路由、发布配置。
5. `apps/server` 只负责 HTTP / WS / job 装配；账号、设备、同步、blob、GDPR 用例下沉到 `server-core`。
6. `api-types`、notification event、error code 必须先定义再实现，禁止客户端和服务端各自发明 request / response shape。
7. `server-core` 不依赖任何 UI 包，也不承载明文索引、Agent 推理或内容推荐逻辑。

### 3.4 为什么桌面仍用 Electron

本专题明确保留 Electron，不转 Tauri，也不把桌面端降格为“浏览器加壳”。

原因有五个：

1. **桌面端需要真实文件系统优先体验**  
   Orbit 的 `sources/ / wiki/ / .orbit/` 结构要求对本地目录、文件监听、导入导出、冲突修复、附件落盘有稳定掌控。Electron 的 Node/OS 能力与生态对此最成熟。

2. **桌面端需要长时后台工作**  
   同步、索引、转写、翻译、模型调用、MCP connector、外部工具编排都不是“页面在前台时顺手跑一下”的任务。Electron 更适合作为常驻本地控制面。

3. **桌面端需要稳定承载 DOM 富编辑器与复杂工作台**  
   Orbit 的 Reader、Research、Block 编辑器、拖拽素材、命令面板、图谱、浮层系统，都更适合运行在稳定的 Chromium 环境里。Electron 让桌面与 Web 共享同一套渲染基础。

4. **桌面端需要丰富系统集成**  
   全局快捷键、菜单栏、协议处理、拖拽文件、剪贴板、通知、窗口管理、本地模型 sidecar、外部程序拉起，这些都是 Orbit 作为“桌面工作台”而不是“网页应用”的核心。

5. **对 Orbit 来说，一致运行时比二进制体积更重要**  
   Tauri 的优势在体积与原生壳，但 Orbit 更看重：桌面与 Web 尽量同构、编辑器行为一致、Agent 工具运行时一致、前端调试与发布链一致。因此 Electron 是更合适的主宿主。

### 3.5 为什么 Web 与 Desktop 可以高复用

Orbit 的 Web 与 Desktop 采用**同一个 DOM App Shell**：

- 共用 React Router / 页面结构
- 共用 `ui-dom`
- 共用 `editor-dom`
- 共用 Reader / Note / Research / Writing 页面编排
- 共用 view model、query hooks、对象卡片、侧栏、命令面板、搜索结果、Agent 对话块

二者只在以下层面分叉：

- **Host API**：Electron 走 preload bridge；Web 走 browser adapter / service worker / Web APIs
- **权限能力**：桌面可访问真实文件系统与长任务；Web 默认只访问浏览器沙箱与受控同步接口
- **分发方式**：桌面打包安装并可自动更新；Web 即时部署

因此，推荐把**产品工作台本身**放进 `packages/feature-workbench`，而不是分别写在 `apps/desktop` 与 `apps/web`。这样桌面与 Web 的复用不是“复制页面再对齐”，而是**共享同一份页面代码，由宿主决定运行方式**。

### 3.6 iOS 与 Web / Electron：哪些共享，哪些不共享

#### iOS 必须共享的部分

1. **对象与关系模型**：`object_index`、类型系统、`links`、`events`
2. **状态模型**：action / project / note / highlight / research 的状态机
3. **数据层协议**：repository interface、query contract、mutation envelope、同步冲突语义
4. **Agent 能力内核**：tool schema、planner contract、memory contract、handoff summary、权限声明
5. **业务用例层**：创建 note、归档内容、发送到 research、生成 action、保存高亮等 use case
6. **设计 token 与文案 key**：颜色语义、字号阶梯、间距 token、i18n key

#### iOS 不应强行共享的部分

1. **DOM 工作台 UI**：多栏布局、Hover 交互、TipTap NodeView、拖拽浮层、复杂 split pane
2. **桌面级编辑器实现**：Block Editor 的 DOM 细节、富文本菜单定位、桌面快捷键系统
3. **文件系统实现**：桌面是真实目录；iOS 是 app sandbox + Files/Share extension 边界
4. **后台执行策略**：iOS 受系统后台限制，不能照搬桌面常驻任务模型
5. **系统交互**：菜单栏、窗口、多实例管理、全局快捷键、协议唤起等

最终建议是：**iOS 复用“脑”，不复用“桌面身体”**。  
即：共享核心逻辑、查询命令、Agent 能力与数据协议；移动端 UI 采用原生化表达。

### 3.7 运行时能力边界与平台 Port

所有客户端平台能力统一通过 `platform-contracts` 抽象为 port；服务端基础设施则通过 `server-core` 依赖的 infra contracts 注入：

```ts
interface WorkspacePort {}
interface DatabasePort {}
interface SyncPort {}
interface CapabilityHostPort {}
interface NotificationPort {}
interface AuthPort {}
interface SecureStorePort {}

interface AccountStorePort {}
interface ObjectStoragePort {}
interface NotificationFanoutPort {}
interface JobSchedulerPort {}
```

各端职责如下：

- **Electron**
  - 真文件系统 workspace
  - 文件监听与索引
  - 本地 SQLite 主库
  - 本地模型 / 外部 MCP server / 长任务 orchestration
  - 多窗口、菜单、快捷键、系统协议

- **Web**
  - OPFS / IndexedDB / Cache Storage
  - Service Worker 缓存与离线 shell
  - 浏览器内 SQLite 适配
  - 受限文件导入导出
  - 受限能力调用与云端代理

- **iOS**
  - app sandbox 内本地数据库与文件缓存
  - Share Extension / Camera / Photo / Files import
  - Push / Background refresh / Biometric
  - 语音输入、原生选择器、移动端通知

- **Server**
  - Auth / Device / Sync / Blob / Admin API
  - PostgreSQL 中的账号、设备、游标、审计元数据
  - R2 / S3 中的加密 blob 存储
  - WebSocket / SSE / APNs 通知 fan-out
  - 导出 / 删除 / 清理后台 job 与 rate limit / audit

原则是：**运行时能力可以不同，能力语义必须一致；服务端只实现云端职责，不承载对象明文与 Agent 推理**。  
例如“保存一篇网页到 Inbox”在三端都应走同一个 use case，但调用的 capture adapter 不同。

### 3.8 构建、测试与发布策略

#### 构建

- 根任务：`turbo run lint typecheck test build`
- 按影响范围执行：改 `domain`、`data-protocol`、`api-types`、`sync-core` 会带动三端 + server；改 `ui-dom` 只影响 Web/Desktop；改 `ui-native` 只影响 iOS；改 `server-core` / `server-db-schema` 只影响 server
- 所有跨端共享包和 client/server 协议包都必须有 contract tests

#### 测试

- `domain / sync-core / agent-core`：纯单元测试 + 协议测试
- `api-types / server-core`：鉴权、游标、错误码、通知事件 contract tests
- `ui-dom / editor-dom`：组件测试 + 关键工作流回归
- `ui-native`：view model 测试 + 关键页面快照 / 交互测试
- `platform-*`：adapter contract tests，确保同一接口在三端行为一致
- `apps/server`：路由集成测试、迁移 smoke test、对象存储 / 通知 adapter 集成测试

#### 发布

- **Desktop**：Electron Forge 打包；渠道分 `canary / beta / stable`；自动更新独立于 Web 发布
- **Web**：持续部署；灰度按 workspace / feature flag 控制
- **iOS**：Expo EAS Build + TestFlight + App Store；与 Web/Desktop 共享同一 feature flag 与 schema version gate
- **Server**：单容器发布；先执行 PostgreSQL migration，再切流量；R2/S3、rate limit、APNs 等配置按环境注入

#### 版本治理

- 内部包默认随仓库 lockstep 版本前进
- 对外暴露的少数包（如 capability SDK）可独立 semver
- 数据 schema、sync protocol、tool manifest、server API contract 必须有显式版本号与兼容矩阵

## 4. Agent 行为与自动化机制

Monorepo 三端不是只共享 UI，更要共享 Orbit 的 Agent 行为语义。

### 4.1 统一 Agent Core，按平台协商能力集

三端共用 `agent-core`，但启动时根据宿主注入不同 toolset：

- Desktop：完整能力集，可访问本地 workspace、长任务、外部工具、MCP connector
- Web：默认受限能力集，危险写操作需经云端代理或更强确认
- iOS：移动优先能力集，强调 capture、summarize、review、route、ask-on-selection

Agent 不直接判断“我是哪个端”，而是读取 `CapabilityHostPort` 返回的**可执行能力声明**。这样规划器、记忆系统与 prompt contract 保持一致，只是可用工具不同。

补充约束：`apps/server` 不运行 `agent-core` 里的 planner / memory / tool runtime。服务端只提供登录、同步、设备、通知与 GDPR 接口；任何需要读取用户明文的推理仍留在客户端。

### 4.2 跨端会话与 handoff

当用户从桌面切到 iOS，或从 Web 切回桌面时，Agent 不应该从零开始。三端共享：

- `session_summary`
- `active_context_bundle`
- `tool_permission_snapshot`
- `recent_object_refs`

桌面端可以产生更厚的上下文；iOS 端只消费压缩结果。这样既满足移动端轻量体验，也避免 agent 会话语义断裂。

### 4.3 自动化任务分层

- **Desktop 优先承担重任务**：索引、批量导入、ASR、全文重建、外部工具编排
- **Web 优先承担即时任务**：查询、轻编辑、在线协作式查看、短链路 Agent 交互
- **iOS 优先承担捕捉型任务**：分享保存、快速提问、录音、快速 review、通知回调

这不是功能阉割，而是让相同能力根据平台成本做最合适的落点。

## 5. 数据模型 / 接口 / 能力边界

### 5.1 跨端与服务端共享的最小协议面

Monorepo 必须围绕以下协议稳定收敛：

```ts
interface ObjectEnvelope {
  id: string;
  type: string;
  version: number;
}

interface MutationEnvelope {
  mutationId: string;
  objectId: string;
  actor: string;
  baseVersion?: number;
  payload: unknown;
}

interface AuthSession {
  accountId: string;
  deviceId: string;
  accessToken: string;
}

interface SyncChangeEnvelope {
  changeId: string;
  objectId: string;
  channel: 'object' | 'document' | 'blob';
  version: number;
  timestamp: number;
  checksum: string;
  encryptedPayload: string;
}

interface SyncPushRequest {
  deviceId: string;
  changes: SyncChangeEnvelope[];
}

interface SyncNotification {
  type: 'sync_available';
  changeCount: number;
  latestTimestamp: number;
}

interface ToolManifest {
  toolName: string;
  inputSchema: unknown;
  permissions: string[];
  platformAvailability: ('desktop' | 'web' | 'ios')[];
}
```

共享的不是具体数据库驱动，而是：

- 对象语义
- 变更语义
- 查询语义
- 工具语义
- 认证 / 设备 / 同步 / blob / GDPR API 语义
- 通知事件语义
- 权限语义

### 5.2 共享边界判定标准

一个模块要进入共享层，必须同时满足至少两条：

1. 不依赖宿主 UI 细节
2. 不依赖单端 OS API
3. 不依赖单端生命周期
4. 在三端或至少两端都具有长期稳定复用价值
5. 对 client/server 而言，它表达的是稳定契约，而不是某个宿主的临时实现细节

否则就留在 app 或 platform adapter 层，不为了“看起来复用很多”而抽坏边界。

### 5.3 Web/Desktop 与 iOS 的最终边界结论

| 能力 | Web/Desktop | iOS |
|---|---|---|
| Reader 基础查询 | 共享对象与 view model；UI 同构 | 共享查询与对象，UI 重写 |
| Notes / Writing 编辑 | 共享 TipTap/Block DOM 编辑器 | 共享 block AST、命令、存储协议；编辑器实现独立 |
| Agent Chat | 共享消息协议、tool schema、markdown block renderer 规范 | 共享协议与能力语义，消息容器 UI 独立 |
| 文件工作区 | Electron 强；Web 受限 FSA/OPFS | iOS sandbox + share/import |
| 后台任务 | Desktop 强；Web 中等 | iOS 强约束，需要任务裁剪 |

### 5.4 明确不采用的错误拆法

1. **不做“三个 app 各自复制一套 feature 再抽公共组件”**  
   这样会快速形成三套 Orbit。

2. **不做“所有端强行共享同一套 UI 组件”**  
   这会让 iOS 为 DOM 工作台买单，也会让 Web/Desktop 为移动端最小公分母买单。

3. **不做“领域逻辑藏在 Electron main、Hono route 或某个 app 内”**  
   领域真相与协议真相必须在 packages 中，宿主只能装配。

4. **不做“客户端共享一套类型，服务端再手写一套 DTO / error code”**  
   这会让登录、同步、设备、通知协议在实现中缓慢漂移。

## 6. 与其他专题的依赖关系

以下按**能力域**说明；若后续专题标题微调，以这里的边界描述为准。

| 专题 | 依赖关系 |
|---|---|
| **11** | 11 定义本地优先、跨端同步、密钥与数据出境规则；`workspace-core`、`sync-core`、设备信任与授权流都要以它为准。没有 11，monorepo 只能“同仓”，不能“同治理”。 |
| **19** | 19 定义零知识服务端的职责边界、API、存储与部署策略；本专题把它落成 `apps/server + packages/api-types + packages/server-*` 的仓库结构与 CI 治理。没有 19，server 只能是“仓外附件”，无法和三端稳定共演进。 |
| **13** | 13 定义 `sources/ + wiki/ + .orbit/` 三层数据边界与 file-backed object 契约；三端 workspace loader、索引恢复与文件桥接都依赖它。没有 13，三端数据真相会重新分叉。 |
| **14** | 14 定义 `agent-core`、session handoff、后台任务与审批恢复模型；三端只做宿主装配，不各自重写 Agent 行为。没有 14，三端只能共享聊天 UI，无法共享 Agent runtime。 |
| **15** | 15 定义 capability registry / MCP runtime / connector lifecycle；`capability-core` 与三端宿主要按同一能力契约实现。没有 15，Agent 能力无法稳定跨端复用。 |
| **16** | 16 是跨端共享价值最高的复杂 UI 内核；Desktop/Web 共享 DOM 编辑器家族，iOS 共享文档模型、command schema 与 block 协议。没有 16，三端内容工作台会迅速分裂。 |
| **17** | 17 决定 locale 注入、翻译资源分发、formatter、术语表与多语搜索配置如何跨端共享。没有 17，跨端统一只能停留在单语假设。 |
| **18** | 18 决定 `ui-tokens`、`ui-dom`、`ui-native` 如何共享颜色语义、排版、暗色主题、换肤与可访问性策略。没有 18，Web/Desktop/iOS 会演化出三套视觉体系。 |

## 7. 风险、边界与设计决策

1. **风险：为了跨端复用，把 iOS 也硬塞进 DOM 心智模型**  
   - 决策：采用“Desktop/Web 共用 DOM 家族，iOS 共用核心逻辑”的双家族方案。

2. **风险：把 Electron 仅当成 Web 壳，结果本地优先优势没发挥出来**  
   - 决策：桌面端承担 workspace、索引、长任务、外部工具、系统集成等“本地主场能力”。

3. **风险：共享包越来越多，边界反而更乱**  
   - 决策：按“领域 / 协议 / 表现 / 平台 / 应用”五层切分；能留在 app 的不提前抽。

4. **风险：Web 与 Desktop 表面共用组件，实则页面逐渐分叉**  
   - 决策：把工作台页面直接放进共享包，由两个宿主共同挂载，而不是各自复制页面。

5. **风险：同步协议、tool manifest、schema 版本在三端失配**  
   - 决策：把 schema version、sync protocol version、tool manifest version 作为 monorepo 一级契约，进入 CI 合约测试。

6. **风险：服务端在仓外独立演化，client/server contract 漂移**  
   - 决策：MVP 阶段把服务端纳入同一 monorepo，作为 `apps/server` 独立部署；API DTO、error code、notification event 同源治理。

7. **风险：为了省事，把 Agent、搜索或明文处理塞进服务端**  
   - 决策：服务端只做 auth / device / sync / blob / admin / notification；不做明文索引、不运行 Agent、不成为内容主库。

8. **关键设计决策：桌面端继续使用 Electron**  
   - 原因：Orbit 的核心价值不是更小安装包，而是更强本地控制力、更稳定的富编辑运行时、更成熟的系统集成，以及与 Web 高度同构的工作台实现。

9. **关键设计决策：服务端进入 monorepo，但保持独立部署**  
   - 原因：API 契约、同步协议、错误码、通知事件与迁移版本需要和客户端共同演进，但运行与发布节奏要独立。

10. **关键设计决策：Web 与 Desktop 共享一套产品工作台，iOS 共享一套业务内核**  
   - 原因：这同时满足“Web 最大化复用桌面 UI”“iOS 最大化复用核心业务逻辑”与“client/server 契约同源演进”的三重目标，而不会让三端与服务端彼此漂移。
