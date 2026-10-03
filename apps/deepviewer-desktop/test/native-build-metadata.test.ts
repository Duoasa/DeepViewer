import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error Build-only JavaScript helper has no declaration file.
import { sanitizeNativeBuildMetadata } from '../scripts/native-build-metadata.mjs'
describe('native build source metadata', () => {
  it('drops private source region comments while preserving executable values and licensing', () => {
    const root=mkdtempSync(join(tmpdir(),'deepviewer-build-metadata-'))
    try {
      const projectRoot=join(root,'source'),code=join(root,'payload','client.js')
      mkdirSync(join(root,'payload'));mkdirSync(join(root,'payload','dependency.js'));writeFileSync(code,`/* Copyright Example; MIT */\n//#region ${projectRoot}/src/example.ts\nconst value = ${JSON.stringify(homedir())};\n//#region public-module\n//#endregion\n`)
      expect(sanitizeNativeBuildMetadata(join(root,'payload'),{projectRoot})).toEqual({changedFiles:1,removedComments:1})
      expect(readFileSync(code,'utf8')).toContain('Copyright Example; MIT')
      expect(readFileSync(code,'utf8')).toContain(`const value = ${JSON.stringify(homedir())};`)
      expect(readFileSync(code,'utf8')).toContain('//#region public-module')
      expect(readFileSync(code,'utf8')).not.toContain(`${projectRoot}/src/example.ts`)
      expect(sanitizeNativeBuildMetadata(join(root,'payload'),{projectRoot})).toEqual({changedFiles:0,removedComments:0})
    } finally {rmSync(root,{recursive:true,force:true})}
  })
})
