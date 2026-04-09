# apps/ios/modules

这里放 iOS 宿主专属的原生桥接与 Expo Module 适配层。

## 目录职责

- 负责把通知、分享扩展、后台刷新、生物识别、文件导入等真机能力接进来
- 负责把 iOS / Expo 的平台差异收敛后提供给 `@orbit/platform-ios`
- 不承载业务真相，业务编排仍然放在共享包里

## 边界约束

- iOS 宿主只复用共享业务内核与移动端特性层
- 不复用 DOM 工作台，不直接依赖桌面 / Web 的界面实现
- 宿主层新增能力时，优先沉淀成 `@orbit/platform-ios` 可消费的稳定接口

## 后续接入建议

1. 先在这个目录里为单个真机能力建立桥接文件，例如通知或分享扩展
2. 再把桥接能力收口到 `@orbit/platform-ios`
3. 最后由 `@orbit/feature-mobile` 组合这些能力，挂到 Expo Router 页面
