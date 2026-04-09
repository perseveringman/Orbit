# Packages Server 迭代规则

## 职责边界

Server packages 迭代只处理 API 类型、数据库 schema、服务核心能力和基础设施包，让多个服务入口或客户端共享统一协议。具体 app/server 入口装配和前端页面接线不在这里完成。

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

- **先锁协议与 schema**：定义数据结构、接口类型、迁移方案和兼容窗口。
- **再补共享实现**：在 server core / infra 内完成复用逻辑，不把业务条件写进 infra。
- **通知入口与消费方**：让 `apps/server` 与各客户端按窗口接入。
- **最后做兼容收尾**：确认旧字段、旧接口、旧迁移脚本何时清理。

## 提交前检查

- 确认变更顺序是类型/schema -> 提供方实现 -> 消费方接入。
- 确认每个 schema/API 变更都有兼容、迁移、回滚说明。
- 确认 infra 包不承载业务分支。
- 至少完成 package 级类型、测试或接口 smoke 验证，并同步验证窗口。

## 完成定义

- 共享协议与 schema 可被 server app 和客户端稳定消费。
- breaking change 与迁移步骤可追踪。
- 服务复用逻辑沉淀在 package，而不是 app 壳层。
- 上下游知道何时接入、何时清理旧逻辑。

## 与上下游协作方式

上游通常是 `monorepo-lead` 与 `packages-core`；下游是 `apps/server` 以及 Web/Desktop/iOS 等消费方。协作时先发协议和 schema，再让入口和客户端接入；一旦影响多个消费端，必须由总控统一发布窗口和回退策略。
