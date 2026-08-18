import { chmodSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { resolve } from 'node:path'

import { defineConfig } from 'vite'

const outDir = 'dist'
const outFileName = 'cli.mjs'

export default defineConfig({
  resolve: {
    /**
     * vite 默认 conditions 为 ['module', 'browser', 'development|production'].
     * chalk 的 vendor supports-color 只有 node 和 default 两个导出, 不含 browser,
     * 默认条件下会选中 default (browser 版), 其用 navigator.userAgent 检测终端,
     * 在 Node 下颜色级别恒为 0, 产物颜色全部丢失.
     * 把 browser 换成 node 即可命中 node 导出.
     */
    conditions: ['module', 'node', 'development|production'],
  },
  input: resolve(import.meta.dirname, 'src/cli.tsx'),
  build: {
    outDir,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      platform: 'node',
      output: {
        entryFileNames: outFileName,
        postBanner: ['#!/usr/bin/env node'].join('\n'),
        codeSplitting: false,
        comments: false,
      },
      external: (id) => id.startsWith('node:') || builtinModules.includes(id),
    },
  },
  plugins: [
    {
      name: 'make-executable',
      closeBundle() {
        chmodSync(`${outDir}/${outFileName}`, 0o755)
      },
    },
  ],
})
