import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// @ts-expect-error The checked JavaScript build adapter has no declaration file.
const adapter = await import('../scripts/adapt-subscriptions-plugin.mjs')

const sourceClient = resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'node_modules',
  'dsh-plugin-subscriptions',
  'lib',
  'client.js',
)

describe('subscriptions usage presentation adapter (DV-0011)', () => {
  it('maps used quota to remaining quota and stable balance levels', () => {
    expect(adapter.remainingSubscriptionPercent(31)).toBe(69)
    expect(adapter.remainingSubscriptionPercent(-5)).toBe(100)
    expect(adapter.remainingSubscriptionPercent(120)).toBe(0)
    expect(adapter.remainingSubscriptionLevel(50)).toBe('healthy')
    expect(adapter.remainingSubscriptionLevel(49)).toBe('low')
    expect(adapter.remainingSubscriptionLevel(20)).toBe('low')
    expect(adapter.remainingSubscriptionLevel(19)).toBe('critical')
  })

  it('patches the pinned client once and rejects incompatible source drift', async () => {
    const root = await mkdtemp(join(tmpdir(), 'deepviewer-subscriptions-ui-'))
    await mkdir(join(root, 'lib'))
    await copyFile(sourceClient, join(root, 'lib', 'client.js'))

    expect(adapter.adaptSubscriptionsPlugin(root)).toBe(true)
    expect(adapter.adaptSubscriptionsPlugin(root)).toBe(false)
    const client = await readFile(join(root, 'lib', 'client.js'), 'utf8')
    expect(client).toContain('usageSession: "Periodic window"')
    expect(client).toContain('usageSession: "周期窗口"')
    expect(client).toContain('const remainingPercent = 100 -')
    expect(client).toContain('width: `${String(remainingPercent)}%`')
    expect(client).toContain('style: { color: balanceColor }')
    expect(client).not.toContain('usageSession: "5-hour window"')
    expect(client).not.toContain('usageSession: "5 小时窗口"')

    await writeFile(join(root, 'lib', 'client.js'), 'export const incompatible = true\n')
    expect(() => adapter.adaptSubscriptionsPlugin(root)).toThrow(/anchor mismatch/u)
  })
})
