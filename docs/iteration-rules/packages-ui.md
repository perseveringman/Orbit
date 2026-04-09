# Packages UI 迭代规则

## 职责边界

UI 迭代只处理共享视觉资产、基础组件、编辑器 DOM 能力和 feature 级交互模块。它的工作是提供稳定的展示/交互层复用，而不是承接 app 路由、平台桥接或领域建模。

## 可改目录

- `packages/editor-dom/**`
- `packages/feature-mobile/**`
- `packages/feature-workbench/**`
- `packages/ui-dom/**`
- `packages/ui-native/**`
- `packages/ui-tokens/**`

## 禁止改目录

- `apps/**`
- `packages/agent-core/**`
- `packages/app-viewmodels/**`
- `packages/capability-core/**`
- `packages/data-protocol/**`
- `packages/domain/**`
- `packages/i18n/**`
- `packages/object-graph/**`
- `packages/platform-*`
- `packages/api-types/**`
- `packages/db-schema/**`
- `packages/server-*`
- `packages/tooling/**`

## 迭代节奏

- **先判层级**：先区分 token、基础组件、feature 模块，避免职责混装。
- **先定 API 再做表现**：先敲定 props、事件、组合方式，再细化视觉和动画。
- **验证共享性**：确认多个 app/平台都能消费，不把单端细节变成强制标准。
- **发布接入说明**：明确替换策略、示例代码和已知限制。

## 提交前检查

- 确认不是某个 app 的页面容器或私有交互被错误下沉。
- 确认依赖方向遵循 token -> 基础组件 -> feature 模块。
- 确认没有把平台判断、路由逻辑或服务调用塞进 UI 包。
- 完成至少一种可证明组件可用的验证方式，如示例、测试或手动演示路径。

## 完成定义

- 共享 UI API 稳定且可复用。
- 视觉和交互职责集中，没有在多个 app 重复造轮子。
- 消费方知道如何接入、替换旧实现和规避限制。
- 没有引入对 app 或 server 的反向依赖。

## 与上下游协作方式

上游主要是 `packages-core`；下游是 Web/Desktop/iOS 和 `packages-platform`。协作时先让 UI 包输出稳定 API，再让 app builder 接线；若某需求只在单端成立，应优先留在 app，而不是扩散进共享 UI。
