import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  configureDevelopmentProfile,
  developmentUserDataOverride,
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
const packageScript = readFileSync(resolve(appRoot, 'scripts/package-native.mjs'), 'utf8')
const nativeBuild = readFileSync(resolve(appRoot, 'scripts/build-native-desktop.mjs'), 'utf8')
const upstreamPreparation = readFileSync(resolve(projectRoot, 'apps/deepviewer-adapter/scripts/prepare-upstream.mjs'), 'utf8')

describe('DeepViewer development workflow (DV-0038)', () => {
  it('uses only DeepViewer launch environment and ignores independent products', () => {
    expect(developmentUserDataOverride({ DEEPVIEWER_DEV_USER_DATA: '/new', SCODER_DEV_USER_DATA: '/foreign', SAIDEX_DEV_USER_DATA: '/foreign' })).toBe('/new')
    expect(developmentUserDataOverride({ SCODER_DEV_USER_DATA: '/foreign', SAIDEX_DEV_USER_DATA: '/foreign' })).toBeUndefined()
    const setPath = vi.fn()
    const app = { getName: () => 'DeepViewer', getPath: () => '/profiles', setPath }
    expect(configureDevelopmentProfile(app, { DEEPVIEWER_PROFILE: 'installed', SCODER_PROFILE: 'development' })).toBe(false)
    expect(setPath).not.toHaveBeenCalled()
    expect(configureDevelopmentProfile(app, { DEEPVIEWER_PROFILE: 'development', DEEPVIEWER_DEV_USER_DATA: '/isolated' })).toBe(true)
    expect(setPath).toHaveBeenCalledWith('userData', '/isolated')
  })
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
    expect(devScript).toContain('prepareDevelopmentShell(electronExecutable, appRoot)')
    expect(devScript).toContain('spawn(developmentExecutable,')
  })

  it('exposes explicit development, preview, and release tiers', () => {
    expect(rootManifest.scripts['desktop:dev']).toBe('pnpm --filter @deepviewer/desktop dev')
    expect(rootManifest.scripts['desktop:dev:restart']).toBe('pnpm --filter @deepviewer/desktop dev:restart')
    expect(rootManifest.scripts['desktop:preview']).toBe('pnpm --filter @deepviewer/desktop preview')
    expect(rootManifest.scripts['desktop:release']).toBe('pnpm --filter @deepviewer/desktop release')

    expect(appManifest.scripts.preview).toBe('node scripts/package-native.mjs --preview')
    expect(appManifest.scripts.dev).toBe('node scripts/dev.mjs')
    expect(appManifest.scripts.release).toBe('node scripts/package-native.mjs --release')
    expect(appManifest.scripts.release).not.toContain('upload')
    expect(appManifest.scripts.release).not.toContain('github')
  })

  it('pins DeepViewer identity and RC2 without reviving retired preview plugins', () => {
    expect(appManifest.version).toBe('0.5.1')
    expect(Number.isSafeInteger(appManifest.buildNumber)).toBe(true)
    expect(appManifest.buildNumber).toBeGreaterThan(0)
    expect(appManifest.productName).toBe('DeepViewer')
    expect(appManifest.scripts['build:dev']).toBe('node scripts/bump-build-number.mjs && node scripts/build-native-desktop.mjs')
    expect(appManifest.dependencies['dsh-plugin-subscriptions']).toBe('0.3.1')
    expect(upstreamPreparation).toContain("harnessVersion = '0.2.0-rc.2'")
    expect(upstreamPreparation).toContain('639ed015397290b3745d163aafe02ffee4aa3f84')
    expect(nativeBuild).toContain('stageNativeModules')
    expect(nativeBuild).not.toContain('stageBetterSidebar')
    expect(nativeBuild).not.toContain('stagePreviewPlugin')
  })

  it('separates local preview identity and signed preparation from publication', () => {
    expect(packageScript).toContain("'com.deepviewer.desktop.preview'")
    expect(packageScript).toContain('Signed releases require')
    expect(packageScript).toContain("publish:'never'")
    expect(packageScript).toContain('published:false')
  })
})
