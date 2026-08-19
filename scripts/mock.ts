/**
 * 一键填充 mock 自选股 (22 只, 沪深主板 + 创业板 + 科创板).
 * 默认追加去重 (保留已有自选股), 传 `--reset` 完全覆盖.
 * 用法: pnpm mock [--reset]
 */
import process from 'node:process'

import { loadWatchlist, saveWatchlist, watchlistPath } from '../src/lib/watchlist.ts'

const MOCK_STOCKS = [
  { code: 'sh600584', name: '长电科技' },
  { code: 'sz002156', name: '富通微电' },
  { code: 'sh600900', name: '长江电力' },
  { code: 'sz000725', name: '京东方A' },
  { code: 'sz002185', name: '华天科技' },
  { code: 'sz001232', name: '嘉立创' },
  { code: 'sh688018', name: '乐鑫科技' },
  { code: 'sh688825', name: '长鑫科技' },
  { code: 'sz000066', name: '中国长城' },
  { code: 'sz002553', name: '南方精工' },
  { code: 'sh600536', name: '中国软件' },
  { code: 'sh601899', name: '紫金矿业' },
  { code: 'sz301308', name: '江波龙' },
  { code: 'sh688981', name: '中芯国际' },
  { code: 'sh600460', name: '士兰微' },
  { code: 'sz002273', name: '水晶光电' },
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
