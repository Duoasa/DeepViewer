import { expect, it } from 'vitest'
import { searchNetworkError } from '../upstream-overrides/network/search-network-error.js'
it('retains nested transport codes while excluding credentials, URLs and arbitrary error messages', () => {
  const nested = Object.assign(new Error('proxy password=secret https://user:token@api.test/private?key=secret'), { code: 'ECONNREFUSED' })
  const root = new TypeError('fetch failed', { cause: new AggregateError([nested, Object.assign(new Error(), { code: 'CERT_HAS_EXPIRED' })]) })
  const result = searchNetworkError(root)
  expect(result).toContain('ECONNREFUSED'); expect(result).toContain('CERT_HAS_EXPIRED')
  expect(result).not.toMatch(/secret|api.test|user:token/u)
  Object.assign(nested, { cause: nested })
  expect(searchNetworkError(nested)).toContain('ECONNREFUSED')
})
