import { expect, test } from 'vitest'

import ActionResult from '../src/components/ActionResult.tsx'
import { t } from '../src/i18n/core.ts'
import { resetStores } from './helpers/app.tsx'
import { CaptureOutput, plain, renderInk, unmountApp, waitForFrame } from './helpers/ink.tsx'

test('ActionResult 同时渲染提示信息与返回输入框', async () => {
  resetStores()
  const output = new CaptureOutput(50, 5)
  const instance = renderInk(
    <ActionResult tone="success" msg="操作完成" isActive={false} onSubmit={() => undefined} />,
    { output },
  )

  try {
    const frame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes('操作完成'))
    expect(plain(frame)).toContain(t('common.returnPrompt'))
    expect(frame).toContain('\u001B[32m')
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})
