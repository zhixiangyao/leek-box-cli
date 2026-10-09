# leek-box-cli(韭菜盒子) 项目规范

交互式终端股票自选股看板. 技术栈为 `ink@8.0.0`, `react@19.3.0`, `zustand@5`, `meow@14`, TypeScript ESM 和 Vite. 开发使用 `tsx`, 行情请求使用 Node.js 原生 `fetch`.

终端 UI 的 Ink 通用 API (组件, hooks, render) 见 `node_modules/ink/readme.md` (ink 8.x 官方手册).

## 核心原则

- 以当前源码为唯一事实来源, 不保留未上线版本的兼容层, migration, deprecated alias 或旧文件格式 fallback.
  `settings.json` 的 `schemaVersion` 只用于**判断** (读到更高版本就拒绝启动), 不是迁移机制.
- 命令渲染, 输入接线, 业务状态和持久化分层, 不把所有逻辑放进 command 组件.
- 共享状态使用 Zustand, React 生命周期和 Ink hooks 留在 React hook 层.
- 文件写入使用锁和原子替换, 所有 settings 与 stocks 修改必须在锁内读取最新文档后合并.
- 所有中文文案, 注释和文档使用 ASCII 标点, 禁止中文全角标点和 U+3000 空格.
- 所有本地 import 显式写 `.ts` 或 `.tsx` 后缀.

## 目录和职责

```text
src/main.tsx
  入口接线: 调用 cli/run.ts 的 run(), Ink render 和 settings persistence start/stop

src/app.tsx
  无浮层时的 esc(打开菜单) 和 q(退出) 输入, 当前 command 装配 (COMMAND_COMPONENTS 持组件映射), 浮层的绘制顺序

src/i18n/
  国际化叶子模块. types.ts 是全部 i18n 类型与文案键的规范来源, locale.ts 定义 locale/language 常量与系统语言检测, core.ts 持有 active locale 与 t(), catalog/ 存放三份文案表

src/navigation/
  命令导航域, 只依赖 i18n, 不 import commands 也不持有命令组件.
  registry.ts 是命令唯一注册表, 派生 Command, COMMAND_LIST, CLI help 和菜单, 文案字段是 MessageKey;
  menu.ts 是从注册表派生的菜单项 (含 reset/exit 两个应用级动作), 供 DialogMenu 与其 store 使用.
  命令组件映射在 app.tsx 的 COMMAND_COMPONENTS, 因此 stores/components 引用本目录不会与 app.tsx 成环

src/cli/
  只在命令行入口链路上用到的模块.
  meow.ts 参数解析, parseCli() 先按已配置语言 applyLanguage 再生成 help, 处理 -h,
  返回 helpMessage 与已读到的 settingsDocument (供 persistence 复用);
  run.ts 启动流程: parseCli -> 打印 help 或交给注入的 startApp, 顶层异常统一成 "运行失败" 文案与退出码

src/commands/<Feature>/index.tsx
  命令渲染, 只消费对应 feature hook 返回的状态和视图模型

src/commands/<Feature>/hooks/
  Zustand 订阅, 命令生命周期, Ink 输入, 测量和轮询接线

src/commands/<Feature>/components/
  该命令专用的展示组件, 不跨命令复用, 只接 props 与窄 selector 订阅, 不持有业务状态.
  目前只有 StockList 抽出这一层: 表格渲染较大, 抽走后 index.tsx 回到按 step 选内容的角色

src/commands/<Feature>/lib.ts
  该命令的纯函数与常量, 不经 hook 就能单测 (tests/stockListLib.test.ts). 目前只有 StockList:
  滚动窗口, 排序, 选中行与视口下标

src/components/
  Card, Dialog, AppLogo, SpaceMask, Text, StatusBar, TextInput, CheckboxGrid, MarketIndexTicker (指数轮播, 目录: index.tsx + hooks/ + lib.ts) 和复合弹窗 (DialogMenu, DialogStockDetail, DialogRemoveConfirm, DialogConfirm). Dialog 导出 DIALOG_CHROME 和 DIALOG_WIDTH_RESERVE; WindowSizeGuard 持有 MIN_TERMINAL_ROWS 与 MIN_TERMINAL_COLUMNS, 两者都是与界面语言无关的常量, 并在尺寸达标分支把 children 包进一个终端尺寸的 Box, 作为 `full` Card 百分比尺寸的基准

src/hooks/
  usePolling, useOverlayOpen, useClock, useTheme, useTranslation

src/stores/
  Zustand 状态机和业务动作. 复杂 store 导出 createXxxStore(dependencies)

src/api/index.ts
  HTTP 请求, timeout, minimum duration, AbortSignal 合并和 GBK 解码

src/api/lib/parsers.ts
  腾讯行情响应的纯解析器

src/api/lib/tools.ts
  代码归一化 (normalizeCode), 统一 timing wrapper 与年 K 聚合

src/settings/schema.ts
  settings.json schema, 校验和文档转换; 外观常量 (border/theme) 与 Settings 类型也定义于此, store 从 schema 导入常量. 校验错误文案也是 MessageKey

src/settings/file.ts
  settings.json 路径, 原子写入, stocks 增删改操作. loadExistingSettings() 只读不创建,
  供启动阶段先取语言用

src/settings/lock.ts
  跨进程文件锁 (withFileLock), 通用 filePath 参数

src/settings/persistence.ts
  settings 初始化 (可复用 parseCli 预读的文档), store hydration, debounce patch 保存和退出 flush

src/lib/
  纯工具: format.ts (格式化与涨跌色), error.ts, is.ts, keys.ts, yesNo.ts, quoteTable.ts (行情表列定义与行渲染),
  version.ts (应用版本, 取自 package.json; CLI `-v` 与 settings.json 的 `appVersion` 共用)

tests/
  一个源文件一个测试文件, 文件名取自源文件 (小驼峰; 命令的 lib.ts 用 <feature>Lib.test.ts,
  `commands/Settings` 用 settingsCommand.test.tsx 以区别于 settings 目录);
  tests/helpers/ 放共享的渲染, 帧断言和夹具, 不参与用例收集
```

依赖方向保持为:

```text
commands/components -> hooks/stores -> settings/file -> settings/schema -> lib
components -> navigation (DialogMenu 读 `MENU_ITEMS`; navigation 不反向 import commands)
main -> cli/run + navigation/registry + settings/persistence -> stores -> settings/file
cli/run -> cli/meow
navigation -> i18n (只依赖 i18n 类型, 不 import commands; 引用 registry 的 store/component 因此不会与 app.tsx 成环)
lib, settings/{schema,file,lock,persistence}, api, cli, stores, hooks/useTranslation, main -> i18n
```

`src/i18n/**` 是叶子层, 只依赖 `node:process`, 不导入项目内任何模块, 因此上游任一模块 import i18n
都是向下的. i18n 不得导入 `src/lib`, `src/settings` 或 `src/stores`; 反过来 `src/lib` 与
`src/settings` 也不得为了拿文案类型而反过来定义领域类型 (见 `BorderStyle` 的做法).

中性组件不得导入具体 command. React 生命周期, `useInput`, Ink ref 和布局测量不得进入 store, `src/lib` 或 `src/settings`.

## CLI 启动和退出

`src/cli/run.ts` 负责启动流程与顶层错误处理:

1. `await` `src/cli/meow.ts` 的 `parseCli()`, 取出 command, showHelp, showVersion, helpMessage 和 settingsDocument;
   showVersion 时打印 `APP_VERSION`, showHelp 时打印 helpMessage, 两者都跳过应用启动 (版本优先, 保持 meow 原本的先后).
   parseCli 内部先用 `tryLoadSettings()` (对 `loadExistingSettings()` 的包装, 只读不创建) 读取已有配置,
   紧接着 `applyLanguage`, 再调用 `genHelpMessage()` 生成文案, 因此 help 与界面同语言.
   读取失败 (缺失或损坏) 时该包装交出 undefined 文档, 语言回退系统语言. 版本过新是同一处理之外多加的一步:
   文档照样被拒绝 (读不懂的字段不能让它写掉), 但文件里的 `language` 只决定那句 "请升级" 用哪种文字说,
   因此它挂在 `SchemaVersionTooNewError.language` 上, 由该包装取来当语言用 (见 settings.json 一节).
   这个包装必须留在 meow.ts 且自身不抛, 且 `applyLanguage` 必须紧跟其后: 此后任何一步抛错都由顶层的 catch
   报成 "运行失败", 文案要按用户配置的语言渲染; 读取失败的报错留给后面的 `initializeSettings` 统一给出用户提示,
   因此报错只出现一次.
   help 文案必须在 `meow()` 之前生成: 未知命令时 meow 会自己打印它, 不能延后到 showHelp 分支.
   meow 的 `autoHelp` 与 `autoVersion` 都关掉: 版本由 run.ts 打印而不是 meow, 因为 meow 按 cwd 找
   package.json, 在别人的项目目录里会打印那个项目的版本. 两个标志都要同时查 `cli.flags` 与 `cli.input`:
   命令名之后的标志 meow 留在 input 里而不设成 flag (如 `settings -h`, `settings -v`).
2. parseCli 与 startApp 的异常都在这里变成 `app.runFailed` 文案与 `process.exitCode = 1`:
   抛到模块顶层会变成顶层 await 的未处理拒绝, 用户只看得到原始堆栈.
3. 打印 help/version 前给 `process.stdout` 装 EPIPE 监听: 下游 `-h | head` 关闭管道时 Node 会在 stdout 上
   异步抛出未处理的 'error' 事件并打印堆栈, 这既不是运行失败, 也接不到 try/catch.

`src/main.tsx` 只保留入口接线, 并把 Ink 启动作为 `startApp` 注入给 `run()` (注入是为了让启动流程
可测, Ink render 与持久化属于入口):

1. 把 `settingsDocument` 传给 `startSettingsPersistence()`, 复用 parseCli 已读到的文档,
   使启动全程只读一次 settings.json. 复用判断写在 persistence 里
   (`preloadedDocument ?? (await initializeSettings())`), `initializeSettings()` 保持无参:
   "初始化" 不该带一个 "也许别初始化" 的开关. 文件缺失或损坏时该值是 undefined,
   由 initializeSettings 走正常的读取/创建流程并给出报错.
2. 在 `render()` 前写入 router 初始 command.
3. 使用 alternate terminal buffer 启动 Ink.
4. 等待 `instance.waitUntilExit()`.
5. 在 finally 中调用 `settingsPersistence.stop()`.

标准启动:

```ts
const settingsPersistence = await startSettingsPersistence(onError, settingsDocument)
useCommandStore.setState({ command: toCommand(cli.command) })
const instance = render(<App />, { alternateScreen: true, concurrent: true })
await instance.waitUntilExit()
await settingsPersistence.stop()
```

初始化 settings 必须发生在 render 之前. 首屏, 首次轮询和首次 API 请求必须读取已经 hydrate 的配置.

退出使用 Ink `useApp().exit()`. 不调用 `process.exit()`. 异步持久化失败通过 `process.exitCode` 表示, 并保证 alternate terminal buffer 正常清理.

## 命令注册和路由

`src/navigation/registry.ts` 是命令元数据的唯一来源. 每项包含:

- `title`
- `description`

两项都由 meow 的 CLI help 用 `t()` 解析, `title` 另外被 DialogMenu 当作菜单 label (两者都从
`COMMAND_REGISTRY_ENTRIES` 派生). 界面上的标题和 hint 不走注册表: 各命令组件自己
`t('command.xxx.title')` / `t('command.xxx.hint')` (见下面"命令自持文案"), 因此注册表里的 `title`
不是给命令组件读的; 同一句文案在两边各写一次 `MessageKey` 是刻意的.

注册表**不持有命令组件**: 组件映射是 `src/app.tsx` 里的 `COMMAND_COMPONENTS`, 类型为
`Record<Command, ComponentType>`. 命令组件不接 props, navigation 也不向它传值, 因此没有
`CommandComponentProps` 这类"已翻译字符串"入参类型: 注册表对外交出的只有 `MessageKey`, 由消费方自己
`t()`. 这样 navigation 不 import commands, `useCommandStore` 与 `cli/meow` 引用 registry 时
不会与 app.tsx 形成环 (改成值导入也不会).
组件映射是唯一的第二份清单, 但它由 `Record<Command, ...>` 强制穷尽: 新增命令时漏配组件,
或多写了注册表里没有的键, 都编译不过; 因此没有为组件补齐再写一条运行时用例.

`Command`, `COMMAND_LIST`, `isCommand()` 和 `toCommand()` 均从注册表派生. 新增命令要动三处:
注册表 (Command 联合类型 + `title` / `description` 两个 MessageKey), app.tsx 的 `COMMAND_COMPONENTS`,
以及命令自己 `index.tsx` 里的 title / hint 键; 其余全部派生, CLI help, 菜单, 路由都不维护第二份映射.
新命令的文案键要在三份 catalog 补齐.

当前命令:

- `stock-list`
- `stock-add`
- `stock-remove`
- `settings`

无 command 或非法 command 进入 `stock-list`. 该默认值只写在注册表的 `DEFAULT_COMMAND`
(`satisfies Command`, 保留字面量类型), `toCommand()` 的兜底与 `useCommandStore` 的初始 command 都取它;
`COMMAND_LIST` 是 `readonly Command[]`, 直接传给 `meow()` 的 `commands`, 不做防御性拷贝.

命令自持文案: 标题与 hint 都由命令自己解析, App 只按 `useCommandStore.command` 选出组件并渲染,
不往命令里传已翻译的字符串:

```tsx
<Card
  borderTopLeft={<Text color={theme.primary}>{t('command.stockList.title')}</Text>}
  footer={<StatusBar showClock hint={t('command.stockList.hint')} bright={!overlayOpen.open} />}
>
```

因此 commands 与 navigation 之间没有 import 边, 命令的文案 (含 hint 里列的按键与监听是否一致) 就地可读.
代价是同一句文案在注册表与组件里各有一份 `MessageKey`: 键名写错由 `MessageKey` 类型拦住, 张冠李戴
(例如 StockAdd 用了 stockList 的键) 由各命令自己的测试文件 (`tests/stockList.test.tsx`,
`tests/stockAdd.test.tsx`, `tests/stockRemove.test.tsx`, `tests/settingsCommand.test.tsx`)
逐命令断言标题与 hint 整串兜住.

## Command, hook 和 store 分层

Command 的 `index.tsx` 负责渲染. 命令状态, 输入和副作用放入 `hooks/useFeature.ts`.

按终端尺寸派生的纯渲染参数 (如网格列数) 例外: 这类值就地写在 `index.tsx` 里, 不为了"分层"绕进 hook,
因为它只影响这一次渲染, 既不是业务状态, 也不需要被 hook 或 store 持有. StockRemove 直接用
`useWindowSize()` 取终端列数, 算出 `columnCount` 与 `columnGap` 交给 CheckboxGrid.
`useStockList` 的 `useWindowSize()` 则留在 hook 里, 因为它要和选中行, 滚动位置一起算列宽.
两处都允许, 判断依据是这个值要不要和业务状态一起参与计算.

标准模式:

```text
index.tsx
  调用 useFeature()
  终端尺寸派生的渲染参数 (useWindowSize)
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

命令可以把展示部分抽成 `src/commands/<Feature>/components/` 下的组件: 它只接 props 和窄 selector 订阅,
不持有业务状态, 也不接 `useInput` (目前只有 StockList 的 StockTable).

Add, Remove, StockList 和 StockDetail 的复杂 store 使用 `createXxxStore(dependencies)`. 网络, 文件和时间通过 dependencies 注入, 不使用 DI 容器. `useSettingsStore` 是纯内存投影, 不注入依赖.
注入字段直接写 `typeof` 指向真实函数 (`fetchQuotes: typeof fetchQuotes`), 不手抄函数签名: 抄一遍既会与实现漂移, 各处抄法也难保一致 (如 `fetchQuotes` 曾在一处带 `signal?` 一处不带). 只有没有对应真实函数的字段 (`now`) 才手写签名, 并在注释里说明原因.

看板的选中行, 滚动位置和排序模式是视图状态, 放在 `useStockList` 的 `useState` 里而不是 store: 它们的含义是
"显示顺序里的下标", 而显示顺序由排序决定, store 只持按自选股文件顺序排列的行情行, 拿不到它. 一旦把这类下标
放进 store, 方向键就会按文件顺序跳, 而画面上完全看不出来 (行序是 hook 派生的, 看着仍然正确). 同理, 刷新后的
视口锚定也在 hook 里做 (`refreshQuotes` 只管数据), 因为它需要"上一次的显示顺序", 而那个顺序只有 hook 有.
`useStockListStore` 因此只有 `step`, `refreshQuotes` 和 `reset`.

删除流程: StockRemove 常驻渲染 CheckboxGrid (空格勾选, 回车提交, 列数随终端宽度变化), 提交的条目交给 DialogRemoveConfirm 确认删除; 看板按 `d` 打开的是同一个弹窗 (只放一条 entry, 见看板一节). 全部删除成功后直接关闭并重置勾选, 光标停在删除前的位置 (同一个下标, 超出新的条目数时落到末格; 看板那边是刷新一次), 部分条目已不在自选股时进入 done 提示已删除数量, 取消时仅关闭弹窗并保留勾选 (光标也不动), 可重新打开确认.

收尾动作由打开者登记, 两个 store 不互相 import: `open(entries, onRemoved)` 把回调存进 store, `confirmDelete()`
自己收尾并**只在确实删掉条目后**调用它 (每次打开都覆盖该回调, 回 idle/done/error 时清空); 删除页登记的网格 store 的
`removeByCodes` (删掉的那几条离开网格并重挂载), 看板登记的是"立刻刷新一次". 弹窗的 hook 因此不认识任何 command 的
store, 只留 `StockRemoveEntry` 这个类型导入 (entry 的词汇仍归删除域的 store).
"没删掉任何条目" (失败, 或所选已不在自选股: `stocksRemove()` 返回 0) 都在调用点之前收尾并 return, 网格条目与
勾选因此都保留, esc 关闭后可以直接重试; 也避免按 y 后无条件同步把"其实没删掉"的条目从网格里抹掉.

网格条目是 `{code, name}` (`StockRemoveEntry`) 而不是 `StockEntry`: 名称来自实时行情, 因此 store 的 `loadEntries`
先按文件里的代码铺出网格 (勾选不必等行情), 行情到了再补上名称. 拉名称失败**暴露错误并清空网格**: 不静默降级成
只有代码的网格, 否则用户是在闭着眼睛删. 行情到达后名称仍为空, 只发生在行情没返回该代码时 (停牌, 退市或响应不全),
此时单元格只显示代码, 确认弹窗也只列代码 (弹窗拿到的就是网格条目本身).
`loadEntries` 带加载代数: 离开删除页再进来会重开一轮, 上一轮 (文件读取与行情各自可能卡在超时边缘) 的结果一律不落地,
既不覆盖新一轮的名称, 也不在失败时清空新一轮的网格 (见 `useStockAddStore` 的 `generation`).

Settings 的规则:

- `src/commands/Settings/index.tsx` 只负责分组渲染.
- `src/commands/Settings/hooks/useSettings.ts` 负责选中项, 键盘输入, option 循环, duration 格式化和行视图模型.
- UI 只更新 `useSettingsStore`, 不在 command 中直接写文件. 写盘分两条路径: 增量设置变更由 `settingsPersistence` 订阅合并为 patch 保存; 整档操作 (自选股增删改) 由 store 动作调用 `settings/file.ts` 的锁内函数. 全量重置是组合命令 `settings/resetAll.ts` 的 `resetAll()`: 先重置文件, 文件失败则抛出且内存不变; 成功后再恢复设置内存默认值并重新载入自选股.

React 组件和组件 hook 优先使用窄 selector (action 引用稳定, 订阅不会造成多余渲染). 非组件代码 (store 动作, 工具函数) 读写其他 store 时尽量用 `useXxxStore.getState()`, 不通过 selector 订阅. 不在多个 store 中保存同一配置字段.

## 全局输入和 overlay

共享 overlay 包含菜单, 股票详情, 删除确认和通用确认弹窗 (DialogConfirm).

- App 的 `useInput` 常驻注册, 在回调里用 `overlayOpen.open` 早返回, 因此只在无浮层时处理 esc(打开菜单) 和 q(退出).
  不使用 `isActive`: 尺寸不足时 WindowSizeGuard 会卸载整棵子树, 浮层 (持有此时唯一活跃的 useInput) 随之消失,
  一个活跃的 useInput 都不剩时 ink 会 `setRawMode(false)` 并 unref stdin, 事件循环空转触发 beforeExit,
  应用会在用户拖动终端尺寸时退出. App 是唯一在整个进程生命周期内都挂载的组件, 由它持有这条不变量.
- 浮层打开后 esc 由各浮层自己处理: 详情和菜单 esc 直接关闭; DialogRemoveConfirm 在 done/error 阶段 esc 关闭, 删除进行中忽略; DialogConfirm 仅在错误态 esc 关闭.
- 浮层按键以各自 hint 为准: hint 展示什么按键, 监听就只处理什么按键.
- 方向键都有 vim 等价键 `h`/`j`/`k`/`l`, 判定统一走 `src/lib/keys.ts` 的 `keyDirection(input, key)`, 各处不再手写 `key.upArrow || input === 'k'`. hint 与监听并列展示 (`选择(↑/↓/j/k/gg/G)`, 网格 `移动(↑/↓/←/→/hjkl)`); 该界面不响应的方向不要写进 hint (例如看板只接受上下, hint 就不含 `h`/`l`).
- 底层 command 的 `useInput` 使用 `{ isActive: !overlayOpen.open }`.
- 共享输入组件的 `isActive` 由 command 传入 `!overlayOpen.open`, 组件不自己读浮层状态: `CheckboxGrid` 必填, `TextInput` 可选并默认为 true.
- DialogMenu 自己处理上下键, Enter 和数字快捷键. 菜单的开关就是 `useDialogMenuStore` 的 `highlightedType` (`MenuItem['type'] | undefined`), 没有第二个布尔: `open(highlightedType)` 打开并定位高亮, `close()` 置回 `undefined`, `useOverlayOpen` 据此判定 `dialogMenuOpen`. 因此 store 既不持有"是否打开", 也不持有第二份默认命令: 打开时的高亮由 App 的 esc 传入当前 command (`open(command)`). `useDialogMenu` 在 `highlightedType` 为 `undefined` 时早返回 (DialogMenu 只在非 `undefined` 时挂载, 该分支是防御), 之后收窄为 `MenuItem['type']`, 而 `MENU_ITEMS` 覆盖该类型的全部取值 (注册表 + reset/exit), `findIndex` 必命中, 不存在负索引或"无高亮"分支. 被 DialogConfirm 遮住时菜单保持挂载且高亮不变.
- DialogStockDetail 仅在详情打开时处理周期数字键. 菜单与详情互斥 (浮层打开时底层输入一律失活), 无需判断菜单状态.
- DialogRemoveConfirm 只在 confirm 阶段接受 n/y, done/error 阶段只接受 esc. Step 机为 idle/confirm/removing/done/error: 全部删除成功直接关闭, 部分条目已不在自选股时进入 done 提示已删除数量, 删除失败进入 error (删除页据此保留网格勾选, 看板只等下一次轮询), esc 关闭后可直接重试. 打开者可以是删除页, 也可以是看板的 `d` 键.
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

`useOverlayOpen()` 是唯一的浮层状态聚合点, 返回 `overlayOpen`. App 读取全部字段决定浮层渲染, 其余组件只取 `overlayOpen.open`. 不新增重复的 overlay Context.

## Settings 和主题

`useSettingsStore` 保存以下值:

```ts
type Settings = {
  themePreset: ThemePreset
  trendColorMode: TrendColorMode
  borderStyle: BorderStyle
  language: Language
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
trendColorMode              red-up
borderStyle                 round
language                    auto
requestTimeoutMs            8000
minimumRequestDurationMs    0
quotePollIntervalMs         5000
minuteChartPollIntervalMs   30000
klinePollIntervalMs         300000
```

主题只定义色值, 显示名称在 catalog 的 `settings.themePreset.*`; `borderStyle` 的显示名称同样在
catalog 的 `settings.borderStyle.*` (`round` -> `圆角` / `Round`), 设置行不直接显示样式 id.

`BorderStyle` 定义在 `settings/schema.ts` 而不是从 i18n 键反推, 方向是 schema -> 文案:
`useSettings.ts` 的 `BORDER_STYLE_KEYS: Record<BorderStyle, MessageKey>` 负责一一对应,
新增边框样式时该 Record 会编译报错, 从而强制补上三份 catalog 的 `settings.borderStyle.*`.
`settings/schema.ts` 只从 i18n 取 `DEFAULT_LANGUAGE` / `LANGUAGES` / `Language`, 不 import i18n 的类型别名.

主题 preset:

- `classic`
- `ocean`
- `forest`
- `sunset`
- `gray`

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

- Card 使用全局 `borderStyle` 和 `primary` border; 内容区默认透明, 传入 `mask` 时用 SpaceMask 铺满 content 区块, 盖住其后的底层内容.
- Text 在未显式传 color 时使用主题 foreground.
- StatusBar bright 状态使用主题 accent.
- Menu 选中项使用主题 highlight.
- 命令标题使用主题 primary.
- 涨跌色, error, warning 和 success 属于语义色, 显式 color 优先于主题默认色.

Settings 键盘:

```text
Up/Down/k/j       选择配置项
Left/Right/h/l    减少或增加
Enter             增加或切换 option
d                 恢复默认值
```

`SETTING_ITEMS` 用 `group` 字段区分外观组和请求组, 不再用 `rows.slice(0, 3)` 切分.
`SettingItem.type` 必须是每个成员各一个字面量, 否则 TS 无法按它收窄 `setting` 字段.

所有数值更新必须经过 `normalizeSettings()`. 始终保证 `minimumRequestDurationMs <= requestTimeoutMs`.

## 国际化

语言集合是 `auto | zh-hans | zh-hant | en`, 默认 `auto`, 解析兜底为 zh-hans.
`auto` 按 `LC_ALL` > `LC_MESSAGES` > `LANG` 读取系统语言, 再回退到 Node `Intl`, 最后回退 zh-hans.
环境变量明确指定了不支持的语言 (如 `ja_JP`) 时按默认中文处理, 不再回退到 Intl.

- `src/i18n/types.ts` — 全部 i18n 类型的唯一来源, 也是**键的规范来源**.
  `Message` 逐键声明每个文案键 (值为 `string` 或 `MessageValue`); `MessageKey = keyof Message`;
  另有 `MessageValue` / `MessageParams` / `Translate` / `Locale` / `Language`.
- `src/i18n/locale.ts` — `LOCALES` / `LANGUAGES` / `DEFAULT_LOCALE` / `DEFAULT_LANGUAGE` /
  `LOCALE_NATIVE_NAMES` 与 `detectLocale()` / `resolveLanguage()`. 类型从 `types.ts` 导入.
  检测每次实时计算, 便于测试替换环境变量.
- `src/i18n/core.ts` — `t(key, params)` / `createTranslator(locale)` / `applyLanguage(language)`.
  模块级 `activeLocale` 初值是常量 `zh-hans` 而不是检测结果: 保证默认中文, 且测试不受运行环境语言影响.
- `src/i18n/catalog/{zh-hans,zh-hant,en}.ts` — 三份文案表, 都是 `as const satisfies Message`.
  键在 `types.ts` 声明, 三份 catalog 都必须完整实现: `Message` 没有索引签名, 因此缺键和多余键
  都会被 `satisfies` 编译拦截. `catalog/index.ts` 只把三份合成 `CATALOGS`.
- `src/hooks/useTranslation.ts` — 组件唯一入口, 返回 `{ locale, t }`, 写法与 `useTheme` 同构.
  只依赖 `language` 变化重算, 因此系统语言检测不会进入渲染热路径.

文案键是扁平点号命名 (`settings.row.language.label`), 按区域分组:
`app` / `cli` / `command` / `menu` / `dialog*` / `stock*` / `chart.period` / `table` / `settings` / `api` / `common`.

插值与复数:

- `{name}` 占位符用 `MessageParams` 替换, 缺参时保留 `{name}` 原文便于发现遗漏.
- 值为 `{ one, other }` 对象时按 `params.count` 选形态 (`count === 1` 取 `one`, 否则 `other`);
  未传 `count` 时确定性地取 `other`.
- **复数键的计数占位符必须命名为 `{count}`**, 即与形态选择的依据同名. 不要另起别名
  (如 `{added}` / `{removed}`) 再额外传一个重复的 `count`: 那样漏传 `count` 编译期无感,
  运行时静默落到 `other`, 输出 `Removed 1 stocks`. 现在漏传 `count` 会把 `{count}` 原文显示出来,
  错误是显性的. `tests/catalog.test.ts` 有用例机械校验每个复数键的两种形态都含 `{count}`.
- 需要单复数时在 `types.ts` 把该键声明为 `MessageValue`, 只有英文写 `{ one, other }`;
  中文和繁体没有单复数变化, 保持普通字符串. 目前只有 6 个计数键用 `MessageValue`.

`useSettingsStore.language` 是唯一的 settings 状态, active locale 是由 `resolveLanguage()` 派生的
只读渲染缓存, 从不持久化, 也不是 settings 输入. **生产只在两处写入**: `src/settings/persistence.ts`
的 hydrate 之后与 language 变化的订阅里, 以及 `src/cli/meow.ts` 的 `parseCli()`.
`parseCli()` 用 `tryLoadSettings()` 读取已有配置 (不创建文件, 损坏时按无配置处理并回退系统语言;
版本过新时文档同样不采用, 但取文件里的 `language` 渲染那句升级提示),
并把读到的文档回传给 `startSettingsPersistence()` 复用, 因此启动全程只读一次 settings.json.
`setActiveLocale()` 只给测试固定语言用, 不是第二个生产写入口.

数值单位是数据不是文案, 因此定义在 `src/lib/format.ts` 的 `VOLUME_UNITS` / `TURNOVER_UNITS` /
`MARKET_CAP_UNITS` 里, 用 `{ min, scale, decimals, suffix }` 描述档位, 因为 亿/万/手 与 B/M/K/lots
之间是换算而非单纯改后缀. `formatVolume` / `formatTurnover` / `formatMarketCap` 末尾带
`locale: Locale = DEFAULT_LOCALE` 参数.
每档的 `min` 必须与 `scale` 对应 (`min * scale` 落在 1 附近), 否则该档在自己的下界就渲染成两位数,
等于跳过一个数量级 (曾出现过 `min: 10_000` 配 `scale: 1/1000` 的 `K lots` 档, 使 1000-9999 手
不走 K 档而显示 `9999 lots`).

`formatWithUnits` 选中档位后还会向上检查一次: 档位边界上四舍五入会进位 (999950 手若用 K 档会渲染成
`1000.0K lots`), 因此渲染值达到上一档起点时改用上一档, 输出 `1.0M lots`; 起点按本档小数位取整后再比较,
避免 scale 的浮点误差把边界推高一格. 这是格式化层的规则, 不要靠加宽列宽来兜底.
最高档 (`units[0]`) 上方没有档位可进, 因此跳过该检查: 中文的 万手/万元/亿 就是最高档,
所以 `100000.0万手` 这类超大值会自然变宽, 由列宽守卫用例的取值上限约束.

行情表列宽按 locale 分开 (`ColumnSpec.widths`): 既要容纳英文表头 (比中文表头宽), 也要容纳本地化单位
格式化后的数值 (`611.0K lots` 比 `61.1万手` 宽). `stockListColumns(locale)` 与
`stockDetailColumns(locale)` 内部用 `createTranslator(locale)` 而不是全局 `t`, 否则传参 locale 不生效;
解析结果按 locale 缓存在模块级 Map 里, 因此看板每次 resize 和轮询渲染都不会重建列, 返回的数组引用稳定.
**缓存的列定义是共享的, 调用方不得就地修改** (`scaleColumns` 需要改宽度时会复制).

`WindowSizeGuard` 的 `MIN_TERMINAL_COLUMNS` 取**全部 locale** 看板列宽的最大值 + `TABLE_CHROME`,
不按当前 locale 推导. 原因是宽度守卫包住了全部命令, 设置命令也在里面: 若下限随语言变化,
在恰好满足中文下限 (116 列) 的终端上切到英文 (需要 119 列) 会被守卫拦住, 语言就再也改不回来,
只能手动编辑 settings.json. 代价是中文用户也需要 119 列, 换取"任一语言都不会把自己锁在外面".
新增或加宽某个 locale 的列时会自然抬高全局下限, `tests/windowSizeGuard.test.ts` 有用例校验覆盖关系.

新增文案时: 先在 `types.ts` 的 `Message` 里加键, 再三份 catalog 同步补齐 (类型强制),
并保证各语言的占位符集合与之一致. 组件与常量表存 `MessageKey`, 在渲染处用 `t()` 解析.
catalog 禁止全角标点, 顿号, U+3000 和 emoji, 由 `tests/catalog.test.ts` 的标点守卫用例机械校验.

## settings.json 持久化

唯一配置文件:

```text
$XDG_CONFIG_HOME/leek-box-cli/settings.json
```

未设置 `XDG_CONFIG_HOME` 时, Linux 和 macOS 使用:

```text
~/.config/leek-box-cli/settings.json
```

Windows 使用 `%APPDATA%` (Roaming):

```text
%APPDATA%\leek-box-cli\settings.json
```

`configDirectory()` 优先级: 非空 `XDG_CONFIG_HOME` > Windows 的 `%APPDATA%` > `~/.config`. 空字符串的 `XDG_CONFIG_HOME` 按未设置处理.

当前格式带版本字段 (没有 legacy migration):

- `schemaVersion` 是**文档格式版本** (`CURRENT_SCHEMA_VERSION`, 当前为 2), 只在文档结构发生破坏性变更时加一:
  新增可选字段不加, 因为旧程序按默认值接受, 新程序读旧文件也不需要迁移. 加一的例子: v2 把 stocks 条目的
  `name` 移除 (名称只来自实时行情), v1 文件仍按当前规则解析, 下次写盘即去掉该字段.
- `appVersion` 是写入这份文档的**应用版本** (`src/lib/version.ts` 取自 package.json), 只用于排查, 不参与兼容判断;
  读取时缺失或非法都回落到当前应用版本, 不报错 (这个字段不该因为手写出一个怪值就拦住启动). 只判空串, 不 trim.
- 写盘一律盖版本: `writeSettingsFile()` 先把文档校验一遍再盖 `schemaVersion` 与 `appVersion`, 两步都必要 ——
  校验拦下读不懂的文档 (版本过新的文档不该被降级重写), 盖章让这两个字段描述的是**写入它的程序**,
  不是文件自身的历史结构; 读改写路径 (`stocksAdd()` 等) 不沿用旧值.

```json
{
  "schemaVersion": 2,
  "appVersion": "<app version>",
  "language": "auto",
  "theme": {
    "preset": "classic",
    "trendColorMode": "red-up",
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
      "addedAt": "2026-08-20T00:00:00.000Z"
    }
  ]
}
```

示例里的 `"appVersion": "<app version>"` 是占位: 实际写入的是当时运行的程序版本 (构建产物里内联自 package.json).

规则:

- 文件不存在时使用默认 settings 和预置默认自选股 (DEFAULT_STOCK_CODES: sz002156, sh600584, sh688825) 创建, addedAt 为创建时间.
- 文件存在时严格校验 language, theme, request 和 stocks; `theme.trendColorMode` 缺失时按默认 red-up 接受,
  `language` 缺失时按默认 auto 接受. 这是 schema 的可选字段默认值规则, 不是 legacy 格式迁移, 首次成功写入即持久化.
- 读取时先去除 UTF-8 BOM (`stripBom`), 兼容 Windows 记事本或 PowerShell 重定向写入的配置.
- 版本字段缺失时按当前版本接受 (旧文件里没有这两个字段), 下次写盘自动补上.
- `schemaVersion` 高于 `CURRENT_SCHEMA_VERSION` 时**拒绝读取**: 这份文件由更新的程序写入, 当前程序读不懂它.
  不做尽力解析的原因是 `parseSettingsDocument` 按白名单重建, 读不懂的字段会被静默写掉, 那是丢数据.
  错误文案会提示升级并带上文件路径, 用户升级前无法启动 (降级运行时的预期行为). 降级保护从带这条判断的版本开始生效:
  更早的版本不认识 `schemaVersion`, 只会按旧规则重写 (该字段是本次引入的).
- 这类错误用 `SchemaVersionTooNewError` 抛出, `loadExistingSettings()` 对它原样放行 (文件没坏, 不该报成
  "设置文件损坏"). 它因此不套 corruptFile 包装, 文案里的路径由 `parseSettingsDocument(value, path)` 的 path 参数给出
  (path 只用于报错文案, 与 `parseInteger(value, name, limits)` 的 name 同类). `schemaVersion` 非法 (非正整数) 同样报错.
- 该错误另外带上文件里的 `language` (缺失或非法时为 undefined): 文档整体被拒绝, 但 "请升级" 是用户唯一
  必须读懂的一句话, 不该因为它配置的语言读不到而失效; `parseCli` 只在这条错误上额外看这个字段.
- 版本字段只做判断, 不做迁移: 低版本文件按当前规则解析, 字段缺失走默认值, 没有 migration 层.
- 损坏文件直接报错, 不静默丢弃字段, 不 fallback 到旧格式.
- `StockEntry` 为 `{code, addedAt}`. 名称**不是持久化数据**: 除息等情况下行情里的名称会变, 存下来的那份会过期,
  因此它只来自实时行情 (看板行用 quote.name, 详情弹窗标题同源).
- `parseStocks()` 校验 code, addedAt 和重复 code; 旧文档里的 name 按白名单重建丢弃, 不做迁移.
- `patchSettings()` 只合并变化的 settings 字段, 保留锁内读取到的最新 stocks.
- `stocksAdd()`, `stocksRemove()` 在锁内读取最新文档后修改.
- `replaceStocks()` 表示明确的整表替换, 当前仅用于 mock reset.
- `resetSettingsFile()` 重置为默认文档, 损坏文件也能修复; 应用内由 `settings/resetAll.ts` 的 `resetAll()` 触发 (重置文件 → 设置内存默认值 → 自选股重新载入).
  它在锁内先读一次只为判断版本: 读得出来就照常覆盖, 读不出来 (损坏或缺失) 直接修. 版本过新的文件是唯一例外,
  它也拒绝覆盖 (重设不是它的逃生门, 用户只能升级或手动处理该文件), 否则丢的正是 `writeSettingsFile` 要保住的那些字段.

写入流程:

1. 获取 `settings.json.lock`.
2. 在锁内重新读取并校验最新 settings.json.
3. 只修改当前操作负责的字段.
4. 写入同目录唯一临时文件.
5. rename 原子替换 settings.json.
6. 校验 lock token 后释放.

Lock 元数据包含 token, pid 和 createdAt. 元数据先写入临时文件, 再通过 hard link 原子发布, 不暴露空 lock 文件. Lock 使用 PID 和 30 秒 lease 判断 stale. 普通等待每 25ms 重试, 2 秒后给出可读错误.

元数据读不懂的锁按残留处理 (本程序的锁不会出现半写的元数据): mtime 超过 2 秒立即清理, 否则等到本次调用用掉一半等待预算时清理. 后一半是必须的: 文件时间戳与调用方 `Date.now()` 之间的偏移随机器而异 (CI 上就见过 mtime 比循环起点新约 20ms), 只看 mtime 时偏移为正会让清理永远晚于 busy 报错, 调用方每次都失败且锁一直留着. `LOCK_UNREADABLE_GRACE_MS` 由 `LOCK_TIMEOUT_MS` 折半派生, 两者不要再合并成一个常量.

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

详情 `restartKey` 必须包含打开的 code 和 `period` (store 只持有 `code`, 名称随行情走). 切股票或周期时旧请求必须 abort, store 还要检查当前 code/period, 防止陈旧结果落地.

## 请求 timeout 和 minimum duration

`src/api/index.ts` 的全部行情请求使用统一 timing wrapper.

- 每次请求开始时读取最新 `requestTimeoutMs` 和 `minimumRequestDurationMs`.
- 调用者 signal 与 `AbortSignal.timeout()` 使用 `AbortSignal.any()` 合并.
- minimum duration 只作用于成功请求, 失败和 HTTP error 立即返回.
- minimum duration 补时支持调用者 signal 中止.
- 配置变化只影响新请求, 不修改已经启动的请求.

API 函数:

- `fetchQuotes()`
- `fetchQuoteNames()` — 行情里只要 code 与 name 时的投影 (删除网格的名称), 内部复用 `fetchQuotes`,
  因此 timing wrapper 只套一层, 空 codes 的短路也由 `fetchQuotes` 负责 (这一层不再重复判断)
- `fetchIntraday()`
- `fetchFiveDay()`
- `fetchHistorical()`

实时行情使用 GBK. 必须先 `response.arrayBuffer()`, 再使用 `TextDecoder('gbk')`. 不使用 `response.text()`.

## StockList 数据模型

`StockListStep.table` 使用统一 rows:

```ts
type StockListRow = { kind: 'quote'; code: string; quote: Quote } | { kind: 'missing'; code: string }
```

禁止恢复 `quotes + missing` 双数组拼接. 统一 rows 用于渲染, 选择, Enter 打开详情和可视窗口.

行的名称只在 quote 里: 缺失行 (行情没返回该代码) 没有第二个名称来源, 名称列显示 `--`, 其余列按列元数据
显示占位文案. 打开详情也只用 code, 名称由详情弹窗自己从行情行里取 (`useStockListStore` 的 quote).

选择身份使用 `selectedCode`, 不使用数组 index. 它是 `useStockList` 的状态: 刷新后保持仍存在的 code,
消失时按原来的下标回退到附近的行.

`gg` 跳到顶部, `G` 跳到底部: 选中首行或末行, 与方向键走同一个 `selectIndex`, 不另写一套落点规则.
`gg` 是两键序列, 第一键只有前缀意义 (不参与渲染, 因此是 hook 里的 ref 而不是 state), 紧跟的第二个 `g`
才跳顶部, 其余按键让序列从零开始. 浮层打开时前缀作废: 浮层期间本 hook 的 `useInput` 失活,
收尾键落在浮层自己手里, 前缀留着的话关掉菜单后的第一个 `g` 就会跳走.
ink 把同一 chunk 里的多个字符按粘贴一次性交出, 因此两次 `g` 必须分两次按键读入.

窗口只在选中行要移出窗口时才滑动: 方向键, `gg`/`G`, 排序和刷新后的锚定都走 `scrollOffsetToReveal` 这一条规则
(已经在窗口里就一点不动). 曾经给"换顺序"单独写过一条"让选中行停在窗口里的同一行"的规则, 那会让按一次 `s`
把窗口整段拖到列表另一头: 选中行在窗口里的位置是保住了, 但视口已经跳走, 用户看到的是选中行莫名其妙落在中间
(选中行本来就换了位置, 只是它没移出窗口就不该动视口).

按涨跌幅排序 (`s` 键) 是**视图**, 不是数据: `step.rows` 始终是自选股文件顺序, 排序模式 `sortMode`
(`default | desc | asc` 三态循环) 只决定显示顺序. 因此回到 `default` 不需要重读 settings.json
(把排好序的行写回 `step.rows` 就会丢掉文件顺序, 再也回不去). 显示顺序只经由 `commands/StockList/lib.ts` 的
`displayedRows(step, sortMode)` 取出, `sortedRows(rows, sortMode)` 是它的底座: 看板渲染, `moveSelection`,
`cycleSortMode` 和刷新后的视口锚定都用它, 因此只有一个来源. 缺失行没有涨跌幅可比, 一律排在末尾, 不参与升降序.
排序指示器只在排过序之后出现在 Card 右上角 (`涨跌幅 ▼` / `涨跌幅 ▲`, cyan 显示, 与刷新间隔并排);
排序是 hook 的内存状态, 不写盘, 离开看板随组件一起消失.

StockList 会逐字段比较 Quote. 数据未变化时复用旧 Quote 引用, 让 Zustand selector 的 `Object.is` 跳过无意义更新.

右上角固定有一段刷新间隔 (`{value} ms`): 它取设置里的 `quotePollIntervalMs`, 不是某次刷新的耗时, 也不随
刷新变化, 因此在 loading/empty/error 各 step 都在, 改设置后立即跟着变, 位置排在排序指示器之后, 两段之间用
`|` 分隔 (分隔符自己一个 Text, 不跟着相邻那段的颜色走). 除这两段外右上角不再显示别的角标.
不设手动刷新键: 刷新只由轮询驱动, 只有删除成功后会额外触发一次.

上边框中间 (`borderTopCenter`) 是公共组件 `components/MarketIndexTicker/`: 传入一串指数行情,
它让上证指数与深证成指轮流显示, 每 5 秒换一个, 换的时候用 1 秒打字机把新的一行从左往右写出来.
行情来自独立的 `useMarketIndexStore`: 它只请求 `MARKET_INDEX_CODES` (上证指数与深证成指),
按代码顺序落地, 缺哪条就少哪条. 它与自选股互不认识, 指数也不进表格行, 拉取失败保留上一次的行情
(指数只是角标, 不为它单开错误状态, 离开看板也不清空, 因此不像自选股那样有 loading 态).
轮询接线在看板自己的 `hooks/useStockList.ts`: 它窄 selector 订阅该 store, 除自选股那条之外另挂一条
`usePolling`, 间隔同样取设置里的 `quotePollIntervalMs` (与看板同一个值, 因此不新增第二份间隔设置),
两条请求各自独立.
名称来自实时行情, 数值用 `formatPrice` / `formatSigned` / `formatPercent`, 与界面语言无关,
因此这项功能一个文案键都不占. 组件自己不认识 store: 行情走 props (看板 `index.tsx` 把
`useStockList()` 返回的 `indices` 传给 `MarketIndexTicker`), 只有涨跌色订阅 `useSettingsStore`.
轮播与打字机状态在组件自己的 `MarketIndexTicker/hooks/useMarketIndexTicker.ts` (与 CheckboxGrid 同构),
它按帧重渲染的只有这一个组件, 并排的表格不跟着重渲染;
行与动画的纯函数 (`indexSegments` / `typewriterSegments` 与三个 `INDEX_*_MS`) 在组件自己的 `MarketIndexTicker/lib.ts`,
段类型直接复用 `lib/quoteTable.ts` 的 `Row`, 渲染复用 `QuoteRow`.
打字机按显示宽度逐字写出 (CJK 不切半个字), 并把整行补空格到最终宽度: 它常被摆在居中槽位里,
行宽随进度变化会让文字左右跳. 首帧直接整行显示第一个指数, 不播过渡 (过渡只属于"换"这个动作);
只有一条时没有可换的对象, 切换定时器不挂, 因此那一条是静止的.
行情没返回的指数不占位 (轮播按 `indices.length` 取模), 一条都没有时该组件不渲染任何东西.
角标落在边框槽位上, 与右上角的刷新间隔同级: 看板的 loading/empty/error 各 step 都在.

看板按 `d` 删除选中那一只: 用选中行拼一条 `StockRemoveEntry` (名称取行内实时行情, 缺失行没有名称, 弹窗因此只列代码)
打开共享的 DialogRemoveConfirm, 并把 `usePolling` 的 `refresh` 登记成收尾动作 —— 删除成功后立刻走一遍"刷新 + 重新锚定"
(读文件 + 拉行情, 选中股消失时按原下标回退到邻近的行, 删空则进入 empty). 一个都不算删掉时 (所选条目已不在自选股)
弹窗进 error, 收尾动作不调用, 那一行要等下一次轮询才消失. `refresh()` 在请求进行中不并发, 那种情况下同样等下一轮.

## Card, Dialog 和 Text

每个 command 自己渲染 full-terminal Card 和 StatusBar. App 只渲染当前 command, 然后按序堆叠渲染浮层: DialogMenu, DialogStockDetail, DialogRemoveConfirm, DialogConfirm (最后绘制即最上层). 浮层输入由各自的 isActive 门控; DialogConfirm 打开时其余浮层变暗 (bright=false) 且输入失活, 仅确认弹窗保持明亮, 视觉与输入上只保留一个活动弹窗, 其余浮层保留挂载与状态.

Card 负责:

- `full` 或显式 width/height
- 主题 border style 和 border color
- 左上 borderTopLeft, 右上 borderTopRight, 左下 borderBottomLeft, 右下 borderBottomRight (四角内容由 CardCorner 渲染, 绝对定位压在边框行上, 固定单行并裁剪溢出)
- 上边框中段 borderTopCenter (绝对定位压在上边框行, 水平居中, 自己裁剪溢出; 不带 CardCorner 的 `|` 装饰).
  它与四个角同在一行, 因此顺序上排在四角**之前**绘制: 万一内容过宽, 被压住的是中间而不是标题和角标
- 内容 padding 和可选 `mask` (打开时用 SpaceMask 盖住其后内容)
- footer

`full` 把 width 和 height 都写成 100%, Card 因此不再读 `useWindowSize`; 代价是必须有一个给定尺寸的祖先,
由 `WindowSizeGuard` 尺寸达标分支包出的 Box 充当 (命令的 Card 一定在守卫之内). 脱离这个祖先渲染 `full`
Card 时 `height: '100%'` 解析不到确定值, 会退回内容高度: ink 只给 root node 设宽度, 不设高度,
所以这条契约由测试显式提供一个给定尺寸的父盒来锁定.

Dialog 支持 `above`, `borderTopLeft`, `borderTopRight`, `borderBottomLeft`, `borderBottomRight`, `hint` 和 `width` (四角类型从 CardProps Pick 而来), footer 由 StatusBar 渲染 hint 和时钟. Dialog 使用 absolute full-terminal Box 居中 Card, 外层保持透明, 让底层 command 的 dim 状态可见; Card 传入 `mask` 铺满 content 区域, 盖住被压住的浮层内容.

`above` 渲染在 Card 之上并与 Card 居中同轴, 与 Card 之间的一行间距由 Dialog 的 `marginBottom` 提供,
槽位内容不自带外边距. 它是唯一不参与 Card 宽度也不在 Card `mask` 之内的浮层槽位: art 覆盖的单元格
(含字母之间的空格) 由 Ink 逐格重写, 因此自身那一带不会与底层文字串行, 但 art 左右两侧仍是底层 command
的 dim 内容, 与窄 Card 浮在看板上的观感一致. 目前只有 DialogMenu 用它与 AppLogo 搭配.

AppLogo 是应用 ASCII art (两行), 各行必须等宽, 且宽度不得超过 `MIN_TERMINAL_COLUMNS`
(否则在恰好卡着宽度下限的终端上 art 会被裁). `tests/appLogo.test.ts` 有守卫用例锁定这两条;
组件不铺 mask, 也不接受宽度参数.

弹窗宽度一律按 `Math.max(标题宽, Math.min(内容宽, CONTENT_WIDTH_CAP), hint 宽, 下限)` 计算:
外层取各部分的**最大**值, `CONTENT_WIDTH_CAP` 只用来给内容单独设上限. 内容是列表时先
`Math.max(...每项宽度)` 再套 cap, 不要把整串宽度直接丢进 `Math.min`, 那样取到的是最短项, 弹窗会偏窄
(文案换语言变长后更明显).

SpaceMask 用在 card 被 `mask` 时铺出 Card 自己 `useBoxMetrics` 量到的 clientWidth*clientHeight 个空格 (absolute + flexDirection column, 每行一个 Text), 再由 Card 的 `overflow: hidden` 裁剪到 content 区域. 取 client 尺寸而不是 width/height: 后者含边框, 铺出来比内容区各多两格, 全靠裁剪兜底; clientHeight 正是 Card 内容区的高度, 只比 mask 所在的 Box (内容区再减掉 footer) 多出 footer 那几行. 测量完成前 (`hasMeasured` 为 false, 即首帧) 不渲染, 与 ScrollBox, CheckboxGrid 用 `hasMeasured` 兜底的写法一致. Card 不再接受 `backgroundColor`, 遮蔽一律走 `mask`.

ScrollBox 用 ink 8 的 `contentOffsetY` 滚动: 视口是 `flexBasis={0} flexGrow={1} overflow="hidden"` 的 Box,
整份 list (不再切片) 放在一个 `flexShrink={0}` 的 wrapper 里, `contentOffsetY` 把它上移钳制后的偏移.
`flexBasis={0}` 不能省: 视口默认 `flexBasis: auto` 会以整段内容为基准尺寸, 内容高于视口时同一列的表头行
会被 flex 收缩挤掉; 基准为 0 时视口高度只由 flexGrow 决定, 与内容多少无关. 可视行数取 `useBoxMetrics`
的 clientHeight, 经 `onVisibleChange` 交给调用方 (看板按它算选中行要不要滚动窗口); 偏移的钳制规则与
`commands/StockList/lib.ts` 的 `visibleWindow` 相同, 两处各有一份是分层使然 (components 不 import commands),
改一处要同时改另一处.

本地 `src/components/Text.tsx` 是项目文字入口. 它负责主题默认 foreground 和 overlay dim. Ink 原生 Text 只在封装内部或测试中直接使用.

CheckboxGrid 是多选网格: 方向键移动, 空格勾选, 回车提交勾选项 (至少一个才触发). 内部处理光标滚动窗口, `isActive` 控制输入, 外部通过 key 重挂载 (resetToken 变化) 清空勾选.

重挂载会把光标带回第一格, 因此另有 `defaultCursor` (可选, 默认 0, 越界时按 `clampCursor` 钳制) 与
`onCursorChange` (光标移动时回传新下标, 初始位置不回传): 删除页用它们让删除后的光标停在原来的位置,
即同一个下标 (列表缩短后它可能指向别的条目), 越界时落到末格. 网格自身不受这两个值影响, 它们只在挂载时读一次.

列数和列间距都不写死在组件里: `columnCount` (至少为 1) 与 `columnGap` (至少为 2) 都是必填 prop,
组件不设默认值, 也不读终端尺寸, 只消费传入的值.

列数推导函数 `gridColumnCount(contentWidth, columnGap)` 与其它网格几何一起放在
`CheckboxGrid/lib.ts`: 按内容区宽度取每格仍不小于最小单元格宽度的最大列数
(最小单元格宽度 24 列, 即 `[x] 四字名称 (sh600000)` 的宽度), 最后钳制到 2..8.
它不读终端尺寸, 内容区宽度由调用方算好传入.

StockRemove 在 `index.tsx` 里用 Ink 的 `useWindowSize()` 取终端列数, 再按
`gridColumnCount(columns - TABLE_CHROME, columnGap)` 推导列数: 单元格等分 Card 内容区宽度
(`columns - TABLE_CHROME`), 这样列数取整后单元格仍放得下条目, 不需要靠加宽单元格或截断来兜底.

列数变化 (终端宽度变化) 会改变光标所在的行, 所以 hook 在渲染前用 `scrollForCursor` 再钳制一次滚动偏移,
否则光标会落在可视窗口之外, 而空格勾选的仍是光标处那一条.

## TextInput 协议

TextInput 的 props 是 `{ prompt, onSubmit, placeholder?, isActive? }`: `isActive` 默认为 true, 由 command 传入
`!overlayOpen.open` (组件不自己读浮层状态), 组件内部再叠加 `!submitted`, 因此回车后输入框不再接受按键并
收起光标. 返回入口 `ActionResult` 复用这两个字段 (`Pick<TextInputProps, 'isActive' | 'onSubmit'>`), 自己不
import command 或 store: "按 Enter 返回" 的行为由命令的 hook 提供, 例如 `useStockAdd()` 的 `handleSubmit`
(reset + 切回本命令).

TextInput 的 value 和 submitted 是组件本地状态. 业务 store 保存:

```ts
{
  error: string | undefined
  resetToken: number
}
```

resetToken 变化时清空输入并重新激活. 命令给不同步骤添加 token 前缀, 例如 `code-1` 和 `confirm-1`. 不依赖 React key 强制 remount.

TextInput 和全局快捷键没有事件冒泡停止机制. 新增自由文本编辑模式时, 必须同步设计全局 q/esc 的 keyboard ownership, 避免输入字符触发退出或菜单.

## 行情解析和显示

A 股颜色为涨红, 跌绿, 平灰 (trendColorMode 可切换为涨绿跌红). 停牌显示 `--` 和 `common.suspended`
(英文 `Suspended`), 接口缺失显示 `--` 和 `common.noData` (英文 `No data`).

`src/api/lib/parsers.ts` 是纯解析层:

- `parseQuoteText()` 解析实时行情文本.
- `parseIntradayResponse()` 解析当日分时.
- `parseFiveDayResponse()` 解析五日分钟数据.
- `parseHistoricalResponse()` 解析日, 周, 月 K 数据.

年 K 使用后复权月 K 在本地按年份聚合. Chart 数据和行情语义色不受 UI theme preset 覆盖.

## 测试和验证

测试使用 Vitest. **一个源文件一个测试文件**, 均位于 `tests/`, 文件名取自对应的源文件 (首字母小写):
`src/api/index.ts` -> `tests/api.test.ts`, `src/api/lib/parsers.ts` -> `tests/parsers.test.ts`,
`src/stores/useStockListStore.ts` -> `tests/useStockListStore.test.ts`,
`src/commands/StockList/index.tsx` -> `tests/stockList.test.tsx`.
命令目录与 settings 目录重名时命令侧带 `Command` 后缀: `tests/settingsCommand.test.tsx` 测
`commands/Settings/index.tsx`, `tests/schema.test.ts` / `tests/file.test.ts` 测 `settings/` 下的同名文件.
命令或组件的 `lib.ts` 用 `<feature>Lib.test.ts` (`tests/stockListLib.test.ts`, `tests/checkboxGridLib.test.ts`,
`tests/stockChartLib.test.ts`, `tests/marketIndexTickerLib.test.ts`), 因此同一 feature 的 lib 与组件各有一个测试文件.

`tests/helpers/` 放共享测试设施, 不参与用例收集:

- `ink.tsx` --- 渲染到固定尺寸输出 (`CaptureOutput` / `createInput` / `renderInk` / `plain`) 与四种等待:
  `waitForFrame` (after 之后任取一帧), `waitForLatestFrame` (只看最新一帧), `waitForState` (轮询状态),
  `waitForInput` (让出一拍: 同一 tick 连写的两个按键会被 ink 合并成一个输入, 两键序列必须分开写),
  以及所有渲染用例共用的收尾 `unmountApp(instance)`: `unmount()` 后 `await waitUntilExit()`,
  等 ink 把 unmount 写出的最后一帧落盘 (只调 `unmount()` 会断言到卸载前的帧).
- `app.tsx` --- App 级断言: `renderApp`, `resetStores`, `assertFrameSize`, `selectedCodeIn`, `isDimmed`,
  以及把看板, 删除网格和指数角标钉在给定数据上的 `stubBoardRows` / `stubRemoveEntries` / `stubMarketIndices`.
- `fixtures.ts` --- 行情与自选股夹具: `quote` / `quoteRow` / `missingRow` / `rowCodes` / `stockEntry` / `removeEntry`.

测试文件必须隔离 `XDG_CONFIG_HOME`, 不读写用户真实 settings.json. 全局 Zustand singleton 在渲染用例之间由
`tests/helpers/app.tsx` 的 `resetStores()` 用 `getInitialState()` 恢复; 指数 store 是例外, 它改为钉成空角标
(`stubMarketIndices()`), 因为看板一挂载就会发起第二条请求, 不钉住的话每个 App 级用例都会真的联网
(自选股那条一直由各用例的 `stubBoardRows()` / `refreshQuotes` 覆盖兜住). 需要指数数据的用例在
`resetStores()` 之后自己 `stubMarketIndices([...])` 覆盖.

断言选中行反显与浮层 dim 的用例需要 Ink 真的输出 SGR 序列, 因此 `FORCE_COLOR` 由 `vitest.config.ts`
的 `test.env` 提供: chalk 在模块求值时就定下颜色档位, 写在测试文件顶部或 helper 里都太迟
(helper 的赋值晚于它自己 import 的 ink), 用例会一个序列都收不到. 需要彩色断言的新文件不必自己设这个变量.

涉及渲染帧或文案断言的测试必须固定语言: 模块级 `activeLocale` 初值是 `zh-hans`, 但 `language` 默认值
`auto` 会跟随运行环境的系统语言, 因此 `resetStores()` (同时把 store 的 `language` 置为 `zh-hans`),
`tests/persistence.test.ts` 与 `tests/schema.test.ts` / `tests/file.test.ts` 的 `beforeEach` 都显式
`setActiveLocale(DEFAULT_LOCALE)`. 新增此类测试必须做同样的固定, 否则在 `LANG=en_US` 的机器上会失败.
需要中文或英文文案时用 `t(key)` 而不是字面量.

`tests/quoteTable.test.ts` 持有三语言列宽的守卫用例: 表头宽度, 停牌/缺失占位文案宽度, 以及单位列在
档位边界 (含四舍五入) 的渲染文本宽度都不超过列宽, 另有 `LIST_WIDTH_SUM` 锁定各 locale 的列宽之和.
改动 `ColumnSpec.widths` 或 `format.ts` 的单位档位时必须同步更新这些常量, 否则用例会失败.
`cell()` 只补齐不截断, 因此超宽文本会撑宽整行并让后续列错位, 而不是被裁掉.
`tests/windowSizeGuard.test.ts` 另有一条用例校验 `MIN_TERMINAL_COLUMNS` 覆盖全部 locale 的看板占宽,
防止再次出现"切到某种语言就被宽度守卫锁在外面".

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
- 上述三条同样适用于 catalog 内容, 由 `tests/catalog.test.ts` 的标点守卫用例机械校验.
- 不新增兼容 alias, migration 或 deprecated API, 除非任务明确要求.
- 不新增第二份路由, overlay, poll interval 或 settings 状态.
- 不新增第二份文案来源: 显示文案只放 catalog, 组件与常量表存 `MessageKey` 并在渲染处解析.
- 不直接修改 Zustand store 内部字段来绕过 action, 测试 setup 和明确初始化除外.
- store 里的类型统一带该 store 的 feature 前缀 (含只经 Step 联合类型暴露的): `useStockListStore` 有
  `StockListRow` / `StockListStep` / `StockListDependencies`, `useStockAddStore` 有 `StockAddCandidate`.
  不写 `StockRow` / `StockCandidate` 这类省掉 feature 的形式. 唯一的例外是 `StockEntry`: 它由多个 store 共用,
  定义在 settings/schema, 不属于任何一个 feature.
- 前缀动词区分 I/O: 走 HTTP 的用 `fetchX` (fetchQuotes, fetchQuoteNames), 从文件读的用 `loadX` (loadStocks, loadEntries).
- 同一种数据在各层用同一个名字: 删除网格的 `entries` 和确认弹窗的 `entries` 是同一份 `StockRemoveEntry[]`,
  不一处叫 `entries` 另一处叫 `targets`. 泛型组件自己的词汇不算别名 (CheckboxGrid 的 `items` 指任意 T).
- 表格宽度由列元数据推导, CJK 宽度使用项目本地函数.
- command 不复制 Card, StatusBar, registry 或 persistence 逻辑.
- 所有退出走 Ink, 所有持久化退出前 flush.
