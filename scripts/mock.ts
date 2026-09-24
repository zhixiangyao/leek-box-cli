import process from 'node:process'

import { stocksAdd, loadStocks, replaceStocks, settingsPath } from '../src/settings/file.ts'

const MOCK_CODES = [
  'sh600584',
  'sz002156',
  'sh600900',
  'sz000725',
  'sz002185',
  'sz001232',
  'sh688018',
  'sh688825',
  'sz000066',
  'sz002553',
  'sh600536',
  'sh601899',
  'sz301308',
  'sh688981',
  'sh600460',
  'sz002273',
  'sz000333',
  'sz000651',
  'sz000858',
  'sz002594',
  'sz300750',
  'sh600036',
  'sz002415',
  'sh601398',
  'sh601288',
  'sz000002',
  'sh600276',
  'sz300059',
  'sh601012',
  'sh603501',
  'sz000063',
  'sh600309',
]

const main = async () => {
  const reset = process.argv.includes('--reset')
  const addedAt = new Date().toISOString()
  const candidates = MOCK_CODES.map((code) => ({ code, addedAt }))
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
