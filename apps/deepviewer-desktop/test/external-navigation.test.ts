import { describe, expect, it, vi } from 'vitest'
import {
  getExternalPreviewUrl,
  getExternalWebUrl,
  openExternalWebUrl,
} from '../src/main/external-navigation.js'

describe('external navigation', () => {
  it.each([
    ['https://example.com/docs?q=deepviewer#links', 'https://example.com/docs?q=deepviewer#links'],
    ['http://example.com', 'http://example.com/'],
  ])('allows web URL %s', (targetUrl, expected) => {
    expect(getExternalWebUrl(targetUrl)).toBe(expected)
  })

  it.each([
    'file:///tmp/private.txt',
    'javascript:alert(1)',
    'data:text/html,unsafe',
    'deepviewer://settings',
    'not a url',
    '',
  ])('rejects non-web URL %s', targetUrl => {
    expect(getExternalWebUrl(targetUrl)).toBeUndefined()
  })

  it('opens allowed URLs with the supplied system-browser adapter', async () => {
    const openExternal = vi.fn<(url: string) => Promise<void>>().mockResolvedValue()

    await expect(openExternalWebUrl('https://github.com/Duoasa/DeepViewer', openExternal))
      .resolves.toBe(true)
    expect(openExternal).toHaveBeenCalledOnce()
    expect(openExternal).toHaveBeenCalledWith('https://github.com/Duoasa/DeepViewer')
  })

  it('does not invoke the adapter for rejected protocols', async () => {
    const openExternal = vi.fn<(url: string) => Promise<void>>().mockResolvedValue()

    await expect(openExternalWebUrl('file:///tmp/private.txt', openExternal))
      .resolves.toBe(false)
    expect(openExternal).not.toHaveBeenCalled()
  })

  it('opens only explicitly marked preview capabilities from the active Runtime origin', () => {
    const runtimeOrigin = 'http://127.0.0.1:4312'
    const target = `${runtimeOrigin}/deepviewer-preview-static/token/index.html?x=1&deepviewerExternalPreview=1`

    expect(getExternalPreviewUrl(target, runtimeOrigin))
      .toBe(`${runtimeOrigin}/deepviewer-preview-static/token/index.html?x=1`)
    expect(getExternalPreviewUrl(target, 'http://127.0.0.1:9999')).toBeUndefined()
    expect(getExternalPreviewUrl(`${runtimeOrigin}/settings?deepviewerExternalPreview=1`, runtimeOrigin))
      .toBeUndefined()
    expect(getExternalPreviewUrl(
      `${runtimeOrigin}/deepviewer-preview-static/token/index.html`, runtimeOrigin,
    )).toBeUndefined()
  })
})
