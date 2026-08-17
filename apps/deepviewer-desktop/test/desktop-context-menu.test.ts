import { describe, expect, it } from 'vitest'
import {
  getContextLinkTarget,
  getDesktopContextMenuLabels,
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

  it.each([
    'javascript:alert(1)',
    'data:text/plain,unsafe',
    'deepviewer://settings',
    'not a url',
  ])('rejects unsupported context link %s', linkUrl => {
    expect(getContextLinkTarget(linkUrl)).toBeUndefined()
  })

  it('localizes custom labels while native edit roles remain system-managed', () => {
    expect(getDesktopContextMenuLabels('zh-CN').revealFile).toBe('finder中显示')
    expect(getDesktopContextMenuLabels('en-US').revealFile).toBe('Show in Finder')
  })
})
