import assert from 'node:assert/strict'
import test from 'node:test'

import { visibleWindow } from '../src/screens/StockList/lib.ts'

test('visibleWindow clamps offsets at both ends', () => {
  assert.deepEqual(visibleWindow(3, 10, 5), { start: 0, end: 3 })
  assert.deepEqual(visibleWindow(10, -2, 3), { start: 0, end: 3 })
  assert.deepEqual(visibleWindow(10, 99, 3), { start: 7, end: 10 })
})
