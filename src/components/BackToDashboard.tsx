import { Newline } from 'ink'

import { useRouterStore } from '../stores/useRouterStore.ts'
import TextInput from './TextInput.tsx'

type Props = {
  /** 外部禁用输入 (如菜单弹窗打开时), 默认 true */
  isActive?: boolean
}

export default function BackToDashboard({ isActive = true }: Props) {
  const goTo = useRouterStore((state) => state.goTo)

  return (
    <>
      <Newline />
      <TextInput isActive={isActive} prompt="按 Enter 返回看板..." onSubmit={() => goTo('dashboard')} />
    </>
  )
}
