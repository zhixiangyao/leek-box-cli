import { PassThrough, Writable } from 'node:stream'
import { setTimeout as delay } from 'node:timers/promises'
import { stripVTControlCharacters } from 'node:util'

import { Box, render } from 'ink'
import { expect, test } from 'vitest'

import TextInput from '../src/components/TextInput.tsx'

process.env['FORCE_COLOR'] = '1'

class CaptureOutput extends Writable {
  readonly columns: number
  readonly rows: number
  readonly isTTY = true
  readonly frames: string[] = []
  constructor(columns: number, rows: number) {
    super()
    this.columns = columns
    this.rows = rows
  }
  override _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.frames.push(chunk.toString())
    callback()
  }
}

const createInput = () => {
  const input = new PassThrough() as PassThrough & {
    isTTY: boolean
    setRawMode: (mode: boolean) => PassThrough
    ref: () => PassThrough
    unref: () => PassThrough
  }
  input.isTTY = true
  input.setRawMode = () => input
  input.ref = () => input
  input.unref = () => input
  return input
}

const latest = (output: CaptureOutput) => stripVTControlCharacters(output.frames.at(-1) ?? '')

const waitFor = async (check: () => boolean) => {
  const deadline = Date.now() + 2000
  while (Date.now() < deadline) {
    if (check()) return
    await delay(10)
  }
  throw new Error('timed out waiting for expected frame or state')
}

const renderInput = (isActive: boolean | undefined, onSubmit: (value: string) => void, placeholder?: string) => {
  const output = new CaptureOutput(60, 6)
  const input = createInput()
  const instance = render(
    <Box width={60} height={6} flexDirection="column">
      <TextInput prompt="code: " placeholder={placeholder} isActive={isActive} onSubmit={onSubmit} />
    </Box>,
    {
      stdout: output as unknown as NodeJS.WriteStream,
      stdin: input as unknown as NodeJS.ReadStream,
      stderr: new PassThrough() as unknown as NodeJS.WriteStream,
      debug: true,
      interactive: true,
      patchConsole: false,
    },
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
    await waitFor(() => latest(output).includes('code: '))
    await type(input, '600000')
    await waitFor(() => latest(output).includes('code: 600000█'))

    await press(input, '\r')
    await waitFor(() => submitted.length === 1)
    expect(submitted).toStrictEqual(['600000'])
    expect(latest(output)).toContain('code: 600000')
    expect(latest(output)).not.toContain('█')
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
    await waitFor(() => latest(output).includes('code: '))
    await type(input, '600000')
    await press(input, '\r')
    await waitFor(() => submitted.length === 1)

    const submittedFrame = latest(output)
    await type(input, '999')
    await delay(50)
    expect(submitted).toStrictEqual(['600000'])
    expect(latest(output)).toBe(submittedFrame)
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
    await waitFor(() => latest(output).includes('code: '))
    await type(input, '600000')
    await waitFor(() => latest(output).includes('code: 600000█'))
    await press(input, '\r')
    await waitFor(() => submitted.length === 1)
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
    await waitFor(() => latest(output).includes('code: █'))
    await type(input, '600000')
    await press(input, '\r')
    await delay(50)
    expect(submitted).toStrictEqual([])
    expect(latest(output)).toContain('code: █')
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
  }
})

test('TextInput: 输入为空时显示 placeholder, 输入后隐藏', async () => {
  const { output, input, instance } = renderInput(true, () => {}, '600000')

  try {
    await waitFor(() => latest(output).includes('code: █600000'))
    await press(input, '6')
    await waitFor(() => latest(output).includes('code: 6█'))
    expect(latest(output)).not.toContain('600000')
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
  }
})
