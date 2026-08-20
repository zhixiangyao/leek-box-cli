import { Newline } from 'ink'

import { useRouterStore } from '../stores/useRouterStore.ts'
import TextInput from './TextInput.tsx'

export default function BackToStockList() {
  const routerStore = useRouterStore()

  return (
    <>
      <Newline />
      <TextInput prompt="按 Enter 返回看板..." onSubmit={() => routerStore.goTo('stock-list')} />
    </>
  )
}
