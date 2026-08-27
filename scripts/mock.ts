import process from 'node:process'

import { stocksAdd, loadStocks, replaceStocks, settingsPath } from '../src/lib/settings.ts'

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
  { code: 'sh600036', name: '招商银行' },
  { code: 'sz002415', name: '海康威视' },
  { code: 'sh601398', name: '工商银行' },
  { code: 'sh601288', name: '农业银行' },
  { code: 'sz000002', name: '万科A' },
  { code: 'sh600276', name: '恒瑞医药' },
  { code: 'sz300059', name: '东方财富' },
  { code: 'sh601012', name: '隆基绿能' },
  { code: 'sh603501', name: '韦尔股份' },
  { code: 'sz000063', name: '中兴通讯' },
  { code: 'sh600309', name: '万华化学' },
]

const main = async () => {
  const reset = process.argv.includes('--reset')
  const addedAt = new Date().toISOString()
  const candidates = MOCK_STOCKS.map((stock) => ({ ...stock, addedAt }))
  const added = reset ? candidates.length : await stocksAdd(candidates)
  if (reset) await replaceStocks(candidates)

  const entries = await loadStocks()
  console.log(`${reset ? '已重置为 mock 列表' : `已添加 ${added} 只`}: 当前共 ${entries.length} 只自选股`)
  if (!reset && added === 0) {
    console.log('全部 mock 股票已在自选股中, 未重复添加')
  }
  console.log(`文件: ${settingsPath()}`)
}

await main()
