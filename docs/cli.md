# CLI 启动和退出

`src/cli/run.ts` 负责启动流程与顶层错误处理:

- `parseCli()` (`src/cli/args.ts`) 返回 command, unknownCommand, showHelp, showVersion, helpMessage 和 settingsDocument.
- showVersion 时打印 `APP_VERSION`, showHelp 时打印 helpMessage, 两者都跳过应用启动 (版本先于 help, 未知命令先于两者).
- parseCli 内部顺序: `tryLoadSettings()` (对 `loadExistingSettings()` 的包装, 只读不创建) -> `applyLanguage` ->
  `genHelpMessage()`, 因此 help 与界面同语言. 这个包装必须留在 args.ts 且自身不抛, `applyLanguage` 必须紧跟其后;
  读取失败的报错留给后面的 `initializeSettings` 统一给出用户提示.
- 读取失败 (缺失或损坏) 时该包装交出 undefined 文档, 语言回退系统语言.
- 版本过新时文档照样被拒绝 (读不懂的字段不能让它写掉), 但文件里的 `language` 只决定那句 "请升级" 用哪种文字说,
  因此它挂在 `SchemaVersionTooNewError.language` 上 (见 `docs/settings.md`).
- `genHelpMessage()` 的文案随解析结果返回; 未知命令时 parseCli 交出 `unknownCommand`, 由 run 打印错误,
  可用命令与 help 并置 `process.exitCode = 2`. 未知命令优先于 `-h`/`-v`.
- `parseArgs()` 用 `strict: false`: 未知 flag 本身不阻断启动, 但其后的独立值会落入位置参数,
  因此 `--config foo` 里的 `foo` 会被判成未知命令. 短选项合并 (`-hv`) 与命令名之后的 `-h`/`-v`
  (如 `settings -h`) 都由 parseArgs 识别.
- parseCli 与 startApp 的异常都在这里变成 `app.runFailed` 文案与 `process.exitCode = 1`, 不抛到模块顶层.
- 打印 help/version 前给 `process.stdout` 装 EPIPE 监听: 下游 `-h | head` 关闭管道时 Node 会在 stdout 上
  异步抛出未处理的 'error' 事件, 接不到 try/catch.

`src/main.tsx` 只保留入口接线, 并把 Ink 启动作为 `startApp` 注入给 `run()` (注入使启动流程可测):

调用 `run()` 之前把 `process.title` 设为 `APP_NAME`, 只影响进程列表显示.

1. 把 `settingsDocument` 传给 `startSettingsPersistence()`, 复用 parseCli 已读到的文档, 启动全程只读一次 settings.json.
   复用判断写在 persistence 里 (`preloadedDocument ?? (await initializeSettings())`), `initializeSettings()` 保持无参.
   文件缺失或损坏时该值是 undefined, 由 initializeSettings 走正常的读取/创建流程并给出报错.
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

退出使用 Ink `useApp().exit()`, 不调用 `process.exit()`. 异步持久化失败通过 `process.exitCode` 表示, 并保证 alternate terminal buffer 正常清理.
