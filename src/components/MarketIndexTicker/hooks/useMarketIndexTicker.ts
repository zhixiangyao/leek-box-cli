import { useEffect, useState } from 'react'

import type { Quote } from '../../../api/types.ts'
import type { Row } from '../../../lib/quoteTable.ts'
import { useSettingsStore } from '../../../stores/useSettingsStore.ts'
import { INDEX_FRAME_MS, INDEX_SWITCH_MS, INDEX_TRANSITION_MS, indexSegments, typewriterSegments } from '../lib.ts'

const FRAME_COUNT = Math.round(INDEX_TRANSITION_MS / INDEX_FRAME_MS)

export function useMarketIndexTicker(indices: Quote[]): Row {
  const trendColorMode = useSettingsStore((state) => state.trendColorMode)
  const [active, setActive] = useState(0)
  const [frame, setFrame] = useState(FRAME_COUNT)
  const total = indices.length

  useEffect(() => {
    if (total <= 1) return
    const timer = setInterval(() => {
      // 换指数并回到第 0 帧, 由下面的帧定时器重新写出来
      setActive((current) => (current + 1) % total)
      setFrame(0)
    }, INDEX_SWITCH_MS)
    return () => clearInterval(timer)
  }, [total])

  const typing = frame < FRAME_COUNT
  useEffect(() => {
    if (!typing) return
    // 只在过渡中挂帧定时器, 走满即随 typing 变化卸载
    const timer = setInterval(() => setFrame((current) => Math.min(FRAME_COUNT, current + 1)), INDEX_FRAME_MS)
    return () => clearInterval(timer)
  }, [typing])

  // 指数可能没全返回 (停牌或响应不全), 按当前条数取模而不是按代码
  const quote = indices[active % total]
  if (quote === undefined) return []

  return typewriterSegments(indexSegments(quote, trendColorMode), frame / FRAME_COUNT)
}
