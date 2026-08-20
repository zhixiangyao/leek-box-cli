---
name: leek-box-cli
description: leek-box-cli 项目规范与真实实现结构. 当任务涉及本项目的界面, 命令, 组件, hooks, 状态, 行情接口, 存储或测试时使用. Ink 通用 API 参考见 ink skill.
---

# leek-box-cli 项目规范

终端股票自选股看板, 技术栈为 `ink@7.1.1`, `react@19.2.8`, `zustand@5`, `meow`, TypeScript ESM. 开发使用 `tsx`, 构建使用 Vite, 运行时行情请求只依赖 Node 原生 `fetch`.

## 目录与依赖方向

```text
src/cli.tsx                         meow 命令解析, 初始化 router store, 启动 Ink
src/app.tsx                         全局按键, 页面装配, 浮层顺序, 顶层布局
src/lib/registry.ts                 页面唯一注册表: 组件, 标题, 说明, 状态栏提示, 菜单名
src/screens/<Feature>/index.tsx     按 step 纯渲染, 使用窄 Zustand selector
src/screens/<Feature>/hooks/        页面生命周期, 输入, 测量和轮询接线
src/screens/<Feature>/lib.ts        feature 局部纯函数
src/components/                     通用 Ink 组件和复合弹窗
src/hooks/                          usePolling, useOverlayOpen, useClock
src/stores/                         Zustand 状态机与业务动作; 复杂 store 导出可注入 factory
src/api/index.ts                    HTTP 传输, 超时, GBK 解码, 股票代码规范化
src/api/parsers.ts                  腾讯实时行情和分时响应的纯解析器
src/api/types.ts                    Quote, IntradayPoint
src/lib/columns.ts                  全量行情列和共享行构造
src/lib/stockTable.ts               看板列子集和表格宽度
src/lib/layout.ts                   中性布局常量
src/lib/watchlist.ts                watchlist schema, 锁, 原子持久化
src/lib/*.ts                        格式化, 错误, yes/no 等纯逻辑
test/*.test.ts                      Node test runner 单元和状态机测试
```

依赖保持 `components/screens -> hooks/stores -> api/lib`. 中性组件不得反向导入具体 screen; 共享布局和列定义放 `src/lib`.

所有本地导入显式写 `.ts` 或 `.tsx` 后缀.

## 页面与路由注册

`src/lib/registry.ts` 是页面运行时元数据的唯一来源, 包含:

- `component`
- `title`
- `description`, 用于 CLI help
- `hint`, 用于 StatusBar
- `menuLabel`

`Screen`, `SCREEN_LIST`, `isScreen()`, `toScreen()` 均从注册表派生. 新增页面时在注册表增加一项并新增对应 feature/store; App, CLI help 和 MenuDialog 不再维护重复映射.

`src/cli.tsx` 在 `render()` 前使用 `useRouterStore.setState()` 写入初始页面, 再执行:

```ts
render(<App />, { alternateScreen: true, concurrent: true })
```

无命令或未知命令进入 `stock-list`.

## 状态与订阅

- Zustand 是应用共享状态的唯一来源, 不为 overlay 再复制 Context 或第二份状态.
- React 组件必须使用窄 selector, 例如 `useMenuStore(state => state.open)`; 不要无参数整店订阅.
- `useOverlayOpen()` 只订阅 `menu.open` 与 `detail.stock !== null` 两个布尔派生值.
- store action 需要读取多个同步字段时可使用 `get()`; 事件接线需要当前快照时可使用 `useXxxStore.getState()`.
- Add, Remove, StockList, StockDetail 均导出 `createXxxStore(dependencies)`, 生产环境再以默认依赖创建 `useXxxStore`. 网络, 文件, 时间通过 factory 依赖替换, 不使用 DI 容器.
- Add/Remove 的 `generation` 位于各 factory 闭包内; 页面重置后, 旧异步结果不得覆盖新流程.

页面采用 step 判别联合: store 保存 step 和动作, `index.tsx` 只按 `step.type` 分支展示, 页面挂载和输入行为放在 hook.

## Overlay 与输入

共享 overlay 包含菜单和股票详情:

- App 的 `esc` 优先关闭详情, 否则切换菜单.
- `q` 仅在 `!overlayOpen` 时调用 `useApp().exit()`.
- TextInput 和 StockList 快捷键通过 `useOverlayOpen()` 设置 `useInput({isActive: !overlayOpen})`.
- MenuDialog 自己处理菜单选择输入; 详情不注册输入, 关闭逻辑由 App 统一处理.

本地 `src/components/Text.tsx` 是项目唯一文字入口. 它从 Zustand 派生 overlay 状态:

```text
bright=false  背景文字在 overlay 打开时 dim
bright=true   浮层文字保持鲜艳
```

浮层内的可见 Text, QuoteRow, IntradayChart 和边框标题应传 `bright`. 所有退出行为使用 `useApp().exit()`, 不得调用 `process.exit()`.

## TextInput 协议

TextInput 的 `value` 和 `submitted` 是组件本地瞬时状态. 业务 store 中每个输入步保存:

```ts
{
  error: string | null
  resetToken: number
}
```

页面将带步骤前缀的 token 传给 TextInput, 例如 `code-1`, `confirm-1`. token 变化时 TextInput 显式清空 value/submitted. 不要依赖 React `key` 强制 remount, 也不要让相邻输入步骤共享相同 token.

## StockList 数据模型

`StockListStep.table` 使用保持 watchlist 顺序的统一行数组:

```ts
type StockRow = { kind: 'quote'; code; name; quote } | { kind: 'missing'; code; name }
```

禁止恢复 `quotes + missing` 双数组拼接. 统一 rows 用于渲染, 选择, Enter 打开详情和切窗.

选择身份保存为 `selectedCode`, 不是数组下标. 刷新时:

1. code 仍存在则保持选择;
2. code 被删除则回退到最接近的有效行;
3. 保持选中行在视口中的相对位置;
4. 空列表重置 selectedCode 和 scrollOffset.

`moveSelection(delta, visible)` 负责钳制选择和锚定滚动. 可视行数通过行容器的 `useBoxMetrics()` 实测, 首帧未测量时使用 1; `visibleWindow()` 只负责纯切窗.

每轮接口会产生新对象. StockList store 会逐字段比较 Quote; 数据完全未变化时复用旧 Quote 引用. 因此详情按 code selector 读取 quote 时, 默认 `Object.is` 可以跳过真正未变化的行情更新.

## 行情列与终端布局

`src/lib/columns.ts` 保存完整 COLUMNS, 以及:

- `headerRow(columns)`
- `quoteRow(columns, quote)`
- `missingRow(columns, code, name)`
- CJK 宽度感知的 `displayWidth` / `cell`

看板列子集 `STOCK_LIST_COLUMNS` 和 `stockTableWidth()` 位于 `src/lib/stockTable.ts`; 详情列子集和详情宽度位于 `StockDetailDialog/lib.ts`. `DIALOG_CHROME`, 最小终端高度等中性常量位于 `src/lib/layout.ts`. 不要让 WindowSizeGuard 导入 screen, 也不要让详情纯逻辑导入 `.tsx` 组件常量.

A 股颜色为涨红, 跌绿, 平灰. 停牌行显示 `--` 和 `停牌`, 接口缺失行显示 `--` 和 `无数据`.

## 轮询

所有网络轮询使用 `src/hooks/usePolling.ts`:

- timer, inFlight, AbortController 都是 hook 实例级状态, 不得使用模块级共享 poll 对象;
- 首次挂载立即执行;
- 请求完成后才使用自调度 `setTimeout` 安排下一轮;
- 同一实例不并发执行;
- 卸载或 `restartKey` 变化时清 timer 并 abort 当前请求;
- interval 变化只重新排程, 不重复创建共享轮询状态;
- 手动 refresh 在已有请求执行时忽略.

看板默认 5000ms, 使用 `-`/`+` 以 500ms 步进调整到 `[1000, 60000]`. 详情默认 30000ms, 并以股票 code 作为 restartKey; 快速关开或切股必须立即请求新 code, 旧请求结果不能落入新股票.

API 的 `fetchQuotes` / `fetchIntraday` 接收可选 AbortSignal, 并与 8000ms timeout signal 合并. store 在 signal aborted 时不写 error 状态.

看板首次刷新失败进入 error; 已有 table 后刷新失败保留旧 rows, 写入黄色 `errorLine`, 后续轮询继续自愈. 详情失败进入 error, 后续轮询成功恢复 ready.

## 腾讯接口与解析

`src/api/index.ts` 只负责请求, 超时和解码:

- 实时行情 `https://qt.gtimg.cn/q=...` 返回 GBK, 必须先 `arrayBuffer()`, 再 `TextDecoder('gbk')`;
- 分时接口返回 JSON;
- 不要使用 `response.text()` 解码实时行情.

`src/api/parsers.ts` 导出纯函数:

- `parseQuoteText(text)`: 按 `;` 和 `~` 解析, 字段不足 50, 空名称和无效记录跳过; 无有效行情时抛错.
- `parseIntradayResponse(value, code)`: 安全读取未知 JSON, 过滤无效价格, 错误时间和 `time > '1500'` 的收盘补点; 缺失数据返回空数组.

腾讯实时字段: 1 名称, 3 现价, 4 昨收, 5 今开, 30 时间, 31 涨跌额, 32 涨跌幅, 33 最高, 34 最低, 36 成交量, 37 成交额, 38 换手率, 43 振幅, 45 总市值, 49 量比.

`normalizeCode()` 去除 SH/SZ/BJ 前后缀并要求 6 位数字: `5/6 -> sh`, `0/1/3 -> sz`, `4/8/92 -> bj`.

## Watchlist 持久化

路径为 `$XDG_CONFIG_HOME/leek-box-cli/watchlist.json`, 未设置时使用 `~/.config/leek-box-cli/watchlist.json`. 读取环境变量必须显式导入 `node:process`, 避免构建器错误替换全局 process.

持久化 schema:

```ts
type WatchEntry = { code: string; name: string; addedAt: string }
```

`parseWatchlist()` 完整校验: 顶层数组, 对象, 标准化 code 格式, 非空 name, 可解析 addedAt, code 不重复. 损坏文件抛出包含路径和条目位置的错误, 不静默过滤.

`saveWatchlist()` 先写同目录唯一临时文件, 再 rename 到目标路径, 并在 finally 清理临时文件. `addStock()` / `removeStock()` 的 read-modify-write 使用独占 lock 文件; 锁等待超时会给出可读错误, 不自动删除所有权不明的锁. Add 最终提交必须处理 `duplicate`, Remove 必须处理目标已被其他进程删除.

## Add/Remove 状态机

Add:

```text
input-code -> checking -> confirm -> saving -> done
                         |          -> already-exists
                         -> error
```

Remove:

```text
loading -> select -> confirm -> removing -> done/error
```

提交过程中必须进入显式 saving/removing step, 不能只依赖 TextInput 本地 submitted 状态防重复提交. Store 的异步 action 返回 Promise, 测试可直接 await.

## Dialog, 图表和绘制顺序

Dialog 使用全屏 absolute Box 做 flex 居中, 内部 round 边框, 黑色不透明背景和 padding, 宽度由调用方提供, 高度自适应. Dialog, MenuDialog, StockDetailDialog, BorderTitle, BorderUpdatedAt 必须是主边框 Box 的后绘制兄弟节点, 不能放进主边框内容区.

分时图使用 Braille 点阵: 价格折线, 昨收虚线, 分钟增量成交量柱和时间轴. 分时接口的成交量是累计值, 柱状图必须转成分钟增量; 15:00 后补点必须过滤. 终端字体需要 Braille 字形.

## 测试与验证

单元测试使用 Node test runner + tsx:

```bash
pnpm test
```

优先覆盖:

- 腾讯响应 parser fixture;
- watchlist schema, 重复项和原子存储边界;
- Add/Remove step 与并发结果;
- StockList 顺序, 选择保持, 滚动和 Quote 引用复用;
- StockDetail 陈旧响应;
- visibleWindow, 图表和格式化纯函数.

完整验证顺序:

```bash
pnpm fmt
pnpm typecheck
pnpm lint:check
pnpm fmt:check
pnpm test
pnpm build
```

交互输入依赖 raw mode, 自动冒烟必须使用 PTY, 并将终端至少设为看板要求的尺寸, 例如:

```bash
script -qec "stty cols 160 rows 40; pnpm dev" /dev/null
```

PTY 冒烟若涉及添加/删除, 应通过临时 `XDG_CONFIG_HOME` 隔离用户真实 watchlist.

## 界面规范

- 中文文案使用半角标点, 并按正常英文标点规则在标点后留空格, 不使用 emoji.
- 颜色: magenta 标题, cyan 信息, yellow 警告, red 错误, green 成功, gray 占位.
- 所有文字使用本地 Text; 所有退出使用 `useApp().exit()`.
- 表格宽度由列元数据推导, 不硬编码; CJK 宽度使用本地 displayWidth/cell, 不新增 string-width 依赖.
- 页面结果使用 ActionResult/Message, 返回看板使用 BackToStockList; StockList 自身的 empty/error 不显示"返回看板".
