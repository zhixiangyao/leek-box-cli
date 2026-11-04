import { plain } from './ink.tsx'

/** 'YYYY-MM-DD HH:MM:SS' */
export const CLOCK_PATTERN = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/

/** 从渲染帧里取出时钟文本, 没有则返回 undefined */
export const clockIn = (frame: string): string | undefined => plain(frame).match(CLOCK_PATTERN)?.[0]
