import type { ThreadToastMessage } from '~/types/thread'

let dismissTimeout: ReturnType<typeof setTimeout> | undefined

export function useThreadToast() {
  const toast = useState<ThreadToastMessage | null>('thread-toast', () => null)
  const sequence = useState<number>('thread-toast-sequence', () => 0)
  function showToast(message: string) {
    sequence.value += 1
    toast.value = { id: sequence.value, message }
    if (dismissTimeout) clearTimeout(dismissTimeout)
    dismissTimeout = setTimeout(() => {
      toast.value = null
    }, 3600)
  }

  function dismissToast() {
    if (dismissTimeout) clearTimeout(dismissTimeout)
    toast.value = null
  }

  return { toast, showToast, dismissToast }
}
