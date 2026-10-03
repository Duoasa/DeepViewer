import { afterEach, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
// @ts-expect-error The staging implementation is deliberately plain Node ESM.
import { nativeModuleNames, stageNativeModules } from '../../deepviewer-adapter/scripts/stage-native-modules.mjs'
const fixtures: string[] = []
afterEach(() => { for (const path of fixtures.splice(0)) rmSync(path,{recursive:true,force:true}) })
it('ships an application-owned CLI dependency closure without changing the upstream installation manifest', () => {
  const root=mkdtempSync(join(tmpdir(),'deepviewer-native-modules-')); fixtures.push(root)
  mkdirSync(join(root,'apps/cli/lib'),{recursive:true})
  const original=JSON.stringify({name:'@deepseek-ai/dsh',dependencies:{'core-dependency':'1.0.0'}})
  writeFileSync(join(root,'apps/cli/package.json'),original); writeFileSync(join(root,'apps/cli/lib/bin.js'),'fixture')
  mkdirSync(join(root,'apps/cli/node_modules/core-dependency'),{recursive:true}); writeFileSync(join(root,'apps/cli/node_modules/core-dependency/package.json'),JSON.stringify({name:'core-dependency',version:'1.0.0'}))
  for(const name of nativeModuleNames) { const directory=join(root,'node_modules',name); mkdirSync(directory,{recursive:true}); writeFileSync(join(directory,'package.json'),JSON.stringify({name,version:'1.0.0',dsh:{bundle:{patch:'./cordis.patch.yml'},client:{platform:'web'}}})) }
  const target=join(root,'native-cli'); stageNativeModules(root,target); stageNativeModules(root,target)
  expect(readFileSync(join(root,'apps/cli/package.json'),'utf8')).toBe(original)
  const cli=JSON.parse(readFileSync(join(target,'package.json'),'utf8'))
  for(const name of nativeModuleNames) { expect(cli.dependencies[name]).toBe('1.0.0'); const module=JSON.parse(readFileSync(join(root,'node_modules',name,'package.json'),'utf8')); expect(module.dsh.bundle).toBeUndefined(); expect(module.dsh.client.platform).toBe('web') }
  expect(existsSync(join(target,'lib/bin.js'))).toBe(true)
})
