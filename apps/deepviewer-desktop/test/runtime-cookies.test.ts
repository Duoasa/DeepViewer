import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { Cookie } from 'electron'
import { pruneRetiredRuntimeCookies } from '../src/main/runtime-cookies.js'
const name = (port: number) => 'dsh-auth-' + createHash('sha256').update(`127.0.0.1:${port}`).digest('base64url')
const cookie = (port: number): Cookie => ({ name: name(port), value: 'test', domain: '127.0.0.1', path: '/', httpOnly: true, secure: false, session: false, sameSite: 'strict' })

describe('runtime cookie lifecycle', () => {
  it('removes retired runtime auth cookies while preserving the current login and unrelated cookies', async () => {
    const cookies = { get: vi.fn(async () => [cookie(1111), cookie(2222), { ...cookie(3333), name: 'other-login' }, { ...cookie(4444), domain: 'localhost' }]), remove: vi.fn(async () => {}) }
    await pruneRetiredRuntimeCookies(cookies, 'http://127.0.0.1:2222/?token=test')
    expect(cookies.remove).toHaveBeenCalledExactlyOnceWith('http://127.0.0.1:2222', name(1111))
  })
  it.each(['http://127.0.0.1:2222/', 'https://example.com/?token=test', 'http://localhost:2222/?token=test'])(
    'does not alter cookies outside a local token launch: %s', async url => {
      const cookies = { get: vi.fn(async () => []), remove: vi.fn(async () => {}) }
      await pruneRetiredRuntimeCookies(cookies, url)
      expect(cookies.get).not.toHaveBeenCalled()
    },
  )
})
