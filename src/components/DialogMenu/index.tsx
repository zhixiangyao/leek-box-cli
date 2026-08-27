import { useTheme } from '../../hooks/useTheme.ts'
import Dialog from '../Dialog.tsx'
import Text from '../Text.tsx'
import { useDialogMenu } from './hooks/useDialogMenu.ts'

export default function DialogMenu() {
  const { highlight, width, menuItems } = useDialogMenu()
  const theme = useTheme()

  return (
    <Dialog
      title={
        <Text bright color={theme.primary}>
          菜单
        </Text>
      }
      width={width}
    >
      {menuItems.map((item, index) => (
        <Text
          bright
          key={item.label}
          color={index === highlight ? 'black' : undefined}
          backgroundColor={index === highlight ? theme.highlight : undefined}
        >
          {index === highlight ? '> ' : '  '}
          {item.label}
        </Text>
      ))}
    </Dialog>
  )
}
