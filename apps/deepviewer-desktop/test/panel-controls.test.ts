import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'
import { BETTER_SIDEBAR_CHROME_CSS, BETTER_SIDEBAR_CHROME_SCRIPT } from '../src/main/better-sidebar-chrome.js'
import { MACOS_WINDOW_CHROME_CSS } from '../src/main/macos-window-chrome.js'
const require = createRequire(import.meta.url)
const { JSDOM } = require('../../../upstream/deepseek-harness/node_modules/jsdom')
const windows: Array<{ close(): void }> = []
afterEach(() => { for (const window of windows.splice(0)) window.close() })
function fixture() {
  const dom = new JSDOM(`<html lang="zh"><head><style>${MACOS_WINDOW_CHROME_CSS + BETTER_SIDEBAR_CHROME_CSS}</style></head><body><main><header>
    <button data-sidebar-right-expand aria-label="展开侧栏"><svg></svg></button></header>
    <aside data-sidebar-right-panel="push"><button data-sidebar-right-mode="fullscreen" aria-label="全屏"><svg></svg></button>
    <button data-sidebar-right-toggle aria-label="收起侧栏"><svg></svg></button></aside></main></body></html>`, { runScripts: 'outside-only', pretendToBeVisual: true })
  windows.push(dom.window)
  const document = dom.window.document as Document
  const panel = document.querySelector('aside')!
  document.querySelector<HTMLButtonElement>('[data-sidebar-right-expand]')!.onclick = () => panel.setAttribute('data-sidebar-right-open', '')
  document.querySelector<HTMLButtonElement>('[data-sidebar-right-toggle]')!.onclick = () => panel.removeAttribute('data-sidebar-right-open')
  document.querySelector<HTMLButtonElement>('[data-sidebar-right-mode]')!.onclick = () => panel.setAttribute('data-sidebar-right-panel', 'fullscreen')
  dom.window.eval(BETTER_SIDEBAR_CHROME_SCRIPT)
  const toolbar = document.getElementById('deepviewer-panel-controls')!
  const button = (name: string) => toolbar.querySelector<HTMLButtonElement>(`[data-deepviewer-panel-control="${name}"]`)!
  const order = () => Array.from(toolbar.children).map(child => (child as HTMLElement).dataset.deepviewerPanelControl)
  const shown = () => Array.from(toolbar.children).filter(child => !(child as HTMLButtonElement).hidden).map(child => (child as HTMLElement).dataset.deepviewerPanelControl)
  return { dom, document, panel, toolbar, button, order, shown }
}
describe('desktop panel controls', () => {
  it('removes hidden actions from layout and preserves button identities through expand and collapse', () => {
    const f = fixture()
    const mode = f.button('mode'), sidebar = f.button('sidebar')
    expect(f.order()).toEqual(['mode', 'sidebar'])
    expect(f.shown()).toEqual(['sidebar'])
    expect(f.dom.window.getComputedStyle(mode).display).toBe('none')
    expect(f.toolbar.parentElement).toBe(f.document.body)
    f.button('sidebar').click()
    expect(f.order()).toEqual(['mode', 'sidebar'])
    expect(f.shown()).toEqual(['mode', 'sidebar'])
    expect(f.dom.window.getComputedStyle(mode).display).toBe('inline-flex')
    expect(f.panel.getAttribute('data-sidebar-right-panel')).toBe('push')
    f.button('sidebar').click()
    expect(f.order()).toEqual(['mode', 'sidebar'])
    expect(f.shown()).toEqual(['sidebar'])
    expect([f.button('mode'), f.button('sidebar')]).toEqual([mode, sidebar])
    expect(mode.hidden).toBe(true)
    expect(mode.disabled).toBe(true)
    expect(f.dom.window.getComputedStyle(mode).display).toBe('none')
  })
  it('retains native sidebar controls in fullscreen presentation', () => {
    const f = fixture()
    f.button('sidebar').click(); f.button('mode').click()
    expect(f.panel.getAttribute('data-sidebar-right-panel')).toBe('fullscreen')
    expect(f.document.documentElement.hasAttribute('data-deepviewer-right-maximized')).toBe(true)
    f.button('sidebar').click()
    expect(f.document.documentElement.hasAttribute('data-deepviewer-right-maximized')).toBe(false)
  })
  it('never creates a bottom workbench control', () => {
    const f = fixture()
    expect(f.button('bottom')).toBeNull()
    f.button('sidebar').click()
    expect(f.shown()).toEqual(['mode', 'sidebar'])
    expect(f.panel.getAttribute('data-sidebar-right-panel')).toBe('push')
    expect(f.panel.hasAttribute('data-sidebar-right-open')).toBe(true)
    expect(f.dom.window.getComputedStyle(f.panel.querySelector('[data-sidebar-right-toggle]')).display).toBe('none')
  })
  it('ignores controls retained inside hidden sessions and hides newly mounted native duplicates immediately', () => {
    const f = fixture()
    const background = f.document.createElement('div')
    background.hidden = true
    background.innerHTML = '<aside data-sidebar-right-panel="fullscreen" data-sidebar-right-open><button data-sidebar-right-mode="push"></button><button data-sidebar-right-toggle></button></aside>'
    f.document.body.prepend(background)
    f.button('sidebar').click()
    expect(f.document.documentElement.hasAttribute('data-deepviewer-right-maximized')).toBe(false)
    expect(f.panel.hasAttribute('data-sidebar-right-open')).toBe(true)
    // No observer flush is necessary to prevent the duplicate from flashing.
    const duplicate = f.document.createElement('button')
    duplicate.setAttribute('data-sidebar-right-toggle', '')
    f.panel.append(duplicate)
    expect(f.dom.window.getComputedStyle(duplicate).display).toBe('none')
  })
  it('targets the current source after session rerender and installs only once', () => {
    const f = fixture()
    const source = f.document.querySelector('[data-sidebar-right-expand]')!
    const replacement = source.cloneNode(true) as HTMLButtonElement
    let clicks = 0
    replacement.onclick = () => { clicks++ }
    source.replaceWith(replacement)
    f.dom.window.eval(BETTER_SIDEBAR_CHROME_SCRIPT)
    f.button('sidebar').click()
    expect(clicks).toBe(1)
    expect(f.document.querySelectorAll('#deepviewer-panel-controls')).toHaveLength(1)
  })
})
