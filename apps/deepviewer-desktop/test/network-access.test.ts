import { describe, expect, it, vi } from 'vitest'
import { WebAccess, isPublic, validateTarget, type Address } from '../src/main/network/access.js'
const signal = () => new AbortController().signal

describe('web destination access', () => {
  it('does not ask for public targets and pins the direct DNS answer', async () => {
    const ask = vi.fn().mockResolvedValue('deny')
    const gate = new WebAccess(ask, async () => [{ address: '1.1.1.1', family: 4 }])
    expect(await gate.check(new URL('https://public.test'), false, signal())).toEqual([{ address: '1.1.1.1', family: 4 }])
    expect(ask).not.toHaveBeenCalled()
  })
  it('only accepts fake-IP domain resolution when an actual proxy is selected', async () => {
    const ask = vi.fn().mockResolvedValue('deny')
    const gate = new WebAccess(ask, async () => [{ address: '198.18.1.30', family: 4 }])
    await expect(gate.check(new URL('https://github.com'), false, signal())).rejects.toMatchObject({ code: 'FAKE_IP_WITHOUT_PROXY' })
    expect(await gate.check(new URL('https://github.com'), true, signal())).toBeUndefined()
    await expect(gate.check(new URL('https://198.18.1.30'), true, signal())).rejects.toMatchObject({ code: 'LOCAL_ACCESS_DENIED' })
    expect(ask).toHaveBeenCalledTimes(1)
  })
  it('binds run consent to host, port and exact DNS address set', async () => {
    let address = '192.168.1.10'
    const ask = vi.fn().mockResolvedValueOnce('run').mockResolvedValue('deny')
    const gate = new WebAccess(ask, async () => [{ address, family: 4 }])
    await gate.check(new URL('http://nas.local:8080/one'), false, signal())
    await gate.check(new URL('http://nas.local:8080/two'), false, signal())
    expect(ask).toHaveBeenCalledTimes(1)
    await expect(gate.check(new URL('http://nas.local:8081'), false, signal())).rejects.toMatchObject({ code: 'LOCAL_ACCESS_DENIED' })
    address = '192.168.1.11'
    await expect(gate.check(new URL('http://nas.local:8080'), false, signal())).rejects.toMatchObject({ code: 'LOCAL_ACCESS_DENIED' })
    expect(ask).toHaveBeenCalledTimes(3)
  })
  it('single-use consent never grants another request and cannot survive cancellation', async () => {
    const ask = vi.fn().mockResolvedValue('once')
    const gate = new WebAccess(ask, async () => [{ address: '127.0.0.1', family: 4 }])
    await gate.check(new URL('http://localhost'), false, signal())
    await gate.check(new URL('http://localhost'), false, signal())
    expect(ask).toHaveBeenCalledTimes(2)
    const controller = new AbortController(); controller.abort()
    await expect(gate.check(new URL('http://localhost'), false, controller.signal)).rejects.toThrow()
    expect(ask).toHaveBeenCalledTimes(2)
  })
  it('keeps mixed DNS and mapped IPv6 addresses behind consent', async () => {
    expect(isPublic('::ffff:127.0.0.1')).toBe(false)
    expect(isPublic('::1')).toBe(false)
    expect(isPublic('169.254.169.254')).toBe(false)
    const addresses: Address[] = [{ address: '1.1.1.1', family: 4 }, { address: '10.0.0.1', family: 4 }]
    const gate = new WebAccess(async () => 'deny', async () => addresses)
    await expect(gate.check(new URL('https://mixed.test'), false, signal())).rejects.toMatchObject({ code: 'LOCAL_ACCESS_DENIED' })
  })
  it('rejects credentialed and non-http targets before connection', () => {
    expect(() => validateTarget('file:///etc/passwd')).toThrow()
    expect(() => validateTarget('https://user:password@site.test')).toThrow()
  })
})

it('asks before connecting through a discovered custom NAT64 prefix to an internal IPv4 target', async () => {
  const ask = vi.fn().mockResolvedValue('deny')
  const gate = new WebAccess(ask, async hostname => [{ address: hostname === 'ipv4only.arpa' ? '2001:4860:64::c000:aa' : '2001:4860:64::a00:1', family: 6 }])
  await expect(gate.check(new URL('http://translated.test'), false, signal())).rejects.toMatchObject({ code: 'LOCAL_ACCESS_DENIED' })
  expect(ask).toHaveBeenCalledTimes(1)
})
