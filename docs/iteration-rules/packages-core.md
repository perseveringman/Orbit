# Packages Core 迭代规则

## 职责边界

Core 迭代只处理真正跨端、跨模块复用且相对稳定的领域内核与基础契约，包括 domain、protocol、view model、sync、workspace core、test kit 等。它不是“任何暂时无处安放代码”的回收站。

## 可改目录

- `packages/agent-core/**`
- `packages/app-viewmodels/**`
- `packages/capability-core/**`
- `packages/data-protocol/**`
- `packages/domain/**`
- `packages/i18n/**`
- `packages/object-graph/**`
- `packages/sync-core/**`
- `packages/test-kit/**`
- `packages/workspace-core/**`

## 禁止改目录

- `apps/**`
- `packages/ui-*`
- `packages/editor-dom/**`
- `packages/feature-*`
- `packages/platform-*`
- `packages/api-types/**`
- `packages/db-schema/**`
- `packages/server-*`
- `packages/tooling/**`

## 迭代节奏

- **确认抽象是否值得下沉**：至少要有多个消费者，或由总控判定为必须提前沉淀。
- **先定 public API**：先定义导出面、类型、错误模型和兼容策略。
- **最小实现 + 验证**：在 package 内完成实现和测试，不把验证压力全部甩给 app。
- **同步迁移说明**：告诉下游怎么接、旧接口何时废弃。

## 提交前检查

- 确认没有引入平台、UI、服务基础设施等上层细节。
- 确认 public API 稳定且不要求下游 import 内部路径。
- 确认新抽象不是单一 app 的私有需求伪装成共享能力。
- 完成 package 级类型、测试或示例验证。

## 完成定义

- 共享抽象可被多个消费方稳定复用。
- 导出面、兼容策略、迁移说明完整。
- 没有反向依赖 UI / platform / server 包。
- 下游接入动作清楚，避免“自己猜怎么用”。

## 与上下游协作方式

上游通常是 `monorepo-lead`；下游覆盖 UI、platform、server 和各 app。Core 变更需要先冻结 public API，再通知下游开始消费；如多个下游诉求冲突，应通过总控统一裁决，而不是在 core 中同时满足矛盾模型。
