import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Render children at the document root, outside ancestor layout and animation contexts. */
export function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body)
}
