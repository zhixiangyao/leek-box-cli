# StockList 数据模型和看板

`StockListStep.table` 使用统一 rows:

```ts
type StockListRow = { kind: 'quote'; code: string; quote: Quote } | { kind: 'missing'; code: string }
```

禁止恢复 `quotes + missing` 双数组拼接. 统一 rows 用于渲染, 选择, Enter 打开详情和可视窗口.

行的名称只在 quote 里: 缺失行 (行情没返回该代码) 没有第二个名称来源, 名称列显示 `--`, 其余列按列元数据显示占位文案. 打开详情也只用 code, 名称由详情弹窗自己从行情行里取 (`useStockListStore` 的 quote).

选择身份使用 `selectedCode`, 不使用数组 index. 它是 `useStockList` 的状态: 刷新后保持仍存在的 code, 消失时按原来的下标回退到附近的行.

`gg` 跳到顶部, `G` 跳到底部: 选中首行或末行, 与方向键走同一个 `selectIndex`, 不另写一套落点规则. `gg` 是两键序列, 第一键只有前缀意义 (不参与渲染, 因此是 hook 里的 ref 而不是 state), 其余按键让序列从零开始; 浮层打开时前缀作废 (浮层期间本 hook 的 `useInput` 失活, 收尾键落在浮层手里). ink 把同一 chunk 里的多个字符按粘贴一次性交出, 因此两次 `g` 必须分两次按键读入.

窗口只在选中行要移出窗口时才滑动: 方向键, `gg`/`G`, 排序和刷新后的锚定都走 `scrollOffsetToReveal` 这一条规则 (已经在窗口里就一点不动). 不给"换顺序"另写落点规则: 选中行只是换了位置, 没移出窗口就不该动视口.

按涨跌幅排序 (`s` 键) 是**视图**, 不是数据: `step.rows` 始终是自选股文件顺序, 排序模式 `sortMode` (`default | desc | asc` 三态循环) 只决定显示顺序, 因此回到 `default` 不需要重读 settings.json. 显示顺序只经由 `commands/StockList/lib.ts` 的 `displayedRows(step, sortMode)` 取出, `sortedRows(rows, sortMode)` 是它的底座: 看板渲染, `moveSelection`, `cycleSortMode` 和刷新后的视口锚定都用它, 因此只有一个来源. 缺失行没有涨跌幅可比, 一律排在末尾, 不参与升降序. 排序指示器只在排过序之后出现在 Card 右上角 (`涨跌幅 ▼` / `涨跌幅 ▲`, cyan 显示, 与刷新间隔并排); 排序是 hook 的内存状态, 不写盘.

StockList 会逐字段比较 Quote. 数据未变化时复用旧 Quote 引用, 让 Zustand selector 的 `Object.is` 跳过无意义更新.

右上角固定有一段刷新间隔 (`{value} ms`): 它取设置里的 `quotePollIntervalMs`, 不是某次刷新的耗时, 也不随刷新变化, 因此在 loading/empty/error 各 step 都在, 改设置后立即跟着变, 位置排在排序指示器之后, 两段之间用 `|` 分隔 (分隔符自己一个 Text). 除这两段外右上角不再显示别的角标. 不设手动刷新键: 刷新只由轮询驱动, 只有删除成功后会额外触发一次.

上边框中间 (`borderTopCenter`) 是公共组件 `components/MarketIndexTicker/`: 传入一串指数行情, 它让上证指数与深证成指轮流显示, 每 5 秒换一个, 换的时候用 1 秒打字机把新的一行从左往右写出来 (首帧整行瞬显, 不播过渡; 只有一条时切换定时器不挂). 行情来自独立的 `useMarketIndexStore`: 它只请求 `MARKET_INDEX_CODES` (上证指数与深证成指), 按代码顺序落地, 缺哪条就少哪条. 它与自选股互不认识, 指数也不进表格行, 拉取失败保留上一次的行情 (指数只是角标, 不为它单开错误状态, 离开看板也不清空, 没有 loading 态).

轮询接线在看板自己的 `hooks/useStockList.ts`: 它窄 selector 订阅该 store, 除自选股那条之外另挂一条 `usePolling`, 间隔同样取设置里的 `quotePollIntervalMs` (与看板同一个值, 不新增第二份间隔设置), 两条请求各自独立.

名称来自实时行情, 数值用 `formatPrice` / `formatSigned` / `formatPercent`, 与界面语言无关, 因此这项功能一个文案键都不占. 组件自己不认识 store: 行情走 props (看板 `index.tsx` 把 `useStockList()` 返回的 `indices` 传给 `MarketIndexTicker`), 只有涨跌色订阅 `useSettingsStore`. 轮播与打字机状态在组件自己的 `MarketIndexTicker/hooks/useMarketIndexTicker.ts` (与 CheckboxGrid 同构), 它按帧重渲染的只有这一个组件; 行与动画的纯函数 (`indexSegments` / `typewriterSegments` 与三个 `INDEX_*_MS`) 在组件自己的 `MarketIndexTicker/lib.ts`, 段类型直接复用 `lib/quoteTable.ts` 的 `Row`, 渲染复用 `QuoteRow`.

打字机按显示宽度逐字写出 (CJK 不切半个字), 并把整行补空格到最终宽度 (它摆在居中槽位里, 行宽随进度变化会让文字左右跳). 行情没返回的指数不占位 (轮播按 `indices.length` 取模), 一条都没有时该组件不渲染任何东西, 上边框中间只留下槽位自己的空管道 `||`. 角标落在边框槽位上, 与右上角的刷新间隔同级: 看板的 loading/empty/error 各 step 都在.

看板按 `d` 删除选中那一只: 用选中行拼一条 `StockRemoveEntry` (名称取行内实时行情, 缺失行没有名称, 弹窗因此只列代码) 打开共享的 DialogRemoveConfirm (删除流程见 docs/architecture.md), 并把 `usePolling` 的 `refresh` 登记成收尾动作: 删除成功后立刻刷新一次 (选中股消失时按原下标回退到邻近的行, 删空则进入 empty). 一个都不算删掉时弹窗进 error, 收尾动作不调用, 那一行要等下一次轮询才消失. `refresh()` 在请求进行中不并发, 那种情况下同样等下一轮.
