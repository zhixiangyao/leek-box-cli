# 轮询, 请求和行情解析

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

- 每次请求开始时读取最新 `requestTimeoutMs` 和 `minimumRequestDurationMs` (`api/lib/tools.ts` 直接读 `useSettingsStore.getState()`, 这就是依赖图里 api -> stores 那条边).
- 调用者 signal 与 `AbortSignal.timeout()` 使用 `AbortSignal.any()` 合并.
- minimum duration 只作用于成功请求, 失败和 HTTP error 立即返回.
- minimum duration 补时支持调用者 signal 中止.
- 配置变化只影响新请求, 不修改已经启动的请求.

API 函数: `fetchQuotes()`, `fetchQuoteNames()` (行情里只要 code 与 name 时的投影, 内部复用 `fetchQuotes`, 因此 timing wrapper 只套一层, 空 codes 的短路也由 `fetchQuotes` 负责), `fetchIntraday()`, `fetchFiveDay()`, `fetchHistorical()`.

实时行情使用 GBK. 必须先 `response.arrayBuffer()`, 再使用 `TextDecoder('gbk')`. 不使用 `response.text()`.

## 行情解析和显示

A 股颜色为涨红, 跌绿, 平灰 (trendColorMode 可切换为涨绿跌红). 停牌显示 `--` 和 `common.suspended` (英文 `Suspended`), 但只替换数值列, 代码与名称列照常显示; 接口缺失显示 `--` 和 `common.noData` (英文 `No data`).

`src/api/lib/parsers.ts` 是纯解析层: `parseQuoteText()` (实时行情文本), `parseIntradayResponse()` (当日分时), `parseFiveDayResponse()` (五日分钟数据), `parseHistoricalResponse()` (日, 周, 月 K).

腾讯在名称字段里用空格把短名称补齐到固定显示宽度 (如 `万  科Ａ`, `深 赛 格`), `parseQuoteText()` 去掉全部空白字符后再写入 `Quote.name`, 名称列截断因此只按真实字符数计算.

年 K 使用后复权月 K 在本地按年份聚合. Chart 数据和行情语义色不受 UI theme preset 覆盖.
