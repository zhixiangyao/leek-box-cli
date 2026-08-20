import Dialog from '../Dialog.tsx'
import Text from '../Text.tsx'
import { useMenuDialog } from './hooks/useMenuDialog.ts'

export default function MenuDialog() {
  const { highlight, width, menuItems } = useMenuDialog()

  return (
    <Dialog
      title={
        <Text bright color="magenta">
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
          backgroundColor={index === highlight ? 'cyan' : undefined}
        >
          {index === highlight ? '> ' : '  '}
          {item.label}
        </Text>
      ))}
    </Dialog>
  )
}
