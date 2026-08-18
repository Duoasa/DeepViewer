import { describe, expect, it } from 'vitest'
import {
  createNativeFilePathLookupScript,
  createPreviewFileDispatchScript,
  getContextLinkTarget,
  getDesktopContextMenuLabels,
  getNativeFileTarget,
} from '../src/main/desktop-context-menu.js'

describe('desktop context menu', () => {
  it('recognizes web links and normalizes their URL', () => {
    expect(getContextLinkTarget('https://github.com/Duoasa/DeepViewer')).toEqual({
      kind: 'web',
      url: 'https://github.com/Duoasa/DeepViewer',
    })
  })

  it('decodes local file links into native paths', () => {
    expect(getContextLinkTarget('file:///Users/example/My%20Project/%E6%8A%A5%E5%91%8A.md')).toEqual({
      kind: 'file',
      path: '/Users/example/My Project/报告.md',
    })
  })

  it('reads an absolute path from a Harness file button title', () => {
    expect(getContextLinkTarget('', '/Users/example/Project/report.md')).toEqual({
      kind: 'file',
      path: '/Users/example/Project/report.md',
    })
  })

  it('does not treat arbitrary or relative titles as local file targets', () => {
    expect(getContextLinkTarget('', 'Open settings')).toBeUndefined()
    expect(getContextLinkTarget('', 'src/report.md')).toBeUndefined()
  })

  it('finds the nearest explicit native-file target at the context-menu point', () => {
    const script = createNativeFilePathLookupScript(120, 48)
    const result = new Function('document', `return ${script}`)({
      elementFromPoint: (x: number, y: number) => ({
        closest: (selector: string) => ({
          getAttribute: (attribute: string) =>
            x === 120 && y === 48
            && selector === '[data-deepviewer-native-file-path]'
            && attribute === 'data-deepviewer-native-file-path'
              ? '/Users/example/Project/report.md'
              : '',
        }),
      }),
    })
    expect(getNativeFileTarget(result)).toEqual({
      kind: 'file',
      path: '/Users/example/Project/report.md',
    })
  })

  it('rejects invalid values returned by the renderer lookup', () => {
    expect(getNativeFileTarget('src/report.md')).toBeUndefined()
    expect(getNativeFileTarget({ path: '/Users/example/report.md' })).toBeUndefined()
  })

  it('dispatches the validated file path to the DeepViewer preview plugin', () => {
    const events: Array<{ type: string; detail: unknown }> = []
    const script = createPreviewFileDispatchScript('/Users/example/Project/a "quoted" file.html')
    new Function('window', 'CustomEvent', script)(
      {
        dispatchEvent: (event: { type: string; detail: unknown }) => {
          events.push({ type: event.type, detail: event.detail })
        },
      },
      class CustomEvent {
        constructor(readonly type: string, readonly options: { detail: unknown }) {}
        get detail(): unknown { return this.options.detail }
      },
    )
    expect(events).toEqual([{
      type: 'deepviewer:preview-file',
      detail: '/Users/example/Project/a "quoted" file.html',
    }])
  })

  it.each([
    'javascript:alert(1)',
    'data:text/plain,unsafe',
    'deepviewer://settings',
    'not a url',
  ])('rejects unsupported context link %s', linkUrl => {
    expect(getContextLinkTarget(linkUrl)).toBeUndefined()
  })

  it('localizes custom labels while native edit roles remain system-managed', () => {
    expect(getDesktopContextMenuLabels('zh-CN').previewFile).toBe('在 DeepViewer 中预览')
    expect(getDesktopContextMenuLabels('zh-CN').revealFile).toBe('在 Finder 中显示')
    expect(getDesktopContextMenuLabels('en-US').revealFile).toBe('Show in Finder')
  })
})
