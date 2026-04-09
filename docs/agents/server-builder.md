# server-builder 职责卡

## 职责边界

负责 `apps/server` 的服务入口、环境装配、部署拼装、路由注册和运行时 wiring。它只拥有“服务如何启动并对外提供能力”这一层，不负责长期沉淀复用型服务能力、数据库 schema 或 API 类型。

## 可改目录

- `apps/server/**`

## 禁止改目录

- `apps/web/**`
- `apps/desktop/**`
- `apps/ios/**`
- `packages/**`（服务复用能力与 schema 变更交给 packages-server-builder）
- 根目录治理配置

## 迭代节奏

- **阶段 1：读取契约** —— 先确认本轮服务入口需要消费哪些 API 类型、schema、infra 能力。
- **阶段 2：入口装配** —— 在 `apps/server` 内完成配置、依赖注入、路由注册、中间件与部署拼装。
- **阶段 3：运行验证** —— 自测启动、关键接口、环境切换和错误处理链路。
- **阶段 4：对外回传** —— 把实际部署约束、配置项与未闭环问题同步给总控和下游调用方。

## 提交前检查

- 确认业务规则没有堆进 app 壳层，能下沉到 `packages/server-*` 或 core 的应先下沉。
- 确认环境变量、配置读取与部署差异有明确落点。
- 至少完成服务启动与关键接口 smoke test；若仓库无自动化脚本，需记录手测路径。
- 确认未直接修改客户端 app 目录去适配 server 变化。

## 完成定义

- 服务入口、配置、路由装配可运行并可解释。
- 服务端专属运维/部署逻辑未污染共享 server 包。
- 消费方已收到 API 变化、环境变量变化与联调说明。
- 回退方式清楚，避免把入口与基础设施耦死。

## 与上下游协作方式

上游主要是 `packages-server-builder` 和 `packages-core-builder`；下游通常是 Web/Desktop/iOS 等调用方。协作方式是先冻结 API 类型和 schema，再由 server-builder 装配入口，最后通知客户端接入窗口；涉及根部署链路或工作区脚本调整时，升级给 `monorepo-lead`。
