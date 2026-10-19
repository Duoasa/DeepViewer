import { EventEmitter } from 'node:events'
import { afterEach, expect, it, vi } from 'vitest'
import type { AppUpdater } from 'electron-updater'
import { desktopUpdateChannel } from '../src/update-channel.ts'
import { resolveDesktopPolicyConfig } from '../src/mandatory-update-policy.ts'

vi.mock('electron', () => ({ app: { isPackaged: false } }))
vi.mock('electron-updater', () => ({ default: { autoUpdater: {} } }))
const { DesktopUpdateCoordinator } = await import('../src/update-coordinator.ts')
afterEach(() => vi.unstubAllEnvs())

it.each([
  ['latest', 'latest', false],
  ['nightly', 'preview', true],
] as const)('keeps the native %s policy on the DeepViewer %s feed', (channel, feed, prerelease) => {
  vi.stubEnv('DEEPVIEWER_UPDATE_CHANNEL', feed)
  const updater = new EventEmitter() as AppUpdater
  const coordinator = new DesktopUpdateCoordinator(state => state, async () => false, updater,
    () => false, () => '0.5.1', undefined, desktopUpdateChannel({ dshDesktopUpdateChannel: channel }))
  try {
    expect(updater.channel).toBe(feed)
    expect(updater.allowPrerelease).toBe(prerelease)
    expect(updater.allowDowngrade).toBe(false)
    expect(updater.autoDownload).toBe(false)
    expect(updater.autoInstallOnAppQuit).toBe(false)
  } finally { coordinator.dispose() }
})
it('does not let a preview environment change a sealed stable channel', () => {
  vi.stubEnv('DEEPVIEWER_UPDATE_CHANNEL', 'preview')
  const updater = new EventEmitter() as AppUpdater
  const coordinator = new DesktopUpdateCoordinator(state => state, async () => false, updater,
    () => false, () => '0.5.1', undefined, 'latest')
  try { expect(updater.channel).toBe('latest'); expect(updater.allowPrerelease).toBe(false) }
  finally { coordinator.dispose() }
})
it('does not inherit the official mandatory-update service without product configuration', () => {
  expect(resolveDesktopPolicyConfig(undefined)).toBeUndefined()
})
