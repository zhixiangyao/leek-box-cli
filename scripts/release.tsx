import { execFile } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { Box, render, Text, useApp, useInput } from 'ink'
import { useEffect, useState } from 'react'

const execFileAsync = promisify(execFile)

type ReleaseKind = 'major' | 'minor' | 'patch'

const KINDS: ReleaseKind[] = ['patch', 'minor', 'major']

const KIND_LABELS: Record<ReleaseKind, string> = {
  patch: 'patch  修订号 (0.0.x)',
  minor: 'minor  次版本 (0.x.0)',
  major: 'major  主版本 (x.0.0)',
}

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/** 按语义化版本规则递增指定位, 低位归零 */
const bumpVersion = (version: string, kind: ReleaseKind): string => {
  const match = SEMVER_PATTERN.exec(version)
  if (!match) throw new Error(`package.json version 非法: ${version} (仅支持 x.y.z)`)
  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])
  if (kind === 'major') return `${major + 1}.0.0`
  if (kind === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

const packageJsonPath = () => join(process.cwd(), 'package.json')

/** 执行 git 命令, 失败时抛出 git stderr 便于定位 */
const git = async (...args: string[]): Promise<string> => {
  try {
    const { stdout } = await execFileAsync('git', args)
    return stdout.trim()
  } catch (error) {
    const stderr = (error as { stderr?: unknown }).stderr
    const text = typeof stderr === 'string' ? stderr.trim() : ''
    throw new Error(text !== '' ? text : errorMessage(error))
  }
}

/** 读取 package.json 当前版本 */
async function readCurrentVersion(): Promise<string> {
  const parsed = JSON.parse(await readFile(packageJsonPath(), 'utf8')) as { version?: unknown }
  if (typeof parsed.version !== 'string') throw new Error('package.json 缺少 version 字段')
  return parsed.version
}

/** 确认 package.json 无未提交改动, 避免把无关改动混进 release commit */
async function ensurePackageClean(): Promise<void> {
  if ((await git('status', '--porcelain', '--', packageJsonPath())) !== '') {
    throw new Error('package.json 存在未提交改动, 请先提交或还原后再执行')
  }
}

type ReleaseResult = { current: string; next: string; tag: string; message: string }

/** 递增版本, 创建 release commit 和 tag (仅本地, 不推送) */
async function createRelease(kind: ReleaseKind): Promise<ReleaseResult> {
  await ensurePackageClean()

  const path = packageJsonPath()
  const raw = await readFile(path, 'utf8')
  const parsed = JSON.parse(raw) as { version?: unknown }
  if (typeof parsed.version !== 'string') throw new Error('package.json 缺少 version 字段')

  const current = parsed.version
  const next = bumpVersion(current, kind)
  const tag = `v${next}`

  if ((await git('tag', '--list', tag)) !== '') throw new Error(`tag ${tag} 已存在`)

  // 只替换顶层 version 字段, 其余内容和格式保持不变, 让 release commit 只包含版本改动.
  const updated = raw.replace(/^(\s*"version":\s*")\d+\.\d+\.\d+(")/m, `$1${next}$2`)
  if (updated === raw) throw new Error('未能在 package.json 中定位 version 字段')
  await writeFile(path, updated)

  const message = `chore(release): ${tag}`
  await git('commit', '-m', message, '--', path)
  await git('tag', tag)

  return { current, next, tag, message }
}

/** 推送当前分支和指定 tag 到 origin */
async function pushRelease(tag: string): Promise<void> {
  const branch = await git('rev-parse', '--abbrev-ref', 'HEAD')
  await git('push', 'origin', branch)
  await git('push', 'origin', tag)
}

type Phase = 'init' | 'select' | 'releasing' | 'confirm' | 'pushing' | 'done' | 'error'

/** 发布交互界面: 选择 patch/minor/major, 创建 commit 和 tag, 再选择是否 push */
function ReleaseApp() {
  const { exit } = useApp()
  const [phase, setPhase] = useState<Phase>('init')
  const [current, setCurrent] = useState('')
  const [previews, setPreviews] = useState<Record<ReleaseKind, string> | null>(null)
  const [selected, setSelected] = useState(0)
  const [pushSelected, setPushSelected] = useState(1) // 默认 "否", 防止误推送
  const [result, setResult] = useState<ReleaseResult | undefined>(undefined)
  const [pushed, setPushed] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        await ensurePackageClean()
        const version = await readCurrentVersion()
        const nextPreviews: Record<ReleaseKind, string> = {
          patch: bumpVersion(version, 'patch'),
          minor: bumpVersion(version, 'minor'),
          major: bumpVersion(version, 'major'),
        }
        if (cancelled) return
        setCurrent(version)
        setPreviews(nextPreviews)
        setPhase('select')
      } catch (loadError) {
        if (cancelled) return
        setError(errorMessage(loadError))
        setPhase('error')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (phase === 'done') {
      exit()
    } else if (phase === 'error') {
      process.exitCode = 1
      exit()
    }
  }, [phase, exit])

  const startRelease = (kind: ReleaseKind) => {
    setPhase('releasing')
    const perform = async () => {
      try {
        const releaseResult = await createRelease(kind)
        setResult(releaseResult)
        setPhase('confirm')
      } catch (releaseError) {
        setError(errorMessage(releaseError))
        setPhase('error')
      }
    }
    void perform()
  }

  const startPush = () => {
    if (!result) return
    setPhase('pushing')
    const perform = async () => {
      try {
        await pushRelease(result.tag)
        setPushed(true)
        setPhase('done')
      } catch (pushError) {
        setError(errorMessage(pushError))
        setPhase('error')
      }
    }
    void perform()
  }

  const skipPush = () => {
    setPushed(false)
    setPhase('done')
  }

  useInput(
    (input, key) => {
      if (key.upArrow) setSelected((index) => (index + KINDS.length - 1) % KINDS.length)
      else if (key.downArrow) setSelected((index) => (index + 1) % KINDS.length)
      else if (key.return) startRelease(KINDS[selected]!)
      else if (input === '1') startRelease('patch')
      else if (input === '2') startRelease('minor')
      else if (input === '3') startRelease('major')
    },
    { isActive: phase === 'select' },
  )

  useInput(
    (input, key) => {
      if (input === 'y' || input === 'Y') startPush()
      else if (input === 'n' || input === 'N') skipPush()
      else if (key.upArrow || key.downArrow) setPushSelected((value) => (value === 0 ? 1 : 0))
      else if (key.return) {
        if (pushSelected === 0) startPush()
        else skipPush()
      }
    },
    { isActive: phase === 'confirm' },
  )

  if (phase === 'error') {
    return <Text color="red">{`release 失败: ${error}`}</Text>
  }

  if (phase === 'init' || previews === null) {
    return <Text>读取 package.json...</Text>
  }

  if (phase === 'select') {
    return (
      <Box flexDirection="column">
        <Text>{`当前版本 v${current}. 选择发布类型 (Up/Down + Enter, 或按 1/2/3):`}</Text>
        {KINDS.map((kind, index) => (
          <Text key={kind} color={index === selected ? 'cyan' : undefined}>
            {`${index === selected ? '> ' : '  '}${index + 1}) ${KIND_LABELS[kind]}   v${current} -> v${previews[kind]}`}
          </Text>
        ))}
      </Box>
    )
  }

  if (phase === 'releasing') {
    return <Text>正在创建 commit 和 tag...</Text>
  }

  if (phase === 'confirm' && result) {
    return (
      <Box flexDirection="column">
        <Text color="green">{`已创建提交 ${result.message} 和标签 ${result.tag}`}</Text>
        <Text>是否推送 commit 和 tag 到远端? (y/n, 或 Up/Down + Enter)</Text>
        <Text color={pushSelected === 0 ? 'cyan' : undefined}>
          {`${pushSelected === 0 ? '> ' : '  '}是, 推送到 origin`}
        </Text>
        <Text color={pushSelected === 1 ? 'cyan' : undefined}>
          {`${pushSelected === 1 ? '> ' : '  '}否, 仅保留本地`}
        </Text>
      </Box>
    )
  }

  if (phase === 'pushing') {
    return <Text>正在推送到 origin...</Text>
  }

  if (result) {
    return (
      <Box flexDirection="column">
        <Text color="green">{`完成: v${result.current} -> v${result.next}`}</Text>
        <Text>{`提交: ${result.message}`}</Text>
        <Text>{`标签: ${result.tag}`}</Text>
        {pushed ? (
          <Text color="green">已推送 commit 和 tag 到 origin</Text>
        ) : (
          <Text>{`未推送. 手动推送: git push && git push origin ${result.tag}`}</Text>
        )}
      </Box>
    )
  }

  return null
}

const isDirectRun = (() => {
  const entry = process.argv[1]
  if (entry === undefined) return false
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
})()

if (isDirectRun) {
  render(<ReleaseApp />)
}
