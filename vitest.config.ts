import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    isolate: true,
    // 必须在任何模块加载前生效: chalk 在模块求值时就读定了颜色档位, 测试文件里再设 (或写在 helper 里) 都太迟,
    // 断言反显 (选中行) 与 dim (浮层压住的底层) 这类 SGR 序列的用例会一个序列都收不到
    env: { FORCE_COLOR: '1' },
    // 与生产入口一致: 测试直接 import 源文件, 不经过 main, 缺少 getOrInsertComputed 的运行时
    // 会在 WindowSizeGuard 的模块顶层求值时就抛错
    setupFiles: ['./src/lib/polyfill.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      // 基线略低于当前实测值, 给不可达分支留一点余量; 明显回落时 CI 会失败
      thresholds: {
        statements: 93,
        branches: 86,
        functions: 96,
        lines: 94,
      },
    },
  },
})
