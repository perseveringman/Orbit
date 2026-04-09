# Orbit

Orbit 是一个本地优先（Local-First）的个人认知工作台。这个仓库承载 Orbit Reboot 的 monorepo 基座：桌面端、Web 端、iOS 端、服务端，以及它们共享的协议、对象模型、平台适配与设计系统。

## 当前阶段

当前仓库处于**脚手架搭建阶段**，重点是把以下边界先固化：

1. `apps/` 只承载宿主入口，不承载业务真相。
2. `packages/` 承载共享契约、领域模型、平台接口、UI 家族与特性拼装。
3. 服务端进入 monorepo 与客户端共享 API 契约，但保持独立部署节奏。
4. Desktop / Web 共享 DOM 工作台；iOS 共享业务内核但不强行共享 DOM UI。

## 目录结构

```text
apps/
  desktop/        Electron 宿主
  ios/            Expo / React Native 宿主
  server/         Hono 服务端宿主
  web/            浏览器宿主

docs/
  agents/         agent 团队定义、职责卡、协作规则
  iteration-rules/ 各部分迭代规则文档

packages/
  ...             共享领域层、协议层、UI 层、平台适配层与工具层
```

## 根级命令

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## 开发命令

```bash
pnpm dev
pnpm dev:web
pnpm dev:desktop
pnpm dev:ios
pnpm dev:server
```

## 架构原则

1. **共享稳定性优先于复用数量**：先判断边界是否稳定，再决定是否下沉到 `packages/`。
2. **服务端不是第四个前端**：它是零知识同步与账号服务宿主，不承担 Agent 推理和明文内容处理。
3. **平台差异通过 adapter 解决**：不把 Electron、Browser、iOS、Server 的差异写进领域层。
4. **文档和 agent 团队一起演进**：每个部分都需要职责边界与迭代规则，避免后续多人并行时结构漂移。
