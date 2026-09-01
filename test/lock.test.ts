import { mkdtemp, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

import { afterEach, beforeEach, expect, test } from 'vitest'

import { withFileLock } from '../src/settings/lock.ts'

let configHome: string

beforeEach(async () => {
  configHome = await mkdtemp(join(tmpdir(), 'leek-box-cli-lock-'))
})

afterEach(async () => {
  await rm(configHome, { recursive: true, force: true })
})

/** 写一个虚假的锁文件, 检查默认锁读取路径 */
const prepareLockFile = async (contents: string | object) => {
  const lockPath = `${configHome}.lock`
  await writeFile(lockPath, typeof contents === 'string' ? contents : JSON.stringify(contents), 'utf8')
  return lockPath
}

test('withFileLock 在锁保护下执行操作并在结束后删除锁文件', async () => {
  let executed = false
  await withFileLock(configHome, async () => {
    executed = true
  })

  expect(executed).toBe(true)
  await expect(stat(`${configHome}.lock`)).rejects.toMatchObject({ code: 'ENOENT' })
})

test('操作抛错时锁仍被释放且错误传播不丢失', async () => {
  const error = new Error('操作失败')
  await expect(
    withFileLock(configHome, async () => {
      throw error
    }),
  ).rejects.toBe(error)
  await expect(stat(`${configHome}.lock`)).rejects.toMatchObject({ code: 'ENOENT' })
})

test('锁被并发占用时第二个调用等待释放后串行执行', async () => {
  let inside = 0
  let maxInside = 0
  const operation = async () => {
    inside += 1
    maxInside = Math.max(inside, maxInside)
    await new Promise((resolve) => setTimeout(resolve, 30))
    inside -= 1
  }

  await Promise.all([withFileLock(configHome, operation), withFileLock(configHome, operation)])
  expect(maxInside).toBe(1)
})

test('死进程留下的锁被清理并继续执行', async () => {
  await prepareLockFile({ token: 'dead-process', pid: 999_999_999, createdAt: Date.now() })

  let executed = false
  await withFileLock(configHome, async () => {
    executed = true
  })
  expect(executed).toBe(true)
})

test('超过 30 秒 lease 的锁被视为过期并清理', async () => {
  await prepareLockFile({ token: 'expired', pid: process.pid, createdAt: Date.now() - 60_000 })

  let executed = false
  await withFileLock(configHome, async () => {
    executed = true
  })
  expect(executed).toBe(true)
})

test('元数据无效且 mtime 超过超时窗口的锁被清理', async () => {
  const lockPath = await prepareLockFile('not-json')
  await utimes(lockPath, new Date(Date.now() - 3000), new Date(Date.now() - 3000))

  let executed = false
  await withFileLock(configHome, async () => {
    executed = true
  })
  expect(executed).toBe(true)
})

test('无效元数据的锁等待 mtime 超时后也被清理, 不阻塞后续执行', async () => {
  await prepareLockFile('not-json')

  let executed = false
  await withFileLock(configHome, async () => {
    executed = true
  })
  expect(executed).toBe(true)
}, 10_000)

test('活跃进程持有的有效锁等待超时后报错', async () => {
  await prepareLockFile({ token: 'busy', pid: process.pid, createdAt: Date.now() })

  await expect(withFileLock(configHome, async () => 'never')).rejects.toThrow('文件正被其他进程占用')
}, 10_000)

test('获取锁前会创建目标目录', async () => {
  const nestedPath = join(configHome, 'nested', 'dir', 'settings.json')
  let executed = false
  await withFileLock(nestedPath, async () => {
    executed = true
  })
  expect(executed).toBe(true)
  await expect(stat(`${nestedPath}.lock`)).rejects.toMatchObject({ code: 'ENOENT' })
})
