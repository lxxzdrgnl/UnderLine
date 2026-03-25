import { useEffect, type RefObject } from 'react'

/**
 * Calls onDismiss when user clicks outside `ref` element or presses Escape.
 */
export function useModalDismiss(
  ref: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [ref, onDismiss, enabled])
}
