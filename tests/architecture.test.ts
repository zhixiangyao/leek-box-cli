import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test } from 'vitest'

const SOURCE_ROOT = fileURLToPath(new URL('../src/', import.meta.url))

type ImportRef = { file: string; spec: string; typeOnly: boolean }

/** 本地 import 必须带扩展名: .ts / .tsx, 或 JSON 文档 */
const LOCAL_EXTENSION = /\.(ts|tsx|json)$/

const toPosix = (path: string) => path.split(sep).join('/')

const listSourceFiles = async (): Promise<string[]> => {
  const entries = await readdir(SOURCE_ROOT, { recursive: true })
  return entries.filter((entry) => /\.(ts|tsx)$/.test(entry)).map(toPosix)
}

const importsOf = async (file: string): Promise<ImportRef[]> => {
  const content = await readFile(join(SOURCE_ROOT, file), 'utf8')
  const refs: ImportRef[] = []
  const collect = (pattern: RegExp, typeOnly: boolean) => {
    for (const match of content.matchAll(pattern)) refs.push({ file, spec: match[1]!, typeOnly })
  }

  collect(/\bimport\s+type\s+[^'"]*?from\s+['"]([^'"]+)['"]/g, true)
  collect(/\bimport\s+(?!type\b)[^'"]*?from\s+['"]([^'"]+)['"]/g, false)
  collect(/\bimport\s+['"]([^'"]+)['"]/g, false)
  collect(/\bexport\s+[^'"]*?from\s+['"]([^'"]+)['"]/g, false)
  return refs
}

const targetPath = (ref: ImportRef): string | undefined => {
  if (!ref.spec.startsWith('.')) return undefined
  return resolve(dirname(join(SOURCE_ROOT, ref.file)), ref.spec)
}

const isUnder = (path: string, directory: string) => path === directory || path.startsWith(`${directory}${sep}`)

/**
 * 扫描指定源文件, 收集违规描述.
 * include 选出要检查的文件, violation 返回 undefined 表示该 import 合规.
 */
const collectViolations = async (
  include: (file: string) => boolean,
  violation: (ref: ImportRef, target: string | undefined) => string | undefined,
): Promise<string[]> => {
  const violations: string[] = []
  for (const file of await listSourceFiles()) {
    if (!include(file)) continue
    for (const ref of await importsOf(file)) {
      const message = violation(ref, targetPath(ref))
      if (message !== undefined) violations.push(message)
    }
  }
  return violations
}

const importsInto = (directory: string) => (ref: ImportRef, target: string | undefined) =>
  target && isUnder(target, directory) ? `${ref.file} -> ${ref.spec}` : undefined

test('本地 import 显式写 .ts, .tsx 或 .json 后缀', async () => {
  const violations = await collectViolations(
    () => true,
    (ref) => (ref.spec.startsWith('.') && !LOCAL_EXTENSION.test(ref.spec) ? `${ref.file} -> ${ref.spec}` : undefined),
  )

  expect(violations).toStrictEqual([])
})

test('i18n 是叶子层, 只依赖 node 模块与自身', async () => {
  const i18nRoot = join(SOURCE_ROOT, 'i18n')
  const violations = await collectViolations(
    (file) => file.startsWith('i18n/'),
    (ref, target) => {
      if (target && !isUnder(target, i18nRoot)) return `${ref.file} -> ${ref.spec}`
      if (!ref.spec.startsWith('.') && !ref.spec.startsWith('node:')) return `${ref.file} -> ${ref.spec}`
      return undefined
    },
  )

  expect(violations).toStrictEqual([])
})

test('navigation 不依赖 commands', async () => {
  const violations = await collectViolations(
    (file) => file.startsWith('navigation/'),
    importsInto(join(SOURCE_ROOT, 'commands')),
  )

  expect(violations).toStrictEqual([])
})

test('components 不依赖 commands', async () => {
  const violations = await collectViolations(
    (file) => file.startsWith('components/'),
    importsInto(join(SOURCE_ROOT, 'commands')),
  )

  expect(violations).toStrictEqual([])
})

test('lib, settings 与 stores 不引入 React 与 Ink 的运行时依赖', async () => {
  const violations = await collectViolations(
    (file) => /^(lib|settings|stores)\//.test(file),
    (ref) => (!ref.typeOnly && (ref.spec === 'react' || ref.spec === 'ink') ? `${ref.file} -> ${ref.spec}` : undefined),
  )

  expect(violations).toStrictEqual([])
})
