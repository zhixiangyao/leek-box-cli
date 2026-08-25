import { useCallback, useEffect, useRef } from 'react'

type PollingOptions = {
  enabled?: boolean
  intervalMs: number
  restartKey?: unknown
  onError?: (error: unknown) => void
}

type PollingControl = {
  refresh?: () => void
  reschedule?: () => void
}

/**
 * 实例级自调度轮询. intervalMs 表示相邻任务的最小启动间隔. 组件卸载或
 * restartKey 变化时会取消当前请求和定时器, 避免不同页面实例共享状态.
 */
export function usePolling(
  task: (signal: AbortSignal) => Promise<void>,
  { enabled = true, intervalMs, restartKey, onError }: PollingOptions,
) {
  const taskRef = useRef(task)
  const intervalRef = useRef(intervalMs)
  const onErrorRef = useRef(onError)
  const controlRef = useRef<PollingControl>({})

  useEffect(() => {
    taskRef.current = task
    intervalRef.current = intervalMs
    onErrorRef.current = onError
  }, [task, intervalMs, onError])

  const refresh = useCallback(() => controlRef.current.refresh?.(), [])

  useEffect(() => {
    if (!enabled) {
      controlRef.current = {}
      return
    }

    let active = true
    let inFlight = false
    let timer: ReturnType<typeof setTimeout> | undefined = undefined
    let controller: AbortController | undefined = undefined

    const clearTimer = () => {
      if (!timer) return
      clearTimeout(timer)
      timer = undefined
    }

    const schedule = (delayMs = intervalRef.current) => {
      if (!active || inFlight || timer) return
      timer = setTimeout(() => {
        timer = undefined
        startRun()
      }, delayMs)
    }

    const run = async () => {
      if (!active || inFlight) return
      const startedAt = Date.now()
      inFlight = true
      controller = new AbortController()
      const currentController = controller
      try {
        await taskRef.current(currentController.signal)
      } catch (error) {
        if (!currentController.signal.aborted) onErrorRef.current?.(error)
      } finally {
        if (controller === currentController) controller = undefined
        inFlight = false
        schedule(Math.max(0, intervalRef.current - (Date.now() - startedAt)))
      }
    }

    const startRun = () => void run()

    controlRef.current = {
      refresh: () => {
        if (inFlight) return
        clearTimer()
        startRun()
      },
      reschedule: () => {
        if (inFlight) return
        clearTimer()
        schedule()
      },
    }

    startRun()

    return () => {
      active = false
      controlRef.current = {}
      clearTimer()
      controller?.abort()
    }
  }, [enabled, restartKey])

  useEffect(() => {
    controlRef.current.reschedule?.()
  }, [intervalMs])

  return { refresh }
}
