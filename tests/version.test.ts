import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { expect, test } from 'vitest'

import { APP_NAME, APP_VERSION } from '../src/lib/version.ts'

test('应用名与版本号取自 package.json', async () => {
  const packageJson = JSON.parse(
    await readFile(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
  ) as { name: string; version: string }

  expect(APP_NAME).toBe(packageJson.name)
  expect(APP_VERSION).toBe(packageJson.version)
})
