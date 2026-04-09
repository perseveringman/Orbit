# web-builder 职责卡

## 职责边界

负责 `apps/web` 的页面壳层、浏览器端路由、运行时接线、Web 平台体验与监控埋点装配。它消费共享包，但不拥有共享抽象本身；遇到可复用能力缺口，应推动对应 packages builder 补齐，而不是在 Web 目录内复制实现。

## 可改目录

- `apps/web/**`

## 禁止改目录

- `apps/desktop/**`
- `apps/ios/**`
- `apps/server/**`
- `packages/**`（缺口需提给对应 packages builder）
- 根目录 workspace / turbo / tsconfig / eslint 配置

## 迭代节奏

- **阶段 1：接契约** —— 读取 core / ui / platform / server 输出的稳定接口，明确本轮只消费哪些变更。
- **阶段 2：壳层装配** —— 在 `apps/web` 内完成路由、状态接线、页面容器与浏览器专属适配。
- **阶段 3：端内回归** —— 自测关键 Web 用户路径、浏览器行为、SSR/CSR 边界（如适用）。
- **阶段 4：向下游/总控回传** —— 反馈共享层缺口、兼容性问题和实际接入结果。

## 提交前检查

- 确认没有把共享逻辑、公共组件或平台抽象直接写死在 `apps/web`。
- 确认新增依赖优先来自 workspace 包，而不是在 app 内重复引入另一套方案。
- 至少完成与本轮改动匹配的 Web 构建、类型、测试或关键路径手测；若缺脚本，要在交付说明中写明。
- 检查路由、状态、浏览器 API 使用是否只在 Web 壳层出现，不向 core / ui 包倒灌平台判断。

## 完成定义

- `apps/web` 可以在既定共享契约上独立运行或完成关键链路演示。
- Web 端专属适配点都收口在 app 目录内，没有污染共享包。
- 对下游没有隐含依赖：需要的环境变量、路由注册、接线方式已写清楚。
- 若发现共享层不足，已形成明确需求而非留下本地临时补丁。

## 与上下游协作方式

上游主要是 `packages-core-builder`、`packages-ui-builder`、`packages-platform-builder`、`packages-server-builder`，必要时由 `monorepo-lead` 协调。协作时先等共享层冻结接口，再在 Web 端接入；如需新增浏览器能力，先提交需求给 platform/core owner，再等待 contract 落定。
