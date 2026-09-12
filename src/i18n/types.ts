export type Message = {
  /* ---------- 应用与 CLI ---------- */
  'app.persistenceFailed': string
  'app.runFailed': string
  'cli.usage': string
  'cli.commands': string
  'cli.options': string
  'cli.version': string
  'cli.help': string

  /* ---------- 页面注册表 ---------- */
  'screen.stockList.title': string
  'screen.stockList.description': string
  'screen.stockList.hint': string
  'screen.stockList.menuLabel': string
  'screen.stockAdd.title': string
  'screen.stockAdd.description': string
  'screen.stockAdd.hint': string
  'screen.stockAdd.menuLabel': string
  'screen.stockRemove.title': string
  'screen.stockRemove.description': string
  'screen.stockRemove.hint': string
  'screen.stockRemove.menuLabel': string
  'screen.settings.title': string
  'screen.settings.description': string
  'screen.settings.hint': string
  'screen.settings.menuLabel': string

  /* ---------- 菜单与通用弹窗 ---------- */
  'menu.title': string
  'menu.hint': string
  'menu.reset': string
  'menu.exit': string
  'menu.resetConfirmTitle': string
  'menu.resetConfirmContent': string
  'menu.resetFailed': string
  'dialogConfirm.hint': string
  'dialogConfirm.errorHint': string

  /* ---------- 自选股看板 ---------- */
  'stockList.loading': string
  'stockList.sourceError': string
  'stockList.refreshFailed': string
  'stockList.remaining': string

  /* ---------- 添加自选股 ---------- */
  'stockAdd.codePrompt': string
  'stockAdd.codePlaceholder': string
  'stockAdd.checking': string
  'stockAdd.found': string
  'stockAdd.candidate': string
  'stockAdd.confirmPrompt': string
  'stockAdd.saving': MessageValue
  'stockAdd.invalidCode': string
  'stockAdd.missingCodes': string
  'stockAdd.cancelled': string
  'stockAdd.alreadyExists': string
  'stockAdd.done': MessageValue
  'stockAdd.writeFailed': string

  /* ---------- 删除确认弹窗 ---------- */
  'dialogRemoveConfirm.confirmHint': string
  'dialogRemoveConfirm.finalHint': string
  'dialogRemoveConfirm.titleConfirm': MessageValue
  'dialogRemoveConfirm.titleRemoving': MessageValue
  'dialogRemoveConfirm.titleDone': string
  'dialogRemoveConfirm.titleFailed': string
  'dialogRemoveConfirm.allMissing': MessageValue
  'dialogRemoveConfirm.done': MessageValue
  'dialogRemoveConfirm.failed': string

  /* ---------- 股票详情弹窗 ---------- */
  'dialogStockDetail.hint': string
  'dialogStockDetail.loading': string
  'dialogStockDetail.empty': string
  'dialogStockDetail.sourceUnavailable': string
  'chart.period.intraday': string
  'chart.period.fiveDay': string
  'chart.period.kline': string
  'chart.period.day': string
  'chart.period.week': string
  'chart.period.month': string
  'chart.period.year': string

  /* ---------- 行情表 ---------- */
  'table.column.code': string
  'table.column.name': string
  'table.column.current': string
  'table.column.changePercent': string
  'table.column.change': string
  'table.column.open': string
  'table.column.prevClose': string
  'table.column.high': string
  'table.column.low': string
  'table.column.volume': string
  'table.column.turnover': string
  'table.column.turnoverRate': string
  'table.column.amplitude': string
  'table.column.volumeRatio': string
  'table.column.marketCap': string
  'table.unknownColumn': string

  /* ---------- 设置页 ---------- */
  'settings.section.appearance': string
  'settings.section.request': string
  'settings.note.minimumDuration': string
  'settings.row.theme.label': string
  'settings.row.theme.description': string
  'settings.row.trendColor.label': string
  'settings.row.trendColor.description': string
  'settings.row.border.label': string
  'settings.row.border.description': string
  'settings.row.language.label': string
  'settings.row.language.description': string
  'settings.row.requestTimeout.label': string
  'settings.row.requestTimeout.description': string
  'settings.row.minimumDuration.label': string
  'settings.row.minimumDuration.description': string
  'settings.row.quotePoll.label': string
  'settings.row.quotePoll.description': string
  'settings.row.minuteChartPoll.label': string
  'settings.row.minuteChartPoll.description': string
  'settings.row.klinePoll.label': string
  'settings.row.klinePoll.description': string
  'settings.themePreset.classic': string
  'settings.themePreset.ocean': string
  'settings.themePreset.forest': string
  'settings.themePreset.sunset': string
  'settings.themePreset.gray': string
  'settings.trendColorMode.redUp': string
  'settings.trendColorMode.greenUp': string
  'settings.borderStyle.single': string
  'settings.borderStyle.double': string
  'settings.borderStyle.round': string
  'settings.borderStyle.bold': string
  'settings.borderStyle.singleDouble': string
  'settings.borderStyle.doubleSingle': string
  'settings.borderStyle.classic': string
  'settings.borderStyle.arrow': string
  'settings.duration.off': string
  'settings.duration.rawMs': string
  'settings.duration.minutes': string
  'settings.duration.seconds': string
  'settings.language.auto': string

  /* ---------- settings.json 校验与锁 ---------- */
  'settings.error.notObject': string
  'settings.error.theme': string
  'settings.error.themePreset': string
  'settings.error.trendColorMode': string
  'settings.error.borderStyle': string
  'settings.error.language': string
  'settings.error.request': string
  'settings.error.invalidValue': string
  'settings.error.minimumDurationGtTimeout': string
  'settings.error.stocksNotArray': string
  'settings.error.stockNotObject': string
  'settings.error.stockCode': string
  'settings.error.stockName': string
  'settings.error.stockAddedAt': string
  'settings.error.stockCodeDuplicate': string
  'settings.error.corruptFile': string
  'settings.lock.invalidMetadata': string
  'settings.lock.busy': string

  /* ---------- 行情接口 ---------- */
  'api.error.quote': string
  'api.error.intraday': string
  'api.error.fiveDay': string
  'api.error.historical': string
  'api.error.noQuotes': string

  /* ---------- 通用 ---------- */
  'common.yesNoError': string
  'common.watchlistEmpty': string
  'common.suspended': string
  'common.noData': string
  'common.returnPrompt': string
  'windowGuard.tooSmall': string
  'windowGuard.width': string
  'windowGuard.height': string
  'windowGuard.required': string
  'windowGuard.requiredSize': string
  'stockLogo.sh': string
  'stockLogo.sz': string
  'stockLogo.bj': string
}

export type MessageValue = string | { readonly one: string; readonly other: string }

export type MessageKey = keyof Message

export type MessageParams = Readonly<Record<string, string | number>>

export type Translate = (key: MessageKey, params?: MessageParams) => string

export type Locale = 'zh-hans' | 'zh-hant' | 'en'

export type Language = Locale | 'auto'
