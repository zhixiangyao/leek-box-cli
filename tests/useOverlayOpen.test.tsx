import { Text } from 'ink'
import { test } from 'vitest'

import { useOverlayOpenValue } from '../src/hooks/useOverlayOpen.ts'
import { useDialogConfirmStore } from '../src/stores/useDialogConfirmStore.ts'
import { useDialogMenuStore } from '../src/stores/useDialogMenuStore.ts'
import { useDialogRemoveConfirmStore } from '../src/stores/useDialogRemoveConfirmStore.ts'
import { useDialogStockDetailStore } from '../src/stores/useDialogStockDetailStore.ts'
import { CaptureOutput, plain, renderInk, unmountApp, waitForFrame } from './helpers/ink.tsx'

function Probe() {
  const overlayOpen = useOverlayOpenValue()
  return <Text>{overlayOpen ? 'OPEN' : 'CLOSED'}</Text>
}

const resetOverlays = () => {
  useDialogConfirmStore.setState(useDialogConfirmStore.getInitialState(), true)
  useDialogMenuStore.setState(useDialogMenuStore.getInitialState(), true)
  useDialogRemoveConfirmStore.setState(useDialogRemoveConfirmStore.getInitialState(), true)
  useDialogStockDetailStore.setState(useDialogStockDetailStore.getInitialState(), true)
}

test('useOverlayOpenValue 跟随任意一个浮层 store', async () => {
  resetOverlays()
  const output = new CaptureOutput(20, 3)
  const instance = renderInk(<Probe />, { output })

  const expectOpenThenClosed = async (open: () => void) => {
    const beforeOpen = output.frames.length
    open()
    await waitForFrame(output, beforeOpen, (candidate) => plain(candidate).includes('OPEN'))

    const beforeClose = output.frames.length
    resetOverlays()
    await waitForFrame(output, beforeClose, (candidate) => plain(candidate).includes('CLOSED'))
  }

  try {
    await waitForFrame(output, 0, (candidate) => plain(candidate).includes('CLOSED'))

    await expectOpenThenClosed(() => useDialogMenuStore.setState({ highlightedType: 'stock-list' }))
    await expectOpenThenClosed(() => useDialogStockDetailStore.setState({ code: 'sh600000' }))
    await expectOpenThenClosed(() => useDialogRemoveConfirmStore.setState({ step: { type: 'confirm' } }))
    await expectOpenThenClosed(() =>
      useDialogConfirmStore.setState({
        config: { title: '', content: '', isError: false, confirm: async () => {} },
      }),
    )
  } finally {
    await unmountApp(instance)
    resetOverlays()
  }
})
