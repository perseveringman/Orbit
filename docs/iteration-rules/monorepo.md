# Orbit Monorepo 总体迭代规则

本文回答的问题很简单：Orbit 作为 monorepo，怎样让多个团队、多个 agent、多个端并行推进，同时又不把共享层、应用层、根配置改成相互纠缠的一团。

## 目录索引

### 应用层规则

- [web](./web.md)
- [desktop](./desktop.md)
- [ios](./ios.md)
- [server](./server.md)

### 共享层规则

- [packages-core](./packages-core.md)
- [packages-ui](./packages-ui.md)
- [packages-platform](./packages-platform.md)
- [packages-server](./packages-server.md)

### 角色说明

- [Agent 团队总览](../agents/README.md)
- [monorepo-lead](../agents/monorepo-lead.md)

## 1. Monorepo 总边界

### 1.1 层级边界

- `apps/*` 是应用壳层：入口、路由、平台装配、部署与运行时 wiring。
- `packages/*` 是复用能力层：只放能够被多个 app 或多个 feature 长期复用的稳定能力。
- 根目录配置是工作区治理层：pnpm workspace、turbo pipeline、TypeScript/ESLint 基线与统一脚本。

### 1.2 允许的主依赖方向

```text
根配置 -> apps / packages
packages-core -> 无上游业务依赖
packages-ui -> packages-core
packages-platform -> packages-core / packages-ui / packages-platform-contracts
packages-server -> packages-core
apps -> packages-*
```

### 1.3 明确禁止的依赖方向

- `apps` 互相直接依赖。
- `packages-core` 反向依赖 `packages-ui`、`packages-platform`、`packages-server`。
- `packages-ui` 依赖具体 app 壳层。
- `packages-platform` 依赖 app 页面、容器或业务分支。
- `packages-server` 依赖前端 app 或 UI 包。
- 任意跨层循环依赖。

## 2. 并行协作总机制

### 2.1 任务分发规则

1. **单 owner 任务**：直接由对应 builder 处理。
2. **跨 owner 任务**：先由 `monorepo-lead` 拆成“契约变更”“实现接入”“集成回归”三个阶段。
3. **根配置任务**：默认由 `monorepo-lead` 主责，其他 builder 只提供受影响面信息。

### 2.2 契约先行规则

涉及以下目录或概念时，必须先冻结契约，再允许消费方接入：

- `packages/api-types`
- `packages/db-schema`
- `packages/data-protocol`
- `packages/platform-contracts`
- 共享 UI 组件 public API
- 共享 core package 的 public exports

固定顺序：

1. 先改类型 / schema / contract；
2. 再改提供方实现；
3. 再改消费方接入；
4. 最后做兼容清理。

### 2.3 升级给 monorepo-lead 的触发条件

- 需要同时修改 2 个以上 app；
- 需要同时修改 2 个以上 package 责任层；
- 需要新增/拆分 package；
- 需要改 workspace 依赖、turbo pipeline、tsconfig/eslint 基线；
- 发现目录职责不清、循环依赖或 owner 冲突。

## 3. 统一迭代节奏

所有分域规则都沿用同一节奏，只是检查项不同：

1. **边界确认**：明确本轮只改哪个 owner 目录、依赖谁的契约。
2. **局部实现**：只在授权目录内完成变更，不顺手扩散到别的 owner。
3. **局部验证**：完成本域构建、测试、关键链路自检或可替代手测。
4. **对外同步**：写清楚下游要接什么、怎么接、风险在哪里。
5. **集成关门**：由发起方或 `monorepo-lead` 汇总影响面并决定是否合并。

## 4. 根规则

### 4.1 新增依赖

新增依赖前必须回答：

- 现有 workspace 包能否复用？
- 这份能力是不是放错层了？
- 会不会形成反向依赖或循环依赖？

### 4.2 新增目录 / 新增 package

新增前必须判断：

- 是真正的新职责，还是现有目录职责漂移？
- 至少有两个明确消费者吗？
- 名称是否能直接表达职责？
- 是否会造成同类代码分散维护？

### 4.3 严禁事项

- 从 app 目录抽出“临时共享代码”后直接被其他 app 复制使用。
- 把实验性质代码塞进 core、platform、server 等基础共享目录。
- 在根目录堆放只服务单一 app 的脚本与配置。
- 用 `misc / temp / common2 / utils-new` 一类名字躲避职责约束。

## 5. 文档同步规则

以下变化必须同步更新文档：

- 目录 owner 变化；
- package 职责变化；
- 契约层新增/删除；
- monorepo 根规则变化；
- 需要新的并行协作约定。

最少更新范围：

- `docs/agents/README.md`
- `docs/agents/*.md` 对应职责卡
- `docs/iteration-rules/monorepo.md`
- `docs/iteration-rules/*.md` 对应分域规则

## 6. 总体完成定义

一个 monorepo 迭代任务，只有同时满足以下条件才算完成：

- 改动发生在明确授权目录内；
- 依赖方向仍然符合分层约束；
- 契约变更已经覆盖提供方与消费方，不留硬断点；
- 验证范围与改动半径匹配；
- 下游接力动作已明确；
- 文档已更新到足以支持下一位接手人继续推进。
