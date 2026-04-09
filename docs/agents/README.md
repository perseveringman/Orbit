# Orbit Agent 团队手册

这套文档只服务一件事：让多个真人开发者或多个 agent 能在同一个 Orbit monorepo 中并行推进，而不是相互覆盖、重复实现、把共享层改成临时堆场。

## 1. 团队设计原则

- **目录 owner 明确**：每个目录只有一个主责 agent，对应 agent 负责最终验收。
- **共享层先行**：跨端能力先落在 package，再由 app 接入；不允许 app 里先抄一份“过渡实现”。
- **契约先收口**：类型、schema、platform contract、公共 UI API 的变更先稳定，再安排消费方接力。
- **总控只做编排**：`monorepo-lead` 负责拆任务、排依赖、裁冲突，不长期替代各 builder 写本域实现。
- **交付要可接力**：每次提交都要让下游知道“现在能接什么、还差什么、风险在哪”。

## 2. 角色分层

| 层级 | 角色 | 关注点 |
| --- | --- | --- |
| 总控层 | [monorepo-lead](./monorepo-lead.md) | 目录边界、跨包编排、根配置、冲突裁决 |
| 应用层 | [web-builder](./web-builder.md)、[desktop-builder](./desktop-builder.md)、[ios-builder](./ios-builder.md)、[server-builder](./server-builder.md) | app 壳层、平台入口、运行时装配、端内体验 |
| 共享层 | [packages-core-builder](./packages-core-builder.md)、[packages-ui-builder](./packages-ui-builder.md)、[packages-platform-builder](./packages-platform-builder.md)、[packages-server-builder](./packages-server-builder.md) | 可复用能力、稳定 API、跨端抽象、服务契约 |

## 3. 并行协作机制

### 3.1 标准接力顺序

1. **需求分流**：先判断任务是单目录变更还是跨 owner 变更。
2. **契约窗口**：如涉及 `api-types`、`db-schema`、`data-protocol`、`platform-contracts`、共享 UI API，先由对应 package owner 提交契约变更。
3. **实现窗口**：下游 app 或其他 package 在已冻结的契约上接入，不反向推动契约漂移。
4. **集成窗口**：由发起方或 `monorepo-lead` 汇总受影响目录，安排最终联调与回归。

### 3.2 协作最小交付物

每个 agent 在把任务交给下游前，至少同步以下信息：

- 本次改了哪些目录；
- 新增/变更了哪些 public API、schema、路由、配置项；
- 下游需要执行的接入动作；
- 已验证范围与未覆盖风险；
- 是否需要 `monorepo-lead` 介入跨目录合并。

### 3.3 必须升级给 monorepo-lead 的情形

- 一次任务涉及 **2 个以上 app**；
- 一次任务涉及 **2 个以上 package 责任层**；
- 需要修改根目录配置、workspace 规则、turbo/pnpm/tsconfig/eslint 基线；
- 两个 agent 对同一共享目录提出不兼容诉求；
- 发现循环依赖、目录职责漂移、包拆分失真。

## 4. 职责卡索引

### 4.1 总控角色

- [monorepo-lead](./monorepo-lead.md)

### 4.2 应用角色

- [web-builder](./web-builder.md)
- [desktop-builder](./desktop-builder.md)
- [ios-builder](./ios-builder.md)
- [server-builder](./server-builder.md)

### 4.3 共享角色

- [packages-core-builder](./packages-core-builder.md)
- [packages-ui-builder](./packages-ui-builder.md)
- [packages-platform-builder](./packages-platform-builder.md)
- [packages-server-builder](./packages-server-builder.md)

## 5. 与迭代规则的关系

- 跨仓库总规则：[`../iteration-rules/monorepo.md`](../iteration-rules/monorepo.md)
- 分域规则：`web / desktop / ios / server / packages-*`

读法建议：

1. 先看本文件确定 owner；
2. 再看对应职责卡确认“谁能改、谁不能改”；
3. 最后看对应迭代规则，执行分阶段交付与提交流程。
