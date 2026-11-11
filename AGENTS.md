# leek-box-cli(韭菜盒子) 项目规范

交互式终端股票自选股看板. 技术栈为 `ink@8.0.0`, `react@19.3.0`, `zustand@5`, Node.js 26, TypeScript ESM 和 Vite. 开发使用 `tsx`, 行情请求使用原生 `fetch`.

终端 UI 的 Ink 通用 API (组件, hooks, render) 见 `node_modules/ink/readme.md` (ink 8.x 官方手册).

本文只保留每次都要遵守的硬约束和大纲. 具体实现约定在 `docs/`, 动到对应区域前先读对应文档. 文档与源码冲突时以源码为唯一事实来源.

## 文档索引

| 改什么                                                          | 先读                   |
| --------------------------------------------------------------- | ---------------------- |
| 目录职责, 依赖方向, 命令注册与路由, Command/hook/store 分层     | `docs/architecture.md` |
| CLI 参数解析, 启动流程, 退出                                    | `docs/cli.md`          |
| 浮层和输入, Card/Dialog/Text, CheckboxGrid, TextInput, 主题应用 | `docs/ui.md`           |
| Settings 状态, 主题常量, settings.json 格式, 文件锁和持久化     | `docs/settings.md`     |
| 语言, 文案键, 插值和复数, 单位与列宽                            | `docs/i18n.md`         |
| 轮询, 请求 timeout 和 minimum duration, 行情解析                | `docs/data.md`         |
| 看板数据模型, 选择滚动, 排序, 指数角标                          | `docs/stock-list.md`   |
| 测试约定, 覆盖率, 验证命令, PTY 冒烟                            | `docs/testing.md`      |
| 代码和界面规范                                                  | `docs/conventions.md`  |

## 核心原则

- 以当前源码为唯一事实来源, 不保留未上线版本的兼容层, migration, deprecated alias 或旧文件格式 fallback.
  `settings.json` 的 `schemaVersion` 只用于**判断** (读到更高版本就拒绝启动), 不是迁移机制.
- 命令渲染, 输入接线, 业务状态和持久化分层, 不把所有逻辑放进 command 组件.
- 共享状态使用 Zustand, React 生命周期和 Ink hooks 留在 React hook 层.
- 文件写入使用锁和原子替换, 所有 settings 与 stocks 修改必须在锁内读取最新文档后合并.
- 中文文案, 注释和文档使用 ASCII 标点, 禁止中文全角标点和 U+3000 空格.
- 所有本地 import 显式写 `.ts` 或 `.tsx` 后缀.

## 目录大纲

```text
src/main.tsx                 入口接线: run(), Ink render, persistence start/stop
src/app.tsx                  全局 esc/q 输入, COMMAND_COMPONENTS, 浮层绘制顺序
src/i18n/                    叶子模块: types.ts 键的唯一来源, locale.ts, core.ts, catalog/
src/navigation/              命令导航域, 只依赖 i18n; registry.ts 是命令元数据唯一来源
src/cli/                     args.ts parseCli(), run.ts 启动流程与顶层错误
src/commands/<Feature>/      index.tsx 渲染, hooks/ 输入与订阅, components/ 专用展示, lib.ts 纯函数
src/components/              公共组件与复合弹窗 (Card, Dialog, TextInput, CheckboxGrid 等)
src/hooks/                   usePolling, useOverlayOpen, useClock, useTheme, useTranslation
src/stores/                  Zustand 状态机与业务动作; 复杂 store 用 createXxxStore(dependencies)
src/api/                     HTTP 请求, 腾讯响应解析器, 代码归一化与 timing wrapper
src/settings/                schema, file, lock, persistence
src/lib/                     纯工具: format, error, is, keys, yesNo, quoteTable, version, polyfill
tests/                       一个源文件一个测试文件; tests/helpers/ 是共享设施
```

完整依赖方向 (`commands/components -> hooks/stores -> settings/file -> settings/schema -> lib` 等) 见 `docs/architecture.md`.

## 硬约束

架构:

- `src/i18n/**` 是叶子层, 只依赖 `node:process`; i18n 不得 import lib/settings/stores, lib/settings 也不得为拿文案类型反向定义领域类型.
- navigation 与 components 不 import commands; 中性组件不 import 具体 command.
- React 生命周期, `useInput`, Ink ref 和布局测量不得进入 store, `src/lib` 或 `src/settings`.
- 不新增第二份路由, overlay 状态, poll interval 或 settings 状态. 命令元数据只来自 registry, 组件映射只在 app.tsx, 浮层聚合只在 `useOverlayOpen()`, 间隔只来自 `useSettingsStore`.
- command 不复制 Card, StatusBar, registry 或 persistence 逻辑.

状态和持久化:

- settings 与 stocks 的每次写入都走 `withFileLock` 加原子 replace, 锁内重读最新文档后合并.
- 不在多个 store 中保存同一配置字段; 非组件代码读写其他 store 用 `useXxxStore.getState()`, 不通过 selector 订阅.
- 不直接修改 Zustand store 内部字段绕过 action (测试 setup 和明确初始化除外).
- 不新增兼容 alias, migration 或 deprecated API, 除非任务明确要求.

UI 和输入:

- 浮层打开时底层 command 与本组件输入一律失活 (`isActive: !overlayOpen.open`), 共享组件的 `isActive` 由 command 传入.
- 浮层按键以自身 hint 为准: hint 展示什么按键, 监听就只处理什么按键.
- 方向键都有 vim 等价键 `h`/`j`/`k`/`l`, 判定统一走 `src/lib/keys.ts` 的 `keyDirection`.
- 所有退出走 Ink `useApp().exit()`, 不调用 `process.exit()`; 所有持久化在退出前 flush.

文案和命名:

- 显示文案只放 catalog, 组件与常量表存 `MessageKey` 并在渲染处解析; 新增键先改 `types.ts`, 再三份 catalog 同步补齐.
- 复数键的计数占位符必须叫 `{count}`; 数值单位是数据不是文案, 定义在 `src/lib/format.ts`.
- 中文文案, 注释和文档只用 ASCII 标点, 禁止全角标点, 顿号, U+3000 和 emoji.
- store 类型带 feature 前缀 (`StockListRow`), 共用类型 `StockEntry` 除外; HTTP 用 `fetchX`, 文件用 `loadX`; 同一种数据在各层同名.
- 本地 import 显式写 `.ts` 或 `.tsx` 后缀.

测试:

- 一个源文件一个测试文件, 放 `tests/`; 跨文件守卫放 `tests/architecture.test.ts`.
- 测试必须隔离 `XDG_CONFIG_HOME`, 涉及渲染帧或文案时固定语言 (`setActiveLocale(DEFAULT_LOCALE)`).
- 改动 `ColumnSpec.widths`, `format.ts` 单位档位或 `Settings` 字段时必须同步对应的守卫用例.

## 验证

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
