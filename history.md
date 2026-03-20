# History

## 2026-03-19

### 已完成

- 修复“正在生成双核名片...”容易卡住的问题，并统一收口交互请求态：
  - `assessment` 提交改为明确的 async 提交流程，成功后直接浏览器跳转到双核名片页
  - `plaza / demo match / arena / reconnect / Second Me 写回` 全部移除了 `startTransition(async ...)` 这种容易让加载态失真的写法
  - live 互选成功后会直接跳到 `/arena/[sessionId]`，不再停留在模糊的 pending 状态里
- 为 Second Me 上游请求增加超时保护：
  - `apps/web/lib/secondme/client.ts` 已对 token exchange、refresh、JSON API 和 stream 请求统一加上超时控制
  - 当 `user/shades / softmemory / act` 响应过慢时，会尽快失败并回退，而不是拖住测评提交流程
- 修复 Next dev / build 产物互相踩踏的问题：
  - `apps/web/next.config.ts` 已将开发环境产物目录切到 `.next-dev`
  - 避免本地同时存在 build 与 dev 时出现 `/apps/web/.next/server/app/me/page.js` 缺失这类 `ENOENT`
- 继续优化全站视觉骨架，重点强化“档案页 / 信号面板 / 协作工单”的信息感：
  - 共享 `globals.css` 已增加更明确的背景层次、面板质感、sticky header、hover/focus 态和专区样式
  - 双核名片页已重排成 `名片摘要 + 配对前摘要 + 四维画像 + Second Me 复核` 的 dossier 结构
  - 公开广场页已强化为 `我的广场卡片 + 信号板 + plaza feed` 的版式，不再只是表单和列表堆叠
- 浏览器验证已确认：
  - `/assessment?demo=1` 已支持逐题作答、自动进入下一题，且不再展示“倾向”提示
  - demo 测评已可完整提交并落到 `/card/demo-you?demo=1`
  - `/card/demo-you?demo=1`、`/me?demo=1`、`/match?demo=1` 页面均已按新版结构正常渲染，无前端 console error

- 将 live 用户主链路从“单边候选演示流”推进为“公开广场 + 互选 + 自动 A2A 回放”：
  - `/match` 已升级为真实用户的公开广场入口，支持发布 / 撤下自己的双核预览
  - 新增 `PlazaListing` 与 `MatchSignal`，单向协作意向不再直接等同于 `MatchIntent`
  - 互选成功后会自动创建 `source=plaza` 的 `SandboxSession`，并直接生成三段 A2A 协商回放
  - `/me` 已新增“我的广场状态 / 等待回应 / incoming 意向 / A2A 协商已生成”信息层
- 将 A2A 从“手动推进回合”扩展为“结构化协商链路”：
  - `SandboxRound` 已补充 `roundType / issue / tensionPoint / concession / boundary / synthesis / roundJson`
  - live plaza session 默认直接生成 `立场确认 / 冲突协商 / 规则敲定` 三段协商
  - `/arena/[sessionId]` 对 plaza session 已改为协商回放视图，demo 流仍保留手动推进
- 将双核画像从“结果页字段”升级为“广场可读 + 沙盘可用”的 dossier：
  - `PersonalityProfile` 已新增 `collaborationThesis / bestWith / frictionWith / preferredWorkSplit / badStartPattern / likelyMisread / suggestedLead`
  - 双核名片页已展示“适合一起做什么 / 不适合怎样开始 / 最怕的协作误解 / 建议谁先主导”
  - 公开广场卡片与 Second Me A2A prompt 已统一读取这组增强后的双核字段
- 新增 live 主链路 API：
  - `GET /api/match/feed`
  - `POST /api/match/publish`
  - `POST /api/match/signal`
  - `GET /api/me/plaza`
- 做了旧画像兼容回填：
  - 已存在的 `PersonalityProfile` 即使数据库里还没有新 dossier 字段，也会在读取层自动回填默认值
  - 这样旧用户不需要重做测评，也能直接进入新的公开广场与双核展示口径

- 将 Second Me 从“后台一次性 Act 调用”推进为主链路里的 `画像校正层 + 记忆沉淀层`：
  - 新增 `syncSecondMeProfileSnapshot()`，接入 `user/shades`、`user/softmemory` 与结构化信号提炼
  - 量表支持 `低置信度轴 <= 0.2` 时，由高置信 Second Me hint 进行最多 `2` 个维度的复核
  - `PersonalityProfile` 已落地 `baseWmti / effectiveWmti / secondMeReview`
- 落地 Second Me 半显式展示：
  - 双核名片页新增 `Second Me 复核`
  - Reconnect / 协作说明书页新增 `Second Me 依据`
  - Arena 页新增轻量 `Second Me` 判定标记
  - `/me` 工作台新增画像同步状态、待写回事项、最近写回结果
- 落地里程碑写回与用户同意：
  - 新增 `assessment_completed / sandbox_finalized / manual_generated / reconnect_exchanged`
  - 新增通用路由 `/api/secondme/writeback`
  - 写回默认走 `agent_memory/ingest`
  - `manual_generated` 对 `note/add` 采用 best-effort，不阻塞主流程
- 扩展持久化模型：
  - `SecondMeAccount` 增加 `shadesJson / softMemoryJson / profileSignalsJson / profileFetchedAt`
  - `PersonalityProfile` 增加 `baseWmtiJson / correctionJson / secondMeEvidenceJson`
  - 新增 `SecondMeWriteback` 表承接 preview、状态、错误与重试
- 补齐测试与回归：
  - 新增 Second Me 校正规则测试
  - 新增写回 route 测试
  - 修复了带冒号的本地 Second Me 用户 ID 无法打开名片页的问题，统一对 `/card/[userId]` 做 encode/decode
- 浏览器烟测已确认：
  - `/me` 可看到 Second Me 同步状态与待处理写回事项
  - `/card/sm:...` 可看到 `Second Me 复核`
  - `/reconnect/[sessionId]` 可看到 `Second Me 依据` 与里程碑写回提示

- 根据最新范围决策，已将“抽卡 / 灵感卡”相关能力从项目当前规划与实现中移除：
  - 删除 `/draw` 页面与 `/api/draw`
  - 删除导航、Arena 旁路入口和相关测试
  - 删除领域类型中的 `InspirationDraw`
  - 同步更新 `SPEC.md` 与 `AGENTS.md`，将项目收束为围绕主链路的三大模块

### 最新验证

- `pnpm typecheck` 通过
- `pnpm test` 通过
- `pnpm build` 通过
- 浏览器已验证：
  - `/match` 在 live 登录态下可显示公开广场发布表单
  - 发布后 `/me` 会同步显示“已公开”的广场状态
  - live feed 在无其他公开用户时会给出正确空状态，不再回退成默认候选列表

## 2026-03-17

### 已完成

- 将 [SPEC.md](/home/server/A2A/mbti/SPEC.md) 从叙事型启动稿升级为可执行 MVP 规格：
  - 明确主状态机
  - 补齐主链路 API 契约与失败条件
  - 锁定 `Prisma + SQLite`、`站内数字名片`、`mock-first`
- 接入 Prisma 7 + SQLite 持久化底座：
  - 新增 `prisma/schema.prisma`
  - 新增 `prisma.config.ts`
  - 新增数据库 client 与 workflow repository
  - 主链路状态已落库，不再依赖无状态 demo 即时重算
- 完成主链路 API 重构：
  - `/api/assessment/submit`
  - `/api/match/start`
  - `/api/sandbox/round`
  - `/api/sandbox/finalize`
  - `/api/reconnect/confirm`
  - `/api/draw`
- 保留并强化 Second Me 集成：
  - 登录、刷新和代理路由继续可用
  - Second Me 登录态会尽力同步写入 SQLite
  - 主链路依然支持外部能力失败时的本地降级
- 建立测试优先的项目回归面：
  - 领域规则测试
  - 主流程仓储测试
  - 主流程 route 集成测试
  - Second Me auth route 测试
- 当前验证状态：
  - `pnpm test` 通过
  - `pnpm typecheck` 通过
  - `pnpm build` 通过

### 本轮继续推进

- 将页面从“查看器”推进为“可执行主流程”：
  - 测评页已支持真实作答并提交生成双核名片
  - 匹配页已支持选择候选人与题目并发起沙盘
  - 沙盘页已支持逐轮推进与 finalize
  - Reconnect 页已支持双向确认演示并解锁数字名片
  - 抽卡页已支持真实调用 `/api/draw`
- 将主链路从“单演示用户”推进为“Second Me 优先的当前用户上下文”：
  - 新增 `resolveCurrentUserContext()`，优先从 Second Me 会话映射本地 `User`
  - `demo-you` 仅在开发态 `?demo=1` 下回退，不再作为默认公开入口
  - `SecondMeAccount` 写入时会同时绑定本地 `User`
- 新增“我的流程中心”：
  - 新增 `/me` 页面，聚合当前身份、双核名片、进行中沙盘、待确认 Reconnect、已完成连接与已终止连接
  - 页面支持从既有 `sessionId` 恢复到 `/arena/[sessionId]` 与 `/reconnect/[sessionId]`
- 主流程 API 改为服务端推导当前操作者：
  - `/api/assessment/submit`
  - `/api/match/start`
  - `/api/sandbox/round`
  - `/api/sandbox/finalize`
  - `/api/reconnect/confirm`
  - 新增 `/api/me`、`/api/me/profile`、`/api/me/sessions`
- Reconnect 演示方式从“模拟对方确认”升级为“开发态双视角切换”：
  - 正常模式下只允许当前用户确认自己
  - 开发态可通过 actor switch 切到对方视角完成评审演示
- 仓储层补齐了当前里程碑需要的状态能力：
  - `getCurrentUserProfile()`
  - `listUserSessions()`
  - `getSessionParticipants()`
  - `assertSessionActor()`
- 测试面继续扩充：
  - 新增当前用户上下文与 `/api/me*` 测试
  - 新增会话访问控制测试
  - 新增仓储层 session list / actor 校验测试
- 将产品入口从“评审页”收束为“正式入口 + 工作台”：
  - 首页 `/` 改为双模产品入口，按 `未登录 / 已登录待测评 / 已登录可恢复流程` 输出不同主叙事与 CTA
  - `/me` 从信息聚合页升级为工作台入口，首屏先展示当前身份、最推荐下一步动作和会话恢复入口
  - header 的 `连接 Second Me / 开发演示 / 当前身份` 规则已统一，开发态下会明确显示 demo 状态
- 抽离入口展示层结构，减少 page 内的条件分支：
  - 新增 `apps/web/lib/entry-view.ts` 负责首页与工作台的 view model
  - 新增入口组件：`EntryHero`、`NextActionCard`、`SessionList`、`ProofRail`
  - 首页与 `/me` 的文案已切到产品入口口径，不再展示“建设中 / 继续推进中”式说明
- 补齐入口层验收与细节收尾：
  - 新增 `tests/entry-view.test.ts`，锁住首页与工作台的 CTA 优先级和空状态策略
  - `vitest` 配置补充对 `.tsx` 测试文件的收集支持
  - 新增 `apps/web/app/icon.svg`，清掉入口页的 favicon 404 噪音
- 手动浏览器验收已覆盖关键状态：
  - 未登录 `/`
  - 未登录 `/me`
  - `?demo=1` 的首页入口
  - `?demo=1` 的工作台恢复态
- 补齐了主链路内部页的“判定依据”与“排雷解释”：
  - Arena 页现在会展示知乎题源、风险标签中文化、冲突标签人类可读解释和建议动作
  - Reconnect 页现在会展示本次判定、题源、冲突解释和可执行排雷建议，而不只是一份静态说明书
  - 新增 `apps/web/lib/conflict-explainer.ts` 作为结构化冲突解释层
  - `getReconnectPayload()` 已补充 `topic / fitScore / recommendation / conflictFlags`，用于说明书页展示可追溯依据
- 测试继续扩充：
  - 新增 `tests/conflict-explainer.test.ts`
  - 仓储测试新增对 `Reconnect payload` 判定依据结构的断言
- 按“诗意互动替换清单”统一了主链路关键文案：
  - 首页与品牌辅助说明切换为“我们想知道的，不是你像谁，而是你适合和谁一起把事情做成”
  - 身份入口 / 绑定前改为“先确认你此刻认可的身份进入这里”
  - W-MBTI、匹配、沙盘、说明书、流程中心的说明文案已整体替换为更克制、更有呼吸感的版本
  - 保留了 CTA 行为与状态逻辑，只替换展示层口径，便于设计和前端继续对齐

### 当前已知边界

- 当前的“当前用户上下文”仍以单设备、单浏览器的连续使用为目标，不是实时多终端同步。
- 开发态双视角切换仅用于演示和测试，不改变真实产品里“每人只能确认自己”的规则。
- 首页与 `/me` 已收敛到正式产品入口口径，但主链路内部页面仍可继续统一视觉与叙事风格。
- 浏览器级 smoke 目前仍以手动验收为主，还没有独立的 Playwright 项目测试套件。

### 最新验证

- `pnpm test` 通过
- `pnpm typecheck` 通过
- `pnpm build` 通过
- 浏览器手动 smoke 验收通过

### 本轮浏览器测试与修复

- 针对 live 主链路补做了浏览器验收：
  - `/me` 已正确展示 `我的广场状态 / 等待对方回应 / 别人正在看你 / A2A 协商已生成 / 待确认 Reconnect`
  - `/match` 已正确展示公开广场、当前双核预览和空状态提示
  - `/card/sm:casey` 已正确展示增强后的 dossier 字段与 `Second Me 复核`
  - `/reconnect/[sessionId]` 与 `/arena/[sessionId]` 已确认能展示 `Second Me 依据`、排雷解释与协商回放
- 浏览器测试中发现并修复了一个真实问题：
  - `Second Me 记忆写回` 的待处理预览会复用旧的 `previewJson`
  - 当画像经过 `Second Me` 低置信度校正后，名片页和流程中心中的“当前协作像”仍可能显示旧值
  - 现已改为在读取 `pending` 写回记录时，按当前 `PersonalityProfile / Session` 重新刷新预览，避免展示过期结果
- 已补一条回归测试锁住该问题：
  - `tests/secondme-correction.test.ts` 现在会校验 pending writeback 预览能跟随最新复核结果刷新

### Second Me 登录链路修复

- 修复了一个会阻断 Second Me OAuth callback 的配置问题：
  - `.env.local` 中如果显式保留 `SECONDME_TOKEN_ENDPOINT=` 或 `SECONDME_REFRESH_ENDPOINT=` 空值
  - 旧逻辑会把空字符串当成有效配置，导致 callback 在 `fetch('')` 时落成 `Failed to parse URL from`
- 现已在 `apps/web/lib/secondme/config.ts` 中统一把空白环境变量视为未配置，并自动回退到默认 Second Me API 地址
- 运行态已验证：
  - `/me` 恢复正常访问
  - `/api/auth/login?next=/me` 正常跳转到 Second Me OAuth
  - 使用假授权码访问 callback 时，错误已变为上游返回的 `Invalid authorization code.`，说明 token 交换 URL 已恢复正确

### 登录入口与测评页交互改造

- 修复了“点击登录先弹 `TypeError: Failed to fetch` 再跳转”的体验问题：
  - 原因是多个页面和入口组件仍用 `next/link` 指向 `/api/auth/*`
  - App Router 会先把它当成一次 server navigation，导致浏览器侧先抛一轮 fetch 错误
  - 现已新增 `apps/web/app/_components/app-link.tsx`，并把所有 `Second Me 登录 / 退出` 入口切成浏览器级跳转
- 测评页已从“40 题平铺”升级为分步式答题流：
  - 每次只展示一道题，右侧为主问题卡片，左侧展示当前维度、四维进度和 40 题快速定位
  - 增加整体进度条、当前维度说明、上一题 / 下一题 / 跳题能力
  - 保留原有提交逻辑，但交互改成更适合真实填写的节奏
- 为了支撑这次改版，`apps/web` 已接入 Tailwind CSS（带 `tw-` 前缀且关闭 preflight，避免冲击现有全站样式）：
  - 新增 `apps/web/postcss.config.mjs`
  - 新增 `apps/web/tailwind.config.ts`
  - `apps/web/app/globals.css` 已引入 Tailwind 指令
- 运行态已验证：
  - 匿名访问 `/assessment` 可正常展示登录引导
  - 点击“连接 Second Me”会直接进入 `second.me/oauth`，不再出现前端 `Failed to fetch`
  - `/assessment?demo=1` 可正常进入新的分步测评流，选择答案和切换到下一题正常

### 测评页微调

- 测评选项里不再展示 `对应倾向：E / I / S / N ...` 这类标签，避免用户在作答时被类型结果牵引
- 交互改成“选择后自动下一题”：
  - 非最后一题在选中后会直接跳到下一题
  - 最后一题仍保留显式提交，避免误触直接生成结果
- 当前动作区的提示文案也同步改成自动跳题口径
