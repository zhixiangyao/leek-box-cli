import { PassThrough, Writable } from 'node:stream'
import { setTimeout as delay } from 'node:timers/promises'
import { stripVTControlCharacters } from 'node:util'

import { render, type Instance } from 'ink'
import type { ReactElement } from 'react'

const DEADLINE_MS = 2000

/** 够 Ink 走完一轮 readable -> 按键回调 */
const INPUT_TICK_MS = 10

/** 固定尺寸的输出: 用例断言的就是写进来的帧 */
export class CaptureOutput extends Writable {
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

/** 可写按键的 stdin: Ink 要 setRawMode/ref/unref, PassThrough 本身没有 */
export const createInput = () => {
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

export type TestInput = ReturnType<typeof createInput>

/** 渲染到固定尺寸的输出: 除 debug 外的默认行为一律关掉, 用例只需断言帧 */
export const renderInk = (
  element: ReactElement,
  {
    output,
    input = createInput(),
    interactive = false,
  }: { output: CaptureOutput; input?: TestInput; interactive?: boolean },
): Instance =>
  render(element, {
    stdout: output,
    stdin: input,
    stderr: new PassThrough(),
    debug: true,
    interactive,
    patchConsole: false,
  })

/** 去掉 SGR 序列, 只看可见文本 */
export const plain = (frame: string) => stripVTControlCharacters(frame)

/** 用例收尾: 卸载并等 ink 把最后一帧写完 */
export const unmountApp = async (instance: Instance) => {
  instance.unmount()
  await instance.waitUntilExit()
}

/**
 * 等待 after 之后的某一帧满足条件, 返回那一帧. 取的是最后一帧, 因此一次按键写出的多帧
 * 不会命中按键之前的那一帧.
 */
export const waitForFrame = async (
  output: CaptureOutput,
  after: number,
  predicate: (frame: string) => boolean,
): Promise<string> => {
  const deadline = Date.now() + DEADLINE_MS
  while (Date.now() < deadline) {
    const frame = output.frames.slice(after).findLast(predicate)
    if (frame !== undefined) return frame
    await delay(10)
  }

  throw new Error(`Timed out waiting for frame. Latest output:\n${plain(output.frames.at(-1) ?? '')}`)
}

/** 等待最新一帧满足条件: 只有刚写出的那一帧算数, 旧帧命中过不代表现在也满足 */
export const waitForLatestFrame = async (
  output: CaptureOutput,
  predicate: (frame: string) => boolean,
): Promise<string> => {
  const deadline = Date.now() + DEADLINE_MS
  while (Date.now() < deadline) {
    const frame = output.frames.at(-1)
    if (frame !== undefined && predicate(frame)) return frame
    await delay(10)
  }

  throw new Error(`Timed out waiting for latest frame. Latest output:\n${plain(output.frames.at(-1) ?? '')}`)
}

/**
 * 让 Ink 消化掉已经写进去的按键: 同一 tick 连写的两个按键会被合并成一个 chunk,
 * 多字符输入按粘贴处理, 因此两键序列 (如 gg) 必须分开写, 中间让出一拍.
 */
export const waitForInput = () => delay(INPUT_TICK_MS)

/** 按键只改变 store 状态而没有可断言的帧差异时, 轮询状态直到按键生效 */
export const waitForState = async (check: () => boolean) => {
  const deadline = Date.now() + DEADLINE_MS
  while (Date.now() < deadline) {
    if (check()) return
    await delay(10)
  }

  throw new Error('Timed out waiting for state')
}
