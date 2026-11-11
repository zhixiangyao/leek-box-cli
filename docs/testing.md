# 测试和验证

测试使用 Vitest. **一个源文件一个测试文件**, 均位于 `tests/`, 文件名取自对应的源文件 (首字母小写): `src/api/index.ts` -> `tests/api.test.ts`, `src/commands/StockList/index.tsx` -> `tests/stockList.test.tsx`. 命令目录与 settings 目录重名时命令侧带 `Command` 后缀: `tests/settingsCommand.test.tsx` 测 `commands/Settings/index.tsx`, `tests/schema.test.ts` / `tests/file.test.ts` 测 `settings/` 下的同名文件. 命令或组件的 `lib.ts` 用 `<feature>Lib.test.ts` (`tests/stockListLib.test.ts`, `tests/checkboxGridLib.test.ts`, `tests/stockChartLib.test.ts`, `tests/marketIndexTickerLib.test.ts`). 入口接线由 `tests/main.test.tsx` 覆盖 `src/main.tsx`.

`tests/architecture.test.ts` 是没有单一对应源文件的跨文件守卫, 机械检查本地 import 后缀, 依赖方向 (i18n 叶子层, navigation/components 不依赖 commands) 与纯状态层不引入 React/Ink 运行时. 它是 "一个源文件一个测试文件" 的刻意例外, 新增此类全局约束时继续放在这个文件, 不要拆成无主的多个文件.

`tests/helpers/` 放共享测试设施, 不参与用例收集:

- `ink.tsx` --- 渲染到固定尺寸输出 (`CaptureOutput` / `createInput` / `renderInk` / `plain`) 与四种等待: `waitForFrame` (after 之后任取一帧), `waitForLatestFrame` (只看最新一帧), `waitForState` (轮询状态), `waitForInput` (让出一拍: 同一 tick 连写的两个按键会被 ink 合并成一个输入, 两键序列必须分开写), 以及所有渲染用例共用的收尾 `unmountApp(instance)`: `unmount()` 后 `await waitUntilExit()`, 等 ink 把 unmount 写出的最后一帧落盘.
- `app.tsx` --- App 级断言: `renderApp`, `resetStores`, `assertFrameSize`, `selectedCodeIn`, `isDimmed`, 以及把看板, 删除网格和指数角标钉在给定数据上的 `stubBoardRows` / `stubRemoveEntries` / `stubMarketIndices`.
- `fixtures.ts` --- 行情与自选股夹具: `quote` / `quoteRow` / `missingRow` / `rowCodes` / `stockEntry` / `removeEntry`.
- `clock.ts` --- 时钟帧断言: `CLOCK_PATTERN` 与 `clockIn()`.

测试文件必须隔离 `XDG_CONFIG_HOME`, 不读写用户真实 settings.json. 全局 Zustand singleton 在渲染用例之间由 `resetStores()` 用 `getInitialState()` 恢复; 指数 store 是例外, 它改为钉成空角标 (`stubMarketIndices()`), 因为看板一挂载就会发起第二条请求, 不钉住的话每个 App 级用例都会真的联网. 需要指数数据的用例在 `resetStores()` 之后自己 `stubMarketIndices([...])` 覆盖.

断言选中行反显与浮层 dim 的用例需要 Ink 真的输出 SGR 序列, 因此 `FORCE_COLOR` 由 `vitest.config.ts` 的 `test.env` 提供: chalk 在模块求值时就定下颜色档位, 写在测试文件顶部或 helper 里都太迟. 需要彩色断言的新文件不必自己设这个变量.

`vitest.config.ts` 的 `setupFiles` 先加载 `src/lib/polyfill.ts`, 与生产入口保持一致: 测试直接 import 源文件, 不经过 `src/main.tsx`, 缺少 `getOrInsertComputed` 的运行时会在 `WindowSizeGuard` 的模块顶层求值时就抛错.

涉及渲染帧或文案断言的测试必须固定语言: 模块级 `activeLocale` 初值是 `zh-hans`, 但 `language` 默认值 `auto` 会跟随运行环境的系统语言, 因此 `resetStores()` (同时把 store 的 `language` 置为 `zh-hans`), `tests/persistence.test.ts`, `tests/api.test.ts` 与 `tests/schema.test.ts` / `tests/file.test.ts` 的 `beforeEach` 都显式 `setActiveLocale(DEFAULT_LOCALE)`. 新增此类测试必须做同样的固定. 需要中文或英文文案时用 `t(key)` 而不是字面量.

`tests/quoteTable.test.ts` 持有三语言列宽的守卫用例: 表头宽度, 停牌/缺失占位文案宽度, 以及单位列在档位边界 (含四舍五入) 的渲染文本宽度都不超过列宽, 另有 `LIST_WIDTH_SUM` 锁定各 locale 的列宽之和, 以及名称列省略后不超出列宽的用例. 改动 `ColumnSpec.widths` 或 `format.ts` 的单位档位时必须同步更新这些常量. `cell()` 只补齐不截断, 因此超宽文本会撑宽整行并让后续列错位. `tests/windowSizeGuard.test.tsx` 另有一条用例校验 `MIN_TERMINAL_COLUMNS` 覆盖全部 locale 的看板占宽.

`tests/useSettingsStore.test.ts` 与 `tests/useStockListStore.test.ts` 持有字段覆盖守卫: 逐个字段翻转让 `settingsEqual` / `settingsPatch` / `quotesEqual` 必须识别, 新增 `Settings` 或 `Quote` 字段而漏改这三个函数时用例失败 (`Quote.code` 由行情 map 的键决定, 不参与逐字段比较). `Settings` 里的数值项还必须同步 `SETTING_LIMITS`, 否则边界覆盖用例失败; 越界值由 `hydrateSettings` clamp.

覆盖率由 `@vitest/coverage-v8` 统计. `pnpm test:coverage` 使用 `vitest.config.ts` 的全局阈值 (statements 93.5 / branches 87 / functions 97 / lines 95) 判定, 明显回落时以退出码 1 失败. 阈值是防回落的基线, 不是目标值: 新代码应带测试, 确实覆盖不到的分支先说明原因再调整阈值. HTML 报告写入 `coverage/`, 已被 `.gitignore` 忽略.

修改后至少运行:

```bash
pnpm typecheck
pnpm lint:check
pnpm fmt:check
pnpm test
pnpm test:coverage
pnpm build
git diff --check
```

需要写入格式时先运行 `pnpm exec oxfmt <changed-files>`.

交互冒烟需要 PTY 和足够终端尺寸:

```bash
script -qec "stty cols 160 rows 40; pnpm dev" /dev/null
```

涉及 settings 或 stocks 时设置临时 `XDG_CONFIG_HOME`.
