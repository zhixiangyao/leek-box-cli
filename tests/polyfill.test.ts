import { afterEach, expect, test, vi } from 'vitest'

type GetOrInsertComputed = typeof Map.prototype.getOrInsertComputed

const original = Map.prototype.getOrInsertComputed

const removeImplementation = () => {
  delete (Map.prototype as Partial<Map<unknown, unknown>>).getOrInsertComputed
}

const importPolyfill = async () => {
  vi.resetModules()
  await import('../src/lib/polyfill.ts')
}

afterEach(() => {
  if (original === undefined) removeImplementation()
  else Map.prototype.getOrInsertComputed = original
})

test('缺少实现时挂上等价方法, 未命中则写入并返回新值', async () => {
  removeImplementation()
  await importPolyfill()

  const map = new Map<string, number>()
  const keys: string[] = []
  const value = map.getOrInsertComputed('a', (key) => {
    keys.push(key)
    return 1
  })

  expect(keys).toEqual(['a'])
  expect(value).toBe(1)
  expect(map.get('a')).toBe(1)
})

test('键已存在时直接返回旧值且不调用回调', async () => {
  removeImplementation()
  await importPolyfill()

  const map = new Map<string, number>([['a', 1]])
  const callback = vi.fn(() => 2)

  expect(map.getOrInsertComputed('a', callback)).toBe(1)
  expect(callback).not.toHaveBeenCalled()
  expect(map.get('a')).toBe(1)
})

test('运行时已有实现时不覆盖', async () => {
  const existing: GetOrInsertComputed = function <K, V>(key: K, callbackFn: (key: K) => V): V {
    return callbackFn(key)
  }
  Map.prototype.getOrInsertComputed = existing

  await importPolyfill()

  expect(Map.prototype.getOrInsertComputed).toBe(existing)
})
