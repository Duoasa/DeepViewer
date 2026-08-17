export function shouldHideWindowOnClose(platform: NodeJS.Platform): boolean {
  return platform === 'darwin'
}

export function shouldQuitWhenAllWindowsClosed(platform: NodeJS.Platform): boolean {
  return platform !== 'darwin'
}
