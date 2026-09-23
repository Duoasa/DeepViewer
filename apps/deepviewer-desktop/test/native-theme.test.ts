import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import ts from 'typescript'
import { expect, it } from 'vitest'
import { MACOS_WINDOW_CHROME_SCRIPT } from '../src/main/macos-window-chrome.js'

it('releases forced appearance when system is selected, even before the palette changes', () => {
  const attributes = new Map<string, string>()
  const changes: string[] = []
  const style = { setProperty() {}, removeProperty() {} }
  const body = {
    style,
    setAttribute: (key: string, value: string) => attributes.set(key, value),
    removeAttribute: (key: string) => attributes.delete(key),
    getAttribute: (key: string) => attributes.get(key) ?? null,
  }
  const document = {
    body,
    documentElement: { style: { ...style, colorScheme: '' } },
    createElement: () => ({ name: '', content: '', isConnected: false, remove() {} }),
    head: { append() {} },
  }
  const compiled = ts.transpileModule(
    readFileSync(new URL('../upstream-overrides/ui-layout/theme-presenter.ts', import.meta.url), 'utf8'),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
  ).outputText
  const { ThemePresenter } = new Script(compiled + '\nexports').runInNewContext({
    exports: {}, document, getComputedStyle: () => ({ backgroundColor: '#fff' }),
  })
  const start = MACOS_WINDOW_CHROME_SCRIPT.indexOf("let nativeThemeSource = '';")
  const end = MACOS_WINDOW_CHROME_SCRIPT.indexOf("button.addEventListener('click'", start)
  const sync = new Script(MACOS_WINDOW_CHROME_SCRIPT.slice(start, end) + '\nsyncNativeTheme').runInNewContext({
    document,
    window: { deepviewerDesktop: { setNativeThemeSource: (source: string) => changes.push(source) } },
  })
  const presenter = new ThemePresenter()
  const apply = (preference: string, colorScheme: string) => {
    presenter.apply({ preference, active: { colorScheme, tokens: {} }, fontSize: 14 })
    sync()
  }
  // Before theme initialization, do not latch the boot page's resolved palette.
  sync()
  apply('light', 'light')
  apply('system', 'light')
  apply('system', 'dark') // OS changes: remain in system mode.
  expect(attributes.has('data-ds-dark-theme')).toBe(true)
  apply('dark', 'dark')
  apply('system', 'dark')
  apply('system', 'light')
  expect(attributes.has('data-ds-dark-theme')).toBe(false)
  apply('custom-dark', 'dark')
  presenter.dispose()
  sync()
  expect(changes).toEqual(['system', 'light', 'system', 'dark', 'system', 'dark', 'system'])
  expect(attributes.has('data-deepviewer-theme-source')).toBe(false)
})
