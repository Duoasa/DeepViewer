import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// The production graph is materialized by the actual packaging implementation.
// @ts-expect-error The packaging module is deliberately plain Node ESM.
import { productionGraph, materializeClosure } from '../scripts/native-package-closure.mjs'
describe('production package entry points', () => {
 it('loads a declared entry omitted from the npm files list', () => {
  const root = mkdtempSync(join(tmpdir(),'deepviewer-package-')), source = join(root,'source'), output = join(root,'runtime')
  try {
   mkdirSync(source); writeFileSync(join(source,'package.json'),JSON.stringify({name:'entry-fixture',version:'1.0.0',files:['body.cjs'],main:'entry.cjs',exports:{'.':{require:'./entry.cjs'}}}))
   writeFileSync(join(source,'entry.cjs'),"module.exports = require('./body.cjs')\n"); writeFileSync(join(source,'body.cjs'),"module.exports = 'loaded'\n")
   materializeClosure(productionGraph([source]),output)
   expect(createRequire(join(output,'package.json'))('entry-fixture')).toBe('loaded')
  } finally { rmSync(root,{recursive:true,force:true}) }
 })
})
