# packages-platform-builder 职责卡

## 职责边界

负责平台抽象与平台实现包，覆盖 `platform-contracts` 以及 Web/Electron/iOS 等具体 adapter。它只处理“能力如何适配到不同平台”，不拥有页面壳层、领域业务规则或服务 schema。

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

- **阶段 1：先 contract** —— 先定义平台能力接口、可用条件、错误语义和降级策略。
- **阶段 2：再 adapter** —— 分平台补齐实现，不在 app 壳层复制平台判断。
- **阶段 3：兼容验证** —— 检查 Web/Electron/iOS 实现与 contract 是否一致，避免一端特性绑架全部平台。
- **阶段 4：通知消费方** —— 输出 capability matrix、使用限制与 fallback 方式。

## 提交前检查

- 确认 contract 先于实现提交，下游不依赖私有 adapter 细节。
- 确认平台包不承载领域业务规则，只负责能力适配。
- 确认每个 adapter 都说明不可用场景、降级路径与错误处理方式。
- 至少完成受影响平台的最小调用验证。

## 完成定义

- 平台能力边界稳定，消费方可通过统一入口接入。
- 不同平台实现对 contract 的遵循程度可说明、可回归。
- 没有让 app 直接依赖某个平台内部文件。
- 新增能力有明确 capability matrix 与接入说明。

## 与上下游协作方式

上游主要是 `packages-core-builder` 与 `packages-ui-builder`；下游是 Web/Desktop/iOS builder。协作模式是“contract 冻结 -> adapter 落地 -> app 接入”：先定义统一能力，再由各 app builder 消费；若某端能力无法抽象成公共 contract，应回退到该 app 自己实现，并由 monorepo-lead 记录边界。
