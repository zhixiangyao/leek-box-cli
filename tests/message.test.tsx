import { expect, test } from 'vitest'

import Message, { type MessageTone } from '../src/components/Message.tsx'
import { resetStores } from './helpers/app.tsx'
import { CaptureOutput, plain, renderInk, unmountApp, waitForFrame } from './helpers/ink.tsx'

const TONE_COLOR: Record<MessageTone, string> = { error: '31', warning: '33', success: '32' }

test('Message 按 tone 渲染文本与语义色', async () => {
  for (const tone of ['error', 'warning', 'success'] as const) {
    resetStores()
    const output = new CaptureOutput(40, 5)
    const instance = renderInk(<Message tone={tone} msg={`${tone}-message`} />, { output })

    try {
      const frame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes(`${tone}-message`))
      expect(frame).toContain(`\u001B[${TONE_COLOR[tone]}m`)
    } finally {
      await unmountApp(instance)
      resetStores()
    }
  }
})
