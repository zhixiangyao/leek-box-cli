---
name: leek-box-cli
description: leek-box-cli 项目规范与开发经验. 当任务涉及修改/扩展本项目的界面, 命令, 组件, hooks, 行情数据源, 测试与验证时使用. Ink 通用 API 参考见 ink skill.
---

# leek-box-cli 项目规范与经验

终端股票自选股看板, 基于 Ink 构建的交互式 CLI. 技术栈: `ink@7.1.1` + `react@19.2.8` + `zustand@5` + `meow`, ESM 模式, `tsx` 开发 / `vite` 构建. 零外部工具依赖 (行情走 Node 原生 `fetch`, 无需 curl 等).

## 架构与目录

```
src/cli.tsx          meow 解析子命令 -> render 前 setState 写入 router store 初始页 -> render(<App/>, {alternateScreen, concurrent}); 无命令时默认进 dashboard
src/app.tsx          顶层: 页面路由 + 全局 esc/q 键 + 条件渲染 MenuDialog 浮层 + StatusBar (按页面动态 hint)
src/components/       通用组件 (MenuDialog / TextInput / Message / StatusBar / BackToDashboard / ProgressBar)
src/stores/          zustand store, 全部应用状态的唯一来源, 文件名统一 `useXxxStore.ts` (useRouterStore / useDashboardStore / useAddStockStore / useRemoveStockStore)
src/commands/<cmd>/   每个命令一个目录: index.tsx (纯渲染, 订阅 store 选择器, 不持有状态) + hooks/ (页面副作用: 生命周期/快捷键) + lib/ (页面级纯函数, 如 dashboard 的 table.ts)
src/lib/              quote.ts (腾讯行情) / watchlist.ts (自选股存储) / screens.ts (Screen 类型 + 页面 title/hint 元数据) — 与界面无关的逻辑
```

- 每个命令页面是 **step 状态机**: store 持有 step 与动作, `index.tsx` 用 `useXxxStore((s) => s.xxx)` 选择器订阅, 按 `step.type` 分支渲染纯展示, 不跑副作用. **非视图逻辑放 `hooks/`**: 生命周期/快捷键封装为 `useXxxPage()` hook (dashboard 的 useDashboardPage / add-stock 的 useAddStockPage / remove-stock 的 useRemoveStockPage), 纯函数放命令目录的 `lib/` (dashboard 的 `lib/table.ts`).
- **store 常驻进程级**: 页面挂载/卸载只调 store 动作 — dashboard 挂载 `start()` / 卸载 `stop()` (轮询循环); add-stock 挂载 `reset()` (防残留上次流程); remove-stock 挂载 `load()` (重新加载列表). 异步动作用模块级 `flowSeq` 代数守卫丢弃过期结果 (离开页面后旧响应不污染新流程).
- 轮询循环的非响应式状态 (timer / inFlight / cancelled / interval) 是 store 文件内**模块级变量**, 不进 zustand state; state 只承载展示数据.
- 输入校验状态 (inputError / inputKey) 也提升在 store 内; y/n 解析纯函数共用 `src/lib/yn.ts`. **stores 目录只放 zustand store**: 无状态纯函数放 `src/lib` (依赖方向 lib <- stores <- 组件). 组件内部瞬时 UI 状态 (TextInput 的 value / MenuDialog 的 highlight / StatusBar 的时钟) 留在组件内.
- 页面组件 props 为 `{ isActive }` (返回看板由 `BackToDashboard` 自行订阅 router store, 不再钻透 onBack); 映射在 `app.tsx` 的 `screenComponentMap`.
- 新增子命令需同步注册**四处**: `lib/screens.ts` (Screen 联合类型 + SCREEN_META 一条), `cli.tsx` 的 `COMMANDS`, `app.tsx` 的 `screenComponentMap`, `MenuDialog.tsx` 的 `MENU_ITEMS`; 并新增对应 store.
- 文件后缀显式导入 (`./xxx.ts` / `.tsx`), ESM 风格.

## 交互架构

- **启动直接进 dashboard**, 不再有 menu 屏; 菜单是 `esc` 调起的**浮层弹窗** (`MenuDialog`).
- `router store` 状态: `screen` (页面) + `menuOpen` (弹窗开关), 互相独立; `goTo(screen)` 切页并关弹窗.
- **全局按键** (`app.tsx` 的 useInput): `esc` -> `toggleMenu()`; `q` -> 仅 `!menuOpen` 时 `useApp().exit()` (菜单开着时 q 不退出, 防止误触).
- **MenuDialog**: 绝对定位居中覆盖 (`position="absolute"` + `top/left` 用 `useWindowSize` 计算), `↑/↓` 高亮 + `enter` 确认 + 数字键 `1-4` 快捷 (4 = 退出); 高亮项反色 (`backgroundColor="cyan"` + `color="black"`).
- **isActive 传播链**: 菜单打开时当前页的输入必须禁用 — `app.tsx` 传 `isActive={!menuOpen}` 给页面, 页面把它传给自己的 `useInput` 和所有 `TextInput`/`BackToDashboard` 的 `isActive` prop. **新增页面/组件时不要漏掉这条链** (漏了会导致菜单打开时还能操作底层页面).
- 页面内返回看板: `BackToDashboard` (Enter 返回); 任何页面按 `esc` 也能打开菜单切页.

## 数据源: 腾讯行情接口 (`src/lib/quote.ts`)

- 端点: `GET https://qt.gtimg.cn/q=sh600000,sz000001` — **免费无需鉴权** (对比: 雪球 quotec 对匿名请求返回空 body, 需要登录 cookie).
- 响应为 **GBK 编码** 文本, 必须 `await res.arrayBuffer()` 后 `new TextDecoder('gbk').decode(buf)` (Node full-ICU; 不要用 `res.text()`, 会乱码).
- 格式: `v_sh600000="f0~f1~...";v_sz000001="...";` — 按 `;` 切分, `/^v_([a-z]{2}\d{6})="([^"]*)"/` 取代码, 字段串按 `~` 切分.
- **字段索引**: 1=名称 2=代码 3=现价 4=昨收 5=今开 6=成交量(手) 30=时间(yyyyMMddHHmmss) 31=涨跌额 32=涨跌幅(%) 33=最高 34=最低. 字段数需 >= 35 守卫.
- **normalizeCode 规则**: 去 SH/SZ/BJ 前后缀后须为 6 位数字; `6xx->sh` `5xx->sh(ETF)` `0xx/1xx/3xx->sz` `4xx/8xx/92xx->bj`, 其余 (含 B 股 9xx) 拒绝.
- **接口行为**: 无效代码被静默丢弃; 全部无效返回 `v_pv_none_match="1";` (无匹配条目); 停牌/退市股返回现价 0 的记录 (用 `current <= 0` 判停牌, 看板渲染 `--` + `停牌`); 缺数据 = 请求代码集 − 返回集 (看板渲染灰行 `--` + `无数据`).
- 超时用 `AbortSignal.timeout(8000)`.

## 自选股存储 (`src/lib/watchlist.ts`)

- 路径: `~/.config/leek-box-cli/watchlist.json` (遵循 `XDG_CONFIG_HOME`), 函数 `watchlistPath()` 导出便于 UI 显示.
- Schema: 裸数组 `[{ code, name, addedAt }]`, 插入序即显示序; `name` 在添加时缓存, 删除页离线也能显示名称.
- 文件损坏时 `loadWatchlist` **throw** (提示用户删文件自愈), 不静默吞错; `saveWatchlist` 前 `mkdir recursive`.

## 看板轮询模式 (`src/stores/useDashboardStore.ts`)

- 5s 轮询: **自调度 `setTimeout`** (fetch 完成后才排下一次) + 模块级 `inFlight` 守卫, 避免 8s 超时与 5s 间隔重叠; 页面卸载时 `stop()` 置 `cancelled` 标志 + `clearTimeout`, 进行中的 fetch 结果被丢弃 (fetch 完成后检查 `cancelled` 再 set).
- 错误语义: 首次失败 (无旧数据) -> `error` 步 + BackToDashboard; 后续轮询失败 -> **保留旧表格 + 内联黄色 errorLine + 继续轮询自愈** (`setStep(prev => prev.type === 'table' ? {...prev, errorLine} : {type:'error', ...})`).
- 手动刷新 `r` 键在 `hooks/useDashboard.ts` 的 `useInput` (带 `{ isActive }`) 里调 `handleRefreshNow()` (有 in-flight 则忽略).

## 界面风格约定

- 界面文案为**中文**, 所有标点用**半角**.
- **界面文案不含任何 emoji** (2026-08 重构移除全部 emoji, 新增文案不要加).
- 颜色语义: `magenta` 标题, `cyan` 信息/引导, `yellow` 警告, `red` 错误, `green` 成功, `gray` 占位/光标.
- **A股配色: 涨红跌绿平灰** (`trendColor(value)`: >0 red, <0 green, =0 gray), 涨跌幅/涨跌额带显式 `+`/`-` 前缀.
- 表格对齐用本地 `displayWidth`/`cell` 辅助 (`src/commands/dashboard/lib/table.ts`): CJK 字符按宽度 2 计算, **不要引入 string-width 依赖, 不要硬编码宽度**.
- 页面级结果/警告消息用 `<Message tone="error|warning|success">`, 返回提示用 `<BackToDashboard/>` (文案 "按 Enter 返回看板...", 组件自行订阅 router store 的 goTo). **只用于 add-stock/remove-stock 页 (返回看板有意义); dashboard 自身 (empty/error 步) 不用 — 已经在看板上, 返回是无效操作且会误导 (曾有反馈 "按 Enter 无反应"), 用引导文案 + StatusBar 提示即可.**
- **StatusBar** (`src/components/StatusBar.tsx`): 左侧 `hint` 按键提示 (`SCREEN_META[screen].hint`, 自行订阅 router store 的 screen), 右侧日期 `YYYY-MM-DD` — `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', ... })` (en-CA 恰好输出该格式; 时区固定上海, 不要用本地时区).
- 顶层 Box 统一 `borderStyle="classic"` 经典边框 + `padding={1}`, 尺寸撑满 `columns/rows` (useWindowSize).
- **边框叠加层**: 页面标题 `| 标题 |` 在左上角 (`BorderTitle`, `SCREEN_META[screen].title`, magenta 两端竖线默认色), 行情更新时间在右上角 (`BorderUpdatedAt`, cyan, 仅 dashboard 表格步显示). 两者都无 props, 自行订阅 store (BorderUpdatedAt 守卫 `screen` + `step.type`); 都是 `position="absolute" top={0}` 的 Box, **必须是带边框 Box 的兄弟节点且排在其后** — Ink 按 DOM 顺序绘制, 后画的才覆盖边框字符; 放在边框 Box 内部会被 yoga border 内缩 1 格, 盖不到边框线. 页面组件内部不要再渲染自己的标题行. store 常驻进程级, 离开页面不重置 — 依赖页面状态的叠加层要守卫当前 `screen`.

## 测试与验证

- **验证顺序**: 先 `pnpm fmt` (oxfmt 校验严格, 会重排 import), 再 `pnpm typecheck && pnpm lint:check && pnpm fmt:check`. 最后做 pty 交互冒烟.
- **交互测试必须用 pty** (stdin 直通管道会报 "Raw mode is not supported"): 用 `script` 包一层, 按键带延迟确保落在对应屏幕, 输出 `tr -d '\r'` 再 grep. **esc 键发 `\033`**:
  ```bash
  # esc 弹菜单 -> 数字 2 进添加页 -> 输代码 -> y 确认 -> q 退出
  ( sleep 2; printf '\033'; sleep 1; printf '2'; sleep 1; printf '\r'; sleep 2; printf '600000'; sleep 1; printf '\r'; sleep 2; printf 'y'; sleep 1; printf '\r'; sleep 2; printf 'q' ) | timeout 25 script -qec "pnpm dev" /dev/null
  ```
- **冒烟测试会真实写 `~/.config/leek-box-cli/watchlist.json`**, 测完 `rm -f` 复位, 并核对文件内容确认没有意外写入.
- **pty 输入偶发丢字符/错乱**: `script -qec` 管道在短间隔连发按键时会丢字符 (实测 '3'/'y'/'q' 都丢过), 且曾出现一次无法解释的意外添加 (watchlist 多出一只从未输入的股票, 未复现). 对策: sleep >= 2s 起步, 按键间隔 >= 1s; 每次冒烟后检查 watchlist 文件.
- 行情接口可用性: `curl -s "https://qt.gtimg.cn/q=sh600000"` (GBK, 无鉴权); 断网/接口异常时看板应显示 error 步或内联错误行, 网络恢复后自动自愈.
- 运行: `pnpm dev` (tsx 直跑), `pnpm build && pnpm preview` (产物 dist/cli.mjs, 入口 `bin` 字段).

## 常见坑清单

1. 忘记给下一步输入框递增 `key` -> 输入框"卡死"无法继续输入 (输入校验的 key 递增逻辑在 store 的 reject/accept 动作里); 连续两步都有输入框且 key 同值时会 React 复用实例继承旧值 (remove-stock 的 select->confirm, 修复为 `key={'yn-' + confirmInputKey}` 字符串前缀).
2. 用 `process.stdout.write` 而非 `useStdout().write` 写界面 -> 与 Ink 输出冲突错乱.
3. 中文/emoji 字符宽度: 布局用 `useWindowSize`, 表格列宽用 padCJK, 不要硬编码.
4. `useEffect` 里更新状态导致无限重渲染 - Ink 每帧重绘, 状态更新要谨慎.
5. 新增子命令遗漏 `lib/screens.ts` / `cli.tsx` / `app.tsx` / `MenuDialog` 四处注册.
6. 轮询重叠: 必须自调度 setTimeout + in-flight 守卫, 不要用固定 setInterval (8s 超时与 5s 间隔会叠).
7. GBK 解码: 必须 `res.arrayBuffer()` 后用 `TextDecoder('gbk')`, 直接 `res.text()` 会乱码 (默认 utf-8).
8. **菜单弹窗打开时漏传 `isActive={false}`** -> 底层页面的输入框/快捷键仍可操作 (esc 弹窗浮层必须通过 isActive 链禁用底层输入).
9. **`q` 在菜单打开时仍退出** -> 应加 `!menuOpen` 守卫, 否则用户想关菜单误按 q 直接退出进程.
10. 界面文案出现 emoji 或全角标点 (已移除 emoji, 半角是明确要求).
11. 长轮询期间保持 `step.type` 渲染正确, 不要在渲染层跑副作用.
12. **打包产物读不到 `process.env.XDG_CONFIG_HOME`** -> rolldown-vite 把未在 define 声明的 process.env.xxx 折叠成 `{}.xxx` (恒 undefined), dev (tsx) 正常但 build 后的产物静默失效. 已在 vite.config.ts 的 `define` 里自引用声明, 新增 env 读取时需同步注册.
13. **用 `process.exit` 而非 `useApp().exit()` 退出** -> 直接杀进程会跳过 Ink 的 unmount 清理, 输出可能截断; 项目内所有退出 (app.tsx 的 q 键, MenuDialog 的"4) 退出程序") 一律走 `useApp()` 拿到的 `exit()`.
