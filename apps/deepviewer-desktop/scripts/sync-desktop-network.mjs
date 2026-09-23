import { readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export function syncDesktopNetwork(upstreamRoot) {
  const web = resolve(upstreamRoot, 'packages/web/web-fetch-http/src')
  const search = resolve(upstreamRoot, 'packages/web/web-search-deepseek/src')
  copyFileSync(resolve(appRoot, 'upstream-overrides/network/desktop-network.ts'), resolve(web, 'desktop-network.ts'))
  copyFileSync(resolve(appRoot, 'upstream-overrides/network/search-network-error.ts'), resolve(search, 'search-network-error.ts'))
  function patch(path, before, after) {
    const source = readFileSync(path, 'utf8')
    if (source.includes(after)) return
    if (!source.includes(before)) throw new Error(`Desktop network patch anchor missing: ${path}`)
    writeFileSync(path, source.replace(before, after))
  }
  const provider = resolve(web, 'provider.ts')
  patch(provider, "import { WebError }", "import { desktopBridgeUrl, requestDesktop } from './desktop-network.ts'\nimport { WebError }")
  patch(provider, 'if (!isSameOrigin(validatedTarget, currentUrl)) {', 'if (!isSameOrigin(validatedTarget, currentUrl) && !desktopBridgeUrl(this.desktopBridge)) {')
  // Upgrade the earlier local staging layout, then keep abort/timeout translation shared.
  const staged = readFileSync(provider, 'utf8')
  const early = 'private async requestOnce(url: URL, signal: AbortSignal) {\n    const desktop = await requestDesktop(url, signal, this.desktopBridge)\n    if (desktop) return desktop'
  if (staged.includes(early)) writeFileSync(provider, staged.replace(early, 'private async requestOnce(url: URL, signal: AbortSignal) {'))
  patch(provider, '    try {\n      // A proxied hop', '    try {\n      const desktop = await requestDesktop(url, signal, this.desktopBridge)\n      if (desktop) return desktop\n      // A proxied hop')
  patch(provider, 'private readonly resolveAddresses: HttpFetchResolver = publicHttpNetwork.resolve,', 'private readonly resolveAddresses: HttpFetchResolver = publicHttpNetwork.resolve,\n    private readonly desktopBridge?: string,')
  patch(resolve(web, 'index.ts'), 'ctx.web.registerFetchProvider(new HttpFetchProvider(limits))', `// Only the original launch process may supply the desktop capability; project .env cannot opt in.
  const environment = ctx.get('launchEnvironment') as { getFrom(name: string, sources: readonly string[]): { value: string } | undefined } | undefined
  const desktopBridge = environment?.getFrom('DEEPVIEWER_WEB_BRIDGE', ['process'])?.value
  ctx.web.registerFetchProvider(new HttpFetchProvider(limits, undefined, desktopBridge))`)
  const searchProvider = resolve(search, 'provider.ts')
  patch(searchProvider, "import { WebError }", "import { searchNetworkError } from './search-network-error.ts'\nimport { WebError }")
  patch(searchProvider, '${String(error)}`', '${searchNetworkError(error)}`')
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  syncDesktopNetwork(resolve(appRoot, '../..', 'upstream/deepseek-harness'))
}
