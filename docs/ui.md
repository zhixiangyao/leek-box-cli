# 浮层, 公共组件和主题

## 全局输入和 overlay

共享 overlay 包含菜单, 股票详情, 删除确认和通用确认弹窗 (DialogConfirm).

- App 的 `useInput` 常驻注册, 在回调里用 `overlayOpen.open` 早返回, 因此只在无浮层时处理 esc(打开菜单) 和 q(退出). 不使用 `isActive`: 尺寸不足时 WindowSizeGuard 会卸载整棵子树, 浮层 (持有此时唯一活跃的 useInput) 随之消失, 一个活跃的 useInput 都不剩时 ink 会 `setRawMode(false)` 并 unref stdin, 事件循环空转触发 beforeExit, 应用会在拖动终端尺寸时退出. App 是唯一在整个进程生命周期内都挂载的组件.
- 浮层打开后 esc 由各浮层自己处理: 详情和菜单 esc 直接关闭; DialogRemoveConfirm 在 done/error 阶段 esc 关闭, 删除进行中忽略; DialogConfirm 仅在错误态 esc 关闭.
- 浮层按键以各自 hint 为准: hint 展示什么按键, 监听就只处理什么按键.
- 方向键都有 vim 等价键 `h`/`j`/`k`/`l`, 判定统一走 `src/lib/keys.ts` 的 `keyDirection(input, key)`. hint 与监听并列展示 (`选择(↑/↓/j/k/gg/G)`, 网格 `移动(↑/↓/←/→/hjkl)`); 该界面不响应的方向不要写进 hint.
- 底层 command 的 `useInput` 使用 `{ isActive: !overlayOpen.open }`.
- 共享输入组件的 `isActive` 由 command 传入 `!overlayOpen.open`, 组件不自己读浮层状态: `CheckboxGrid` 必填, `TextInput` 可选并默认为 true.
- DialogMenu 自己处理上下键, Enter 和数字快捷键. 菜单的开关就是 `useDialogMenuStore` 的 `highlightedType` (`MenuItem['type'] | undefined`), 没有第二个布尔: `open(highlightedType)` 打开并定位高亮, `close()` 置回 `undefined`, `useOverlayOpen` 据此判定 `dialogMenuOpen`; 高亮由 App 的 esc 传入当前 command (`open(command)`). `useDialogMenu` 在 `undefined` 时早返回 (防御分支, DialogMenu 只在非 `undefined` 时挂载); `MENU_ITEMS` 覆盖 `MenuItem['type']` 的全部取值 (注册表 + reset/exit), `findIndex` 必命中. 被 DialogConfirm 遮住时菜单保持挂载且高亮不变.
- DialogStockDetail 仅在详情打开时处理周期数字键. 菜单与详情互斥 (浮层打开时底层输入一律失活), 无需判断菜单状态.
- DialogRemoveConfirm 只在 confirm 阶段接受 n/y, done/error 阶段只接受 esc.
- DialogConfirm 目前用于菜单的"重置"入口: 确认后经 `settings/resetAll.ts` 的 `resetAll()` 重置设置文件为默认文档 (含默认自选股) 并同步设置与自选股内存; 确认失败时弹窗保留并进入错误态 (`config.isError`), 确认方经 `config.update` 把内容替换为失败信息. 错误态 hint 为 `关闭(esc)   重试(y)` (esc 关闭, n 忽略, y 重试), 确认态 hint 为 `取消(n)   确定(y)` 且不处理 esc. 确认弹窗关闭后菜单保持打开 (高亮位置保留).

详情周期快捷键:

```text
1 分时
2 五日
3 日 K
4 周 K
5 月 K
6 年 K
```

`useOverlayOpen()` 是唯一的浮层状态聚合点, 返回 `overlayOpen`. App 读取全部字段决定浮层渲染, 其余组件只取 `overlayOpen.open`. 只需要 dim 布尔值的高频渲染组件 (Text) 用 `useOverlayOpenValue()`: 它在模块级合并四个 store 的订阅, 所有使用者共享一份监听, 避免每个 Text 各订阅四次. 不新增重复的 overlay Context.

## Card, Dialog 和 Text

每个 command 自己渲染 full-terminal Card 和 StatusBar. App 只渲染当前 command, 然后按序堆叠渲染浮层: DialogMenu, DialogStockDetail, DialogRemoveConfirm, DialogConfirm (最后绘制即最上层). 浮层输入由各自的 isActive 门控; DialogConfirm 打开时其余浮层变暗 (bright=false) 且输入失活, 仅确认弹窗保持明亮, 其余浮层保留挂载与状态.

`src/components/` 含 Card, Dialog, AppLogo, SpaceMask, Text, StatusBar, TextInput, CheckboxGrid, MarketIndexTicker (目录: index.tsx + hooks/ + lib.ts) 与复合弹窗 (DialogMenu, DialogStockDetail, DialogRemoveConfirm, DialogConfirm). Dialog 导出 `DIALOG_CHROME` 和 `DIALOG_WIDTH_RESERVE`; WindowSizeGuard 持有 `MIN_TERMINAL_ROWS` 与 `MIN_TERMINAL_COLUMNS` (与界面语言无关的常量), 并在尺寸达标分支把 children 包进一个终端尺寸的 Box, 作为 `full` Card 百分比尺寸的基准.

Card 负责:

- `full` 或显式 width/height
- 主题 border style 和 border color
- 左上 borderTopLeft, 右上 borderTopRight, 左下 borderBottomLeft, 右下 borderBottomRight 与上边框中段 borderTopCenter (五处内容都由 CardCorner 渲染, 绝对定位压在边框行上, 固定单行并裁剪溢出, 内容两侧各一个 `|`)
- 上边框中段跨满内容区并 `justifyContent="center"`. 它与四个角同在一行, 因此顺序上排在四角**之前**绘制: 万一内容过宽, 被压住的是中间而不是标题和角标
- 内容 padding 和可选 `mask` (打开时用 SpaceMask 盖住其后内容)
- footer

`full` 把 width 和 height 都写成 100%, Card 因此不再读 `useWindowSize`; 代价是必须有一个给定尺寸的祖先, 由 `WindowSizeGuard` 尺寸达标分支包出的 Box 充当. 脱离这个祖先渲染 `full` Card 时 `height: '100%'` 解析不到确定值, 会退回内容高度 (ink 只给 root node 设宽度, 不设高度), 因此测试显式提供一个给定尺寸的父盒锁定这条契约.

Dialog 支持 `above`, `borderTopLeft`, `borderTopRight`, `borderBottomLeft`, `borderBottomRight`, `hint` 和 `width` (四角类型从 CardProps Pick 而来), footer 由 StatusBar 渲染 hint 和时钟. Dialog 使用 absolute full-terminal Box 居中 Card, 外层保持透明, 让底层 command 的 dim 状态可见; Card 传入 `mask` 铺满 content 区域.

`above` 渲染在 Card 之上并与 Card 居中同轴, 与 Card 之间的一行间距由 Dialog 的 `marginBottom` 提供, 槽位内容不自带外边距. 它是唯一不参与 Card 宽度也不在 Card `mask` 之内的浮层槽位: art 覆盖的单元格 (含字母之间的空格) 由 Ink 逐格重写, 自身那一带不会与底层文字串行, 左右两侧仍是底层 command 的 dim 内容. 目前只有 DialogMenu 用它与 AppLogo 搭配.

AppLogo 是应用 ASCII art (两行), 各行必须等宽, 且宽度不得超过 `MIN_TERMINAL_COLUMNS` (否则在恰好卡着宽度下限的终端上 art 会被裁). `tests/appLogo.test.ts` 有守卫用例锁定这两条; 组件不铺 mask, 也不接受宽度参数.

弹窗宽度由 `components/Dialog.tsx` 的 `dialogContentWidth(...)` 与 `dialogWidth(columns, widest)` 统一计算, 各弹窗不再各写一份公式: 内容侧先取最宽的一项并套上限, 外层取标题, 内容, hint 的最大值 (下限 24), 再加 `DIALOG_CHROME` 与 `DIALOG_WIDTH_RESERVE`, 上限为终端宽度减 2. 内容是列表时把每项宽度逐个传给 `dialogContentWidth`, 不要先把整串宽度拼出来.

SpaceMask 用在 card 被 `mask` 时铺出内容区 clientWidth*clientHeight 个空格 (absolute + flexDirection column, 每行一个 Text). 测量在 Card 内部的 `MaskedContent` 里完成: 它只在该 Card 需要 `mask` 时挂载, 自身带着 `useBoxMetrics`, 普通 Card 因此完全不做布局测量. 测量完成前 (`hasMeasured` 为 false, 即首帧) 不渲染, 与 ScrollBox, CheckboxGrid 用 `hasMeasured` 兜底的写法一致. Card 不接受 `backgroundColor`, 遮蔽一律走 `mask`.

ScrollBox 用 ink 8 的 `contentOffsetY` 滚动: 视口是 `flexBasis={0} flexGrow={1} overflow="hidden"` 的 Box, 整份 list (不切片) 放在一个 `flexShrink={0}` 的 wrapper 里, `contentOffsetY` 把它上移钳制后的偏移. `flexBasis={0}` 不能省: 视口默认 `flexBasis: auto` 会以整段内容为基准尺寸, 内容高于视口时同一列的表头行会被 flex 收缩挤掉. 可视行数取 `useBoxMetrics` 的 clientHeight, 经 `onVisibleChange` 交给调用方; 偏移的钳制规则与 `commands/StockList/lib.ts` 的 `visibleWindow` 相同, 两处各有一份是分层使然 (components 不 import commands), 改一处要同时改另一处.

本地 `src/components/Text.tsx` 是项目文字入口, 负责主题默认 foreground 和 overlay dim. Ink 原生 Text 只在封装内部或测试中直接使用.

CheckboxGrid 是多选网格: 方向键移动, 空格勾选, 回车提交勾选项 (至少一个才触发). 内部处理光标滚动窗口, `isActive` 控制输入, 外部通过 key 重挂载 (resetToken 变化) 清空勾选. 重挂载会把光标带回第一格, 因此另有 `defaultCursor` (可选, 默认 0, 越界时按 `clampCursor` 钳制) 与 `onCursorChange` (光标移动时回传新下标, 初始位置不回传): 删除页用它们让删除后的光标停在原来的位置 (同一个下标, 越界时落到末格). 网格自身不受这两个值影响, 它们只在挂载时读一次.

列数和列间距都不写死在组件里: `columnCount` (至少为 1) 与 `columnGap` (至少为 2) 都是必填 prop, 组件不设默认值, 也不读终端尺寸. 列数推导函数 `gridColumnCount(contentWidth, columnGap)` 与其它网格几何一起放在 `CheckboxGrid/lib.ts`: 按内容区宽度取每格仍不小于最小单元格宽度的最大列数 (最小单元格宽度 24 列, 即 `[x] 四字名称 (sh600000)` 的宽度), 最后钳制到 2..8.

StockRemove 在 `index.tsx` 里用 Ink 的 `useWindowSize()` 取终端列数, 再按 `gridColumnCount(columns - TABLE_CHROME, columnGap)` 推导列数: 单元格等分 Card 内容区宽度 (`columns - TABLE_CHROME`). 列数变化 (终端宽度变化) 会改变光标所在的行, 所以 hook 在渲染前用 `scrollForCursor` 再钳制一次滚动偏移.

## TextInput 协议

TextInput 的 props 是 `{ prompt, onSubmit, placeholder?, isActive? }`: `isActive` 默认为 true, 由 command 传入 `!overlayOpen.open` (组件不自己读浮层状态), 组件内部再叠加 `!submitted`, 因此回车后输入框不再接受按键并收起光标. 返回入口 `ActionResult` 复用这两个字段 (`Pick<TextInputProps, 'isActive' | 'onSubmit'>`), 自己不 import command 或 store: "按 Enter 返回" 的行为由命令的 hook 提供, 例如 `useStockAdd()` 的 `handleSubmit`.

TextInput 的 value 和 submitted 是组件本地状态. 业务 store 保存:

```ts
{
  error: string | undefined
  resetToken: number
}
```

resetToken 变化时清空输入并重新激活. 命令给不同步骤添加 token 前缀, 例如 `code-1` 和 `confirm-1`. 不依赖 React key 强制 remount.

TextInput 和全局快捷键没有事件冒泡停止机制. TextInput 在激活期间 (isActive 且未提交) 通过 `useInputFocusStore` 做引用计数: App 的 `useInput` 在计数大于 0 时忽略 q, 让输入字符归输入框所有; esc 仍打开菜单, 它是输入页唯一的返回入口, 且 TextInput 不消费 escape. 因此 StockAdd 的 hint 只列 `菜单(esc)`, 不再宣传 `退出(q)`. 新增自由文本编辑模式时复用 TextInput 即可, 不要再让输入字符触发全局动作.

## 主题应用

`src/hooks/useTheme.ts` 是读取主题 palette 的唯一 hook. 不把 React hook 定义放在 store 文件中.

主题应用规则:

- Card 使用全局 `borderStyle` 和 `primary` border; 内容区默认透明, 传入 `mask` 时用 SpaceMask 铺满 content 区块.
- Text 在未显式传 color 时使用主题 foreground.
- StatusBar bright 状态使用主题 accent.
- Menu 选中项使用主题 highlight.
- 命令标题使用主题 primary.
- 涨跌色, error, warning 和 success 属于语义色, 显式 color 优先于主题默认色.
