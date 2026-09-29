import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    reporters: 'verbose',
    // 必须在任何模块加载前生效: chalk 在模块求值时就读定了颜色档位, 测试文件里再设 (或写在 helper 里) 都太迟,
    // 断言反显 (选中行) 与 dim (浮层压住的底层) 这类 SGR 序列的用例会一个序列都收不到
    env: { FORCE_COLOR: '1' },
  },
})
