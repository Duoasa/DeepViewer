import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const appRoot = resolve(import.meta.dirname, '..')
const islandCss = readFileSync(resolve(appRoot, 'src/renderer/island.css'), 'utf8')
const islandOrb = readFileSync(resolve(appRoot, 'src/renderer/island-orb.ts'), 'utf8')
const islandMarkup = readFileSync(resolve(appRoot, 'src/renderer/island.html'), 'utf8')
const settings = readFileSync(
  resolve(appRoot, 'upstream-overrides/ui-settings-general/ActivityIslandSection.tsx'),
  'utf8',
)

describe('QuotaView activity island visual contract', () => {
  it('keeps the original panel material, inset, radius, typography, and shimmer', () => {
    expect(islandCss).toContain('inset: 10px')
    expect(islandCss).toContain('background: rgb(0 0 0 / 72%)')
    expect(islandCss).toContain('border: 0.5px solid rgb(255 255 255 / 10%)')
    expect(islandCss).toContain('border-radius: min(34px, 50%)')
    expect(islandCss).toContain('font-size: 11.5px')
    expect(islandCss).toContain('font-size: 18px')
    expect(islandCss).toContain('font-size: 14px')
    expect(islandCss).toContain('operation-highlight-sweep 2.6s ease-in-out infinite')
  })

  it('keeps the original orb geometry, state palette, and 60fps WebGL renderer', () => {
    expect(islandOrb).toContain('float sphereRadius = 0.535 + breathing')
    expect(islandOrb).toContain('for (int index = 0; index < 20; ++index)')
    expect(islandOrb).toContain('this.currentStyle.speed * multiplier * 16')
    expect(islandOrb).toContain('primary: [0.55, 0.21, 0.02]')
    expect(islandOrb).toContain('accent: [1, 0.78, 0.22]')
    expect(islandOrb).toContain("this.mode === 'rippleGlow'")
    expect(islandOrb).not.toContain('CanvasRenderingContext2D')
  })

  it('uses the original expanded information hierarchy and no custom signal rail', () => {
    expect(islandMarkup).toContain('class="status-dot"')
    expect(islandMarkup).toContain('id="kicker"')
    expect(islandMarkup).toContain('id="status-title"')
    expect(islandMarkup).toContain('id="operation"')
    expect(islandMarkup).toContain('id="compact-title"')
    expect(islandMarkup).not.toContain('class="signal"')
  })

  it('keeps the four QuotaView settings without a connection control', () => {
    expect(settings).toContain("orbAnimation: 'particleOrb'")
    expect(settings).toContain('compactDelaySeconds: 20')
    expect(settings).toContain('hideDelaySeconds: 100')
    expect(settings).toContain('min="5"')
    expect(settings).toContain('max="60"')
    expect(settings).toContain('max="120"')
    expect(settings.toLowerCase()).not.toContain('connection')
  })
})
