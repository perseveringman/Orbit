# Packages Platform 迭代规则

## 职责边界

Platform 迭代只处理平台 contract 与 adapter，实现同一能力在 Web、Electron、iOS 等平台上的统一接入。这里不承载 app 页面逻辑、领域规则或服务协议，只负责“怎么适配”。

## 可改目录

- `packages/platform-contracts/**`
- `packages/platform-electron/**`
- `packages/platform-ios/**`
- `packages/platform-web/**`

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
- `packages/api-types/**`
- `packages/db-schema/**`
- `packages/server-*`
- `packages/tooling/**`

## 迭代节奏

- **先设计 contract**：定义能力接口、能力矩阵、不可用场景与降级策略。
- **分平台落 adapter**：按 Web/Electron/iOS 分别实现，不让 app 内自己写重复适配。
- **一致性验证**：确认各 adapter 行为与 contract 一致，错误语义一致。
- **告知 app 接入**：同步 capability matrix、fallback 方式和引用入口。

## 提交前检查

- 确认 contract 先于实现存在，消费方不依赖内部 adapter。
- 确认平台包没有夹带业务规则。
- 确认新增能力说明了何时不可用、如何降级。
- 至少验证受影响平台的最小调用链路。

## 完成定义

- 平台 contract 稳定，adapter 可被 app 通过统一入口消费。
- 不同平台实现的差异有显式说明。
- app 不需要直接碰平台私有文件。
- 能力矩阵、错误处理与 fallback 信息完整。

## 与上下游协作方式

上游主要是 `packages-core` 和 `packages-ui`；下游是 Web/Desktop/iOS。Platform 侧必须先冻结 contract，再让 app builder 接入；若某能力无法形成稳定公共抽象，应退回单端实现，并由 `monorepo-lead` 记录边界。
