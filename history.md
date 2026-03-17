# History

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
