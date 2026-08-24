import { useTheme } from '../../hooks/useTheme.ts'
import Dialog from '../Dialog.tsx'
import Text from '../Text.tsx'
import { useMenuDialog } from './hooks/useMenuDialog.ts'

export default function MenuDialog() {
  const { highlight, width, menuItems } = useMenuDialog()
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
