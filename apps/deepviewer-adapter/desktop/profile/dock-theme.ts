import { join } from 'node:path'

interface ThemeSource {
  readonly shouldUseDarkColors: boolean
  on(event: 'updated', listener: () => void): unknown
  removeListener(event: 'updated', listener: () => void): unknown
}

// nativeTheme resolves light/dark/system from the existing renderer theme IPC.
// These PNGs are extracted from Apple's compiled ICNS, not full-bleed artwork.
export function followDockTheme<Image extends { isEmpty(): boolean }>(options: {
  theme: ThemeSource
  resourcesPath: string
  loadImage(path: string): Image
  setIcon(image: Image): void
  log(message: string): void
  onError(message: string): void
}): () => void {
  const images = new Map<string, Image>()
  let applied: string | undefined
  const update = () => {
    const appearance = options.theme.shouldUseDarkColors ? 'dark' : 'light'
    if (applied === appearance) return
    try {
      let image = images.get(appearance)
      if (!image) {
        image = options.loadImage(join(options.resourcesPath, 'DeepViewerDockThemes', `${appearance}.png`))
        if (image.isEmpty()) throw new Error(`Missing native Dock rendition: ${appearance}`)
        images.set(appearance, image)
      }
      options.setIcon(image)
      applied = appearance
      options.log(`appearance=${appearance}`)
    } catch (error) {
      options.onError(error instanceof Error ? error.message : String(error))
    }
  }
  options.theme.on('updated', update)
  update()
  return () => options.theme.removeListener('updated', update)
}
