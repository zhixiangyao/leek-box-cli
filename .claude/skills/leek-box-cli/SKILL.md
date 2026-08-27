---
name: leek-box-cli
description: leek-box-cli 项目架构, 开发规范和真实实现约束. 当任务涉及本项目的页面, 组件, hooks, stores, 行情接口, settings 持久化, 主题, 轮询或测试时使用. Ink 通用 API 参考 ink skill.
---

# leek-box-cli 项目规范

交互式终端股票自选股看板. 技术栈为 `ink@7.1.1`, `react@19.2.8`, `zustand@5`, `meow@14`, TypeScript ESM 和 Vite. 开发使用 `tsx`, 行情请求使用 Node.js 原生 `fetch`.

## 核心原则

- 以当前源码为唯一事实来源, 不保留未上线版本的兼容层, migration, deprecated alias 或旧文件格式 fallback.
- 页面渲染, 输入接线, 业务状态和持久化分层, 不把所有逻辑放进 screen 组件.
- 共享状态使用 Zustand, React 生命周期和 Ink hooks 留在 React hook 层.
- 文件写入使用锁和原子替换, 所有 settings 与 stocks 修改必须在锁内读取最新文档后合并.
- 所有中文文案, 注释和文档使用 ASCII 标点, 禁止中文全角标点和 U+3000 空格.
- 所有本地 import 显式写 `.ts` 或 `.tsx` 后缀.

## 目录和职责

```text
src/cli.tsx
  meow 参数解析, 初始路由, Ink render 和 settings persistence start/stop

src/app.tsx
  全局 esc/q 输入, 当前 screen 装配, DialogMenu 和 DialogStockDetail 绘制顺序

src/lib/registry.ts
  页面唯一注册表, 派生 Screen, SCREEN_LIST, CLI help 和菜单

src/screens/<Feature>/index.tsx
  页面渲染, 只消费对应 feature hook 返回的状态和视图模型

src/screens/<Feature>/hooks/
  Zustand 订阅, 页面生命周期, Ink 输入, 测量和轮询接线

src/components/
  Card, Dialog, Text, StatusBar, TextInput 和复合弹窗

src/hooks/
  usePolling, useOverlayOpen, useClock, useTheme

src/stores/
  Zustand 状态机和业务动作. 复杂 store 导出 createXxxStore(dependencies)

src/api/index.ts
  HTTP 请求, timeout, minimum duration, AbortSignal 合并和 GBK 解码

src/api/parsers.ts
  腾讯行情响应的纯解析器

src/lib/settings.ts
  settings.json schema, 校验, 锁, 原子写入和 stocks 操作

src/lib/settingsPersistence.ts
  settings 初始化, store hydration, debounce patch 保存和退出 flush

test/*.test.ts
  parser, store, settings persistence 和终端布局测试
```

依赖方向保持为:

```text
screens/components -> hooks/stores -> api/lib
cli -> registry/settingsPersistence -> settings/store
```

中性组件不得导入具体 screen. React 生命周期, `useInput`, Ink ref 和布局测量不得进入 store 或 `src/lib`.

## CLI 启动和退出

`src/cli.tsx` 只保留以下职责:

1. 使用 meow 解析 command 和 flags.
2. 调用 `startSettingsPersistence()`.
3. 在 `render()` 前写入 router 初始 screen.
4. 使用 alternate screen 启动 Ink.
5. 等待 `instance.waitUntilExit()`.
6. 在 finally 中调用 `settingsPersistence.stop()`.

标准启动:

```ts
const settingsPersistence = await startSettingsPersistence(onError)
useRouterStore.setState({ screen: toScreen(cli.command) })
const instance = render(<App />, { alternateScreen: true, concurrent: true })
await instance.waitUntilExit()
await settingsPersistence.stop()
```

初始化 settings 必须发生在 render 之前. 首屏, 首次轮询和首次 API 请求必须读取已经 hydrate 的配置.

退出使用 Ink `useApp().exit()`. 不调用 `process.exit()`. 异步持久化失败通过 `process.exitCode` 表示, 并保证 alternate screen 正常清理.

## 页面注册和路由

`src/lib/registry.ts` 是页面元数据的唯一来源. 每项包含:

- `Component`
- `title`
- `description`
- `hint`
- `menuLabel`

`Screen`, `SCREEN_LIST`, `isScreen()` 和 `toScreen()` 均从注册表派生. 新增页面只修改注册表, 不在 App, CLI help 或 DialogMenu 维护第二份映射.

当前页面:

- `stock-list`
- `stock-add`
- `stock-remove`
- `settings`

无 command 或非法 command 进入 `stock-list`.

## Screen, hook 和 store 分层

Screen 的 `index.tsx` 负责渲染. 页面状态, 输入和副作用放入 `hooks/useFeature.ts`.

标准模式:

```text
index.tsx
  调用 useFeature()
  按 step 或 view model 渲染

hooks/useFeature.ts
  窄 selector
  useEffect
  useInput
  usePolling
  视图模型计算

useFeatureStore.ts
  业务状态机
  异步业务动作
  可注入依赖
```

Add, Remove, StockList 和 StockDetail 的复杂 store 使用 `createXxxStore(dependencies)`. 网络, 文件和时间通过 dependencies 注入, 不使用 DI 容器.

Settings 的规则:

- `src/screens/Settings/index.tsx` 只负责分组渲染.
- `src/screens/Settings/hooks/useSettings.ts` 负责选中项, 键盘输入, option 循环, duration 格式化和行视图模型.
- UI 只更新 `useSettingsStore`. 磁盘保存由 `settingsPersistence` 统一订阅, 不在 screen 中直接写文件.

React 组件优先使用窄 selector. 事件需要同步快照时使用 `useXxxStore.getState()`. 不在多个 store 中保存同一配置字段.

## 全局输入和 overlay

共享 overlay 包含菜单和股票详情.

- `esc`: 详情打开时先关闭详情, 否则切换菜单.
- `q`: 仅在没有 overlay 时退出.
- 底层 screen 的 `useInput` 使用 `{ isActive: !overlayOpen }`.
- DialogMenu 自己处理上下键, Enter 和数字快捷键.
- DialogStockDetail 仅在详情打开且菜单关闭时处理周期数字键.

详情周期快捷键:

```text
1 分时
2 五日
3 日 K
4 周 K
5 月 K
6 年 K
```

`useOverlayOpen()` 只派生 menu open 和 detail stock 两个布尔状态. 不新增重复的 overlay Context.

## Settings 和主题

`useSettingsStore` 保存以下值:

```ts
type Settings = {
  themePreset: ThemePreset
  borderStyle: BorderStyle
  requestTimeoutMs: number
  minimumRequestDurationMs: number
  quotePollIntervalMs: number
  minuteChartPollIntervalMs: number
  klinePollIntervalMs: number
}
```

默认值:

```text
themePreset                 classic
borderStyle                 round
requestTimeoutMs            8000
minimumRequestDurationMs    0
quotePollIntervalMs         5000
minuteChartPollIntervalMs   30000
klinePollIntervalMs         300000
```

主题 preset:

- `classic`
- `ocean`
- `forest`
- `sunset`

Border style:

- `single`
- `double`
- `round`
- `bold`
- `singleDouble`
- `doubleSingle`
- `classic`
- `arrow`

`src/hooks/useTheme.ts` 是读取主题 palette 的唯一 hook. 不把 React hook 定义放在 store 文件中.

主题应用规则:

- Card 使用全局 `borderStyle`, `primary` border 和主题 background.
- Text 在未显式传 color 时使用主题 foreground.
- StatusBar bright 状态使用主题 accent.
- Menu 选中项使用主题 highlight.
- 页面标题使用主题 primary.
- 涨跌色, error, warning 和 success 属于语义色, 显式 color 优先于主题默认色.

Settings 键盘:

```text
Up/Down       选择配置项
Left/Right    减少或增加
Enter         增加或切换 option
d             恢复默认值
```

所有数值更新必须经过 `normalizeSettings()`. 始终保证 `minimumRequestDurationMs <= requestTimeoutMs`.

## settings.json 持久化

唯一配置文件:

```text
$XDG_CONFIG_HOME/leek-box-cli/settings.json
```

未设置 `XDG_CONFIG_HOME` 时:

```text
~/.config/leek-box-cli/settings.json
```

当前格式没有 legacy migration 和 schemaVersion:

```json
{
  "theme": {
    "preset": "classic",
    "borderStyle": "round"
  },
  "request": {
    "timeoutMs": 8000,
    "minimumDurationMs": 0,
    "quotePollIntervalMs": 5000,
    "minuteChartPollIntervalMs": 30000,
    "klinePollIntervalMs": 300000
  },
  "stocks": [
    {
      "code": "sh600000",
      "name": "浦发银行",
      "addedAt": "2026-08-20T00:00:00.000Z"
    }
  ]
}
```

规则:

- 文件不存在时使用默认 settings 和空 stocks 创建.
- 文件存在时严格校验 theme, request 和 stocks.
- 损坏文件直接报错, 不静默丢弃字段, 不 fallback 到旧格式.
- `StockEntry` 为 `{code, name, addedAt}`.
- `parseStocks()` 校验 code, name, addedAt 和重复 code.
- `patchSettings()` 只合并变化的 settings 字段, 保留锁内读取到的最新 stocks.
- `stockAdd()`, `stocksAdd()`, `stockRemove()` 在锁内读取最新文档后修改.
- `replaceStocks()` 表示明确的整表替换, 当前仅用于 mock reset.

写入流程:

1. 获取 `settings.json.lock`.
2. 在锁内重新读取并校验最新 settings.json.
3. 只修改当前操作负责的字段.
4. 写入同目录唯一临时文件.
5. rename 原子替换 settings.json.
6. 校验 lock token 后释放.

Lock 元数据包含 token, pid 和 createdAt. 元数据先写入临时文件, 再通过 hard link 原子发布, 不暴露空 lock 文件. Lock 使用 PID 和 30 秒 lease 判断 stale. 普通等待每 25ms 重试, 2 秒后给出可读错误.

`settingsPersistence` 在启动时 hydrate store. Store 变化后使用 100ms debounce 合并 patch, 串行写入, 保存失败时保留 pending patch, 后续变更或退出时重试. `stop()` 必须幂等并 flush 所有 pending 数据.

## 轮询语义

所有网络轮询使用 `src/hooks/usePolling.ts`.

- 挂载后立即执行一次.
- 单实例最多一个 in-flight task.
- `intervalMs` 表示相邻任务的最小启动间隔.
- task 完成后只等待 `intervalMs - taskDuration` 的剩余时间.
- task 超过 interval 时下一轮立即开始, 但不并发.
- 手动 refresh 清除 timer 并立即执行, 已有请求时忽略.
- interval 变化在非请求期间重新排程.
- 卸载或 restartKey 变化时清 timer 并 abort 当前请求.

默认 interval 来自 `useSettingsStore`, 不在 StockList 或详情 store 保存重复值.

详情 `restartKey` 必须包含 `stock.code` 和 `period`. 切股票或周期时旧请求必须 abort, store 还要检查当前 code/period, 防止陈旧结果落地.

## 请求 timeout 和 minimum duration

`src/api/index.ts` 的全部行情请求使用统一 timing wrapper.

- 每次请求开始时读取最新 `requestTimeoutMs` 和 `minimumRequestDurationMs`.
- 调用者 signal 与 `AbortSignal.timeout()` 使用 `AbortSignal.any()` 合并.
- minimum duration 只作用于成功请求, 失败和 HTTP error 立即返回.
- minimum duration 补时支持调用者 signal 中止.
- 配置变化只影响新请求, 不修改已经启动的请求.

API 函数:

- `fetchQuotes()`
- `fetchIntraday()`
- `fetchFiveDay()`
- `fetchHistorical()`

实时行情使用 GBK. 必须先 `response.arrayBuffer()`, 再使用 `TextDecoder('gbk')`. 不使用 `response.text()`.

## StockList 数据模型

`StockListStep.table` 使用统一 rows:

```ts
type StockRow =
  { kind: 'quote'; code: string; name: string; quote: Quote } | { kind: 'missing'; code: string; name: string }
```

禁止恢复 `quotes + missing` 双数组拼接. 统一 rows 用于渲染, 选择, Enter 打开详情和可视窗口.

选择身份使用 `selectedCode`, 不使用数组 index. 刷新时保持仍存在的 code, 删除后回退到附近有效行, 并尽量保持选中行的视口相对位置.

StockList 会逐字段比较 Quote. 数据未变化时复用旧 Quote 引用, 让 Zustand selector 的 `Object.is` 跳过无意义更新.

## Card, Dialog 和 Text

每个 screen 自己渲染 full-screen Card 和 StatusBar. App 只渲染当前 screen, 然后按顺序渲染 DialogMenu 和 DialogStockDetail.

Card 负责:

- 全屏或显式 width/height
- 主题 border style 和 border color
- 左上 title
- 右上 extra
- 内容 padding 和 background
- footer

Dialog 使用 absolute full-screen Box 居中 Card. Dialog 外层保持透明, 让底层 screen 的 dim 状态可见. Dialog 内容背景由 Card 主题处理.

本地 `src/components/Text.tsx` 是项目文字入口. 它负责主题默认 foreground 和 overlay dim. Ink 原生 Text 只在封装内部或测试中直接使用.

## TextInput 协议

TextInput 的 value 和 submitted 是组件本地状态. 业务 store 保存:

```ts
{
  error: string | undefined
  resetToken: number
}
```

resetToken 变化时清空输入并重新激活. 页面给不同步骤添加 token 前缀, 例如 `code-1` 和 `confirm-1`. 不依赖 React key 强制 remount.

TextInput 和全局快捷键没有事件冒泡停止机制. 新增自由文本编辑模式时, 必须同步设计全局 q/esc 的 keyboard ownership, 避免输入字符触发退出或菜单.

## 行情解析和显示

A 股颜色为涨红, 跌绿, 平灰. 停牌显示 `--` 和 `停牌`. 接口缺失显示 `--` 和 `无数据`.

`src/api/parsers.ts` 是纯解析层:

- `parseQuoteText()` 解析实时行情文本.
- `parseIntradayResponse()` 解析当日分时.
- `parseFiveDayResponse()` 解析五日分钟数据.
- `parseHistoricalResponse()` 解析日, 周, 月 K 数据.

年 K 使用后复权月 K 在本地按年份聚合. Chart 数据和行情语义色不受 UI theme preset 覆盖.

## 测试和验证

测试使用 Vitest. 当前测试文件:

- `test/api.test.ts`
- `test/lib.test.ts`
- `test/settings.test.ts`
- `test/stores.test.ts`
- `test/layout.test.ts`

测试文件必须隔离 `XDG_CONFIG_HOME`, 不读写用户真实 settings.json. 全局 Zustand singleton 在布局测试之间使用 `getInitialState()` 恢复.

修改后至少运行:

```bash
pnpm typecheck
pnpm lint:check
pnpm fmt:check
pnpm test
pnpm build
git diff --check
```

需要写入格式时先运行:

```bash
pnpm exec oxfmt <changed-files>
```

交互冒烟需要 PTY 和足够终端尺寸:

```bash
script -qec "stty cols 160 rows 40; pnpm dev" /dev/null
```

涉及 settings 或 stocks 时设置临时 `XDG_CONFIG_HOME`.

## 代码和界面规范

- 中文使用 ASCII `, . : ; ! ? ( )`, 标点后按英文规则留空格.
- 禁止中文全角标点, 顿号和 U+3000 空格.
- 不使用 emoji.
- 不新增兼容 alias, migration 或 deprecated API, 除非任务明确要求.
- 不新增第二份路由, overlay, poll interval 或 settings 状态.
- 不直接修改 Zustand store 内部字段来绕过 action, 测试 setup 和明确初始化除外.
- 表格宽度由列元数据推导, CJK 宽度使用项目本地函数.
- screen 不复制 Card, StatusBar, registry 或 persistence 逻辑.
- 所有退出走 Ink, 所有持久化退出前 flush.
