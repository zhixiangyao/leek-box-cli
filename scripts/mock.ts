/**
 * 一键填充 mock 自选股 (22 只, 沪深主板 + 创业板 + 科创板).
 * 默认追加去重 (保留已有自选股), 传 `--reset` 完全覆盖.
 * 用法: pnpm mock [--reset]
 */
import process from 'node:process'

import { loadWatchlist, saveWatchlist, watchlistPath } from '../src/lib/watchlist.ts'

const MOCK_STOCKS = [
  { code: 'sh600000', name: '浦发银行' },
  { code: 'sh600036', name: '招商银行' },
  { code: 'sh600030', name: '中信证券' },
  { code: 'sh600519', name: '贵州茅台' },
  { code: 'sh601318', name: '中国平安' },
  { code: 'sh601398', name: '工商银行' },
  { code: 'sh601857', name: '中国石油' },
  { code: 'sh600028', name: '中国石化' },
  { code: 'sh600050', name: '中国联通' },
  { code: 'sh601988', name: '中国银行' },
  { code: 'sh601288', name: '农业银行' },
  { code: 'sh601628', name: '中国人寿' },
  { code: 'sh600900', name: '长江电力' },
  { code: 'sh601012', name: '隆基绿能' },
  { code: 'sh688981', name: '中芯国际' },
  { code: 'sz000001', name: '平安银行' },
  { code: 'sz000002', name: '万科A' },
  { code: 'sz000333', name: '美的集团' },
  { code: 'sz000651', name: '格力电器' },
  { code: 'sz000858', name: '五粮液' },
  { code: 'sz002594', name: '比亚迪' },
  { code: 'sz300750', name: '宁德时代' },
]

const main = async () => {
  const reset = process.argv.includes('--reset')
  const entries = reset ? [] : await loadWatchlist()
  const known = new Set(entries.map((entry) => entry.code))
  let added = 0
  for (const stock of MOCK_STOCKS) {
    if (known.has(stock.code)) continue
    entries.push({ code: stock.code, name: stock.name, addedAt: new Date().toISOString() })
    known.add(stock.code)
    added += 1
  }
  await saveWatchlist(entries)
  console.log(`${reset ? '已重置为 mock 列表' : `已添加 ${added} 只`}: 当前共 ${entries.length} 只自选股`)
  if (!reset && added === 0) {
    console.log('全部 mock 股票已在自选股中, 未重复添加')
  }
  console.log(`文件: ${watchlistPath()}`)
}

await main()
