import { setTimeout as delay } from 'node:timers/promises'

import { Box } from 'ink'
import { expect, test } from 'vitest'

import TextInput from '../src/components/TextInput.tsx'
import { CaptureOutput, createInput, plain, renderInk, waitForLatestFrame, waitForState } from './helpers/ink.tsx'

const renderInput = (isActive: boolean | undefined, onSubmit: (value: string) => void, placeholder?: string) => {
  const output = new CaptureOutput(60, 6)
  const input = createInput()
  const instance = renderInk(
    <Box width={60} height={6} flexDirection="column">
      <TextInput prompt="code: " placeholder={placeholder} isActive={isActive} onSubmit={onSubmit} />
    </Box>,
    { output, input, interactive: true },
  )
  return { output, input, instance }
}

const press = async (input: ReturnType<typeof createInput>, sequence: string, times = 1) => {
  for (let count = 0; count < times; count += 1) {
    input.write(sequence)
    await delay(14)
  }
}

const type = async (input: ReturnType<typeof createInput>, text: string) => {
  for (const character of text) await press(input, character)
}

test('TextInput: 输入的字符累积到回车时整串提交', async () => {
  const submitted: string[] = []
  const { output, input, instance } = renderInput(true, (value) => submitted.push(value))

  try {
    await waitForLatestFrame(output, (frame) => plain(frame).includes('code: '))
    await type(input, '600000')
    await waitForLatestFrame(output, (frame) => plain(frame).includes('code: 600000█'))

    await press(input, '\r')
    await waitForState(() => submitted.length === 1)
    expect(submitted).toStrictEqual(['600000'])
    expect(plain(output.frames.at(-1) ?? '')).toContain('code: 600000')
    expect(plain(output.frames.at(-1) ?? '')).not.toContain('█')
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
  }
})

test('TextInput: 回车后不再接受输入', async () => {
  const submitted: string[] = []
  const { output, input, instance } = renderInput(true, (value) => submitted.push(value))

  try {
    await waitForLatestFrame(output, (frame) => plain(frame).includes('code: '))
    await type(input, '600000')
    await press(input, '\r')
    await waitForState(() => submitted.length === 1)

    const submittedFrame = plain(output.frames.at(-1) ?? '')
    await type(input, '999')
    await delay(50)
    expect(submitted).toStrictEqual(['600000'])
    expect(plain(output.frames.at(-1) ?? '')).toBe(submittedFrame)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
  }
})

test('TextInput: 省略 isActive 时默认为 true, 仍接受输入', async () => {
  const submitted: string[] = []
  const { output, input, instance } = renderInput(undefined, (value) => submitted.push(value))

  try {
    await waitForLatestFrame(output, (frame) => plain(frame).includes('code: '))
    await type(input, '600000')
    await waitForLatestFrame(output, (frame) => plain(frame).includes('code: 600000█'))
    await press(input, '\r')
    await waitForState(() => submitted.length === 1)
    expect(submitted).toStrictEqual(['600000'])
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
  }
})

test('TextInput: isActive 为 false 时忽略输入', async () => {
  const submitted: string[] = []
  const { output, input, instance } = renderInput(false, (value) => submitted.push(value))

  try {
    await waitForLatestFrame(output, (frame) => plain(frame).includes('code: █'))
    await type(input, '600000')
    await press(input, '\r')
    await delay(50)
    expect(submitted).toStrictEqual([])
    expect(plain(output.frames.at(-1) ?? '')).toContain('code: █')
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
  }
})

test('TextInput: 输入为空时显示 placeholder, 输入后隐藏', async () => {
  const { output, input, instance } = renderInput(true, () => {}, '600000')

  try {
    await waitForLatestFrame(output, (frame) => plain(frame).includes('code: █600000'))
    await press(input, '6')
    await waitForLatestFrame(output, (frame) => plain(frame).includes('code: 6█'))
    expect(plain(output.frames.at(-1) ?? '')).not.toContain('600000')
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
  }
})
