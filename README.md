# leek-box-cli

> 终端股票自选股看板, 基于 [Ink](https://github.com/vadimdemedes/ink) 构建的交互式 CLI 工具.

## 功能

- **股票涨跌看板(默认页, 自动刷新)** — 启动即进入看板, 实时展示自选股行情: 现价/涨跌幅/涨跌额/今开/昨收/最高/最低, 默认每 5 秒自动刷新(支持 `-`/`+` 以 1 秒步进调整间隔, 范围 1s-60s), 支持 `r` 手动刷新, 涨红跌绿
- **添加自选股** — 输入股票代码(支持 `600000` / `sh600000` / `600000.SH` 等写法), 自动校验并确认股票名称后加入自选股
- **删除自选股** — 列表展示自选股, 选择序号并确认后删除

## 交互方式

- 启动直接进入看板, **按 `esc` 调起菜单弹窗**(浮层覆盖在当前页之上)
- 菜单内: `↑`/`↓` 移动高亮 + `enter` 确认, 或数字键 `1`-`4` 快捷选择; `esc` 关闭弹窗
- 任意页面按 `q` 直接退出 (菜单弹窗打开时 `q` 不生效, 先按 `esc` 关闭再退出)
- 底部状态栏: 左侧按键提示, 右侧日期(YYYY-MM-DD, 时区 Asia/Shanghai)

## 环境要求

- [Node.js](https://nodejs.org/) >= 26.7.0
- [pnpm](https://pnpm.io/) >= 10.0.0

无任何外部工具依赖(行情通过 Node 原生 `fetch` 获取)。

## 行情数据源

- 使用**腾讯行情接口**(`https://qt.gtimg.cn/q=...`), 免费无需鉴权
- 数据实时性以接口实际返回为准, 仅用于个人展示用途
- 支持沪深主板/创业板/科创板/北交所及 ETF 基金代码

## 安装

```bash
pnpm install
pnpm build
```

## 使用

```bash
# 开发模式直接运行
pnpm dev

# 构建后运行
pnpm build
node dist/cli.mjs

# 或打包为单文件二进制后直接运行
pnpm bundle
./dist/leek-box-cli
```

## 打包为单文件二进制

`pnpm bundle` 基于 Node 官方 SEA(Single Executable Applications)把构建产物与 Node 运行时合并为单个可执行文件 `dist/leek-box-cli`, 在无 node 环境的目标机器上也能直接运行:

```bash
pnpm bundle        # 构建 + 打包
pnpm bundle:sea    # 仅重新打包(dist/cli.mjs 需已存在)
./dist/leek-box-cli   # 直接运行
```

- 产物为单个文件, 体积约 143MB(内含完整 Node 运行时), 目前仅支持 Linux

启动后直接进入股票涨跌看板, 按 `esc` 调起菜单; 也可通过子命令直接进入对应页面：

```bash
leek-box-cli               # 直接进入股票涨跌看板
leek-box-cli dashboard     # 同上
leek-box-cli add-stock     # 直接进入添加自选股
leek-box-cli remove-stock  # 直接进入删除自选股
leek-box-cli -v            # 查看版本
leek-box-cli -h            # 查看帮助
```

## 菜单弹窗

按 `esc` 调起(覆盖在当前页之上的浮层):

```
+----------------------------+
|菜单                         |
|> 1) 股票涨跌看板 (dashboard)|
|  2) 添加自选股 (add-stock)  |
|  3) 删除自选股 (remove-stock)|
|  4) 退出程序                |
|esc 关闭  enter 选择        |
+----------------------------+
```

## 自选股存储

- 自选股保存在 `~/.config/leek-box-cli/watchlist.json`(遵循 `XDG_CONFIG_HOME` 环境变量)
- 文件为 JSON 数组, 手动编辑后需重启程序生效

## 脚本

| 命令              | 说明                     |
| ----------------- | ------------------------ |
| `pnpm dev`        | 开发模式运行             |
| `pnpm build`      | TypeScript 编译          |
| `pnpm bundle`     | 构建并打包为单文件二进制 |
| `pnpm bundle:sea` | 仅打包(需先 build)       |
| `pnpm typecheck`  | 类型检查                 |
| `pnpm lint`       | Lint 检查并自动修复      |
| `pnpm lint:check` | 仅 Lint 检查             |
| `pnpm fmt`        | 格式化代码               |
| `pnpm fmt:check`  | 检查代码格式             |

## 技术栈

- [TypeScript](https://www.typescriptlang.org/)
- [Ink](https://github.com/vadimdemedes/ink) — React for CLI
- [React](https://react.dev/)
- [meow](https://github.com/sindresorhus/meow) — CLI helper
- [oxlint](https://oxc.rs/) / [oxfmt](https://oxc.rs/) — Lint & 格式化
