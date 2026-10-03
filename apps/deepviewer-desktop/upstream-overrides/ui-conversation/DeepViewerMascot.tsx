import { useEffect, useRef, useState } from 'react'
import { createMascotRenderer } from './mascot-motion.ts'
import css from './HeroShell.module.css'

export function DeepViewerMascot() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !window.matchMedia) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const image = new Image()
    let disposed = false
    let renderer: ReturnType<typeof createMascotRenderer> = null
    let frame = 0
    let lastTime = 0
    let elapsed = 0
    let inView = true
    const stop = () => {
      cancelAnimationFrame(frame)
      frame = 0
      lastTime = 0
    }
    const tick = (time: number) => {
      if (!renderer || disposed) return
      if (lastTime) elapsed += Math.min(time - lastTime, 50)
      lastTime = time
      renderer.draw(elapsed / 1000)
      frame = requestAnimationFrame(tick)
    }
    const sync = () => {
      stop()
      if (disposed) return
      if (motion.matches) {
        setReady(false)
        return
      }
      if (!renderer && image.complete && image.naturalWidth) renderer = createMascotRenderer(canvas, image)
      if (!renderer) return
      renderer.draw(elapsed / 1000)
      setReady(true)
      if (!document.hidden && inView) frame = requestAnimationFrame(tick)
    }
    const contextLost = (event: Event) => {
      event.preventDefault()
      stop()
      renderer?.dispose()
      renderer = null
      setReady(false)
    }
    const observer = new IntersectionObserver(entries => {
      inView = entries[0]?.isIntersecting ?? true
      sync()
    })
    observer.observe(canvas)
    motion.addEventListener('change', sync)
    document.addEventListener('visibilitychange', sync)
    canvas.addEventListener('webglcontextlost', contextLost)
    canvas.addEventListener('webglcontextrestored', sync)
    image.onload = sync
    image.src = '/deepviewer-mascot.png'
    return () => {
      disposed = true
      stop()
      observer.disconnect()
      image.onload = null
      motion.removeEventListener('change', sync)
      document.removeEventListener('visibilitychange', sync)
      canvas.removeEventListener('webglcontextlost', contextLost)
      canvas.removeEventListener('webglcontextrestored', sync)
      renderer?.dispose()
    }
  }, [])
  return (
    <div className={css.avatar} aria-hidden="true" data-motion-ready={ready}>
      <img className={css.mascotStill} src="/deepviewer-mascot.png" alt="" draggable={false} />
      <canvas ref={canvasRef} className={css.mascotCanvas} width={360} height={360} />
    </div>
  )
}
