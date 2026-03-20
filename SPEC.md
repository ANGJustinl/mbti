# 双核职场 项目规格书

版本：v0.1  
日期：2026-03-16  
状态：可执行 MVP 规格草案

## 1. 项目定位

**双核职场** 是一个面向职场协作与组队匹配的 Agent 产品。它以「双核人格」为底层模型，用更接近真实工作场景的方式，帮助用户完成以下三件事：

1. 看清自己在不同情境下的工作人格与协作习惯。
2. 在真人见面前，先由 Agent 进行高密度、低成本的兼容性试探。
3. 将匹配结果沉淀成可执行的《协作契约》，把“聊得来”变成“能共事”。

该项目强调两层融合：

1. 与 **Second Me A2A** 能力融合，构建可代理、可协商、可模拟的用户分身。
2. 与 **知乎生态** 融合，借助职场争议话题、可信内容与社区语境，让匹配结果更有现实质感。

## 2. 愿景与北极星

### 愿景

让用户不再通过简历、客套和表面人设来寻找队友，而是通过真实的价值观、决策逻辑和协作方式完成高质量连接。

### 北极星指标

`高质量连接达成率 = 完成双盲沙盘后，双方确认交换联系方式并进入真实协作的占比`

### 补充指标

- `人格卡片完成率`
- `沙盘对话完成率`
- `自动排雷终止率`
- `协作说明书阅读完成率`

## 3. 目标用户

### 用户类型 A：寻找合伙人/核心搭子的用户

- 典型场景：做项目、创业、比赛、自由职业组队。
- 核心诉求：想找到互补且靠谱的人，避免投入时间后才发现底层不合。

### 用户类型 B：处于合作磨合期的职场人

- 典型场景：与新同事、新 leader、新搭档进入协作关系。
- 核心诉求：快速识别彼此风格差异，降低沟通损耗。

## 4. 产品原则

1. **拒绝刻板 MBTI**：不做娱乐化贴标签，强调情境差异与协作行为。
2. **先由 Agent 试错，再让真人连接**：把高风险磨合前置到虚拟空间。
3. **结果必须可执行**：输出不仅要“像”，还要能指导真实协作。
4. **强叙事但不失可实现性**：保留赛博感、知乎感、文学感，同时能在 MVP 内落地。
5. **主链路优先**：所有功能都应服务“先验证协作兼容性，再决定是否进入现实连接”。

## 5. 核心用户流程

1. 用户完成 `W-MBTI 40 题标准量表`。
2. 系统生成 `双核名片`，展示用户在生活态与职场态中的差异化协作画像。
3. 用户完成画像后，可选择把 `双核预览` 发布到公开广场。
4. 用户在广场中查看其他真实用户与受控 `agent 用户` 的双核预览与完整名片，并发起单向协作意向。
5. 双方互相看中后，不直接交换联系方式，而是由系统在后台自动生成 `A2A 赛博沙盘`。
6. 双方 Agent 围绕真实职场议题完成三段协商链路：
   - `立场确认`
   - `冲突协商`
   - `规则敲定`
7. 系统输出 `兼容性结论`：
   - 可继续深入
   - 可合作但需明确边界
   - 建议终止连接
8. 用户回到 `/me` 查看协商回放；若通过，则生成 `专属协作说明书` 与 `知乎护身符建议`。
9. 双方确认后，执行 `一键交换现实名片`。

补充说明：

- 当前实现已引入 `Second Me 优先` 的身份解析。
- 已登录用户默认从 `我的流程中心 (/me)` 恢复自己的测评、沙盘与 Reconnect 进度。
- `demo-you` 仅保留为开发 / 评审环境下的 fallback，不再作为默认公开入口。
- 当前转化优化方向为：`缩短回选路径 + 引入受控 agent 供给 + 最小漏斗埋点`。

## 6. 功能全景图（设想与实现矩阵）

| 模块 | 功能点 | 设想描述 | MVP 实现 | 后续增强 | 关键依赖 / 风险 |
| --- | --- | --- | --- | --- | --- |
| 双核人格生成器 | W-MBTI 40 题标准量表 | 用 40 道高密度二选一题，提取用户四个职场底层维度 | 本地题库 + 维度计分引擎 + 结果解释模板 | 自适应加题、置信度校准、版本化题库 | 题目科学性、结果解释的可信度 |
| 双核人格生成器 | 双核名片展示 | 生成兼具极客感与文学感的双态角色小传 | 卡片页展示：类型、双态标题、优势、雷区、沟通建议、广场预览字段 | 可分享海报、动态角色皮肤、时间线案例 | 文案质量、视觉表达风格统一 |
| A2A 赛博沙盘 | 双盲谈判引擎 | 双方 Agent 在后台进行多轮问答与协商 | 基于双方人格画像和意图的三段协商链路编排，输出结构化回放与总结 | 多 Agent 厅、可视化对战、历史回放 | Agent 质量稳定性、成本控制 |
| A2A 赛博沙盘 | 知乎热榜“修罗场”考题 | 用知乎职场热议问题做推演题，测试价值观咬合度 | MVP 先用人工精选题池 / 配置化题库，保留知乎来源字段 | 接入实时热榜、话题聚类、自动选题 | 知乎数据接入方式待确认，需准备降级方案 |
| A2A 赛博沙盘 | 自动排雷机制 | 自动识别不可调和的底层冲突并终止连接 | 规则引擎 + LLM 冲突归因，输出终止原因 | 可解释冲突图谱、冲突严重度分层 | 误杀率与漏判率需要平衡 |
| 匹配广场 | 公开广场与互选 | 让已完成画像的真实用户先在广场中相遇，再异步互选 | 广场发布、双核预览、协作意向、互选成功后自动创建 A2A session | 排序推荐、公开广场运营、可见性策略 | 首版 live 用户密度与冷启动 |
| 匹配广场 | 转化闭环优化 | 提升“浏览 -> 看卡 -> 发起 -> 回选 -> 互选 -> 查看说明书”的完成率 | incoming 一键回选、名片 CTA、关系前置排序、最小埋点 | 精排推荐、通知提醒、漏斗后台 | 互选率低、供给不足 |
| 匹配广场 | agent 用户供给 | 用受控代理身份补充早期广场供给 | `kind=agent`、可被互选、可进入 A2A 与说明书、终点为代理名片 | 自治代理、运营编排、真人转接 | 身份标识必须明确，不能伪装真人 |
| 重塑连接 Reconnect | 生成《专属协作说明书》 | 将匹配结论转化为真实合作建议 | 模板化章节 + AI 生成建议 + 风险提示 | 90 天协作行动计划、角色分工建议 | 输出不能空泛，必须可执行 |
| 重塑连接 Reconnect | 知乎高赞“护身符” | 附送与组合人格相关的可信职场建议 | MVP 先用人工维护的高质量内容池与引用摘要 | 接入可信搜索、自动检索与排序 | 外部内容版权、引用质量与时效 |
| 重塑连接 Reconnect | 一键交换现实名片 | 在读完报告后自愿从虚拟连接进入现实连接 | 双方二次确认后展示联系方式 / 名片页 | 数字名片、二维码、第三方社交账号绑定 | 隐私保护、误触风险 |
## 7. 三大模块详细定义

### 模块一：双核人格生成器

#### 目标

用结构化测评与生成式表达，构建用户可信、可读、可用的双态人格画像。

#### 输入

- 用户回答的 40 道二选一题
- 基础标签：职业阶段、目标场景、当前困境

#### 输出

- 四维人格结果
- 生活态 / 职场态双核标题
- 优势与风险点
- 推荐协作方式

#### MVP 验收标准

- 用户可在 8 分钟内完成测评
- 系统可稳定生成双核名片
- 结果至少包含 3 类可执行建议：沟通、分工、冲突处理

### 模块二：A2A 赛博沙盘

#### 目标

在真人交换联系方式前，用 Agent 替用户进行一次“低成本预演合作”。

#### 输入

- 双方双核名片
- 双方组队意图
- 预设或实时抓取的知乎职场题

#### 输出

- 多轮问答记录
- 兼容性评分
- 冲突标签
- 建议动作：继续 / 谨慎 / 终止

#### MVP 验收标准

- 一次沙盘至少完成 3 个问题回合
- 能输出结构化兼容性结论
- 能在明显冲突场景下触发自动排雷

### 模块三：重塑连接（Reconnect）

#### 目标

将人格互补和沙盘结果沉淀成真实世界可执行的协作说明。

#### 输入

- 双方人格画像
- 沙盘问答记录
- 冲突与互补点

#### 输出

- 《专属协作说明书》
- 知乎高质量建议摘要
- 交换联系方式确认页

#### MVP 验收标准

- 协作说明书至少含有：互补优势、风险提醒、沟通建议、分工建议
- 联系方式交换必须是双向确认
- 输出内容不能只有抽象形容词，必须有行动建议

## 8. MVP 范围定义

### 必做

1. `W-MBTI 40 题测评`
2. `双核名片生成`
3. `公开广场 + 双向互选`
4. `1v1 Agent 双盲沙盘`
5. `规则 + LLM 自动排雷`
6. `专属协作说明书`
7. `双向确认后交换联系方式`

### 可延后

1. 实时知乎热榜接入
2. 多人沙盘大厅
3. 可分享人格海报
4. 90 天协作计划
5. 实时在线大厅与多人即时协商

### 当前默认技术决策

1. 第一优先级是 `主链路契约 + 测试`，不是页面包装。
2. 持久化采用 `Prisma + SQLite`。
3. 联系方式第一版采用 `站内数字名片`。
4. Second Me / 知乎采用 `mock-first, adapter-ready`，真实联调不阻塞主流程验收。
5. 当前用户解析采用 `Second Me 优先 + 开发态 demo fallback`。
6. Second Me 当前以 `低置信度量表复核 + 里程碑记忆写回` 两层能力接入主链路。
7. `agent_memory/ingest` 是写回主通道；`note/add` 仅用于说明书摘要的 best-effort 辅助写回。
8. 上线后优先优化 `转化闭环`，不先进入复杂推荐系统。

## 9. 推荐技术拆分

### 前端

- 响应式 Web 应用优先，兼容移动端展示
- 页面形态至少包括：
  - 我的流程中心页
  - 测评页
  - 双核名片页
  - 匹配 / 广场页
  - 沙盘对话页
  - 协作说明书页

### 后端能力

- `profile-service`：人格测评、结果存储、名片生成
- `match-service`：匹配意图、候选推荐、连接状态管理
- `sandbox-service`：Agent 编排、回合控制、结论生成
- `content-service`：知乎题池 / 护身符内容管理
- `report-service`：协作说明书生成与结构化输出

### A2A 能力抽象

每个用户至少拥有一个可被调用的个人 Agent，其标准能力建议定义为：

- `read_profile`
- `state_intent`
- `debate_topic`
- `detect_conflict`
- `summarize_fit`
- `generate_contract`

## 10. 核心数据对象

### User

- `id`
- `nickname`
- `kind`
- `career_stage`
- `goal_type`
- `contact_card`

### PersonalityProfile

- `user_id`
- `base_wmti_result`
- `effective_wmti_result`
- `life_mode_title`
- `work_mode_title`
- `strengths`
- `risks`
- `collaboration_style`
- `second_me_review`

### AnalyticsEvent

- `id`
- `name`
- `actor_user_id`
- `actor_kind`
- `target_user_id?`
- `target_kind?`
- `session_id?`
- `source_page`
- `meta_json`
- `created_at`

### SecondMeAccount

- `user_id`
- `secondme_user_id`
- `shades_snapshot`
- `softmemory_snapshot`
- `profile_signals`
- `profile_fetched_at`

### MatchIntent

- `user_id`
- `target_type`
- `looking_for`
- `must_have`
- `red_flags`

### SandboxSession

- `session_id`
- `user_a`
- `user_b`
- `topics`
- `rounds`
- `fit_score`
- `conflict_flags`
- `recommendation`

### CollaborationManual

- `session_id`
- `summary`
- `complements`
- `risk_points`
- `communication_rules`
- `work_split_suggestions`
- `zhihu_advice_refs`

### SecondMeWriteback

- `target_key`
- `user_id`
- `milestone`
- `preview`
- `payload`
- `consented`
- `status`
- `written_at`

## 11. 主状态机与接口契约

### 主状态机

`draft -> assessed -> matched -> sandboxing -> filtered_out | reconnect_ready -> exchanged`

说明：

1. `draft`：用户尚未完成测评。
2. `assessed`：已完成测评并生成双核名片。
3. `matched`：已发起匹配并创建沙盘会话，但还未真正推进回合。
4. `sandboxing`：沙盘回合已开始，但还未 finalize。
5. `filtered_out`：已完成结论判断，系统建议终止连接。
6. `reconnect_ready`：已完成结论判断，允许进入说明书与双向确认。
7. `exchanged`：双方都已确认，站内数字名片可见。

### 主链路 API 契约

#### `POST /api/assessment/submit`

输入：

- `answers`: 40 道 `questionId + optionKey`
- `meta.name / roleTag`
- 当前用户由服务端从 `Second Me session` 或开发态 demo 上下文推导

输出：

- `state = assessed`
- `baseProfile`
- `effectiveProfile`
- `correction`
- `profile`
- `card`
- `writebackPrompt?`

失败条件：

- 题目未答满
- 存在重复 `questionId`
- 存在非法题目 ID
- 当前用户不存在

#### `POST /api/match/start`

输入：

- `targetProfileId`
- `topicId?`
- 当前用户由服务端推导

输出：

- `intent`
- `session`

失败条件：

- 发起方尚未完成测评
- 目标画像不存在
- 当前用户不存在

#### `POST /api/sandbox/round`

输入：

- `sessionId`
- `roundIndex?`

输出：

- `sessionId`
- `topic`
- `state`
- `round`
- `conflictFlags`

失败条件：

- `sessionId` 缺失或不存在
- 回合越界
- 跳轮推进
- 当前用户不是该会话参与方

#### `POST /api/sandbox/finalize`

输入：

- `sessionId`

输出：

- `session`
- `manual`
- `secondMeEvidenceSummary?`

失败条件：

- 会话不存在
- 未完成 3 轮沙盘
- 当前用户不是该会话参与方

#### `POST /api/reconnect/confirm`

输入：

- `sessionId`
- `confirmed`
- 正常模式下默认只确认当前用户本人
- 开发态允许显式 actor switch，用于双视角演示

输出：

- `state`
- `cards`

失败条件：

- 会话不存在
- 会话处于 `filtered_out`
- 单边确认时禁止返回真实联系方式
- 当前用户不是该会话参与方

#### `GET /api/me`

输出：

- `currentUser`
- `authenticated`
- `hasProfile`
- `needsAssessment`
- `secondMeProfileSyncedAt`
- `pendingWritebacks`
- `recentWritebacks`

用途：

- 作为页面恢复当前身份与流程状态的统一入口

#### `GET /api/me/profile`

输出：

- `currentUser`
- `profile`
- `card`
- `secondMeReview`
- `needsAssessment`
- `pendingWritebacks`

#### `GET /api/me/sessions`

输出：

- `currentUser`
- `groups.sandboxing`
- `groups.reconnect_ready`
- `groups.exchanged`
- `groups.filtered_out`

用途：

- 驱动 `/me` 会话中心与继续推进入口

#### `POST /api/secondme/writeback`

输入：

- `milestone`
- `assessmentId?`
- `sessionId?`
- `consented`

输出：

- 单条 `writeback preview/status`

失败条件：

- 当前用户未绑定 Second Me
- 目标 assessment / session 不存在
- 上游写回失败

## 12. 风险与约束

1. **心理测评可信度风险**：避免宣称临床级准确，产品表达应聚焦“职场协作画像”而非人格定论。
2. **知乎数据接入风险**：若实时接口不可用，必须保留人工题池与内容池作为降级方案。
3. **隐私风险**：联系方式只能在双向确认后解锁，沙盘期间默认匿名。
4. **Agent 结论幻觉风险**：关键判定要保留规则兜底与结构化解释。
5. **文案风格风险**：如果文学化表达过度，可能损害可执行性，需平衡“酷感”与“清晰”。

## 13. 里程碑建议

### Milestone 1：概念验证

- 完成 40 题题库与计分逻辑
- 产出双核名片静态页
- 跑通 1 轮沙盘对话 Demo

### Milestone 2：MVP 可演示版

- 跑通完整链路：测评 -> 名片 -> 沙盘 -> 协作说明书 -> 交换名片
- 接入基础内容池

### Milestone 3：评审优化版

- 优化视觉叙事与角色表达
- 补充排雷解释与协作建议可信度
- 增加知乎生态挂钩展示

## 14. 当前待确认问题

1. `W-MBTI` 题库后续是否需要引入版本二和置信度校准机制。
2. Second Me 的登录态是否需要从“cookie + SQLite 双写”进一步演进为完全数据库驱动。
3. Second Me 的画像复核后续是否要扩展到更多维度，而不仅是低置信度轴。
4. 知乎实时数据接入方式是否会提供官方可用源，否则继续长期采用内容池模式。

## 15. 一句话总结

**双核职场** 的核心不是“测出你是什么人”，而是“提前验证你和谁能一起把事做成”。它用双核人格理解个体，用 A2A 沙盘验证关系，用协作契约交付结果。
