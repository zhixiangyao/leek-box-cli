import { mkdtemp, readFile, rm, stat, unlink, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

import { afterEach, beforeEach, expect, test, vi } from 'vitest'

interface OneShotHook {
  path: string
  run: () => Promise<void>
}

/** 模拟锁文件在两次文件操作之间被别的进程删掉, 只有命中路径的那一次调用触发 */
const fsHooks = vi.hoisted(() => ({
  readFile: undefined as OneShotHook | undefined,
  stat: undefined as OneShotHook | undefined,
  rm: undefined as OneShotHook | undefined,
}))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()

  return {
    ...actual,
    readFile: async (...args: Parameters<typeof actual.readFile>) => {
      const hook = fsHooks.readFile
      if (hook?.path === String(args[0])) {
        fsHooks.readFile = undefined
        await hook.run()
      }
      return actual.readFile(...args)
    },
    stat: async (...args: Parameters<typeof actual.stat>) => {
      const hook = fsHooks.stat
      if (hook?.path === String(args[0])) {
        fsHooks.stat = undefined
        await hook.run()
      }
      return actual.stat(...args)
    },
    rm: async (...args: Parameters<typeof actual.rm>) => {
      const hook = fsHooks.rm
      if (hook?.path === String(args[0])) {
        fsHooks.rm = undefined
        await hook.run()
      }
      return actual.rm(...args)
    },
  }
})

import { withFileLock } from '../src/settings/lock.ts'

let configHome: string

beforeEach(async () => {
  configHome = await mkdtemp(join(tmpdir(), 'leek-box-cli-lock-'))
})

afterEach(async () => {
  fsHooks.readFile = undefined
  fsHooks.stat = undefined
  fsHooks.rm = undefined
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

test('元数据字段不完整或类型非法的锁按残留清理', async () => {
  const invalidMetadata = [
    'null',
    '[]',
    {},
    { token: 1, pid: process.pid, createdAt: Date.now() },
    { token: 'x', pid: String(process.pid), createdAt: Date.now() },
    { token: 'x', pid: 1.5, createdAt: Date.now() },
    { token: 'x', pid: 0, createdAt: Date.now() },
    { token: 'x', pid: process.pid, createdAt: 'now' },
    { token: 'x', pid: process.pid, createdAt: null },
  ]

  for (const contents of invalidMetadata) {
    const lockPath = await prepareLockFile(contents)
    const stale = new Date(Date.now() - 3000)
    await utimes(lockPath, stale, stale)

    let executed = false
    await withFileLock(configHome, async () => {
      executed = true
    })
    expect(executed, JSON.stringify(contents)).toBe(true)
  }
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

test('无效元数据的锁在等待预算内被清理, 不因 mtime 比本机时钟新而阻塞后续执行', async () => {
  const lockPath = await prepareLockFile('not-json')
  // mtime 拨到调用方时钟之后: 文件时间戳与 Date.now() 之间的偏移随机器而异, 一旦为正,
  // "等 mtime 过期" 就永远晚于 busy 超时, 用自然写入时间做这条用例会变成看机器脸的定时炸弹
  const ahead = new Date(Date.now() + 100)
  await utimes(lockPath, ahead, ahead)

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

const gone = () => Object.assign(new Error('lock removed by another process'), { code: 'ENOENT' })

test('锁在 EEXIST 之后被别的进程删除时直接重试', async () => {
  const lockPath = await prepareLockFile({ token: 'race', pid: process.pid, createdAt: Date.now() })
  fsHooks.readFile = {
    path: lockPath,
    run: async () => {
      await unlink(lockPath)
      throw gone()
    },
  }

  let executed = false
  await withFileLock(configHome, async () => {
    executed = true
  })
  expect(executed).toBe(true)
})

test('元数据读不懂且锁在 stat 之前消失时直接重试', async () => {
  const lockPath = await prepareLockFile('not-json')
  fsHooks.stat = {
    path: lockPath,
    run: async () => {
      await unlink(lockPath)
      throw gone()
    },
  }

  let executed = false
  await withFileLock(configHome, async () => {
    executed = true
  })
  expect(executed).toBe(true)
})

test('清理过期锁时文件已被删除, 重试后继续', async () => {
  const lockPath = await prepareLockFile({ token: 'dead', pid: 999_999_999, createdAt: Date.now() })
  fsHooks.rm = {
    path: lockPath,
    run: async () => {
      await unlink(lockPath)
      throw gone()
    },
  }

  let executed = false
  await withFileLock(configHome, async () => {
    executed = true
  })
  expect(executed).toBe(true)
})

test('释放锁时的非 ENOENT 读取错误向上传播', async () => {
  const lockPath = `${configHome}.lock`
  fsHooks.readFile = {
    path: lockPath,
    run: async () => {
      throw Object.assign(new Error('cleanup failed'), { code: 'EACCES' })
    },
  }

  try {
    await expect(withFileLock(configHome, async () => 'ok')).rejects.toMatchObject({ code: 'EACCES' })
  } finally {
    await unlink(lockPath).catch(() => undefined)
  }
})

test('释放锁时锁文件已消失不算清理错误', async () => {
  const lockPath = `${configHome}.lock`
  fsHooks.readFile = {
    path: lockPath,
    run: async () => {
      await unlink(lockPath)
      throw gone()
    },
  }

  await expect(withFileLock(configHome, async () => 'ok')).resolves.toBe('ok')
})

const accessDenied = () => Object.assign(new Error('permission denied'), { code: 'EACCES' })

test('检查残留锁时读取失败会向上传播', async () => {
  const lockPath = await prepareLockFile({ token: 'busy', pid: process.pid, createdAt: Date.now() })
  fsHooks.readFile = { path: lockPath, run: async () => Promise.reject(accessDenied()) }

  try {
    await expect(withFileLock(configHome, async () => 'never')).rejects.toMatchObject({ code: 'EACCES' })
  } finally {
    await unlink(lockPath).catch(() => undefined)
  }
})

test('检查残留锁时 stat 失败会向上传播', async () => {
  const lockPath = await prepareLockFile('not-json')
  fsHooks.stat = { path: lockPath, run: async () => Promise.reject(accessDenied()) }

  try {
    await expect(withFileLock(configHome, async () => 'never')).rejects.toMatchObject({ code: 'EACCES' })
  } finally {
    await unlink(lockPath).catch(() => undefined)
  }
})

test('删除残留锁失败会向上传播', async () => {
  const lockPath = await prepareLockFile({ token: 'dead', pid: 999_999_999, createdAt: Date.now() })
  fsHooks.rm = { path: lockPath, run: async () => Promise.reject(accessDenied()) }

  try {
    await expect(withFileLock(configHome, async () => 'never')).rejects.toMatchObject({ code: 'EACCES' })
  } finally {
    await unlink(lockPath).catch(() => undefined)
  }
})

test('持有期间锁文件被别的调用方替换时, 释放不删除对方的锁', async () => {
  const lockPath = `${configHome}.lock`

  await withFileLock(configHome, async () => {
    // 模拟 stale 清理后另一个进程拿到锁: 路径还是同一个, 内容已经不是本次的 token
    await writeFile(lockPath, '{"token":"other","pid":1,"createdAt":0}', 'utf8')
  })

  expect(await readFile(lockPath, 'utf8')).toBe('{"token":"other","pid":1,"createdAt":0}')
  await rm(lockPath)
})
