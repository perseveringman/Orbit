# packages-ui-builder 职责卡

## 职责边界

负责共享 UI 资产与交互模块，包括设计 token、DOM/Native 组件、编辑器 DOM 能力、工作台/移动端 feature 级 UI 模块。它控制表现层与交互复用，但不拥有 app 路由壳层、平台桥接或领域模型。

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

- **阶段 1：确认复用面** —— 先判断是 token、基础组件还是 feature 模块，避免层级错放。
- **阶段 2：先 API 再样式** —— 先稳定组件 props、事件、组合方式，再优化视觉和交互细节。
- **阶段 3：跨端验证** —— 关注 DOM 与 Native 的共享边界，验证不会把单端样式策略扩散成全局负担。
- **阶段 4：接力说明** —— 告知 app builder 如何替换旧组件、如何接新的交互模块。

## 提交前检查

- 确认组件或 feature 模块确实可复用，而不是某个 app 的私有容器。
- 确认依赖方向符合 `token -> 基础 UI -> feature 模块`，没有反向耦合。
- 确认没有把 app 路由、页面装配或平台桥接写进 UI 包。
- 至少完成 package 级渲染、交互、样式回归或示例验证。

## 完成定义

- 共享 UI API 稳定、消费方式清楚、视觉和交互职责集中。
- 同一类组件/交互没有在多个 app 重复实现。
- 下游替换/接入路径已明确，避免 app builder 自行猜测组合方式。
- 没有引入对 app 壳层或 server 目录的反向依赖。

## 与上下游协作方式

上游主要是 `packages-core-builder`；下游是 Web/Desktop/iOS builder 以及 `packages-platform-builder`。协作时由 UI builder 先发布稳定组件 API 和交互约束，再让 app builder 做装配；若某个端提出只服务单端的视觉需求，应先判断是否留在 app，而不是强行进入共享 UI。
