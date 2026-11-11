# 架构, 目录和分层

## 目录和职责

```text
src/main.tsx                 入口接线: run(), Ink render, persistence start/stop
src/app.tsx                  无浮层时的 esc/q 输入, command 装配 (COMMAND_COMPONENTS), 浮层绘制顺序
src/i18n/                    叶子模块. types.ts 是类型与文案键的唯一来源, locale.ts 定语言常量与检测,
                             core.ts 持 activeLocale 与 t(), catalog/ 是三份文案表
src/navigation/              命令导航域, 只依赖 i18n, 不 import commands.
                             registry.ts 是唯一注册表 (派生 Command, COMMAND_LIST, CLI help, 菜单), menu.ts 是派生菜单项
src/cli/                     入口链路的模块. args.ts parseCli() 与 -h, run.ts 启动流程与顶层错误
src/commands/<Feature>/index.tsx      命令渲染
src/commands/<Feature>/hooks/         订阅, 生命周期, Ink 输入, 测量与轮询
src/commands/<Feature>/components/    该命令专用展示组件, 不跨命令复用 (目前只有 StockList)
src/commands/<Feature>/lib.ts         纯函数与常量, 不经 hook 即可单测
src/components/              公共组件与复合弹窗, 见 docs/ui.md
src/hooks/                   usePolling, useOverlayOpen, useClock, useTheme, useTranslation
src/stores/                  Zustand 状态机与业务动作; 复杂 store 导出 createXxxStore(dependencies)
src/api/index.ts             HTTP 请求, timeout, minimum duration, AbortSignal 合并, GBK 解码
src/api/lib/parsers.ts       腾讯行情响应的纯解析器
src/api/lib/tools.ts         代码归一化 (normalizeCode), 统一 timing wrapper, 年 K 聚合
src/settings/schema.ts       schema, 校验与文档转换; 外观常量与 Settings 类型也在此 (store 从 schema 导入常量),
                             校验错误文案也是 MessageKey
src/settings/file.ts         路径, 原子写入, stocks 增删改; loadExistingSettings() 只读不创建
src/settings/lock.ts         跨进程文件锁 (withFileLock)
src/settings/persistence.ts  初始化, hydration, debounce patch 保存, 退出 flush
src/lib/                     纯工具: format.ts (格式化与涨跌色), error.ts, is.ts, keys.ts, yesNo.ts,
                             quoteTable.ts (行情表列与行渲染), version.ts (应用名与版本号),
                             polyfill.ts (getOrInsertComputed 兜底, 入口与 vitest setup 最先求值)
tests/                       一个源文件一个测试文件; tests/helpers/ 放共享设施, 不参与用例收集
```

依赖方向保持为:

```text
commands/components -> hooks/stores -> settings/file -> settings/schema -> lib
components -> navigation (DialogMenu 读 MENU_ITEMS; navigation 不反向 import commands)
main -> cli/run + navigation/registry + settings/persistence -> stores -> settings/file
cli/run -> cli/args + navigation/registry (未知命令的可用命令列表)
api/lib/tools -> stores/useSettingsStore (withRequestTiming 读取最新请求配置; api 唯一的 stores 依赖)
navigation -> i18n (只依赖 i18n 类型, 不 import commands)
lib, settings/{schema,file,lock,persistence}, api, cli, stores, hooks/useTranslation, main -> i18n
```

`src/i18n/**` 是叶子层, 只依赖 `node:process`, 不导入项目内任何模块. i18n 不得导入 `src/lib`, `src/settings` 或 `src/stores`; 反过来 `src/lib` 与 `src/settings` 也不得为了拿文案类型而反过来定义领域类型 (见 `BorderStyle` 的做法).

中性组件不得导入具体 command. React 生命周期, `useInput`, Ink ref 和布局测量不得进入 store, `src/lib` 或 `src/settings`.

## 命令注册和路由

`src/navigation/registry.ts` 是命令元数据的唯一来源, 每项含 `title` 和 `description`. 两项都由 CLI help 用 `t()` 解析, `title` 另外被 DialogMenu 当作菜单 label (两者都从 `COMMAND_REGISTRY_ENTRIES` 派生).

注册表**不持有命令组件**: 组件映射是 `src/app.tsx` 里的 `COMMAND_COMPONENTS`, 类型为 `Record<Command, ComponentType>`, 由它强制穷尽 (漏配组件或多写键都编译不过). 命令组件不接 props, navigation 也不向它传值, 因此没有 `CommandComponentProps` 这类"已翻译字符串"入参类型: 注册表对外交出的只有 `MessageKey`, 由消费方自己 `t()`, navigation 因此不 import commands.

`Command`, `COMMAND_LIST`, `isCommand()` 和 `toCommand()` 均从注册表派生. 新增命令要动三处: 注册表 (Command 联合类型 + `title` / `description` 两个 MessageKey), app.tsx 的 `COMMAND_COMPONENTS`, 以及命令自己 `index.tsx` 里的 title / hint 键; 其余全部派生, CLI help, 菜单, 路由都不维护第二份映射. 新命令的文案键要在三份 catalog 补齐.

当前命令: `stock-list`, `stock-add`, `stock-remove`, `settings`.

无 command 进入 `stock-list`. 该默认值只写在注册表的 `DEFAULT_COMMAND` (`satisfies Command`), `toCommand()` 的兜底与 `useCommandStore` 的初始 command 都取它; 非法 command 由入口 (run) 报成未知命令并以退出码 2 结束. `COMMAND_LIST` 是 `readonly Command[]`, 也是 CLI 已知命令校验 (`isCommand()`) 的集合, 不做防御性拷贝.

命令自持文案: 标题与 hint 都由命令自己解析, App 只按 `useCommandStore.command` 选出组件并渲染, 不往命令里传已翻译的字符串:

```tsx
<Card
  borderTopLeft={<Text color={theme.primary}>{t('command.stockList.title')}</Text>}
  footer={<StatusBar showClock hint={t('command.stockList.hint')} bright={!overlayOpen.open} />}
>
```

注册表里的 `title` 不是给命令组件读的; 同一句文案在两边各写一次 `MessageKey` 是刻意的: 键名写错由 `MessageKey` 类型拦住, 张冠李戴 (例如 StockAdd 用了 stockList 的键) 由各命令自己的测试文件 (`tests/stockList.test.tsx`, `tests/stockAdd.test.tsx`, `tests/stockRemove.test.tsx`, `tests/settingsCommand.test.tsx`) 逐命令断言标题与 hint 整串兜住.

## Command, hook 和 store 分层

Command 的 `index.tsx` 负责渲染. 命令状态, 输入和副作用放入 `hooks/useFeature.ts`.

按终端尺寸派生的纯渲染参数 (如网格列数) 例外: 这类值就地写在 `index.tsx` 里. StockRemove 直接用 `useWindowSize()` 取终端列数, 算出 `columnCount` 与 `columnGap` 交给 CheckboxGrid; `useStockList` 的 `useWindowSize()` 则留在 hook 里, 因为它要和选中行, 滚动位置一起算列宽. 判据是这个值要不要和业务状态一起参与计算.

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

命令可以把展示部分抽成 `src/commands/<Feature>/components/` 下的组件: 它只接 props 和窄 selector 订阅, 不持有业务状态, 也不接 `useInput` (目前只有 StockList 的 StockTable).

Add, Remove, StockList 和 StockDetail 的复杂 store 使用 `createXxxStore(dependencies)`. 网络, 文件和时间通过 dependencies 注入, 不使用 DI 容器. `useSettingsStore` 是纯内存投影, 不注入依赖. 注入字段直接写 `typeof` 指向真实函数 (`fetchQuotes: typeof fetchQuotes`), 不手抄函数签名; 只有没有对应真实函数的字段 (`now`) 才手写签名, 并在注释里说明原因.

看板的选中行, 滚动位置和排序模式是视图状态, 放在 `useStockList` 的 `useState` 里而不是 store: 它们是"显示顺序里的下标", 而显示顺序由排序决定, store 只持按自选股文件顺序排列的行情行. 刷新后的视口锚定同样在 hook 里做 (`refreshQuotes` 只管数据), 它需要"上一次的显示顺序"; 锚定跨越一次网络往返, 期间用户仍可移动选中行, 因此它读 `viewRef` 里最新的选中行, 滚动位置和排序模式, 不读发起刷新那一帧的闭包 (否则行情返回时会把选中行拉回按下方向键之前的位置). `useStockListStore` 因此只有 `step`, `refreshQuotes` 和 `reset`.

删除流程: StockRemove 常驻渲染 CheckboxGrid (空格勾选, 回车提交, 列数随终端宽度变化), 提交的条目交给 DialogRemoveConfirm 确认删除; 看板按 `d` 打开的是同一个弹窗 (只放一条 entry). Step 机为 idle/confirm/removing/done/error: 全部删除成功后直接关闭并重置勾选, 光标停在删除前的位置 (同一个下标, 超出新的条目数时落到末格; 看板那边是刷新一次), 部分条目已不在自选股时进入 done 提示已删除数量, 删除失败进入 error (删除页据此保留网格勾选, 看板只等下一次轮询), 取消时仅关闭弹窗并保留勾选 (光标也不动). esc 关闭后可直接重试.

收尾动作由打开者登记, 两个 store 不互相 import: `open(entries, onRemoved)` 把回调存进 store, `confirmDelete()` 自己收尾并**只在确实删掉条目后**调用它 (每次打开都覆盖该回调, 回 idle/done/error 时清空); 删除页登记网格 store 的 `removeByCodes` (删掉的那几条离开网格并重挂载), 看板登记的是"立刻刷新一次". 弹窗的 hook 因此不认识任何 command 的 store, 只留 `StockRemoveEntry` 这个类型导入.
"没删掉任何条目" (失败, 或所选已不在自选股: `stocksRemove()` 返回 0) 都在调用点之前收尾并 return, 网格条目与勾选因此都保留.

网格条目是 `{code, name}` (`StockRemoveEntry`) 而不是 `StockEntry`: 名称来自实时行情, 因此 store 的 `loadEntries` 先按文件里的代码铺出网格 (勾选不必等行情), 行情到了再补上名称. 拉名称失败**暴露错误并清空网格**, 不静默降级成只有代码的网格. 行情到达后名称仍为空, 只发生在行情没返回该代码时 (停牌, 退市或响应不全), 此时单元格只显示代码, 确认弹窗也只列代码.
`loadEntries` 带加载代数: 离开删除页再进来会重开一轮, 上一轮的结果一律不落地, 也不在失败时清空新一轮的网格 (见 `useStockAddStore` 的 `generation`).

Settings 的规则:

- `src/commands/Settings/index.tsx` 只负责分组渲染.
- `src/commands/Settings/hooks/useSettings.ts` 负责选中项, 键盘输入, option 循环, duration 格式化和行视图模型.
- UI 只更新 `useSettingsStore`, 不在 command 中直接写文件. 写盘分两条路径: 增量设置变更由 `settingsPersistence` 订阅合并为 patch 保存; 整档操作 (自选股增删改) 由 store 动作调用 `settings/file.ts` 的锁内函数. 全量重置是组合命令 `settings/resetAll.ts` 的 `resetAll()`: 先重置文件, 文件失败则抛出且内存不变; 成功后再恢复设置内存默认值并重新载入自选股.

React 组件和组件 hook 优先使用窄 selector. 非组件代码 (store 动作, 工具函数) 读写其他 store 时用 `useXxxStore.getState()`, 不通过 selector 订阅. 不在多个 store 中保存同一配置字段.
