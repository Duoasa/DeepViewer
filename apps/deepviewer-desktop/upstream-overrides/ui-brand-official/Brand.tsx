import type { SidebarBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'

type DeepViewerBrandMarkProps = SidebarBrandMarkOwnerProps & { className?: string }

/** Render the application icon in the existing sidebar brand slot. */
export function OfficialBrandMark({ size, className }: DeepViewerBrandMarkProps) {
  return <img src="/deepviewer-icon.png" width={size} height={size} className={className} alt="" aria-hidden="true" draggable={false} />
}

/** Render the locale-independent product name. */
export function OfficialBrandName() {
  return <span>DeepViewer</span>
}
