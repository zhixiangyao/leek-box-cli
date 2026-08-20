---
name: leek-box-cli
description: leek-box-cli 项目规范与开发经验. 当任务涉及修改/扩展本项目的界面, 命令, 组件, hooks, 行情数据源, 测试与验证时使用. Ink 通用 API 参考见 ink skill.
---

# leek-box-cli 项目规范与经验

终端股票自选股看板, 基于 Ink 构建的交互式 CLI. 技术栈: `ink@7.1.1` + `react@19.2.8` + `zustand@5` + `meow`, ESM 模式, `tsx` 开发 / `vite` 构建. 零外部工具依赖 (行情走 Node 原生 `fetch`, 无需 curl 等).

## 架构与目录

```
src/cli.tsx          meow 解析子命令 -> render 前 setState 写入 router store 初始页 -> render(<App/>, {alternateScreen, concurrent}); 无命令时默认进 stock-list
src/app.tsx          顶层: 页面路由 + 全局 esc/q 键 + 条件渲染 MenuDialog/StockDetailDialog 浮层 + 边框叠加层 (BorderTitle/BorderUpdatedAt) + StatusBar (按页面动态 hint)
src/components/       通用组件 (Dialog 浮层外壳 (flexbox 居中 + title 边框标题 + 导出 DIALOG_CHROME) / MenuDialog / StockDetailDialog/ (index + lib + hooks/useStockDetailDialog) / QuoteRow (表格行共享渲染) / TextInput / Message / StatusBar / BorderTitle / BorderUpdatedAt / BackToStockList / WindowSizeGuard / IntradayChart)
src/hooks/            应用级跨组件 hooks (useOverlayOpen: 菜单/详情任一浮层打开 -> 背景遮罩变暗 + 输入面统一守卫 / useClock: 上海时区时钟, 按 format 返回不同形态时间字符串)
src/stores/          zustand store, 全部应用状态的唯一来源, 文件名统一 `useXxxStore.ts` (useRouterStore / useMenuStore / useStockListStore / useAddStockStore / useRemoveStockStore / useStockDetailStore)
src/screens/<cmd>/   每个命令一个目录: index.tsx (纯渲染, 整店订阅 store, 不持有状态) + hooks/ (页面副作用: 生命周期/轮询/快捷键/可视行测量) + lib.ts (页面级纯函数, 如 StockList 的 lib.ts)
src/api/             接口处理统一入口: index.ts (腾讯行情 fetchQuotes / fetchIntraday / normalizeCode) + types.ts (接口类型 Quote / IntradayPoint); 接口类型一律放 types.ts
src/lib/              watchlist.ts (自选股存储) / screens.ts (Screen 类型 + 页面 title/hint 元数据) / format.ts (行情数字格式化 + formatClock 时间戳 + A股涨跌色 trendColor) / columns.ts (全量列定义 COLUMNS + displayWidth/cell + 通用行构造 headerRow/quoteRow/missingRow) — 与界面无关的纯逻辑
```

- 每个命令页面是 **step 状态机**: store 持有 step 与动作, `index.tsx` 用 `useXxxStore()` 整店订阅, 按 `step.type` 分支渲染纯展示, 不跑副作用. **非视图逻辑放 `hooks/`**: 生命周期/快捷键封装为 `useXxxPage()` hook (StockList 的 useStockListPage / AddStock 的 useAddStockPage / RemoveStock 的 useRemoveStockPage), 纯函数放命令目录的 `lib.ts` (StockList 的 `lib.ts`).
- **store 常驻进程级, 只承载展示数据与纯动作**: 轮询循环/异步副作用在页面 hook 内模块级自维护 — stock-list 挂载 effect 启动 5s 轮询、卸载清理; add-stock 挂载 `reset()` (防残留上次流程); remove-stock 挂载 `loadEntries()` (重新加载列表). 异步动作用模块级 `generation` 代数守卫 (`isStale(gen)` 丢弃过期结果, 离开页面后旧响应不污染新流程).
- 轮询循环的非响应式状态 (timer / inFlight / cancelled / interval) 是页面 hook 文件内**模块级变量**, 不进 zustand state; state 只承载展示数据.
- 输入校验状态 (按输入步分组 `xxxInput: { error, key }`) 也提升在 store 内; y/n 解析纯函数共用 `src/lib/yn.ts`. **stores 目录只放 zustand store**: 无状态纯函数放 `src/lib` (依赖方向 lib <- stores <- 组件). 组件内部瞬时 UI 状态 (TextInput 的 value / MenuDialog 的 highlight) 留在组件内; 自刷新的时钟抽成跨组件 hook `useClock`.
- 页面组件无 props (输入面统一用 `useOverlayOpen()` 守卫 — 菜单/详情任一浮层打开即失活, 返回看板由 `BackToStockList` 自行订阅 router store, 不钻透 onBack); 映射在 `app.tsx` 的 `screenComponentMap`.
- 新增子命令需同步注册**四处**: `lib/screens.ts` (Screen 联合类型 + SCREEN_META 一条 + SCREEN_LIST), `cli.tsx` (meow 的 `commands: SCREEN_LIST` + helpMessage), `app.tsx` 的 `screenComponentMap`, `MenuDialog.tsx` 的 `MENU_ITEMS`; 并新增对应 store.
- 文件后缀显式导入 (`./xxx.ts` / `.tsx`), ESM 风格.

## 交互架构

- **启动直接进 stock-list** (无独立 menu 屏); 菜单是 `esc` 调起的**浮层弹窗** (`MenuDialog`).
- `router store` 状态: `screen` (页面) + `goTo(screen)` 切页; 菜单弹窗开关独立在 `useMenuStore` 的 `open` (两者互不影响), `goTo` 不关弹窗 — 关弹窗由调用方显式处理 (MenuDialog 选择后先 `close()` 再 `goTo`).
- **全局按键** (`app.tsx` 的 useInput): `esc` -> **优先级 详情弹窗 > 菜单** (详情开着先关详情, 不会误开菜单; 详情状态在 `useStockDetailStore.stock`); `q` -> 仅 `!overlayOpen` 时 `useApp().exit()` (菜单/详情任一开着时 q 不退出, 防止误触).
- **MenuDialog**: 基于共享外壳 `components/Dialog.tsx` (全屏 `position="absolute"` Box + flexbox `alignItems/justifyContent="center"` 水平垂直居中, round 边框, 内容区不透明黑底 + padding; **只收 `width`, 高度自适应**; 导出 `DIALOG_CHROME = 4` (边框 2 + paddingX 2) 供调用方推导内容宽度, 如 StockDetailDialog 的 `CONTENT_WIDTH = width - DIALOG_CHROME`; 标题 `菜单` 经 `title` 参数由 BorderTitle 画在弹窗边框线上, 相对带边框 Box `top={-1} left={1}`), `↑/↓` 高亮 + `enter` 确认 + 数字键 `1-4` 快捷 (4 = 退出); 高亮项反色 (`backgroundColor="cyan"` + `color="black"`).
- **看板行选择**: `↑/↓` 移动 `useStockListStore.selectedIndex` (quotes + missing 拼接的行序列, 越界钳制), 选中行外层 Text 加 `inverse` 反色 (保留涨跌色语义, 涨红底/跌绿底/平灰底); `enter` 按选中行打开详情弹窗 (hook 里用两个 store 的 `getState()` 接线, store 间不互相 import). 菜单/详情任一打开时看板全部快捷键静默 (`isActive: !overlayOpen`).
- **StockDetailDialog 浮层**: 共用 `components/Dialog.tsx` 外壳 (内部文字一律本地 Text + bright 保持鲜艳, 见背景遮罩层), 标题行 (名称/代码/现价/涨跌幅, 随趋势着涨跌色) 经 `title` 参数画在边框上, 内容区不含标题行; 宽度 92, 高度自适应; 行情区是**与看板同款表格**: `QuoteRow` 渲染 `headerRow(DETAIL_COLUMNS)` 表头 + `quoteRow(DETAIL_COLUMNS, quote)` 单行 (今开/昨收/最高/最低/成交量/成交额/换手率/振幅/量比/总市值 10 列; quote 缺失时 `missingRow` 兜底全 `--`; 停牌整行 `--`), 行构造函数参数化列集 (看板传 `STOCK_LIST_COLUMNS`, 详情传 `DETAIL_COLUMNS`, 定义在 `StockDetailDialog/lib.ts` 从 COLUMNS 挑选); 内容宽由 `DETAIL_COLUMNS` 列宽和 + 列间分隔推导, 弹窗宽度按此推导不要单独改; 打开时背景同样经 `useOverlayOpen` 变暗遮罩; 不注册 useInput (esc/q 由 app.tsx 全局守卫). 现价/基础信息从看板 5s 轮询的 store 读 (打开详情必在看板页, 轮询必活跃, 零重复拉取). **全项目唯一 selector 例外**: `useStockDetailDialog` 里 `useStockListStore((state) => ...quotes.find(code))` 按 code 派生单只 quote — 轮询每次 set 新 step 对象但 quote 对象引用稳定, selector 用默认 Object.is 比较, 详情弹窗不会每 5s 重渲染 (整店订阅则每次轮询重渲染, 图表会跟着重建); 新代码默认仍整店订阅, 只有"引用稳定且不想随父订阅重渲染"的场景才考虑 selector. 分时数据由 `useStockDetailDialog` hook 30s 轮询 (见轮询模式).
- 页面内返回看板: `BackToStockList` (Enter 返回); 任何页面按 `esc` 也能打开菜单切页.

## 数据源: 腾讯行情接口 (`src/api/index.ts`)

- 端点: `GET https://qt.gtimg.cn/q=sh600000,sz000001` — **免费无需鉴权** (对比: 雪球 quotec 对匿名请求返回空 body, 需要登录 cookie).
- 响应为 **GBK 编码** 文本, 必须 `await res.arrayBuffer()` 后 `new TextDecoder('gbk').decode(buf)` (Node full-ICU; 不要用 `res.text()`, 会乱码).
- 格式: `v_sh600000="f0~f1~...";v_sz000001="...";` — 按 `;` 切分, `/^v_([a-z]{2}\d{6})="([^"]*)"/` 取代码, 字段串按 `~` 切分.
- **字段索引**: 1=名称 2=代码 3=现价 4=昨收 5=今开 6=成交量(手) 30=时间(yyyyMMddHHmmss) 31=涨跌额 32=涨跌幅(%) 33=最高 34=最低 36=成交量(手) 37=成交额(万元) 38=换手率(%) 43=振幅(%) 44=流通市值(亿) 45=总市值(亿) 49=量比. 字段数需 >= 50 守卫 (实测约 60). 振幅可用 `(high-low)/prevClose*100` 自检.
- **normalizeCode 规则**: 去 SH/SZ/BJ 前后缀后须为 6 位数字; `6xx->sh` `5xx->sh(ETF)` `0xx/1xx/3xx->sz` `4xx/8xx/92xx->bj`, 其余 (含 B 股 9xx) 拒绝.
- **接口行为**: 无效代码被静默丢弃; 全部无效返回 `v_pv_none_match="1";` (无匹配条目, 此时 `fetchQuotes` **throw** `未查询到任何行情数据...` — 看板进 error 步, add-stock 进 error 步); 停牌/退市股返回现价 0 的记录 (用 `current <= 0` 判停牌, 看板渲染 `--` + `停牌`); 缺数据 = 请求代码集 − 返回集 (看板渲染灰行 `--` + `无数据`).
- 超时用 `AbortSignal.timeout(8000)`.
- **分时接口** (`fetchIntraday`): `GET https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=sh600000` — JSON (utf-8, 非 GBK): `data.<code>.data.data` 为 `["0930 9.07 1978 1794046.00", ...]`, 每项 "HHMM 价格 累计成交量(手) 累计成交额(元)". 注意: (a) **收盘后带 15:01-15:30 补点, 需裁剪** (保留 `time <= '1500'`, 否则折线/量柱尾部异常); (b) 成交量是**累计值**, 画柱状图需转分钟增量 (当前点 − 上一累计), 直接画累计值会单调递增失真; (c) 正常响应**没有 qt 字段** (qt 只在无效代码的空响应里出现), prevClose 一律用看板 quote 的; (d) 无效代码/非交易时段返回 `["  0"]` 之类空行, 解析后 points 为空数组, 不抛错.

## 自选股存储 (`src/lib/watchlist.ts`)

- 路径: `~/.config/leek-box-cli/watchlist.json` (遵循 `XDG_CONFIG_HOME`), 函数 `watchlistPath()` 导出便于 UI 显示.
- Schema: 裸数组 `[{ code, name, addedAt }]`, 插入序即显示序; `name` 在添加时缓存, 删除页离线也能显示名称.
- 文件损坏时 `loadWatchlist` **throw** (提示用户删文件自愈), 不静默吞错; `saveWatchlist` 前 `mkdir recursive`.

## 轮询模式 (计时在 hook, fetch+写回在 store)

- **分工**: store 提供 fetch+写回动作 (`useStockListStore.refreshQuotes()` / `useStockDetailStore.refreshIntraday(code)`, 异步动作自带陈旧守卫 — 详情检查 `get().stock?.code !== 请求 code`), hook 持有模块级 `poll` (timer / inFlight / cancelled / interval) + **自调度 `setTimeout`** (fetch 完成后才排下一次) + inFlight 守卫 (避免 8s 超时与 5s 间隔重叠), 经 `pollOnce()` 包装调用 store 动作. `useStockListPage` (`src/screens/StockList/hooks/useStockList.ts`) 与 `useStockDetailDialog` (`src/components/StockDetailDialog/hooks/useStockDetailDialog.ts`) 各自维护自己的 `poll`.
- **看板 5s**: 页面挂载 effect 置 `poll.cancelled = false` + 立即 `pollOnce()` + 排下一次; 卸载清理置 `cancelled` + clearTimeout (卸载后落地的 fetch 结果写入 store 无害: 重挂载先置 loading 再立即拉取覆盖). 错误语义: 首次失败 (无旧数据) -> `error` 步; 后续轮询失败 -> **保留旧表格 + 内联黄色 errorLine + 继续轮询自愈** (均在 `refreshQuotes` 内).
- **详情 30s**: 弹窗组件挂载即轮询 (hook effect 依赖 `stock`: 打开/切换股票重启轮询, 关闭即卸载停止); 陈旧响应由 `refreshIntraday` 内 `get().stock?.code !== code` 丢弃 (覆盖关闭与切股两种场景). 失败置 error 步但**继续轮询自愈**.
- 看板快捷键在 `hooks/useStockList.ts` 的 `useInput` 里: `r` 立即刷新 (模块函数 `refreshNow()`, 有 inFlight 则忽略), `-`/`+` 调整轮询间隔 (`adjustPollInterval(±POLL_INTERVAL_STEP_MS)`, 步进 500ms, clamp 到 [1s, 60s], 调整时清掉排程重排让新间隔立即生效, 并经 `setState({ pollIntervalMs })` 同步显示值); 守卫 `{ isActive: !overlayOpen }` (菜单/详情任一打开即静默).

## 界面风格约定

- 界面文案为**中文**, 所有标点用**半角**.
- **界面文案不含任何 emoji**, 新增文案不要加.
- 颜色语义: `magenta` 标题, `cyan` 信息/引导, `yellow` 警告, `red` 错误, `green` 成功, `gray` 占位/光标.
- **A股配色: 涨红跌绿平灰** (`src/lib/format.ts` 的 `trendColor(value)`: >0 red, <0 green, =0 gray), 涨跌幅/涨跌额带显式 `+`/`-` 前缀 (`formatSigned`/`formatPercent`).
- 表格对齐用本地 `displayWidth`/`cell` 辅助 (`src/lib/columns.ts`): CJK 字符按宽度 2 计算, **不要引入 string-width 依赖, 不要硬编码宽度**. 列定义为数据驱动 `{ key: keyof Quote, kind, title, width, render, color?, suspendedText }` (**key 是渲染的 Quote 字段, 列的唯一标识, 挑选/引用用 key 不用中文 title**), 行由 `headerRow(columns)/quoteRow(columns, quote)/missingRow(columns, code, name)` 构造 (加列只需追加一项, 不会漏渲染; **行构造函数接受列集参数** — 看板传 `STOCK_LIST_COLUMNS`, 详情弹窗传 `DETAIL_COLUMNS`); 停牌行 `--` + 涨跌幅列 `停牌`, 缺失行 `--` + `无数据`. 行渲染统一走共享组件 `components/QuoteRow.tsx` (`segments` + `selected` + `bright`, bright 透传本地 Text: 浮层传 bright 保持鲜艳, 背景层缺省参与遮罩变暗, 见坑 11/12). **COLUMNS 全量 15 列**, 消费方子集各自收口在组件 lib, 都用显式 key 白名单挑选 (无 detailOnly 机制): 看板 `STOCK_LIST_COLUMNS` (12 列, `STOCK_LIST_KEYS`; 昨收/振幅/量比不在其内, 不占看板列宽) + `tableWidth` + 滚动窗口切片 (`visibleWindow`/`tableSlices`) 都在 `StockList/lib.ts`; 详情 `DETAIL_COLUMNS` (10 列, 显式 key 白名单挑选, 现价/涨跌额已在弹窗标题行不重复; 新增列需在 `StockDetailDialog/lib.ts` 的 `DETAIL_KEYS` 登记才进详情) + `detailWidth`/弹窗宽度在 `StockDetailDialog/lib.ts`. 表头/详情面板标题/数值统一走 `cell(text, col)`. 看板内容总宽由 `tableWidth()` 推导, 加边框 2 + padding 2 即 `WindowSizeGuard` 的 `MIN_COLUMNS = tableWidth() + 4` (由表推导不硬编码; 另要求 `MIN_ROWS = 26`). **列宽按实测最大内容校准** (成交量列 11 宽 — 最大内容 `99999.9万手` 显示宽 10, 留 1 余量; 总市值列 10 宽恰容 `16225.93亿`): 列宽不足会折行并顶掉表头; 列间由 `withSeparators` 统一加 1 分隔空格 (内容恒为左对齐 + 尾随填充).
- **表格滚动**: 表头固定不参与滚动; 滚动锚定逻辑在 store (`useStockListStore.scrollOffset` + `moveSelection(delta, visible)`, 锚定滚动提纯函数 `anchoredScrollOffset`): **窗口不跟随选中行**, 选中行触到移动方向的窗口边缘才滚动, 否则窗口保持原位 (从末尾往上选时视图不变, 选中行先走完整个窗口). **可视行数不用 useWindowSize 公式推算, 而是实测**: 行容器 Box (`flexGrow={1} overflow="hidden"`) 挂 `ref={rowsRef}`, `useStockListPage()` 里 `useBoxMetrics(rowsRef)` 量实际高度, `visible = hasMeasured ? max(1, floor(height)) : 1` (首帧未测量兜底 1); 表头/errorLine/StatusBar 都在容器外, 天然不占滚动窗口. 窗口切片由 `useStockListPage()` 收口计算并返回 (`{ slices, rowsRef }`), index.tsx 只消费不计算 (键盘的 visible 与渲染共用同一推导); `visibleWindow(total, scrollOffset, visible)` 纯函数只做越界钳制. `overflow="hidden"` 直接裁剪超高行, 不会再把表头/标题顶出屏幕.
- **图表字符**: 分时图 (`src/components/IntradayChart/`) 用 Braille 点阵 (U+2800, 每字符 2 子列 × 4 子行, 位掩码 `DOT_BIT`/`braille` 辅助) 实现 4 倍垂直 + 2 倍水平分辨率: 折线每子列一个点, 相邻桶 lastPrice 线性插值, 陡坡补垂直间隙; 昨收虚线同为 Braille 点 (2 子列开 1 子列停, 灰, 折线优先不覆盖); 量柱同为 Braille 点阵 (双子列整列填 = 实心柱, 高度 4×volumeHeight 档, 至少 1 子行防太矮), 按各桶相对上一桶涨跌红绿 (首桶回退昨收, 平盘灰); 底部时间轴行 (灰, `09:30` / `11:30/13:00` / `15:00`). 全部 < 0x2e80 单宽, 无新依赖; 桶化降采样 (241 点 -> 列数), 午休平线续接、尾部留空 (盘中数据未到); 折线整线颜色按收尾价 vs 昨收红绿灰 (A股惯例). **终端字体需含 Braille 字形 (现代终端均有), 否则显示为空格 — 改渲染前先在用户终端验证.**
- 页面级结果/警告消息用 `<ActionResult tone msg>` / `<Message tone msg>` 展示 (`msg` 为消息文本字符串), 返回提示用 `<BackToStockList/>` (文案 "按 Enter 返回看板...", 组件自行订阅 router store 的 goTo). **只用于 add-stock/remove-stock 页 (返回看板有意义); stock-list 自身 (empty/error 步) 不用 — 已经在看板上, 返回是无效操作, 用引导文案 + StatusBar 提示即可.**
- **StatusBar** (`src/components/StatusBar.tsx`): 左侧 `hint` 按键提示由 app.tsx 从 `SCREEN_META` 传入 (`<StatusBar hint={SCREEN_META[screen].hint}/>`, 组件不订阅 router store), 右侧时间 `YYYY-MM-DD HH:MM:SS` 来自 `useClock('date-time')` (hook 在 `src/hooks/useClock.ts`: 时区固定上海, 按 format 返回 `'YYYY-MM-DD HH:MM:SS'` / `'YYYY-MM-DD'` / `'HH:MM:SS'` / `'HH:MM'`, 含秒每秒刷新否则每分).
- 顶层 Box 统一 `borderStyle="round"` 圆角边框 + `padding={1}`, 尺寸撑满 `columns/rows` (useWindowSize); 浮层 Dialog 的边框同为 round.
- **背景遮罩层**: 菜单或详情**任一浮层弹窗打开**时背景层整体变暗, 形成遮罩 — Ink 没有 Box 级 dimColor (只有 Text 有), 也无法半透明叠加 (终端无 alpha, `<Transform>` 只支持纯文本子树, 包 Box 会丢布局), 所以实现是: `src/hooks/useOverlayOpen.ts` 整店订阅 `useMenuStore` / `useStockDetailStore`, 返回 `open || stock !== null` (整店订阅不用 selector — 项目风格, 唯一例外见交互架构的 StockDetailDialog quote 派生; 代价是详情 30s 轮询更新时 useOverlayOpen 消费者跟着重渲染, 30s 一次且树小, 已接受), 背景层三处均由它驱动: 本地包装组件 `src/components/Text.tsx` (全项目唯一 Text 入口, 带 `bright` prop — `dimColor = bright ? false : overlayOpen`: 浮层传 bright 恒鲜艳, 背景层缺省随遮罩变暗; 不用 React Context — 状态一律走 zustand), app.tsx 的带边框 Box 加 `borderDimColor={overlayOpen}`, StatusBar 背景 blue->gray; 浮层自身 (MenuDialog / StockDetailDialog, 都基于 `components/Dialog.tsx` 外壳) 用不透明 `backgroundColor="black"` 且内部文字一律本地 Text + `bright` 保持鲜艳 (不透明背景防止底层内容从 padding 透出). **所有文字必须 import 本地 `components/Text.tsx`, 不再直接 import ink 的 Text**: 背景层缺省 bright 参与变暗, 浮层每处文字传 `bright` 保持鲜艳 — 漏用本地 Text 则不参与变暗, 漏写 bright 则浮层文字随遮罩变灰 (坑 11/12).
- **边框叠加层**: 页面标题 `| 标题 |` 在左上角, 行情更新时间在右上角 (`BorderUpdatedAt`, cyan, 仅 stock-list 表格步显示; 无 props, 自行订阅 store 并守卫 `screen` + `step.type`). **BorderTitle** 接收 `title`/`top`/`left`/`bright` props: 页面标题由 app.tsx 传入 `<Text color="magenta">{SCREEN_META[screen].title}</Text>` (`left={2}` = 边框 1 + padding 1); `bright` 变体供浮层 Dialog 复用画自己的边框标题 (挂在 Dialog 带边框 Box 上, `top={-1} left={1}` 落在边框线上, bars 同为本地 Text 且随自身 `bright` prop 控制明暗; 标题内容亮暗由调用方传入的 Text 决定 — app.tsx 背景标题缺省 bright 参与变暗, Dialog 边框标题传 bright 保持鲜艳, 见坑 12). 都是 `position="absolute"` 的 Box, **浮层 (MenuDialog/StockDetailDialog) 与边框叠加层一样, 必须是带边框 Box 的兄弟节点且排在其后** — app.tsx 渲染顺序: 边框 Box -> 浮层 -> BorderTitle -> BorderUpdatedAt; Ink 按 DOM 顺序绘制, 后画的才覆盖边框字符; 放在边框 Box 内部会被 yoga border 内缩 1 格, 盖不到边框线 (浮层放内部还会盖不住整个窗口). 页面组件内部不要再渲染自己的标题行. store 常驻进程级, 离开页面不重置 — 依赖页面状态的叠加层要守卫当前 `screen`.

## 测试与验证

- **验证顺序**: 先 `pnpm fmt` (oxfmt 校验严格, 会重排 import), 再 `pnpm typecheck && pnpm lint:check && pnpm fmt:check`. 最后做 pty 交互冒烟.
- **交互测试必须用 pty** (stdin 直通管道会报 "Raw mode is not supported"): 用 `script` 包一层, 按键带延迟确保落在对应屏幕, 输出 `tr -d '\r'` 再 grep. **esc 键发 `\033`**:
  ```bash
  # esc 弹菜单 -> 数字 2 进添加页 -> 输代码 -> y 确认 -> q 退出
  ( sleep 2; printf '\033'; sleep 1; printf '2'; sleep 1; printf '\r'; sleep 2; printf '600000'; sleep 1; printf '\r'; sleep 2; printf 'y'; sleep 1; printf '\r'; sleep 2; printf 'q' ) | timeout 25 script -qec "pnpm dev" /dev/null
  ```
- **pty 默认 80×24, 会被 WindowSizeGuard 挡住** (看板需 116×26, 只见"终端尺寸过小"): 在 `script -qec` 命令里先 `stty cols 160 rows 40;` 再启动, 如 `script -qec "stty cols 160 rows 40; pnpm dev" /dev/null`.
- **冒烟测试会真实写 `~/.config/leek-box-cli/watchlist.json`**, 测完 `rm -f` 复位, 并核对文件内容确认没有意外写入.
- **pty 输入偶发丢字符/错乱**: `script -qec` 管道在短间隔连发按键时会丢字符 (实测 '3'/'y'/'q' 都丢过), 且曾出现一次无法解释的意外添加 (watchlist 多出一只从未输入的股票, 未复现). 对策: sleep >= 2s 起步, 按键间隔 >= 1s; 每次冒烟后检查 watchlist 文件.
- 行情接口可用性: `curl -s "https://qt.gtimg.cn/q=sh600000"` (GBK, 无鉴权); 断网/接口异常时看板应显示 error 步或内联错误行, 网络恢复后自动自愈.
- 运行: `pnpm dev` (tsx 直跑), `pnpm build && pnpm preview` (产物 dist/cli.mjs, 入口 `bin` 字段).

## 常见坑清单

1. 忘记给下一步输入框递增 `key` -> 输入框"卡死"无法继续输入 (输入校验的 key 递增逻辑在 store 的 reject/accept 动作里); 连续两步都有输入框且 key 同值时会 React 复用实例继承旧值 (remove-stock 的 select->confirm, 修复为 `key={'yn-' + confirmInputKey}` 字符串前缀).
2. 用 `process.stdout.write` 而非 `useStdout().write` 写界面 -> 与 Ink 输出冲突错乱.
3. 中文/emoji 字符宽度: 布局用 `useWindowSize`, 表格列宽用 `displayWidth`/`cell` (src/lib/columns.ts), 不要硬编码.
4. `useEffect` 里更新状态导致无限重渲染 - Ink 每帧重绘, 状态更新要谨慎.
5. 轮询重叠: 必须自调度 setTimeout + inFlight 守卫, 不要用固定 setInterval (8s 超时与 5s 间隔会叠).
6. GBK 解码: 必须 `res.arrayBuffer()` 后用 `TextDecoder('gbk')`, 直接 `res.text()` 会乱码 (默认 utf-8).
7. **输入面/浮层守卫配对**: 输入面 (`useInput`) 一律调 `useOverlayOpen()` 传 `{ isActive: !overlayOpen }` (菜单/详情任一打开即失活; 范例: TextInput / useStockListPage); 浮层自身不注册 useInput, esc/q 由 app.tsx 全局单点处理 — esc 优先级详情 > 菜单, q 只需 `!overlayOpen` 单守卫. 漏一处: 菜单/详情开着时底层输入框仍可操作, 或详情开着按 esc 误开菜单、按 q 直接退进程.
8. 界面文案出现 emoji 或全角标点 (已移除 emoji, 半角是明确要求).
9. **build 产物读不到 `process.env.XDG_CONFIG_HOME`** -> rolldown-vite 会把裸 `process.env.xxx` 折叠成 `{}.xxx` (恒 undefined), dev (tsx) 正常但 build 后静默失效 (曾用 vite `define` 自引用规避, 已移除). 读环境变量的文件必须显式 `import process from 'node:process'` (当前唯一在读的是 src/lib/watchlist.ts), 新增 env 读取时不要依赖全局 process.
10. **用 `process.exit` 而非 `useApp().exit()` 退出** -> 直接杀进程会跳过 Ink 的 unmount 清理, 输出可能截断; 项目内所有退出 (app.tsx 的 q 键, MenuDialog 的"4) 退出程序") 一律走 `useApp()` 拿到的 `exit()`.
11. **文字 import 了 ink 的 Text 而非本地 `components/Text.tsx`** -> 双 Text 切换机制已废, 项目内一律用本地 Text: 背景层文字漏用本地 Text 则遮罩打开时不参与变暗; 浮层文字漏用本地 Text 则永远鲜艳 (浮层需要的是本地 Text + `bright`, 见坑 12). 新增页面/组件的文字统一 import 本地 Text.
12. **浮层文字漏写 `bright` (坑 11 的镜像)**: 明暗只由本地 Text 的 `bright` 决定 (`dimColor = bright ? false : overlayOpen`) — 浮层内每处文字必须传 `bright` (MenuDialog 标题/菜单项、StockDetailDialog 标题行与状态文案、IntradayChart、QuoteRow 的 bright 透传、BorderTitle bars), 漏一处该文字在遮罩打开时变灰; 背景层文字必须缺省 bright 参与变暗. 原 BorderTitle 亮暗配对已内化: bars 亮暗随自身 `bright` prop, 标题内容亮暗由调用方传入的 Text 决定 (app.tsx 背景标题缺省 bright, Dialog 边框标题传 bright).
13. **浮层/叠加层渲染在带边框 Box 内部** -> 定位基准错乱 + 盖不住边框字符 (yoga border 内缩), 浮层还盖不满整个窗口; MenuDialog / StockDetailDialog / BorderTitle / BorderUpdatedAt 都必须是带边框 Box 的**兄弟节点且排在其后** (app.tsx 已如此), 新增浮层照做.
14. **用 useWindowSize 公式推算可视行数** -> 表头/StatusBar/errorLine 的布局一变动, 手工减法公式就漂移 (旧版 `visibleRowCount` 已删); 用行容器 Box 的 ref + `useBoxMetrics` 实测, 首帧未测量时 `visible` 兜底 1 (不要用 0 或未定义).
15. **组件 children/title/placeholder 等 React 节点 props 用 `ReactNode` 而非 `JSX.Element | JSX.Element[]`** -> `{cond && <X/>}` 求值为 `false | Element`, 直接传 JSX.Element 类型会 typecheck 报错 (浮层条件渲染移为 WindowSizeGuard 直接子节点时踩过; BorderTitle/Dialog/TextInput/WindowSizeGuard 已统一 ReactNode).
