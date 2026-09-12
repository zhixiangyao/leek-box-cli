import { type ReactNode } from 'react'

import ActionResult from '../../components/ActionResult.tsx'
import Card from '../../components/Card.tsx'
import StatusBar from '../../components/StatusBar.tsx'
import Text from '../../components/Text.tsx'
import TextInput from '../../components/TextInput.tsx'
import { useOverlayOpen } from '../../hooks/useOverlayOpen.ts'
import { useTheme } from '../../hooks/useTheme.ts'
import { useTranslation } from '../../hooks/useTranslation.ts'
import { formatPrice } from '../../lib/format.ts'
import { isAddResultStep } from '../../stores/useStockAddStore.ts'
import { useStockAdd } from './hooks/useStockAdd.ts'

type Props = {
  title: string
  hint: string
}

export default function StockAdd({ title, hint }: Props) {
  const overlayOpen = useOverlayOpen()
  const theme = useTheme()
  const { t } = useTranslation()
  const { step, codeInput, confirmInput, handleCodeInput, handleConfirm, reset } = useStockAdd()
  let content: ReactNode

  if (isAddResultStep(step)) {
    const tone = step.type === 'already-exists' ? 'warning' : step.type === 'done' ? 'success' : 'error'
    const msg =
      step.type === 'already-exists'
        ? t('stockAdd.alreadyExists', {
            entries: step.entries.map((entry) => `${entry.name} (${entry.code})`).join(', '),
          })
        : step.message
    content = <ActionResult tone={tone} msg={msg} to="stock-add" onReturn={reset} />
  } else {
    switch (step.type) {
      case 'input-code': {
        content = (
          <>
            {codeInput.error && <Text color="red">{codeInput.error}</Text>}
            <TextInput
              key={`code-${codeInput.resetToken}`}
              prompt={t('stockAdd.codePrompt')}
              placeholder={<Text color="gray">{t('stockAdd.codePlaceholder')}</Text>}
              onSubmit={handleCodeInput}
            />
          </>
        )
        break
      }

      case 'checking': {
        content = <Text color="cyan">{t('stockAdd.checking', { codes: step.codes.join(', ') })}</Text>
        break
      }

      case 'confirm': {
        content = (
          <>
            <Text color="cyan">{t('stockAdd.found')}</Text>
            {step.entries.map((entry) => (
              <Text key={entry.code}>
                {t('stockAdd.candidate', {
                  name: entry.name,
                  code: entry.code,
                  price: formatPrice(entry.current),
                })}
              </Text>
            ))}
            {confirmInput.error && <Text color="red">{confirmInput.error}</Text>}
            <TextInput
              key={`confirm-${confirmInput.resetToken}`}
              prompt={t('stockAdd.confirmPrompt')}
              onSubmit={handleConfirm}
            />
          </>
        )
        break
      }

      case 'saving': {
        content = <Text color="cyan">{t('stockAdd.saving', { count: step.entries.length })}</Text>
        break
      }
    }
  }

  return (
    <Card
      fullScreen
      bright={!overlayOpen.open}
      title={<Text color={theme.primary}>{title}</Text>}
      footer={<StatusBar showClock hint={hint} bright={!overlayOpen.open} />}
    >
      {content}
    </Card>
  )
}
