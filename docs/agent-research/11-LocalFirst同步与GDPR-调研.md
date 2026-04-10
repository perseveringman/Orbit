# 11. Local-First 同步与 GDPR —— 基于 Hermes / Claude Code 的调研分析

> **调研目标**：结合 Hermes Agent 和 Claude Code 两个成熟 AI Agent 项目在数据隐私、本地存储、同步策略、安全架构方面的实践，为 Orbit Reboot 的「Local-First 同步与 GDPR」设计方案提供启发与验证。

---

## 1. Orbit 设计方案摘要

Orbit 方案 11 定义了产品的**数据主权底座**，核心立场是：用户数据首先存在于用户设备，本地是唯一真相源；云端只承担加密中转与变更通知角色，永远不可读用户明文内容。

### 设计要点

**同步架构**：三通道分层同步，覆盖全部数据类型——

- **通道 1（结构化对象，95%）**：project / task / goal / highlight / note 等结构化数据，采用对象级 LWW（Last-Writer-Wins），以 version + updatedAt 时间戳解决冲突。
- **通道 2（长文档，4%）**：写作稿件、研究报告等长 Markdown 文档，采用 git 式 3-way merge，段落级自动合并，冲突保留两版让用户选择。
- **通道 3（大文件 blob，1%）**：图片、PDF、音视频等二进制文件，内容寻址 + 不可变存储，hash 去重，天然无冲突。

**加密方案**：极简密钥体系——用户口令 / 恢复短语通过 Argon2id 派生主密钥（masterKey），所有对象与 blob 统一用 AES-256-GCM 加密。不采用多层密钥（RRK / AMK / WK 等），以"简单即安全"为原则降低密钥丢失导致数据不可恢复的风险。

**GDPR 内建**：数据最小化（云端只存密文 + 最少元数据）、导出权（本地执行解密导出）、删除权（tombstone + 7 天恢复窗口 + 永久清除）、匿名化统计、按目的拆分的明示同意。

**Agent / LLM / MCP 出境控制**：数据出境前必须展示说明卡（发什么、发给谁、是否保留），高敏内容默认不出境需逐次授权，出境后记录 egress_record 可审计可撤销。

**关键决策**：
- 不采用 CRDT（个人用户场景，冲突极少，CRDT 的实现复杂度远超收益）
- 不采用多层密钥（一个主密钥 + 恢复短语，未来按需扩展）
- 派生索引不同步（FTS / vector / thumbnail 本地重建，减少同步体积和攻击面）

---

## 2. Hermes 可借鉴之处

Hermes Agent 作为一个「开放式全栈 AI 基础设施」，其设计哲学是最大化灵活性与开放性，支持完全自托管和私有化部署。这与 Orbit 的「本地优先、数据主权」理念高度契合。

### 2.1 凭证与环境变量的严格隔离

Hermes 在安全架构上最值得 Orbit 学习的是其**环境变量隔离机制**。Hermes 在 `tools/environments/local.py` 中实现了对 100+ 个 API 密钥变量的主动剥离（OpenAI、Anthropic、AWS、GitHub Token、Telegram、Discord 等），子进程执行时仅允许通过显式白名单注册的变量通过。同时，Hermes 采用 `ContextVar` 实现会话级变量隔离，确保不同会话间不存在数据泄漏。

**对 Orbit 的启发**：Orbit 的 Agent 在调用外部 LLM 或 MCP 工具时，必须确保本地工作区的密钥（masterKey、恢复短语派生材料）不会被意外传递给子进程或外部服务。可以借鉴 Hermes 的白名单机制，在 Agent 执行环境中建立一个「环境变量防火墙」，只允许声明过的最小变量集通过。这直接增强了方案中"密钥不进日志"这一安全边界的工程落地。

### 2.2 多后端执行环境的沙箱隔离

Hermes 支持 6 种执行后端（Docker、SSH、Modal、Daytona、Singularity、本地），其中 Docker 后端的安全加固值得关注：`--cap-drop ALL`（丢弃所有 Linux capabilities）、`--security-opt no-new-privileges`（阻止权限提升）、`--pids-limit 256`（进程数限制）、`--tmpfs /tmp:rw,nosuid`（无 SUID 的临时目录）。

**对 Orbit 的启发**：Orbit 在桌面端（Electron）执行 Agent 编排时，可以考虑类似的沙箱策略。特别是当 Agent 需要执行代码（如 MCP 工具返回的脚本）时，应在受限环境中运行，防止恶意代码访问 `.orbit/` 下的加密密钥和本地数据库。Hermes 的凭证文件隔离（`credential_files.py` 中的符号链接防护和路径遍历检测）也为 Orbit 的本地文件安全提供了参考模板。

### 2.3 SQLite + FTS5 的本地数据存储模式

Hermes 采用 SQLite（WAL 模式）+ FTS5 全文搜索作为对话历史的存储引擎，支持跨会话的消息检索和分析。消息存储包含完整的结构化字段（role、content、tool_calls、token_count、finish_reason 等），通过 FTS5 虚拟表和触发器实现高效全文搜索。

**对 Orbit 的启发**：Orbit 的 `.orbit/` 下的 SQLite 数据库设计可以参考 Hermes 的 schema 设计思路。特别是 `sync_outbox`、`sync_cursors`、`tombstones` 等同步相关表的设计，可以借鉴 Hermes 的 WAL 模式（支持并发读 + 单写入，非常适合离线写入场景）和 FTS5 索引（用于本地全文搜索）。Hermes 的"会话谱系"（通过 `parent_session_id` 链接压缩后的新旧会话）也与 Orbit 通道 2 长文档的 `baseVersion` 追踪有异曲同工之处。

### 2.4 SSRF 防护与网络安全

Hermes 在 `tools/url_safety.py` 中实现了完整的 SSRF 防护：阻止已知内部主机名（metadata.google.internal）、DNS 解析后检查 IP 范围（RFC 1918 私有地址、回环地址、CGNAT 范围）、失败关闭策略（DNS 错误时阻止请求）。此外还有 OSV API 恶意包检测。

**对 Orbit 的启发**：Orbit 的出境控制（Agent 调用外部 LLM/MCP）需要类似的网络层防护。当 Agent 发起网络请求时，应验证目标地址不是内部服务或元数据端点，防止通过恶意 MCP 工具配置进行 SSRF 攻击。Hermes 的"失败关闭"策略（宁可阻断请求也不泄露数据）与 Orbit 的"高敏内容默认不出境"原则一致。

### 2.5 记忆系统的内容安全扫描

Hermes 的 MemoryStore 对所有写入记忆的内容执行威胁模式扫描，检测提示词注入、角色劫持、系统提示词覆盖、SSH 后门、API 密钥泄露等模式。这是一个重要的安全层，防止恶意内容通过记忆系统持久化。

**对 Orbit 的启发**：Orbit 的 `wiki/` 层是 AI 编译的输出（实体页、概念页），属于 Agent 可写入区域。如果 Agent 被恶意 prompt 注入，可能将危险内容写入 wiki 并持久化。借鉴 Hermes 的记忆安全扫描机制，Orbit 可以在 Agent 写入 wiki 前增加一层内容审查，检测并过滤可能包含提示词注入或恶意指令的内容。

---

## 3. Claude Code 可借鉴之处

Claude Code 作为「精雕细刻的开发者协作工具」，其设计哲学是在单一场景上做到极致。Claude Code 在安全管控、上下文管理、企业级治理方面有许多精细化设计，对 Orbit 的隐私与合规架构有直接参考价值。

### 3.1 声明式权限规则引擎

Claude Code 实现了一个完整的声明式权限规则引擎，包含 6 种权限模式（default、plan、acceptEdits、bypassPermissions、dontAsk、auto）和三态行为（allow / deny / ask）。每条规则记录完整的来源链（配置文件、CLI 参数、命令行、会话），支持精确匹配、前缀匹配和通配符匹配三种规则类型。

**对 Orbit 的启发**：Orbit 的出境控制目前设计为"展示说明卡 + 用户选择"的交互模式。可以借鉴 Claude Code 的声明式规则引擎，让用户预先配置出境规则，例如：

```yaml
egress_rules:
  - target: "api.openai.com"
    data_scope: "summary_only"
    action: "allow"
  - target: "*.unknown-mcp.com"
    action: "deny"
  - data_type: "journal"
    action: "ask"  # 高敏内容始终逐次确认
```

这种声明式规则比纯交互式确认更高效，同时保留了对高敏内容的严格控制。Claude Code 的规则来源追踪机制也为 Orbit 的 `consents` 表提供了更精细的数据模型参考。

### 3.2 集中式安全审计日志

Claude Code 实现了一个集中式的权限决策日志系统（`logPermissionDecision`），每次权限决策都扇出到 Statsig 分析、OTel 遥测、代码编辑计数器、上下文存储四个通道。审计数据包括 messageID（请求关联）、toolName、sandboxEnabled、waiting_for_user_permission_ms 等字段，支持完整的决策链还原。

**对 Orbit 的启发**：Orbit 的 `egress_records`（外部出境审计记录）可以借鉴 Claude Code 的集中式审计架构。不仅记录"什么数据发给了谁"，还应记录决策路径（是用户逐次授权、规则自动放行还是默认拒绝）、授权耗时、数据体积等维度。这些审计数据对于 GDPR 合规审查（数据保护影响评估 DPIA）和用户透明度（控制面板展示出境历史）至关重要。建议将审计日志与同步层解耦，审计日志本身仅在本地存储（不同步到云端），避免审计数据成为新的隐私风险点。

### 3.3 多层配置叠加与记忆文件体系

Claude Code 的 CLAUDE.md 系统支持 5 层配置叠加：Managed（策略设置）→ Managed Rules → User 全局 → User Rules → 项目级/本地级。每层有明确的优先级和权限边界，Managed 层可被企业远程管理，Local 层不签入版本控制。记忆文件通过 frontmatter 标注类型（user / feedback / project / reference），支持团队级记忆同步。

**对 Orbit 的启发**：Orbit 的隐私设置可以参考这种分层叠加模型。例如：

- **平台层默认值**：Orbit 内置的最严格隐私策略（云端不可读、高敏内容不出境）
- **用户全局偏好**：用户在设置中配置的通用出境规则和同意状态
- **工作区级别**：特定工作区的同步策略（如"这个工作区完全离线，不同步"）
- **对象级别**：特定对象的隐私标注（如某篇 Journal 标记为"永不出境"）

这种分层设计确保严格策略不可被宽松策略覆盖（Managed 层优先），同时给用户足够的细粒度控制。

### 3.4 macOS Keychain 级别的密钥存储

Claude Code 将 API 密钥存储在 macOS Keychain 中（通过 `getMacOsKeychainStorageServiceName`），利用操作系统级别的安全存储机制。OAuth 令牌管理包含自动过期检测和刷新机制，缓存清理包含遗留密钥预取清理和基于会话的缓存失效。

**对 Orbit 的启发**：Orbit 的主密钥（masterKey）在本地的存储安全是整个加密体系的根基。方案中提到 iOS 端"密钥存储走 Keychain / Secure Enclave"，但桌面端（Electron）的密钥存储方案未详细定义。建议：
- **macOS**：使用 Keychain Services 存储主密钥派生材料
- **Windows**：使用 Windows Credential Manager 或 DPAPI
- **Linux**：使用 libsecret / GNOME Keyring / KWallet

Claude Code 的实践证明了 OS 级安全存储在桌面应用中的可行性，Orbit 应避免将主密钥明文存储在 `.orbit/` 文件系统中。

### 3.5 上下文压缩与图片剥离

Claude Code 在上下文压缩时会执行图片和文档剥离（`stripImagesFromMessages`），将 image 和 document 内容替换为占位符，这是一种有效的数据最小化实践。压缩后的恢复预算机制（50K token 用于恢复关键文件和技能）也值得注意。

**对 Orbit 的启发**：Orbit 的 Agent 在处理用户内容时，应遵循类似的"数据最小化"原则。例如，当 Agent 需要将上下文发送给外部 LLM 时，应先剥离附件（图片/PDF/音视频的实际内容），只保留元数据引用。这与方案中"用户可选择：全文发送 / 仅摘要 / 仅结构化元数据 / 拒绝"的出境选项设计一致，但可以进一步自动化——默认剥离大文件附件，除非用户显式选择发送。

---

## 4. 不适用的设计

### 4.1 Claude Code 的远程管理策略与 Statsig 门控

Claude Code 通过 Statsig 功能门控实现了组织级别的远程策略管理（如远程禁用 bypassPermissions 模式）。这是面向企业 SaaS 场景的设计，依赖中心化的策略服务器。

**不适用原因**：Orbit 的核心理念是"云端默认不可读用户内容"，引入中心化的远程策略管理会与 Local-First 原则产生矛盾。Orbit 的隐私策略应由用户本地控制，而非由服务端下发。如果未来需要企业版，可以考虑将策略文件作为同步对象加密传输，但决策执行仍在本地。

### 4.2 Hermes 的 LLM 智能审批

Hermes 的"智能审批"模式使用辅助 LLM 评估命令的安全性（三档判断：approve / deny / escalate）。这种设计需要调用外部 LLM 服务。

**不适用原因**：Orbit 的安全审批（如出境控制确认）不应依赖外部 LLM 调用——这本身就构成一次数据出境。安全决策应基于确定性规则（声明式规则引擎 + 用户配置），而非概率性的 LLM 判断。安全层的确定性和可审计性比智能化更重要。

### 4.3 Claude Code 的团队记忆同步 API

Claude Code 支持通过中心化 API（`GET/PUT /api/claude_code/team_memory`）进行团队级记忆同步，服务端 wins per-key 的语义。

**不适用原因**：Orbit 面向个人用户，不存在团队记忆同步需求。同时，这种设计要求服务端能读取和比对记忆内容（至少是哈希），与 Orbit 的"云端不可读"原则冲突。Orbit 的 `agent_session / memory` 数据走通道 1（对象 LWW）同步即可，无需额外的记忆同步协议。

### 4.4 Hermes 的多平台消息网关

Hermes 支持 14+ 消息平台（WhatsApp、Telegram、Discord 等）的网关接入，每个平台有独立的异步审批队列。

**不适用原因**：Orbit 是独立产品（Electron + iOS + Web），不需要适配外部消息平台。但 Hermes 的网关审批队列设计（FIFO 队列 + threading.Event 阻塞）可以在概念上启发 Orbit 的离线出境队列——当用户离线时触发的出境请求应排队等待，恢复联网后再逐一确认。

### 4.5 Claude Code 的 Prompt Caching 优化

Claude Code 深度利用 Anthropic 的 prompt caching 特性（cache_control、extended thinking），实现成本优化。

**不适用原因**：这是与特定 LLM 提供商深度绑定的优化，Orbit 应保持模型无关性。但"缓存已有上下文以减少重复传输"的思路可以应用于 Orbit 的出境控制——对于同一对象重复出境给同一供应商，可以只发送增量变更而非全文。

---

## 5. 具体建议

### 建议 1：建立「环境变量防火墙 + 密钥隔离层」

**问题**：Orbit 的 Agent 在执行 MCP 工具或调用外部 LLM 时，如果未做环境隔离，主密钥或本地数据库路径可能通过环境变量或进程继承被意外泄露。

**建议**：借鉴 Hermes 的环境变量剥离机制（100+ 密钥变量主动清除）和 Claude Code 的 macOS Keychain 存储，建立两层防护：

1. **密钥存储层**：主密钥不存储在文件系统或环境变量中，而是存储在 OS 级安全存储（macOS Keychain / Windows Credential Manager / Linux libsecret）。应用启动时从安全存储读取到进程内存，使用后立即清零。
2. **进程隔离层**：Agent 执行外部工具时，spawn 的子进程环境中主动剥离所有 Orbit 相关变量（ORBIT_MASTER_KEY、ORBIT_DB_PATH 等），只允许通过白名单注册的变量传递。

这两层配合方案中"密钥不进日志"的安全边界，形成从存储到运行时到子进程的完整密钥保护链。

### 建议 2：为出境控制引入「声明式规则引擎 + 审计日志」

**问题**：方案中出境控制依赖交互式确认（"展示说明卡 + 用户选择"），但对于频繁调用外部 LLM 的场景，逐次确认的用户体验成本过高。

**建议**：借鉴 Claude Code 的声明式权限规则引擎和集中式审计日志：

1. **声明式规则**：允许用户预配置出境规则，支持按目标供应商、数据类型、数据敏感度三维度匹配，行为三态（allow / deny / ask）。高敏对象（Journal、愿景、健康）的 deny 规则不可被用户全局 allow 覆盖。
2. **审计日志**：每次出境决策记录完整的上下文（时间、目标、数据范围、决策路径——规则自动/用户手动/默认拒绝、数据体积、授权有效期）。审计日志仅本地存储，不同步到云端，用户可在控制面板查看和导出。
3. **拒绝追踪与降级**：借鉴 Claude Code 的拒绝追踪机制（`maxConsecutive: 3, maxTotal: 20`），如果某个 Agent 反复被拒绝出境请求，自动降级该 Agent 的出境权限，防止恶意或失控的 Agent 消耗用户注意力。

### 建议 3：同步层的「内容安全扫描 + 写入前审查」

**问题**：Orbit 的 `wiki/` 层允许 AI 增量写入，如果 Agent 被恶意 prompt 注入，可能将危险内容（后门指令、恶意链接、假信息）持久化到用户的知识库中，并通过同步传播到所有设备。

**建议**：借鉴 Hermes 的记忆安全扫描机制（检测提示词注入、角色劫持、API 密钥泄露等模式）：

1. **写入前扫描**：Agent 向 `wiki/` 写入前，对内容执行轻量级安全扫描，检测已知的提示词注入模式、隐形 Unicode 字符（零宽空格、方向覆盖符）、可疑的外部链接模式。
2. **同步前校验**：在数据进入 `sync_outbox` 前，对变更记录执行完整性校验，确保加密前的内容不包含明显的注入特征。这不会增加同步延迟（扫描是本地操作），但能防止恶意内容跨端传播。
3. **tombstone 安全审查**：删除操作产生的 tombstone 在 7 天恢复窗口内应保留足够的元数据，以便用户在发现异常时能追溯删除原因。

### 建议 4：三端差异化同步的「按需解密 + 安全存储」策略

**问题**：方案提到 iOS 端"高频内容优先同步、低频大资产按需拉取"，但未详细定义按需拉取时的解密策略和安全存储方案。

**建议**：综合 Hermes 的 Docker 沙箱策略和 Claude Code 的 Keychain 集成：

1. **iOS 端**：密钥存储在 Secure Enclave（不可导出），按需拉取的大文件解密后存入应用沙箱的 tmp 目录，查看完毕后通过 `NSFileProtectionComplete`（设备锁屏即加密）保护。定期清理已解密的临时文件，保留加密版本。
2. **Web 端**：使用 Web Crypto API 在内存中持有主密钥（不写入 localStorage），解密数据存入 OPFS（Origin Private File System），退出浏览器时根据用户配置决定保留或清除。借鉴 Claude Code 的会话级缓存失效机制，确保关闭标签页后内存中的密钥被清零。
3. **桌面端（Electron）**：主密钥走 OS Keychain，`.orbit/` 下的 SQLite 数据库使用 SQLCipher（SQLite 加密扩展）整库加密，即使设备被盗也无法直接读取。借鉴 Hermes 的 WAL 模式确保离线写入的性能。

### 建议 5：出境数据的「自动最小化 + 增量传输」

**问题**：方案中提到用户可选择"全文发送 / 仅摘要 / 仅结构化元数据 / 拒绝"，但实际操作中用户很少会逐次手动选择最优的发送范围。

**建议**：借鉴 Claude Code 的图片剥离（`stripImagesFromMessages`）和 Hermes 的工具结果三层防御（每工具上限 → 持久化 → 每轮预算）：

1. **自动剥离**：出境前自动剥离附件内容（图片/PDF/音视频），只保留元数据引用（文件名、类型、大小）。如果外部 LLM 确实需要分析图片内容，用户需显式授权。
2. **上下文预算**：为每次出境请求设置 token 预算（如 8K / 16K / 32K 三档），超出预算时自动压缩为摘要。借鉴 Hermes 的 `per_turn_budget` 机制（200K 字符上限），在出境场景下将预算设为更保守的值。
3. **增量传输**：对于同一对象重复出境给同一供应商的场景（如持续对话中反复引用同一篇研究笔记），仅发送自上次出境以来的变更增量，而非全文重传。这既降低了隐私风险（暴露面更小），也节省了 API 成本。

---

## 6. 总结

通过对 Hermes Agent 和 Claude Code 两个项目在数据隐私、本地存储、同步策略和安全架构方面的深度分析，可以得出以下关键结论：

**Orbit 设计方案的核心决策是正确的。** "不用 CRDT、不用多层密钥、三通道分层同步"的极简架构，与个人用户的真实使用场景高度匹配。Hermes 和 Claude Code 虽然都是面向开发者的工具（非个人知识管理），但它们在安全和隐私领域的工程实践为 Orbit 提供了大量可落地的参考。

**最有价值的借鉴来自安全工程的细节层面。** Orbit 的方案在宏观架构上已经很完整（加密体系、同步通道、GDPR 合规、出境控制），但在工程实现层面还需要补充许多细节。Hermes 的环境变量剥离、SSRF 防护、记忆安全扫描，Claude Code 的声明式权限引擎、OS 级密钥存储、集中式审计日志——这些都是从"设计文档"到"安全可靠的生产系统"之间必须填补的工程鸿沟。

**本地优先不等于安全自动保证。** 数据存在本地并不意味着数据就是安全的。Agent 的执行环境、子进程的环境继承、恶意内容的持久化传播、密钥在内存中的生命周期管理——这些都是 Local-First 架构特有的安全挑战。Hermes 和 Claude Code 在各自场景下积累的安全防御经验（Hermes 的 106 条危险模式 + 隐形字符检测，Claude Code 的 23 项 AST 级安全检查 + 危险路径保护），为 Orbit 提供了丰富的安全模式库。

**出境控制是 Orbit 的差异化竞争力。** 在所有分析的项目中，没有一个实现了像 Orbit 方案中设计的那种系统化的数据出境控制（说明卡 + 分级授权 + 审计记录 + 可撤销）。这是 Orbit 作为"AI 时代个人数据主权工具"的核心价值主张。建议在此基础上引入声明式规则引擎和自动最小化机制，在保持严格控制的同时降低用户的操作摩擦。

最终，Orbit 的 Local-First 同步与 GDPR 设计应以「简单即安全、本地即真相、出境即审计」三条原则贯穿始终，从 Hermes 的开放防御和 Claude Code 的精细管控中各取所长，构建一个既对个人用户友好又真正保护数据主权的系统。
