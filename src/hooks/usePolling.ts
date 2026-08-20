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
 * 实例级自调度轮询. 每轮任务结束后才开始计时, 组件卸载或 restartKey
 * 变化时会取消当前请求和定时器, 避免不同页面实例共享生命周期状态.
 */
export function usePolling(
  task: (signal: AbortSignal) => Promise<void>,
  { enabled = true, intervalMs, restartKey, onError }: PollingOptions,
) {
  const taskRef = useRef(task)
  const intervalRef = useRef(intervalMs)
  const onErrorRef = useRef(onError)
  const controlRef = useRef<PollingControl>({})

  taskRef.current = task
  intervalRef.current = intervalMs
  onErrorRef.current = onError

  const refresh = useCallback(() => controlRef.current.refresh?.(), [])

  useEffect(() => {
    if (!enabled) {
      controlRef.current = {}
      return
    }

    let active = true
    let inFlight = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let controller: AbortController | null = null

    const clearTimer = () => {
      if (!timer) return
      clearTimeout(timer)
      timer = null
    }

    const schedule = () => {
      if (!active || inFlight || timer) return
      timer = setTimeout(() => {
        timer = null
        startRun()
      }, intervalRef.current)
    }

    const run = async () => {
      if (!active || inFlight) return
      inFlight = true
      controller = new AbortController()
      const currentController = controller
      try {
        await taskRef.current(currentController.signal)
      } catch (error) {
        if (!currentController.signal.aborted) onErrorRef.current?.(error)
      } finally {
        if (controller === currentController) controller = null
        inFlight = false
        schedule()
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
