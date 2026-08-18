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
const sidebarWordmarkLayoutOverride = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-sidebar/BrandWordmark.module.css'),
  'utf8',
)
const portalOverride = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-primitives/Portal.tsx'),
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
const disableAutoCollapseImport = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-layout/DisableAutoCollapseImport.ts.fragment'),
  'utf8',
)
const disableAutoCollapse = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-layout/DisableAutoCollapse.ts.fragment'),
  'utf8',
)
const previewClientEntry = readFileSync(
  resolve(appRoot, 'dsh-plugins/preview/src/client/index.tsx'),
  'utf8',
)
const previewPanelSource = readFileSync(
  resolve(appRoot, 'dsh-plugins/preview/src/client/PreviewPanel.tsx'),
  'utf8',
)
const previewPanelStyles = readFileSync(
  resolve(appRoot, 'dsh-plugins/preview/src/client/PreviewPanel.module.css'),
  'utf8',
)
const previewExternalLinkIcon = readFileSync(
  resolve(appRoot, 'dsh-plugins/preview/src/client/ExternalLinkIcon.tsx'),
  'utf8',
)
const previewFileRouter = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-primitives/DeepViewerPreviewFile.ts'),
  'utf8',
)
const toolRowPreviewOpen = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-tool/ToolRowOpenFile.ts.fragment'),
  'utf8',
)
const producedFilesButton = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-deliverables/ProducedFilesButton.tsx.fragment'),
  'utf8',
)
const producedFileMention = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-deliverables/MentionsNativeTitle.ts.fragment'),
  'utf8',
)
const detailsPanelStyles = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-conversation/DetailsPanel.module.css'),
  'utf8',
)
const detailsPanelSource = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-conversation/DetailsPanel.tsx'),
  'utf8',
)
const detailsLayoutStyles = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-layout/DesktopSafeAreas.module.css'),
  'utf8',
)
const detailsGeometry = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-layout/DetailsPreviewGeometry.ts.fragment'),
  'utf8',
)
const detailsSolver = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-layout/DetailsPreviewSolver.ts.fragment'),
  'utf8',
)
const previewColumns = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-layout/DetailsPreviewColumns.ts.fragment'),
  'utf8',
)
const detailsOpenAction = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-layout/DetailsViewOpenAction.ts.fragment'),
  'utf8',
)
const settingsRootOverride = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-settings-general/SettingsRoot.tsx'),
  'utf8',
)
const settingsLayoutOverride = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-settings-general/SettingsRoot.module.css'),
  'utf8',
)
const aboutSectionOverride = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-settings-general/AboutSection.tsx'),
  'utf8',
)
const aboutLayoutOverride = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-settings-general/AboutSection.module.css'),
  'utf8',
)
const aboutRegistrationOverride = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-settings-general/AboutSectionRegistration.ts.fragment'),
  'utf8',
)
const aboutLocalesZh = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-settings-general/AboutLocales.zh.fragment'),
  'utf8',
)
const aboutLocalesEn = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-settings-general/AboutLocales.en.fragment'),
  'utf8',
)
const modelsTitleZh = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-settings-models/ModelsTitle.zh.fragment'),
  'utf8',
)
const modelsTitleEn = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-settings-models/ModelsTitle.en.fragment'),
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

  it('pins the subscriptions plugin without auto-installing stale DSH peer packages', () => {
    const workspace = readFileSync(resolve(projectRoot, 'pnpm-workspace.yaml'), 'utf8')
    const runtimeBuild = readFileSync(resolve(appRoot, 'scripts/build-runtime.mjs'), 'utf8')

    expect(appManifest.dependencies['dsh-plugin-subscriptions']).toBe('0.3.1')
    expect(workspace).toContain('autoInstallPeers: false')
    expect(workspace).toContain('dsh-plugin-subscriptions@0.3.1')
    expect(upstreamOverrideSync).toContain('stageSubscriptionsPlugin')
    expect(upstreamOverrideSync).toContain("const subscriptionsPluginVersion = '0.3.1'")
    expect(upstreamOverrideSync).toContain('SUBSCRIPTIONS_UI_ADAPTER_ID')
    expect(runtimeBuild).toContain('plugins: packagedPlugins')
    expect(runtimeBuild).toContain('adaptSubscriptionsPlugin(pluginRoot)')
    expect(packageScript).toContain("adapter: 'deepviewer-remaining-usage-v1'")
  })

  it('builds the first-party preview plugin against the pinned rc.7 client contracts', () => {
    const previewManifest = JSON.parse(readFileSync(
      resolve(appRoot, 'dsh-plugins/preview/package.json'),
      'utf8',
    ))
    const runtimeBuild = readFileSync(resolve(appRoot, 'scripts/build-runtime.mjs'), 'utf8')

    expect(previewManifest.name).toBe('@deepviewer/dsh-plugin-preview')
    expect(previewManifest.version).toBe('0.1.0')
    expect(previewManifest.dsh.client.inject).toContain('@deepseek-ai/dsh-client-ui-deliverables')
    expect(upstreamOverrideSync).toContain('stagePreviewPlugin')
    expect(upstreamOverrideSync).toContain('buildPreviewPlugin')
    expect(runtimeBuild).toContain('packPreviewPlugin()')
    expect(packageScript).toContain("name: '@deepviewer/dsh-plugin-preview'")
  })

  it('pins the preview toggle to the window-level top-right overlay', () => {
    expect(previewClientEntry).toContain("ctx.slots.inject('shell.overlay'")
    expect(previewClientEntry).not.toContain('conversation.session.header')
    expect(previewClientEntry).toContain(
      "ctx.layout.toggleDetails('preview', defaultPreviewPanelWidth(window.innerWidth))",
    )
    expect(previewPanelSource).toContain('IconPanelLeftOutline16')
    expect(previewPanelSource).toContain("PropsRuntime<'shell.overlay'>")
    expect(previewPanelSource).toContain('disabled={!hasSession}')
    expect(previewPanelSource).not.toContain("<span>{t('title')}</span>")
    expect(previewPanelStyles).toContain('position: fixed')
    expect(previewPanelStyles).toContain('top: var(--deepviewer-window-control-top, 12px)')
    expect(previewPanelStyles).toContain('right: var(--deepviewer-window-control-right, 12px)')
    expect(previewPanelStyles).toContain('width: 24px')
    expect(previewPanelStyles).toContain('-webkit-app-region: no-drag')
    expect(previewPanelStyles).toContain('transform: scaleX(-1)')
    expect(detailsOpenAction).toContain("d.detailsView === view")
    expect(detailsOpenAction).toContain('d.details = 0')
    expect(detailsOpenAction).toContain('clampWidth(preferredWidth, DETAILS_MIN, DETAILS_MAX)')
    expect(upstreamOverrideSync).toContain("'details-toggle-service-test-fake'")
  })

  it('widens preview resizing while keeping a single plain draggable border', () => {
    expect(detailsGeometry).toContain('DETAILS_MAX = 960')
    expect(detailsGeometry).toContain('PREVIEW_CENTER_MIN = 420')
    expect(detailsSolver).toContain('centerMin = CENTER_MIN')
    expect(previewColumns).toContain("panels.detailsView === 'preview'")
    expect(previewColumns).toContain('PREVIEW_CENTER_MIN')
    expect(detailsLayoutStyles).toContain(".handle[data-side='details']::after")
    expect(detailsLayoutStyles).toContain('content: none')
    expect(detailsPanelStyles).not.toContain('border-left')
    expect(upstreamOverrideSync).toContain("'wider-preview-details-geometry'")
    expect(upstreamOverrideSync).toContain("'preview-specific-column-solve'")
  })

  it('makes preview sections readable, collapsible, and vertically resizable without a duplicate close control', () => {
    expect(previewPanelSource).toContain('role="separator"')
    expect(previewPanelSource).toContain('setFilesCollapsed(current => !current)')
    expect(previewPanelSource).toContain('<button\n        ref={fileHeaderRef}')
    expect(previewPanelSource).toContain('className={css.sectionToggle} aria-hidden="true"')
    expect(previewPanelSource).not.toContain('className={css.sectionToggle}\n          aria-expanded')
    expect(previewPanelSource).toContain('onPointerDown={beginTreeResize}')
    expect(previewPanelSource).toContain('className={css.codeHeaderResize}')
    expect(previewPanelSource).toContain('className={css.webTitleResize}')
    expect(previewPanelSource).toContain('className={css.browserToolbar}')
    expect(previewPanelSource).toContain("sendBrowserCommand('reload')")
    expect(previewPanelSource).toContain('navigateBrowserHistory(-1)')
    expect(previewPanelSource).toContain('navigateBrowserHistory(1)')
    expect(previewPanelSource).toContain('resolvePreviewAddress(siteRootUrl')
    expect(previewPanelSource).toContain('externalPreviewUrl(current')
    expect(previewPanelSource).toContain('<ExternalLinkIcon size={20} />')
    expect(previewPanelSource).not.toContain('IconRightUpOutline')
    expect(previewExternalLinkIcon).toContain('viewBox="0 0 32 32"')
    expect(previewExternalLinkIcon).toContain('fill="currentColor"')
    expect(previewExternalLinkIcon).toContain('fillOpacity="0.85"')
    expect(previewPanelStyles).not.toContain('translateY(-5.5px)')
    expect(previewPanelSource).toContain('event.button !== 0 || filesCollapsed')
    expect(previewPanelSource).toContain('{!filesCollapsed && (')
    expect(previewPanelSource).not.toContain('drag.wasCollapsed')
    expect(previewPanelSource.indexOf('ref={filePathRef}')).toBeLessThan(
      previewPanelSource.indexOf('ref={treeRef}'),
    )
    expect(previewPanelStyles).toContain('cursor: row-resize')
    expect(previewPanelStyles).toContain('.sectionHeader:hover')
    expect(previewPanelStyles).toContain('text-align: start')
    expect(previewPanelStyles).toContain('border-radius: 0 !important')
    expect(previewPanelStyles).toContain('var(--dsw-alias-bg-module-platform)')
    expect(previewPanelStyles).toContain('var(--dsw-alias-border-l2)')
    expect(previewPanelStyles).toContain('--dsl-code-block-banner-background-color: var(--dsw-alias-bg-module-platform)')
    expect(previewPanelStyles).toContain('.webTitleResize')
    expect(previewPanelStyles).toContain('.browserAddress')
    expect(previewPanelStyles).not.toMatch(/var\(--dsw-(?:bg|text|border)-\d/u)
    expect(previewPanelStyles).toContain('--dsl-code-block-border-radius: 0px !important')
    expect(detailsPanelSource).not.toContain('className={css.close}')
    expect(detailsPanelSource).toContain('data-deepviewer-details-header')
  })

  it('routes every Agent-produced file click through the preview with a Host opener fallback', () => {
    expect(previewFileRouter).toContain("DEEPVIEWER_PREVIEW_FILE_EVENT = 'deepviewer:preview-file'")
    expect(previewFileRouter).toContain('cancelable: true')
    expect(previewFileRouter).toContain('const previewAccepted = !window.dispatchEvent(event)')
    expect(previewFileRouter).toContain('if (!previewAccepted) fallback()')
    expect(previewClientEntry).toContain('event.preventDefault()')
    expect(toolRowPreviewOpen).toContain('openDeepViewerPreviewOrFallback(nativeFilePath')
    expect(producedFilesButton).toContain('openDeepViewerPreviewOrFallback(')
    expect(producedFileMention).toContain('openDeepViewerPreviewOrFallback(')
    expect(upstreamOverrideSync).toContain("'deepviewer-preview-file-router'")
    expect(upstreamOverrideSync).toContain("'tool-row-preview-first-open'")
  })

  it('keeps the DeepViewer sidebar wordmark as a tracked inline React SVG override', () => {
    expect(wordmarkOverride).toContain('export function BrandWordmark')
    expect(wordmarkOverride).toContain('size = 24')
    expect(wordmarkOverride).toContain('width={(size * 747) / 144}')
    expect(wordmarkOverride).toContain('viewBox="0 0 747 144"')
    expect(wordmarkOverride.match(/<path\b/gu)).toHaveLength(3)
    expect(wordmarkOverride.match(/fill="currentColor"/gu)).toHaveLength(3)
    expect(wordmarkOverride).not.toContain('fill="white"')
    expect(wordmarkOverride).not.toContain('<filter')
    expect(wordmarkOverride).not.toContain('filter=')
    expect(wordmarkOverride).not.toContain('<image')
    expect(wordmarkOverride).not.toContain('<text')
    expect(sidebarWordmarkLayoutOverride).toContain('justify-content: flex-start')
    expect(sidebarWordmarkLayoutOverride).toContain('var(--dsw-alias-label-secondary)')
    expect(upstreamOverrideSync).toContain("'BrandWordmark.tsx'")
    expect(upstreamOverrideSync).toContain("'center-sidebar-wordmark'")
    expect(upstreamOverrideSync).toContain("['run', 'build:lib:client']")
    expect(upstreamOverrideSync).toContain("['run', 'build:web']")
  })

  it('portals global settings outside sidebar layout and animation contexts', () => {
    expect(portalOverride).toContain("createPortal(children, document.body)")
    expect(settingsRootOverride).toContain('<Portal>')
    expect(upstreamOverrideSync).toContain("'document-root-portal-primitive'")
    expect(upstreamOverrideSync).toContain("'document-root-portal-export'")
  })

  it('keeps the empty composer aligned near the viewport floor', () => {
    expect(emptyHeroBrandingOverride).toContain('.root')
    expect(emptyComposerPositionOverride).toContain(".root[data-phase='hero'] .scrollBody")
    expect(emptyComposerPositionOverride).toContain('justify-content: flex-start')
    expect(emptyComposerPositionOverride).toContain(".root[data-phase='hero'] .composerSeat")
    expect(emptyComposerPositionOverride).toContain('margin-top: auto')
    expect(emptyComposerPositionOverride).toContain('--deepviewer-composer-bottom-offset: 32px')
    expect(emptyComposerPositionOverride).toContain('--deepviewer-hero-input-prelude-height: 40px')
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
    expect(emptyHeroBrandingOverride).toContain('position: relative')
    expect(emptyHeroBrandingOverride).toContain('flex: 1 1 auto')
    expect(emptyHeroBrandingOverride).toContain('padding: var(--deepviewer-hero-input-prelude-height) 24px 0')
    expect(emptyHeroBrandingOverride).toContain('height: 48px')
    expect(emptyHeroBrandingOverride).toContain('opacity: 0.5')
    expect(emptyHeroBrandingOverride).toContain('gap: 40px')
    expect(emptyHeroBrandingOverride).toContain('font-family: var(--dsw-font-family)')
    expect(emptyHeroBrandingOverride).toContain('font-size: 24px')
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

  it('keeps sidebar collapse under explicit user control at every window width', () => {
    expect(disableAutoCollapseImport).not.toContain('SIDEBAR_AUTO_COLLAPSE')
    expect(disableAutoCollapse).toContain('actions.setNarrow(false)')
    expect(disableAutoCollapse).toContain('sidebarCollapsed = panels.sidebar === 0')
    expect(upstreamOverrideSync).toContain("'disable-sidebar-auto-collapse-import'")
    expect(upstreamOverrideSync).toContain("'disable-sidebar-auto-collapse'")
  })

  it('tracks the full-window settings shell and localized DeepViewer About page', () => {
    expect(settingsRootOverride).toContain("row.id !== 'about'")
    expect(settingsRootOverride).toContain("renderSlot('settings.close'")
    expect(settingsLayoutOverride).toContain('position: fixed')
    expect(settingsLayoutOverride).toContain('grid-template-columns')
    expect(settingsLayoutOverride).toContain('border-radius: 0')
    expect(settingsLayoutOverride).toContain('box-shadow: none')
    expect(settingsLayoutOverride).toContain('.navFooter')
    expect(aboutSectionOverride).toContain('__DEEPVIEWER_VERSION__')
    expect(aboutSectionOverride).toContain('__DEEPVIEWER_BUILD_NUMBER__')
    expect(aboutSectionOverride).toContain('__DEEPSEEK_HARNESS_VERSION__')
    expect(aboutSectionOverride).toContain("t('about.core')")
    expect(aboutSectionOverride).toContain('className={css.coreRow}')
    expect(aboutLayoutOverride).toContain('border-top: 1px solid var(--dsw-alias-border-l1)')
    expect(aboutLayoutOverride).toContain('justify-content: space-between')
    expect(aboutSectionOverride).toContain('/deepviewer-icon.png')
    expect(aboutRegistrationOverride).toContain("id: 'about'")
    expect(aboutRegistrationOverride).toContain('order: 1000')
    expect(aboutLocalesZh).toContain('关于 DeepViewer')
    expect(aboutLocalesZh).toContain('当前使用的核心')
    expect(aboutLocalesEn).toContain('About DeepViewer')
    expect(aboutLocalesEn).toContain('Currently used core')
    expect(upstreamOverrideSync).toContain("'global-settings-shell'")
    expect(upstreamOverrideSync).toContain("'about-deepviewer-section'")
    expect(upstreamOverrideSync).toContain("'settings-back-to-app-zh'")
    expect(upstreamOverrideSync).toContain("'about-deepviewer-icon'")
    expect(upstreamOverrideSync).toContain('harnessManifest.version')
  })

  it('integrates subscriptions as the second panel on the Models page', () => {
    expect(settingsRootOverride).toContain("row.id !== 'subscriptions'")
    expect(settingsRootOverride).toContain("active === 'models'")
    expect(settingsRootOverride).toContain("{ only: 'subscriptions' }")
    expect(settingsRootOverride).toContain('subscriptionsRow.label')
    expect(settingsLayoutOverride).toContain('.integratedSection')
    expect(settingsLayoutOverride).toContain('border-top: 1px solid var(--dsw-alias-border-l2)')
    expect(settingsLayoutOverride).toContain("[data-slot='settings.section']")
    expect(settingsLayoutOverride).toContain('max-width: 100% !important')
    expect(modelsTitleZh).toContain("title: 'API'")
    expect(modelsTitleEn).toContain("title: 'API'")
    expect(upstreamOverrideSync).toContain("'models-section-title-zh'")
    expect(upstreamOverrideSync).toContain("'models-section-title-en'")
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
