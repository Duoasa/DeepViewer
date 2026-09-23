import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'
import { BETTER_SIDEBAR_CHROME_SCRIPT } from '../src/main/better-sidebar-chrome.js'
const require = createRequire(import.meta.url)
const { JSDOM } = require('../../../upstream/deepseek-harness/node_modules/jsdom')
const windows: Array<{ close(): void }> = []
afterEach(() => { for (const window of windows.splice(0)) window.close() })
function fixture() {
  const dom = new JSDOM(`<html lang="zh"><body><main><header>
    <button data-dsh-bottom-toggle aria-label="展开底栏" aria-pressed="false"><svg></svg></button>
    <button data-sidebar-right-expand aria-label="展开侧栏"><svg></svg></button></header>
    <aside data-sidebar-right-panel="push"><button data-sidebar-right-mode="fullscreen" aria-label="全屏"><svg></svg></button>
    <button data-sidebar-right-toggle aria-label="收起侧栏"><svg></svg></button></aside></main></body></html>`, { runScripts: 'outside-only', pretendToBeVisual: true })
  windows.push(dom.window)
  const document = dom.window.document as Document
  const panel = document.querySelector('aside')!
  const bottom = document.querySelector<HTMLButtonElement>('[data-dsh-bottom-toggle]')!
  bottom.onclick = () => bottom.setAttribute('aria-pressed', bottom.getAttribute('aria-pressed') === 'true' ? 'false' : 'true')
  document.querySelector<HTMLButtonElement>('[data-sidebar-right-expand]')!.onclick = () => panel.setAttribute('data-sidebar-right-open', '')
  document.querySelector<HTMLButtonElement>('[data-sidebar-right-toggle]')!.onclick = () => panel.removeAttribute('data-sidebar-right-open')
  document.querySelector<HTMLButtonElement>('[data-sidebar-right-mode]')!.onclick = () => panel.setAttribute('data-sidebar-right-panel', 'fullscreen')
  dom.window.eval(BETTER_SIDEBAR_CHROME_SCRIPT)
  const toolbar = document.getElementById('deepviewer-panel-controls')!
  const button = (name: string) => toolbar.querySelector<HTMLButtonElement>(`[data-deepviewer-panel-control="${name}"]`)!
  const order = () => Array.from(toolbar.children).map(child => (child as HTMLElement).dataset.deepviewerPanelControl)
  return { dom, document, panel, bottom, toolbar, button, order }
}
describe('desktop panel controls', () => {
  it('adds the mode control only while expanded, without an empty slot', () => {
    const f = fixture()
    expect(f.order()).toEqual(['bottom', 'sidebar'])
    expect(f.toolbar.parentElement).toBe(f.document.body)
    f.button('sidebar').click()
    expect(f.order()).toEqual(['bottom', 'mode', 'sidebar'])
    f.button('sidebar').click()
    expect(f.order()).toEqual(['bottom', 'sidebar'])
  })
  it.each(['sidebar', 'bottom'])('opens both panels with %s first and closes independently', first => {
    const f = fixture()
    f.button(first).click()
    f.button(first === 'sidebar' ? 'bottom' : 'sidebar').click()
    expect(f.panel.hasAttribute('data-sidebar-right-open')).toBe(true)
    expect(f.bottom.getAttribute('aria-pressed')).toBe('true')
    f.button('bottom').click()
    expect(f.panel.hasAttribute('data-sidebar-right-open')).toBe(true)
    expect(f.bottom.getAttribute('aria-pressed')).toBe('false')
  })
  it('retains the bottom control in fullscreen presentation', () => {
    const f = fixture()
    f.button('sidebar').click(); f.button('mode').click(); f.button('bottom').click()
    expect(f.panel.getAttribute('data-sidebar-right-panel')).toBe('fullscreen')
    expect(f.bottom.getAttribute('aria-pressed')).toBe('true')
  })
  it('targets the current source after session rerender and installs only once', () => {
    const f = fixture()
    const replacement = f.bottom.cloneNode(true) as HTMLButtonElement
    let clicks = 0
    replacement.onclick = () => { clicks++ }
    f.bottom.replaceWith(replacement)
    f.dom.window.eval(BETTER_SIDEBAR_CHROME_SCRIPT)
    f.button('bottom').click()
    expect(clicks).toBe(1)
    expect(f.document.querySelectorAll('#deepviewer-panel-controls')).toHaveLength(1)
  })
})
