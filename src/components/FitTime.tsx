import { useLayoutEffect, useRef } from 'react'

/** Size digits to their own cell, including long-hour values and narrow phones. */
export default function FitTime({ children }: { children: string }) {
  const box = useRef<HTMLSpanElement>(null)
  const digits = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const container = box.current!
    const text = digits.current!
    let lastWidth = -1
    let frame = 0
    const resize = () => {
      if (!container.clientWidth) return
      lastWidth = container.clientWidth
      text.style.fontSize = '100px'
      const width = text.getBoundingClientRect().width
      if (width) text.style.fontSize = `${Math.max(1, (container.clientWidth - 2) * 100 / width)}px`
    }
    resize()
    const observer = new ResizeObserver(() => {
      if (container.clientWidth === lastWidth) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(resize)
    })
    observer.observe(container)
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [children])
  return <span className="fit-time" ref={box}><span ref={digits}>{children}</span></span>
}
