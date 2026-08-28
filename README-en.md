<p align="right">
  <a href="README.md">中文</a> | <strong>English</strong>
</p>

# leek-box-cli(韭菜盒子)

> An interactive terminal stock watchlist dashboard built with [Ink](https://github.com/vadimdemedes/ink).

## Screenshots

### Stock Watchlist

<p align="center">
  <img src="scrennshots/stock-list.png" alt="Stock watchlist dashboard" width="100%">
</p>

### Menu & Settings

<table>
  <tr>
    <td align="center" width="50%"><strong>Menu</strong></td>
    <td align="center" width="50%"><strong>Settings</strong></td>
  </tr>
  <tr>
    <td><img src="scrennshots/dialog-menu.png" alt="Menu dialog"></td>
    <td><img src="scrennshots/settings.png" alt="Settings screen"></td>
  </tr>
</table>

### Manage Watchlist

<table>
  <tr>
    <td align="center" width="50%"><strong>Add Stock</strong></td>
    <td align="center" width="50%"><strong>Remove Stock</strong></td>
  </tr>
  <tr>
    <td><img src="scrennshots/stock-add.png" alt="Add a stock to the watchlist"></td>
    <td><img src="scrennshots/stock-remove.png" alt="Remove a stock from the watchlist"></td>
  </tr>
</table>

### Stock Details

<table>
  <tr>
    <td align="center" width="50%"><strong>Intraday</strong></td>
    <td align="center" width="50%"><strong>Five-day</strong></td>
  </tr>
  <tr>
    <td><img src="scrennshots/dialog-stock-detail-intraday.png" alt="Intraday stock chart"></td>
    <td><img src="scrennshots/dialog-stock-detail-five-day.png" alt="Five-day stock chart"></td>
  </tr>
  <tr>
    <td align="center" width="50%"><strong>Daily</strong></td>
    <td align="center" width="50%"><strong>Weekly</strong></td>
  </tr>
  <tr>
    <td><img src="scrennshots/dialog-stock-detail-day.png" alt="Daily stock chart"></td>
    <td><img src="scrennshots/dialog-stock-detail-week.png" alt="Weekly stock chart"></td>
  </tr>
  <tr>
    <td align="center" width="50%"><strong>Monthly</strong></td>
    <td align="center" width="50%"><strong>Yearly</strong></td>
  </tr>
  <tr>
    <td><img src="scrennshots/dialog-stock-detail-month.png" alt="Monthly stock chart"></td>
    <td><img src="scrennshots/dialog-stock-detail-year.png" alt="Yearly stock chart"></td>
  </tr>
</table>

## Features

- **Real-time dashboard**: Displays the latest price, percentage change, price change, open, high, low, volume, turnover, turnover rate, and total market capitalization for every stock in your watchlist. Refreshes every 5 seconds by default.
- **Row selection and details**: Use `↑`/`↓` to select a stock and `enter` to open its quote details and trend chart. Press `1`-`6` to switch between intraday, five-day, daily, weekly, monthly, and yearly views.
- **Multiple time frames**: Intraday and five-day minute charts refresh every 30 seconds. Daily, weekly, monthly, and yearly charts refresh every 5 minutes.
- **Refresh controls**: Press `r` to refresh immediately. Configure the automatic refresh interval in Settings in 500 ms increments, from 1 to 60 seconds.
- **Watchlist management**: Add or remove Shanghai, Shenzhen, and Beijing A-shares and ETFs. Stock codes can be entered as `600000`, `sh600000`, `600000.SH`, and other common formats.
- **Resilient display**: Suspended stocks, incomplete quotes, and refresh failures each have a dedicated state. The display recovers automatically after a later poll succeeds.

## Controls

- `esc`: Open the menu. If stock details are open, close them first; if the menu is open, close it.
- In the menu, use `↑`/`↓`, `enter`, or a number key to select a page.
- In the dashboard, use `↑`/`↓`, `enter`, and `r`.
- In Settings, use `↑`/`↓` to select an item and `←`/`→` or `enter` to adjust it.
- In stock details, press `1`-`6` to switch between `Intraday`, `Five-day`, `Daily`, `Weekly`, `Monthly`, and `Yearly`.
- `q`: Exit when no menu or stock details overlay is open. It does nothing while an overlay is open to prevent accidental exits.
- The right side of the status bar displays `YYYY-MM-DD HH:MM:SS` in the Asia/Shanghai time zone.

## Requirements

- [Node.js](https://nodejs.org/) >= 22.19.0 (or >= 24)
- [pnpm](https://pnpm.io/) >= 11.0.0

Market data is retrieved with the native Node.js `fetch` API, with no external runtime dependency such as curl.

## Market Data Sources

- Real-time quotes: Tencent quote API at `https://qt.gtimg.cn/q=...`; GBK-encoded and requires no authentication.
- Intraday data: Tencent minute API at `https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=...`.
- Five-day data: Tencent multi-day minute API at `https://web.ifzq.gtimg.cn/appstock/app/day/query?code=...`.
- Daily, weekly, and monthly data: Tencent forward-adjusted K-line API at `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=...`.
- Yearly data: Aggregated locally by year from backward-adjusted monthly data returned by the same API.
- Data timeliness and availability depend on the upstream APIs. This project is intended for personal display purposes only.

## Installation and Usage

### Install globally (recommended)

```bash
npm install -g leek-box-cli
# or
pnpm add -g leek-box-cli
# or
yarn global add leek-box-cli
```

Then run it from anywhere:

```bash
leek-box-cli
```

> Requires Node.js 22.19+ (or 24+) on the machine that runs the command.

Alternatively, run it once without installing:

```bash
npx leek-box-cli
# or
pnpm dlx leek-box-cli
```

### Run from source

```bash
pnpm install

# Development mode
pnpm dev

# Build and run
pnpm build
pnpm preview
```

You can also select the initial page with a subcommand:

```bash
leek-box-cli               # Stock watchlist dashboard
leek-box-cli stock-list    # Same as above
leek-box-cli stock-add     # Add a stock to the watchlist
leek-box-cli stock-remove  # Remove a stock from the watchlist
leek-box-cli -v            # Show version information
leek-box-cli -h            # Show help
```

## Settings and Watchlist Storage

Settings and the watchlist are stored together at `$XDG_CONFIG_HOME/leek-box-cli/settings.json`. If `XDG_CONFIG_HOME` is not set, Linux and macOS use `~/.config/leek-box-cli/settings.json`, while Windows uses `%APPDATA%\leek-box-cli\settings.json`.

Windows note: a UTF-8 BOM written by editors such as Notepad is stripped automatically when the config is read, so hand-editing settings.json will not break parsing because of a BOM.

File structure:

```json
{
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
      "name": "浦发银行",
      "addedAt": "2026-08-20T00:00:00.000Z"
    }
  ]
}
```

The application reloads the file every time it refreshes the dashboard, so valid external edits take effect on the next refresh. It validates the `theme` and `request` fields, as well as each stock's `code`, `name`, `addedAt`, and duplicate codes when reading. Writes use an inter-process lock and atomic temporary-file replacement to prevent lost concurrent updates and partial JSON files.

## Development Scripts

| Command           | Description                              |
| ----------------- | ---------------------------------------- |
| `pnpm dev`        | Run the source code with tsx             |
| `pnpm build`      | Build `dist/cli.mjs` with Vite           |
| `pnpm preview`    | Run the build output                     |
| `pnpm test`       | Run tests with Vitest                    |
| `pnpm typecheck`  | Run TypeScript type checking             |
| `pnpm lint`       | Run the linter and apply automatic fixes |
| `pnpm lint:check` | Run the linter without modifying files   |
| `pnpm fmt`        | Format the code                          |
| `pnpm fmt:check`  | Check code formatting                    |

## Tech Stack

- TypeScript / ESM
- Ink 7 + React 19
- Zustand 5
- meow
- Vite
- oxlint / oxfmt
- Vitest
