import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  configureDevelopmentProfile,
  DEEPVIEWER_DEVELOPMENT_APP_NAME,
  resolveDevelopmentUserDataPath,
  shouldUseDevelopmentProfile,
} from '../src/main/development-profile.js'

// @ts-expect-error The checked JavaScript development helper has no declaration file.
const { developmentControlSocketPath, shouldRestartForDevelopmentPath } = await import('../scripts/dev.mjs')

const appRoot = resolve(import.meta.dirname, '..')
const projectRoot = resolve(appRoot, '..', '..')
const rootManifest = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'))
const appManifest = JSON.parse(readFileSync(resolve(appRoot, 'package.json'), 'utf8'))
const devScript = readFileSync(resolve(appRoot, 'scripts/dev.mjs'), 'utf8')
const packageScript = readFileSync(resolve(appRoot, 'scripts/package.mjs'), 'utf8')
const wordmarkOverride = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-primitives/BrandWordmark.tsx'),
  'utf8',
)
const emptyHeroBrandingOverride = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-conversation/HideEmptyHeroBranding.module.css'),
  'utf8',
)
const heroShellOverride = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-conversation/HeroShell.tsx.fragment'),
  'utf8',
)
const heroWelcomeSeatOverride = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-conversation/HeroWelcomeSeat.tsx.fragment'),
  'utf8',
)
const heroHeadlineZh = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-conversation/HeroHeadline.zh.fragment'),
  'utf8',
)
const heroHeadlineEn = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-conversation/HeroHeadline.en.fragment'),
  'utf8',
)
const emptyComposerPositionOverride = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-conversation/BottomAlignEmptyComposer.module.css'),
  'utf8',
)
const stableComposerFooterFragment = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-conversation/StableComposerFooter.tsx.fragment'),
  'utf8',
)
const stableComposerFooterStyles = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-conversation/StableComposerFooter.module.css'),
  'utf8',
)
const desktopSafeAreaStyles = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-layout/DesktopSafeAreas.module.css'),
  'utf8',
)
const centerColumnOverride = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-layout/CenterColumn.tsx.fragment'),
  'utf8',
)
const sidebarSafeAreaOverride = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-layout/SidebarSafeArea.tsx.fragment'),
  'utf8',
)
const upstreamOverrideSync = readFileSync(resolve(appRoot, 'scripts/sync-upstream-overrides.mjs'), 'utf8')

describe('DeepViewer local development workflow (DV-0008)', () => {
  it('isolates development and preview user data without changing the stable profile', () => {
    expect(DEEPVIEWER_DEVELOPMENT_APP_NAME).toBe('DeepViewer Dev')
    expect(shouldUseDevelopmentProfile('DeepViewer', undefined)).toBe(false)
    expect(shouldUseDevelopmentProfile('DeepViewer', 'development')).toBe(true)
    expect(shouldUseDevelopmentProfile('DeepViewer Dev', undefined)).toBe(true)
    expect(resolveDevelopmentUserDataPath('/Library/Application Support'))
      .toBe('/Library/Application Support/DeepViewer Dev')

    const setPath = vi.fn()
    const developmentApp = {
      getName: () => 'DeepViewer',
      getPath: (_name: 'appData') => '/Users/test/Library/Application Support',
      setPath,
    }
    expect(configureDevelopmentProfile(developmentApp, { DEEPVIEWER_PROFILE: 'development' }))
      .toBe(true)
    expect(setPath).toHaveBeenCalledWith(
      'userData',
      '/Users/test/Library/Application Support/DeepViewer Dev',
    )

    setPath.mockClear()
    expect(configureDevelopmentProfile(developmentApp, {})).toBe(false)
    expect(setPath).not.toHaveBeenCalled()
  })

  it('watches only source and build configuration inputs', () => {
    expect(shouldRestartForDevelopmentPath('src/main/main.ts')).toBe(true)
    expect(shouldRestartForDevelopmentPath('vite.main.config.ts')).toBe(true)
    expect(shouldRestartForDevelopmentPath('package.json')).toBe(true)
    expect(shouldRestartForDevelopmentPath('.desktop/build/main.js')).toBe(false)
    expect(shouldRestartForDevelopmentPath('out/DeepViewer.app')).toBe(false)
  })

  it('uses a project-specific runner socket and never kills by process name', () => {
    expect(developmentControlSocketPath('/tmp/deepviewer-a'))
      .not.toBe(developmentControlSocketPath('/tmp/deepviewer-b'))
    expect(devScript).not.toContain('killall')
    expect(devScript).not.toContain('notarize')
    expect(devScript).not.toContain('package.mjs')
  })

  it('exposes explicit development, preview, and release tiers', () => {
    expect(rootManifest.scripts['desktop:dev']).toBe('pnpm --filter @deepviewer/desktop dev')
    expect(rootManifest.scripts['desktop:dev:restart']).toBe('pnpm --filter @deepviewer/desktop dev:restart')
    expect(rootManifest.scripts['desktop:preview']).toBe('pnpm --filter @deepviewer/desktop preview')
    expect(rootManifest.scripts['desktop:release']).toBe('pnpm --filter @deepviewer/desktop release')

    expect(appManifest.scripts.preview).toContain('package.mjs --preview')
    expect(appManifest.scripts.dev).toContain('sync-upstream-overrides.mjs --build')
    expect(appManifest.scripts.preview).toContain('sync-upstream-overrides.mjs --build')
    expect(appManifest.scripts.release).toContain('sync-upstream-overrides.mjs --build')
    expect(appManifest.scripts.preview).not.toContain('runtime')
    expect(appManifest.scripts.preview).not.toContain('notarize')
    expect(appManifest.scripts.release).toContain('pnpm run runtime')
    expect(appManifest.scripts.release).toContain('package.mjs --sign')
    expect(appManifest.scripts.release).toContain('notarize.mjs')
    expect(appManifest.scripts.release).not.toContain('upload')
    expect(appManifest.scripts.release).not.toContain('github')
  })

  it('keeps the DeepViewer sidebar wordmark as a tracked inline React SVG override', () => {
    expect(wordmarkOverride).toContain('export function BrandWordmark')
    expect(wordmarkOverride).toContain('size = 20')
    expect(wordmarkOverride).toContain('width={(size * 623) / 127}')
    expect(wordmarkOverride).toContain('viewBox="0 0 623 127"')
    expect(wordmarkOverride.match(/<path\b/gu)).toHaveLength(10)
    expect(wordmarkOverride.match(/fill="currentColor"/gu)).toHaveLength(10)
    expect(wordmarkOverride).not.toContain('fill="white"')
    expect(wordmarkOverride).not.toContain('<filter')
    expect(wordmarkOverride).not.toContain('filter=')
    expect(wordmarkOverride).not.toContain('<image')
    expect(wordmarkOverride).not.toContain('<text')
    expect(upstreamOverrideSync).toContain("'BrandWordmark.tsx'")
    expect(upstreamOverrideSync).toContain("['run', 'build:lib:client']")
    expect(upstreamOverrideSync).toContain("['run', 'build:web']")
  })

  it('keeps the empty composer aligned near the viewport floor', () => {
    expect(emptyHeroBrandingOverride).toContain('.root')
    expect(emptyComposerPositionOverride).toContain(".root[data-phase='hero'] .scrollBody")
    expect(emptyComposerPositionOverride).toContain('justify-content: flex-start')
    expect(emptyComposerPositionOverride).toContain(".root[data-phase='hero'] .composerSeat")
    expect(emptyComposerPositionOverride).toContain('margin-top: auto')
    expect(emptyComposerPositionOverride).toContain('--deepviewer-composer-bottom-offset: 32px')
    expect(emptyComposerPositionOverride).toContain('.composerHero')
    expect(emptyComposerPositionOverride).toContain('padding-bottom: var(--deepviewer-composer-bottom-offset)')
    expect(emptyComposerPositionOverride).toContain('.heroGlow')
    expect(emptyComposerPositionOverride).toContain('display: none')
    expect(upstreamOverrideSync).toContain("'hide-empty-hero-branding'")
    expect(upstreamOverrideSync).toContain("'bottom-align-empty-composer'")
  })

  it('renders a localized animated welcome in the space above the empty composer', () => {
    expect(heroShellOverride).toContain('viewBox="0 0 150.374 160"')
    expect(heroShellOverride.match(/<path\b/gu)).toHaveLength(2)
    expect(heroShellOverride).toContain('className={css.logoCursor}')
    expect(heroShellOverride).toContain("t('hero.headline')")
    expect(heroWelcomeSeatOverride).toContain('hero && <HeroShell')
    expect(emptyHeroBrandingOverride).toContain('position: absolute')
    expect(emptyHeroBrandingOverride).toContain('inset: 0')
    expect(emptyHeroBrandingOverride).toContain('height: 48px')
    expect(emptyHeroBrandingOverride).toContain('opacity: 0.5')
    expect(emptyHeroBrandingOverride).toContain('gap: 40px')
    expect(emptyHeroBrandingOverride).toContain('deepviewer-hero-cursor-blink 1s steps(1, jump-end)')
    expect(emptyHeroBrandingOverride).toContain('prefers-reduced-motion: reduce')
    expect(emptyComposerPositionOverride).toContain('position: relative')
    expect(heroHeadlineZh).toContain("'hero.headline': '让我们做点什么'")
    expect(heroHeadlineEn).toContain("'hero.headline': 'What shall we build?'")
    expect(upstreamOverrideSync).toContain("'deepviewer-hero-shell'")
    expect(upstreamOverrideSync).toContain("'deepviewer-hero-scroll-seat'")
  })

  it('keeps a layout-neutral active composer footer seat for desktop chrome', () => {
    expect(stableComposerFooterFragment).toContain("variant === 'composer'")
    expect(stableComposerFooterFragment).toContain('data-composer-footer')
    expect(stableComposerFooterStyles).toContain('.root:not(.hero)')
    expect(stableComposerFooterStyles).toContain('var(--deepviewer-composer-bottom-offset, 32px)')
    expect(stableComposerFooterStyles).toContain('display: contents')
    expect(stableComposerFooterStyles).not.toContain('min-height: 24px')
    expect(upstreamOverrideSync).toContain("'stable-composer-footer-seat'")
    expect(upstreamOverrideSync).toContain("'stable-composer-footer-height'")
  })

  it('tracks macOS safe areas as structural rows inside the AppFrame columns', () => {
    expect(desktopSafeAreaStyles).toContain('.desktopSafeArea')
    expect(desktopSafeAreaStyles).toContain('.centerBody')
    expect(centerColumnOverride).toContain('data-deepviewer-macos-main-safe-area')
    expect(centerColumnOverride).toContain('deepviewer-macos-session-stats')
    expect(sidebarSafeAreaOverride).toContain('data-deepviewer-macos-sidebar-safe-area')
    expect(sidebarSafeAreaOverride).toContain('deepviewer-macos-sidebar-toggle-host')
    expect(upstreamOverrideSync).toContain("'structural-main-safe-area'")
    expect(upstreamOverrideSync).toContain("'structural-sidebar-safe-area'")
  })

  it('ends preview packaging before DMG creation and uses development identity', () => {
    const previewExit = packageScript.indexOf('if (isPreview) {')
    const dmgCreation = packageScript.indexOf("await run('hdiutil'")
    expect(previewExit).toBeGreaterThan(-1)
    expect(packageScript.indexOf('continue', previewExit)).toBeLessThan(dmgCreation)
    expect(packageScript).toContain("'com.deepviewer.desktop.dev'")
    expect(packageScript).toContain("const previewStagingRoot = resolve(outputRoot, '.preview-staging')")
    expect(packageScript).toContain('expectedAppName: `${packagedName}.app`')
  })
})
