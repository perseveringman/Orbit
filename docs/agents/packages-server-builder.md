# packages-server-builder 职责卡

## 职责边界

负责服务端共享能力、API 类型、数据库 schema、服务核心与基础设施包。它控制服务协议如何演进、schema 如何兼容、infra 如何复用，但不负责具体 app/server 入口装配或前端壳层实现。

## 可改目录

- `packages/api-types/**`
- `packages/db-schema/**`
- `packages/server-core/**`
- `packages/server-db-schema/**`
- `packages/server-infra/**`

## 禁止改目录

- `apps/**`
- `packages/agent-core/**`
- `packages/app-viewmodels/**`
- `packages/capability-core/**`
- `packages/data-protocol/**`
- `packages/domain/**`
- `packages/i18n/**`
- `packages/object-graph/**`
- `packages/ui-*`
- `packages/editor-dom/**`
- `packages/feature-*`
- `packages/platform-*`
- `packages/tooling/**`

## 迭代节奏

- **阶段 1：先协议/schema** —— 先锁定 API 类型、数据结构、迁移策略和兼容窗口。
- **阶段 2：再共享实现** —— 在 server core / infra 内完成复用逻辑，不把业务判断塞进基础设施。
- **阶段 3：联动入口与消费方** —— 通知 server app 和客户端 app 开始接入。
- **阶段 4：兼容收尾** —— 确认旧字段、旧接口、旧迁移路径何时清理。

## 提交前检查

- 确认 API 类型、schema 与实现的变更顺序正确，没有“边改边猜”。
- 确认数据库或协议变更包含兼容、迁移、回滚说明。
- 确认 infra 包只承载技术能力，不承载业务分支。
- 至少完成受影响 package 的类型、测试或接口 smoke 验证，并通知消费方验证窗口。

## 完成定义

- 服务端共享协议与 schema 可以被 server app 和客户端稳定消费。
- breaking change、迁移步骤、回退方案都可追踪。
- 服务复用能力沉淀在 package 内，而不是散落在 app 入口。
- 上下游已知晓接入顺序和兼容窗口。

## 与上下游协作方式

上游主要是 `monorepo-lead` 与 `packages-core-builder`；下游是 `server-builder` 以及通过 API/同步协议消费的 Web/Desktop/iOS builder。协作时先发协议和 schema 变更，再安排服务入口接线，最后组织客户端接入；任何会影响多个消费端的 breaking change，都必须由 monorepo-lead 排期。
