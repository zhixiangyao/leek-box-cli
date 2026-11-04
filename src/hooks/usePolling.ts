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

type PollingRuntime = {
  active: boolean
  inFlight: boolean
  timer: ReturnType<typeof setTimeout> | undefined
  controller: AbortController | undefined
}

/**
 * 实例级自调度轮询: 挂载后立即执行一次, 之后按 intervalMs (相邻任务的
 * 最小启动间隔) 排程; 组件卸载或 restartKey 变化时取消当前请求与定时器.
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

    const runtime: PollingRuntime = {
      active: true,
      inFlight: false,
      timer: undefined,
      controller: undefined,
    }

    const clearTimer = () => {
      if (!runtime.timer) return
      clearTimeout(runtime.timer)
      runtime.timer = undefined
    }

    const schedule = (delayMs = intervalRef.current) => {
      if (!runtime.active || runtime.inFlight || runtime.timer) return
      runtime.timer = setTimeout(() => {
        runtime.timer = undefined
        startRun()
      }, delayMs)
    }

    const run = async () => {
      if (!runtime.active || runtime.inFlight) return
      const startedAt = Date.now()
      runtime.inFlight = true
      runtime.controller = new AbortController()
      const currentController = runtime.controller
      try {
        await taskRef.current(currentController.signal)
      } catch (error) {
        if (!currentController.signal.aborted) onErrorRef.current?.(error)
      } finally {
        if (runtime.controller === currentController) runtime.controller = undefined
        runtime.inFlight = false
        schedule(Math.max(0, intervalRef.current - (Date.now() - startedAt)))
      }
    }

    const startRun = () => void run()

    controlRef.current = {
      refresh: () => {
        if (runtime.inFlight) return
        clearTimer()
        startRun()
      },
      reschedule: () => {
        if (runtime.inFlight) return
        clearTimer()
        schedule()
      },
    }

    startRun()

    return () => {
      runtime.active = false
      controlRef.current = {}
      clearTimer()
      runtime.controller?.abort()
    }
  }, [enabled, restartKey])

  useEffect(() => {
    controlRef.current.reschedule?.()
  }, [intervalMs])

  return { refresh }
}
