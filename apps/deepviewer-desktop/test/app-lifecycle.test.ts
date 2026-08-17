import { describe, expect, it } from 'vitest'
import {
  shouldHideWindowOnClose,
  shouldQuitWhenAllWindowsClosed,
} from '../src/main/app-lifecycle.js'

describe('DeepViewer app lifecycle', () => {
  it('keeps the macOS app alive when its window is closed', () => {
    expect(shouldHideWindowOnClose('darwin')).toBe(true)
    expect(shouldQuitWhenAllWindowsClosed('darwin')).toBe(false)
  })

  it('retains the conventional close behavior on other platforms', () => {
    expect(shouldHideWindowOnClose('win32')).toBe(false)
    expect(shouldHideWindowOnClose('linux')).toBe(false)
    expect(shouldQuitWhenAllWindowsClosed('win32')).toBe(true)
    expect(shouldQuitWhenAllWindowsClosed('linux')).toBe(true)
  })
})
