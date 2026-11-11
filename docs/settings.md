# Settings 和 settings.json 持久化

## Settings 状态

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

主题 preset: `classic`, `ocean`, `forest`, `sunset`, `gray`.

Border style: `single`, `double`, `round`, `bold`, `singleDouble`, `doubleSingle`, `classic`, `arrow`.

主题只定义色值, 显示名称在 catalog 的 `settings.themePreset.*`; `borderStyle` 的显示名称同样在 catalog 的 `settings.borderStyle.*` (`round` -> `圆角` / `Round`), 设置行不直接显示样式 id.

`BorderStyle` 定义在 `settings/schema.ts` 而不是从 i18n 键反推, 方向是 schema -> 文案: `useSettings.ts` 的 `BORDER_STYLE_KEYS: Record<BorderStyle, MessageKey>` 负责一一对应, 新增边框样式时该 Record 会编译报错, 从而强制补上三份 catalog 的 `settings.borderStyle.*`. `settings/schema.ts` 只从 i18n 取 `DEFAULT_LANGUAGE` / `LANGUAGES` / `Language`, 不 import i18n 的类型别名.

Settings 键盘:

```text
Up/Down/k/j       选择配置项
Left/Right/h/l    减少或增加
Enter             增加或切换 option
d                 恢复默认值
```

`SETTING_ITEMS` 用 `group` 字段区分外观组和请求组. `SettingItem.type` 必须是每个成员各一个字面量, 否则 TS 无法按它收窄 `setting` 字段.

所有数值更新必须经过 `normalizeSettings()`. 始终保证 `minimumRequestDurationMs <= requestTimeoutMs`.

## settings.json

唯一配置文件 `settings.json`, 路径按平台:

```text
$XDG_CONFIG_HOME/leek-box-cli/settings.json   # 设置了 XDG_CONFIG_HOME
~/.config/leek-box-cli/settings.json          # 未设置时, Linux 与 macOS
%APPDATA%\leek-box-cli\settings.json          # Windows (Roaming)
```

`configDirectory()` 优先级: 非空 `XDG_CONFIG_HOME` > Windows 的 `%APPDATA%` > `~/.config`. 空字符串的 `XDG_CONFIG_HOME` 按未设置处理.

格式 (没有 legacy migration):

```json
{
  "schemaVersion": 2,
  "appVersion": "<app version>",
  "language": "auto",
  "theme": { "preset": "classic", "trendColorMode": "red-up", "borderStyle": "round" },
  "request": {
    "timeoutMs": 8000,
    "minimumDurationMs": 0,
    "quotePollIntervalMs": 5000,
    "minuteChartPollIntervalMs": 30000,
    "klinePollIntervalMs": 300000
  },
  "stocks": [{ "code": "sh600000", "addedAt": "2026-08-20T00:00:00.000Z" }]
}
```

- `schemaVersion` 是**文档格式版本** (`CURRENT_SCHEMA_VERSION`, 当前为 2), 只在文档结构发生破坏性变更时加一: 新增可选字段不加 (旧程序按默认值接受, 新程序读旧文件也不需要迁移). v1 文件按当前规则解析, 下次写盘即去掉已移除的 `name` 字段.
- `appVersion` 是写入这份文档的**应用版本** (`src/lib/version.ts` 取自 package.json), 只用于排查, 不参与兼容判断; 读取时缺失或非法都回落到当前应用版本, 不报错. 只判空串, 不 trim. 示例里的占位值实际写入的是当时运行的程序版本.
- 写盘一律盖版本: `writeSettingsFile()` 先把文档校验一遍再盖 `schemaVersion` 与 `appVersion` —— 校验拦下读不懂的文档 (版本过新的文档不该被降级重写), 盖章让这两个字段描述**写入它的程序**; 读改写路径 (`stocksAdd()` 等) 不沿用旧值.
- 文件不存在时使用默认 settings 和预置默认自选股 (DEFAULT_STOCK_CODES: sz002156, sh600584, sh688825) 创建, addedAt 为创建时间.
- 文件存在时严格校验 language, theme, request 和 stocks; `theme.trendColorMode` 缺失时按默认 red-up 接受, `language` 缺失时按默认 auto 接受 (schema 的可选字段默认值规则, 不是 legacy 格式迁移).
- 读取时先去除 UTF-8 BOM (`stripBom`); 版本字段缺失时按当前版本接受, 下次写盘自动补上.
- `schemaVersion` 高于 `CURRENT_SCHEMA_VERSION` 时**拒绝读取**: 这份文件由更新的程序写入, 当前程序读不懂它 (`parseSettingsDocument` 按白名单重建, 尽力解析会把读不懂的字段静默写掉). 错误文案提示升级并带上文件路径, 用户升级前无法启动.
- 这类错误用 `SchemaVersionTooNewError` 抛出, `loadExistingSettings()` 对它原样放行 (文件没坏, 不报成 "设置文件损坏"), 因此不套 corruptFile 包装. 文案里的路径由 `parseSettingsDocument(value, path)` 的 path 参数给出 (path 只用于报错文案, 与 `parseInteger(value, name, limits)` 的 name 同类). `schemaVersion` 非法 (非正整数) 同样报错.
- 该错误另外带上文件里的 `language` (缺失或非法时为 undefined), `parseCli` 只在这条错误上额外看这个字段: "请升级" 是用户唯一必须读懂的一句话.
- 版本字段只做判断, 不做迁移: 低版本文件按当前规则解析, 字段缺失走默认值, 没有 migration 层. 损坏文件直接报错, 不静默丢弃字段, 不 fallback 到旧格式.
- `StockEntry` 为 `{code, addedAt}`. 名称**不是持久化数据** (行情里的名称会变, 存下来的那份会过期), 只来自实时行情 (看板行用 quote.name, 详情弹窗标题同源).
- `parseStocks()` 校验 code, addedAt 和重复 code; 旧文档里的 name 按白名单重建丢弃.
- `patchSettings()` 只合并变化的 settings 字段, 保留锁内读取到的最新 stocks; 合并结果与文件相同时不写盘 (全量重置后 persistence 补写默认值时走这条短路). `stocksAdd()`, `stocksRemove()` 在锁内读取最新文档后修改. `replaceStocks()` 表示明确的整表替换, 当前仅用于 mock reset.
- `resetSettingsFile()` 重置为默认文档, 损坏文件也能修复; 应用内由 `settings/resetAll.ts` 的 `resetAll()` 触发 (重置文件 → 设置内存默认值 → 自选股重新载入). 它在锁内先读一次只为判断版本: 读得出来就照常覆盖, 读不出来 (损坏或缺失) 直接修. 版本过新的文件也拒绝覆盖 (重设不是它的逃生门).

写入流程:

1. 获取 `settings.json.lock`.
2. 在锁内重新读取并校验最新 settings.json.
3. 只修改当前操作负责的字段.
4. 写入同目录唯一临时文件.
5. rename 原子替换 settings.json.
6. 校验 lock token 后释放.

Lock 元数据包含 token, pid 和 createdAt. 元数据先写入临时文件, 再通过 hard link 原子发布, 不暴露空 lock 文件. Lock 使用 PID 和 30 秒 lease 判断 stale. 普通等待每 25ms 重试, 2 秒后给出可读错误.

元数据读不懂的锁按残留处理 (本程序的锁不会出现半写的元数据): mtime 超过 2 秒立即清理, 否则等到本次调用用掉一半等待预算时清理. 后一半是必须的: 文件时间戳与调用方 `Date.now()` 之间的偏移随机器而异, 只看 mtime 时偏移为正会让清理永远晚于 busy 报错. `LOCK_UNREADABLE_GRACE_MS` 由 `LOCK_TIMEOUT_MS` 折半派生, 两者不要再合并成一个常量.

`settingsPersistence` 在启动时 hydrate store. Store 变化后使用 100ms debounce 合并 patch, 串行写入, 保存失败时保留 pending patch, 后续变更或退出时重试. `stop()` 必须幂等并 flush 所有 pending 数据.
