import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// v0.3.3 / Build 75, commit 58f5a8d43649ea1d9b6cc800fbfc39955c835eb1.
// The CSS fixture is the verbatim released HideEmptyHeroBranding.module.css.
// Its SVG source remains in the retained DSH 0.1.5 override; no tag lookup is
// needed in CI's shallow checkout.
const read = (path: string) => readFileSync(resolve(import.meta.dirname, path), 'utf8')
const releasedCss = read('fixtures/idle-v0.3.3.css')
const releasedMark = read('../upstream-overrides/dsh-015/EmptyHero.tsx')
const currentCss = read('../../deepviewer-adapter/client/welcome.module.css')
const currentMark = read('../../deepviewer-adapter/client/DeepViewerMascot.tsx')

function declarations(source: string, selector: string) {
  const body = source.slice(source.indexOf(selector) + selector.length).match(/^\s*\{([^}]+)\}/u)?.[1]
  if (!body) throw new Error(`Missing released-style selector: ${selector}`)
  return Object.fromEntries(body.split(';').filter(value => value.includes(':')).map(value => {
    const at = value.indexOf(':')
    return [value.slice(0, at).trim(), value.slice(at + 1).trim()]
  }))
}

describe('released DeepViewer idle presentation', () => {
  it('preserves both released SVG paths and its aspect ratio, with a separate cursor', () => {
    const paths = (source: string) => [...source.matchAll(/\bd="([^"]+)"/gu)].map(match => match[1])
    expect(paths(currentMark)).toEqual(paths(releasedMark))
    expect(paths(currentMark)).toHaveLength(2)
    expect(currentMark).toContain('viewBox="0 0 150.374 160"')
    expect(currentMark).toContain('data-deepviewer-brand-cursor')
    expect(currentMark).toContain('aria-hidden="true"')
    expect(currentMark).toContain('focusable="false"')
  })

  it('matches the released size, ink, title typography and spacing', () => {
    const logo = declarations(currentCss, '.brandLogo'), oldLogo = declarations(releasedCss, '.logo')
    for (const property of ['display', 'width', 'height', 'flex', 'overflow', 'color', 'opacity']) expect(logo[property], property).toBe(oldLogo[property])
    const title = declarations(currentCss, ':global([data-deepviewer-hero-title])'), oldTitle = declarations(releasedCss, '.prompt')
    for (const property of ['color', 'font-family', 'font-size', 'font-weight', 'line-height', 'opacity', 'text-align']) expect(title[property], property).toBe(oldTitle[property])
    expect(declarations(currentCss, ':global([data-deepviewer-headline])').gap).toBe(declarations(releasedCss, '.stack').gap)
    expect(logo.mask).toBeUndefined()
  })

  it('retains the released cursor cadence and respects reduced motion', () => {
    expect(declarations(currentCss, '.brandCursor').animation).toBe(declarations(releasedCss, '.logoCursor').animation)
    const frames = (source: string) => source.slice(source.indexOf('@keyframes'), source.indexOf('@media')).replace(/\s/gu, '')
    expect(frames(currentCss)).toBe(frames(releasedCss))
    const reduced = currentCss.slice(currentCss.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(declarations(reduced, '.brandCursor').animation).toBe(declarations(releasedCss.slice(releasedCss.indexOf('@media')), '.logoCursor').animation)
  })

  it('keeps the released flex geometry above the resident bottom composer', () => {
    const hero = declarations(currentCss, ':global([data-deepviewer-hero])'), oldHero = declarations(releasedCss, '.root')
    for (const property of ['position', 'inset', 'flex', 'display', 'align-items', 'justify-content', 'box-sizing', 'height', 'min-width', 'min-height', 'pointer-events']) expect(hero[property], property).toBe(oldHero[property])
    expect(hero.padding).toBe('40px 24px 0')
    expect(declarations(currentCss, ":global(body [data-conversation-content][data-content-phase='hero'] > [data-conversation-scroll])")['justify-content']).toBe('flex-start')
    expect(declarations(currentCss, ":global([data-conversation-content][data-content-phase='hero'] > [data-conversation-scroll] > [data-deepviewer-composer-seat])")['margin-top']).toBe('auto')
  })
})
