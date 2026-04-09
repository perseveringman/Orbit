# packages-core-builder 职责卡

## 职责边界

负责跨端共享的稳定内核：领域模型、协议、同步、view model、通用错误模型、测试基建与 workspace 级共享核心能力。这里的目标不是“什么都能放”，而是只保留真正跨端、跨 feature 可复用且稳定的抽象。

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

- **阶段 1：抽象澄清** —— 先确认能力是否真的被多个端/模块共享，避免为单一场景过度下沉。
- **阶段 2：契约落地** —— 先稳定类型、错误模型、领域边界与 public API。
- **阶段 3：实现与回归** —— 在 package 内完成最小实现、测试和兼容性检查。
- **阶段 4：通知消费方** —— 输出迁移说明、示例用法和 breaking change 范围。

## 提交前检查

- 确认新能力至少有两个明确消费者，或已由 monorepo-lead 判定为必须先下沉。
- 确认没有引入平台实现细节、DOM/原生 UI 细节或服务端基础设施细节。
- 确认 public API 命名、导出路径、错误模型稳定，不让消费方依赖内部文件。
- 至少完成 package 级类型/测试/使用示例验证，确保下游能按文档接入。

## 完成定义

- 共享抽象边界清晰，可被多个消费方稳定复用。
- public API 与内部实现分层清楚，没有把临时业务逻辑塞进 core。
- 迁移方式、兼容策略、下游接入影响已同步。
- 不存在反向依赖 UI、平台或 server 包的情况。

## 与上下游协作方式

上游通常是 `monorepo-lead`；下游覆盖所有 app builder 以及其他 packages builder。协作方式强调“先 contract 后消费”：core builder 先发出类型/协议/错误模型，再让 UI、平台、server、apps 分别接入；如发现两个下游对抽象诉求冲突，由 monorepo-lead 裁决。
