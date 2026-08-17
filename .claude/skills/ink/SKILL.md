---
name: ink
description: Ink (React for CLIs) 官方使用手册. 内容完全来自 https://github.com/vadimdemedes/ink/blob/master/readme.md. 当任务涉及用 Ink 构建/修改终端 UI, 需要查询组件, hooks, render API 的用法时使用.
---

# Ink - React for CLIs

使用手册, 内容完全来自 [Ink 官方 README](https://github.com/vadimdemedes/ink/blob/master/readme.md) (ink 7.x).

## 安装

```
npm install ink react
```

JSX 需要 Babel 的 `@babel/preset-react`, 或使用 `create-ink-app` 脚手架 (JS 或 `--typescript`).

## 核心概念

- 构建和测试 CLI 输出使用组件 ("React for CLIs").
- **布局**: 每个元素都是 flex 容器 - "如同浏览器里每个 `<div>` 都有 `display: flex`". 布局由 Yoga 引擎计算.
- **文字**: 所有文本必须包在 `<Text>` 里.
- **生命周期**: 进程在事件循环有工作时保持存活 (定时器, pending promise, 挂起的 `useInput` 监听 stdin). 退出: Ctrl+C (默认 `exitOnCtrlC`), `useApp().exit()`, 或 `unmount()`. `waitUntilExit()` 在 unmount 后执行代码.

## 组件

### `<Text>`

显示并样式化文本. 里面只允许文本节点和嵌套 `<Text>`, 不能放 `<Box>`.

- 样式: `color` (chalk 颜色名/hex/rgb), `backgroundColor`, `dimColor`, `bold`, `italic`, `underline`, `strikethrough`, `inverse`
- `wrap`: `wrap` (默认) / `hard` / `truncate` / `truncate-start` / `truncate-middle` / `truncate-end`

### `<Box>`

布局核心 (如浏览器 `display: flex`).

- **尺寸**: `width` `height` (数字或 %), `minWidth` `minHeight` `maxWidth` `maxHeight`, `aspectRatio` (需一个尺寸约束)
- **Padding**: `paddingTop/Bottom/Left/Right`, `paddingX`, `paddingY`, `padding` (默认 0)
- **Margin**: `marginTop/Bottom/Left/Right`, `marginX`, `marginY`, `margin` (默认 0)
- **Gap**: `gap`, `columnGap`, `rowGap` (默认 0)
- **Flex**: `flexGrow` (0), `flexShrink` (1), `flexBasis` (数字或 %), `flexDirection` (`row`/`row-reverse`/`column`/`column-reverse`), `flexWrap` (`nowrap`/`wrap`/`wrap-reverse`), `alignItems` (`flex-start`/`center`/`flex-end`/`stretch`/`baseline`), `alignSelf` (多 `auto`), `alignContent` (默认 `flex-start`, 与 CSS 不同), `justifyContent` (`flex-start`/`center`/`flex-end`/`space-between`/`space-around`/`space-evenly`)
- **定位**: `position` (`relative`/`absolute`/`static`; static 时偏移被忽略), `top` `right` `bottom` `left` (数字或父级 %)
- **显示**: `display` (`flex`/`none`), `overflowX` `overflowY` `overflow` (`visible`/`hidden`)
- **边框**: `borderStyle` (`single`/`double`/`round`/`bold`/`singleDouble`/`doubleSingle`/`classic` 或自定义 `BoxStyle` 对象 8 字符), `borderColor` + 单边 `borderTopColor`/`borderRightColor`/`borderBottomColor`/`borderLeftColor`, `borderDimColor` + 单边变体, `borderBackgroundColor` + 单边变体 (回退到简写), 可见性 `borderTop`/`borderRight`/`borderBottom`/`borderLeft`
- **背景**: `backgroundColor` 填满整个 Box 区域并被子 `<Text>` 继承 (除非 Text 自己设了 color); 与边框和 padding 兼容

### `<Newline>`

添加 `\n` 字符, 必须放在 `<Text>` 内. Prop: `count` (默认 1).

### `<Spacer>`

沿主轴扩展的弹性空白. 例如在行内把 "Left" 推左, "Right" 推右; 高列中推上推下.

### `<Static>`

在一切内容之上固定渲染输出 - 用于已完成的任务, 日志, 任何不变更的输出. 只渲染 `items` 中**新增**的项; 对旧项的修改不会重渲染.

- Props: `items` (数组), `style` (容器 `<Box>` 的 props 对象), `children(item, index)` 渲染函数; 根元素必须带 `key`.

### `<Transform>`

在写屏前转换子 `<Text>` 的输出字符串 (渐变, 链接, 文字效果). 只能作用于 `<Text>` 子元素, 且不得改变输出尺寸. 子元素用了样式 prop 时字符串可能含 ANSI 转义码 - 用 ANSI 感知方法 (`slice-ansi`, `strip-ansi`).

- Prop: `transform(outputLine, index)` - 接收每行输出和从 0 开始的行号.

## Hooks

### `useInput(inputHandler, options?)`

处理用户输入; 逐字符调用, 粘贴时一次收到完整字符串. Handler 收 `(input, key)`:

- `key` 标志: `leftArrow` `rightArrow` `upArrow` `downArrow` `return` `escape` `ctrl` `shift` `tab` `backspace` `delete` `pageDown` `pageUp` `home` `end` `meta` `super` `hyper` `capsLock` `numLock` `eventType` (`'press'`/`'repeat'`/`'release'` - 后三者需要 kitty keyboard 协议)
- Options: `isActive` (默认 true)

### `usePaste(handler, options?)`

激活时自动启用 bracketed paste 模式, handler 收到完整粘贴字符串原样 (保留换行和转义). 粘贴内容不会到达 `useInput` handlers. Options: `isActive`.

### `useApp()`

返回:

- `exit(errorOrResult?)` - undefined 时 resolve; Error 时 reject; 其他值 resolve 该值
- `waitUntilRenderFlush()` - 输出 flush 后 settle
- `suspendTerminal(callback?)` - 把终端交给子进程 (如 `$EDITOR`/`fzf`), 恢复后重绘 Ink 状态; 支持回调形式或手动 `suspension.resume()`; 也可作为 `await using` 的 disposable; 已挂起时调用会 throw; 非交互模式下 no-op

### `useStdin()`

返回 `stdin` 流, `isRawModeSupported`, `setRawMode(isRawModeEnabled)` (除非支持否则 throw; 必须用 Ink 的版本, 这样 Ctrl+C 才仍然有效).

### `useStdout()`

返回 `stdout` 流和 `write(data)` - 在 Ink 输出之外打印, 无冲突 (字符串, 类似 `<Static>` 但任意字符串).

### `useBoxMetrics(ref)`

跟踪 `<Box>` ref, 返回 `width` `height` `left` `top` `hasMeasured` (首次布局前或脱离时全为 0).

### `useStderr()`

同 `useStdout` 语义, 面向 stderr.

### `useWindowSize()`

返回 `columns` `rows`; 终端 resize 时重渲染.

### `useFocus(options?)`

让组件可聚焦; Tab 按渲染顺序循环切换可聚焦组件. Options: `autoFocus`, `isActive`, `id` (程序化聚焦). 返回 `isFocused`.

### `useFocusManager()`

返回 `enableFocus()`, `disableFocus()`, `focusNext()`, `focusPrevious()`, `focus(id)`, `activeId` (string | undefined). 焦点管理默认开启; Ink 在 Tab / Shift+Tab 时自动调 `focusNext`/`focusPrevious`.

### `useCursor()`

返回 `setCursorPosition(position)`, `position = {x, y}` (0 起始, 相对 Ink 输出) 或 `undefined` 隐藏光标; IME 支持必需; 宽字符 (CJK, emoji) 用 `string-width` 计算.

### `useIsScreenReaderEnabled()`

返回布尔; 为屏幕阅读器渲染不同输出.

### `useAnimation(options?)`

返回 `frame` (离散计数器), `time` (已过毫秒), `delta` (距上次 tick 毫秒), `reset()`. Options: `interval` (默认 100), `isActive` (切换会重置所有值为 0). 所有动画共享单个内部定时器.

## render API

### `render(tree, options?)` -> Instance

Options:

- `stdout` `stdin` `stderr` (流, 默认 `process.*`)
- `exitOnCtrlC` (默认 true)
- `patchConsole` (默认 true; console 输出与 Ink 输出交错, unmount 时恢复原生 console)
- `onRender({renderTime})` - 每帧提交后的回调 (不等待流 flush; 需要时用 `waitUntilRenderFlush`)
- `isScreenReaderEnabled` (默认: `process.env['INK_SCREEN_READER'] === 'true'`)
- `debug` (每次更新作为单独输出)
- `maxFps` (默认 30)
- `incrementalRendering` (只重绘变化行)
- `concurrent` (React Concurrent 模式: Suspense, `useTransition`, `useDeferredValue`)
- `interactive` (默认 true, 除非 CI 或 `stdout.isTTY` 为 falsy; false 时跳过终端特性, 只在 unmount 时写最后一帧)
- `alternateScreen` (独立缓冲区, 如 vim/htop; 无滚动回退; 非交互时忽略)
- `kittyKeyboard` - `{mode: 'auto'|'enabled'|'disabled', flags: [...]}`; flags: `disambiguateEscapeCodes`, `reportEventTypes`, `reportAlternateKeys`, `reportAllKeysAsEscapeCodes`, `reportAssociatedText`; 改变输入行为 (非打印键产生空 `input`, Ctrl+字母映射为 `key.ctrl` + 字母名, 区分 Ctrl+I 与 Tab, Shift+Enter, Escape 与 Ctrl+[)

### `renderToString(tree, options?)` -> string

同步, 不写 stdout, 不监听终端. 终端 hooks 返回 no-op (不 throw). `useEffect` 会运行但它的状态更新不影响返回输出; `useLayoutEffect` 的更新会. `<Static>` 输出前置. 错误在 cleanup 后传播. Option: `columns` (默认 80).

### Instance (render 的返回值)

- `rerender(tree)` - 替换根组件或更新其 props
- `unmount()` - 手动卸载
- `waitUntilExit()` - unmount 时 settle; 用 `exit(value)` resolve, 用 `exit(error)` reject
- `waitUntilRenderFlush()` - 帧 flush 后 settle
- `cleanup()` - unmount + 删除该 stdout 的内部实例 (同时拆除终端状态, 如 alternate screen)
- `clear()` - 清空输出

### `measureElement(ref)`

返回 `{x, y, width, height}` 给一个 `<Box>` ref. 是布局树坐标, 不是终端视口坐标 (鼠标事件比较时需要换算). 渲染期间调用返回 0 - 从 `useEffect`, `useLayoutEffect`, 输入处理器或定时器里调用, 内容变化时重新测量.

## 测试

```
npm install ink-testing-library
```

```jsx
import { render } from 'ink-testing-library'
const { lastFrame } = render(<Test />)
```

## React Devtools

运行时设置 `DEV=true` 启动 CLI, 然后 `npx react-devtools`. 需要可选依赖 `react-devtools-core`.

## 屏幕阅读器支持

通过选项或 `INK_SCREEN_READER=true` 启用; 实现 ARIA 子集: `aria-label`, `aria-hidden`, `aria-role` (button, checkbox, combobox, list, listbox, listitem, menu, menuitem, option, progressbar, radio, radiogroup, tab, tablist, table, textbox, timer, toolbar), `aria-state` (busy, checked, disabled, expanded, multiline, multiselectable, readonly, required, selected). 示例: 选中复选框渲染为 "(checked) checkbox: Accept terms and conditions". 自定义组件: 用 `useIsScreenReaderEnabled` 和 `<Box>`/`<Text>` 上的 ARIA props.

## 常用组件与 Hooks (生态)

- 组件: `ink-text-input`, `ink-spinner`, `ink-select-input`, `ink-link`, `ink-gradient`, `ink-big-text`, `ink-table`, `ink-markdown`, `ink-task-list`, `ink-chart`, 等
- Hooks: `ink-use-stdout-dimensions`
- Recipes: 用 React Router 的 `MemoryRouter` 做路由

## CI 行为

检测到 `CI` 时: 只在退出时渲染最后一帧 (无 ANSI 覆盖序列), resize 事件被忽略; 用 `CI=false` 退出此行为.

## 其它

- 所有 React 特性都受支持 (hooks, context, 等等).
- Examples: 仓库中有可运行示例 (borders, counter, suspense, table, focus, input, static, router, child process, Jest-like UI 等).
