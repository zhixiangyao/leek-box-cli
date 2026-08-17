import { Newline } from 'ink'

import TextInput from './TextInput.tsx'

type Props = {
  onBack: () => void
  /** 外部禁用输入 (如菜单弹窗打开时), 默认 true */
  isActive?: boolean
}

export default function BackToDashboard({ onBack, isActive = true }: Props) {
  return (
    <>
      <Newline />
      <TextInput isActive={isActive} prompt="按 Enter 返回看板..." onSubmit={onBack} />
    </>
  )
}
