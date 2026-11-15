import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Liquid-glass specular light: expose the pointer position (relative to the
// hovered glass surface) as --mx / --my so CSS can paint a moving highlight.
const GLASS = '[class*="rounded-xl"][class*="border-[#E5E1DA]"], section.rs3d, header.lg-header'
let raf = 0
document.addEventListener(
  'pointermove',
  (e) => {
    if (raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      const el = (e.target as Element | null)?.closest?.(GLASS) as HTMLElement | null
      if (!el) return
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${e.clientX - r.left}px`)
      el.style.setProperty('--my', `${e.clientY - r.top}px`)
    })
  },
  { passive: true },
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
