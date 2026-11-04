import { Box } from 'ink'
import { expect, test } from 'vitest'

import CardCorner from '../src/components/CardCorner.tsx'
import Text from '../src/components/Text.tsx'
import { resetStores } from './helpers/app.tsx'
import { CaptureOutput, plain, renderInk, unmountApp, waitForFrame } from './helpers/ink.tsx'

test('CardCorner 在内容两侧各渲染一个管道符', async () => {
  resetStores()
  const output = new CaptureOutput(30, 5)
  const instance = renderInk(
    <Box width={20} height={3} flexDirection="column">
      <CardCorner top={0} left={0}>
        <Text>corner-content</Text>
      </CardCorner>
    </Box>,
    { output },
  )

  try {
    const frame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes('corner-content'))
    expect(plain(frame)).toContain('|corner-content|')
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})
