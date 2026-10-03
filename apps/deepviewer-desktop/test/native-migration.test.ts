import { afterEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readlinkSync, statSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { load } from 'js-yaml'
import { prepareDesktopProfile, rollbackDesktopProfile } from '../../deepviewer-adapter/migrations/desktop-profile.ts'
import { prepareKernelSnapshot, restoreKernelSnapshot, verifyKernelSnapshot } from '../../deepviewer-adapter/migrations/kernel-snapshot.ts'
vi.mock('electron', () => ({ BrowserWindow: class {}, ipcMain: {} }))
const { filterWebState, legacyOrigins } = await import('../../deepviewer-adapter/migrations/web-state.ts')
const fixtures: string[] = []
afterEach(() => { for (const root of fixtures.splice(0)) rmSync(root,{recursive:true,force:true}) })
function fixture() {
 const root = mkdtempSync(join(tmpdir(),'deepviewer-migration-')); fixtures.push(root)
 const runtime = join(root,'runtime'), home = join(root,'home'), web = join(home,'profiles/web'), directory = join(root,'adapter')
 for (const path of [runtime,web,directory]) mkdirSync(path,{recursive:true})
 writeFileSync(join(runtime,'package.json'),JSON.stringify({dsh:{profile:{bundles:['@deepseek-ai/dsh-base']}}}))
 writeFileSync(join(directory,'package.json'),JSON.stringify({name:'@deepviewer/adapter',version:'0.7.0'}))
 writeFileSync(join(web,'package.json'),JSON.stringify({dependencies:{'dsh-better-sidebar':'0.19.1','dsh-codex-taskboard':'1.1.24','@deepviewer/dsh-plugin-preview':'0.1.0'},dsh:{profile:{bundles:['dsh-better-sidebar','dsh-codex-taskboard','@deepviewer/dsh-plugin-preview']}}}))
 writeFileSync(join(web,'cordis.patch.yml'),'- id: dsh-better-sidebar\n  name: dsh-better-sidebar\n- id: custom-provider\n  config:\n    credential: secret-reference\n')
 return {root,home,runtime,directory,web,integrations:[{name:'@deepviewer/adapter',version:'0.7.0',directory}]}
}
describe('independent desktop migration', () => {
 it('backs up old Sessions before upgrading and restores only into a fresh separate home', () => {
  const f = fixture(), session = join(f.home, 'sessions', 's1', 'events.jsonl'); mkdirSync(join(f.home,'sessions','s1'),{recursive:true}); writeFileSync(session,'old-events')
  prepareKernelSnapshot(f.home); writeFileSync(session,'new-events'); prepareKernelSnapshot(f.home)
  expect(verifyKernelSnapshot(f.home).kernel).toBe('0.1.5-rc.2')
  const destination = join(f.root,'rollback-home'); restoreKernelSnapshot(f.home,destination)
  expect(readFileSync(join(destination,'sessions/s1/events.jsonl'),'utf8')).toBe('old-events'); expect(readFileSync(session,'utf8')).toBe('new-events')
  expect(()=>restoreKernelSnapshot(f.home,destination)).toThrow('new, empty')
  writeFileSync(join(f.home,'migration-backups/kernel-v020/data/sessions/s1/events.jsonl'),'broken'); expect(()=>verifyKernelSnapshot(f.home)).toThrow('integrity')
 })
 it('preserves provider references, removes retired bundles, retries and rolls back metadata', () => {
  const f=fixture(); prepareDesktopProfile(f.home,f.runtime,f.integrations)
  const target=join(f.home,'profiles/desktop'), first=readFileSync(join(target,'package.json'),'utf8')
  expect(first).not.toContain('dsh-better-sidebar'); expect(first).not.toContain('dsh-codex-taskboard'); expect(first).not.toContain('@deepviewer/dsh-plugin-preview'); expect(readFileSync(join(target,'cordis.patch.yml'),'utf8')).toContain('secret-reference')
  prepareDesktopProfile(f.home,f.runtime,f.integrations); expect(readFileSync(join(target,'package.json'),'utf8')).toBe(first)
  expect(first).not.toContain('@deepviewer/adapter')
  // Native recovery retains only its selected core bundles.
  const value=JSON.parse(first); value.dsh.profile.bundles=[]; writeFileSync(join(target,'package.json'),JSON.stringify(value)); prepareDesktopProfile(f.home,f.runtime,f.integrations)
  expect(JSON.parse(readFileSync(join(target,'package.json'),'utf8')).dsh.profile.bundles).toEqual([])
  rollbackDesktopProfile(f.home); expect(readFileSync(join(f.web,'cordis.patch.yml'),'utf8')).toContain('secret-reference')
 })
 it('leaves unowned packages and source data intact while moving declarations to the application', () => {
  const f=fixture(), target=join(f.home,'profiles/desktop/node_modules/@deepviewer'); mkdirSync(target,{recursive:true}); symlinkSync(f.web,join(target,'adapter'))
  prepareDesktopProfile(f.home,f.runtime,f.integrations)
  expect(readlinkSync(join(target,'adapter'))).toBe(f.web)
  expect(readFileSync(join(f.home,'profiles/desktop/package.json'),'utf8')).not.toContain('@deepviewer/adapter')
  expect(readFileSync(join(f.web,'package.json'),'utf8')).toContain('dsh-better-sidebar')
 })
 it('disables a migrated integration and keeps recovery choices after removing the flag', () => {
  const f = fixture(); prepareDesktopProfile(f.home,f.runtime,f.integrations)
  prepareDesktopProfile(f.home,f.runtime,f.integrations,['@deepviewer/adapter'])
  const target = join(f.home,'profiles/desktop/package.json')
  expect(JSON.parse(readFileSync(target,'utf8')).dsh.profile.bundles).toEqual(['@deepseek-ai/dsh-base'])
  prepareDesktopProfile(f.home,f.runtime,f.integrations)
  expect(JSON.parse(readFileSync(target,'utf8')).dsh.profile.bundles).toEqual(['@deepseek-ai/dsh-base'])
  expect(readFileSync(join(f.home,'profiles/desktop/cordis.patch.yml'),'utf8')).toContain('secret-reference')
  expect(readFileSync(join(f.home,'profiles/desktop/cordis.patch.yml'),'utf8')).toContain('deepviewer-adapter\n  disabled: true')
 })
 it('converts an existing plugin profile, preserves settings/disabled choices and can retry and restore owned links', () => {
  const f = fixture(), target = join(f.home,'profiles/desktop'), marker = join(f.home,'.deepviewer-desktop-migration.json')
  const names = ['@deepviewer/adapter','@deepviewer/dsh-plugin-model-capabilities','dsh-plugin-subscriptions']
  const integrations = names.map((name,i) => { const directory=join(f.root,`module-${i}`); mkdirSync(directory); writeFileSync(join(directory,'package.json'),JSON.stringify({name,version:'1.0.0'})); return {name,directory,version:'1.0.0'} })
  mkdirSync(join(target,'node_modules/@deepviewer'),{recursive:true}); symlinkSync(integrations[0]!.directory,join(target,'node_modules/@deepviewer/adapter'))
  const original = JSON.stringify({dependencies:Object.fromEntries([...names.map(name=>[name,'1.0.0']),['other-plugin','1.2.3']]),dsh:{profile:{bundles:['@deepseek-ai/dsh-base',names[0],names[1],'other-plugin']}}})
  writeFileSync(join(target,'package.json'),original)
  writeFileSync(join(target,'cordis.patch.yml'),'- id: custom-provider\n  config:\n    credential: secret-reference\n- insert:\n  - id: old-model-row\n    name: "@deepviewer/dsh-plugin-model-capabilities"\n    config:\n      limits:\n        concurrency: 7\n')
  writeFileSync(join(target,'pnpm-lock.yaml'),'lockfileVersion: "9.0"\nimporters:\n  .:\n    dependencies:\n      "@deepviewer/adapter":\n        specifier: 1.0.0\n        version: 1.0.0\n      other-plugin:\n        specifier: 1.2.3\n        version: 1.2.3\n')
  const oldJournal = {schemaVersion:1,completedAt:'fixture',ownedLinks:{'@deepviewer/adapter':integrations[0]!.directory}}
  writeFileSync(marker,JSON.stringify(oldJournal)); writeFileSync(join(f.home,'.credentials.yaml'),'untouched-account-data')
  prepareDesktopProfile(f.home,f.runtime,integrations)
  const migrated=JSON.parse(readFileSync(join(target,'package.json'),'utf8'))
  expect(migrated.dependencies).toEqual({'other-plugin':'1.2.3'}); expect(migrated.dsh.profile.bundles).toEqual(['@deepseek-ai/dsh-base','other-plugin'])
  expect(existsSync(join(target,'node_modules/@deepviewer/adapter'))).toBe(false)
  const patch=readFileSync(join(target,'cordis.patch.yml'),'utf8')
  expect(patch).toContain('concurrency: 7'); expect(patch).toContain('id: model-capabilities'); expect(patch).not.toContain('old-model-row')
  expect(patch).toContain('llm-subscriptions\n  disabled: true'); expect(patch).not.toContain('deepviewer-adapter\n  disabled: true')
  expect(readFileSync(join(target,'pnpm-lock.yaml'),'utf8')).not.toContain('@deepviewer/adapter')
  expect(readFileSync(join(target,'pnpm-lock.yaml'),'utf8')).toContain('other-plugin')
  expect(statSync(join(f.home,'migration-backups/builtins-v1/desktop/cordis.patch.yml')).mode & 0o777).toBe(0o600)
  // Simulate failure just before completion. Retry must consult the backed-up selection.
  writeFileSync(marker,JSON.stringify(oldJournal)); prepareDesktopProfile(f.home,f.runtime,integrations)
  expect(readFileSync(join(target,'cordis.patch.yml'),'utf8')).toBe(patch)
  rollbackDesktopProfile(f.home)
  expect(readFileSync(join(target,'package.json'),'utf8')).toBe(original)
  expect(readlinkSync(join(target,'node_modules/@deepviewer/adapter'))).toBe(integrations[0]!.directory)
  expect(JSON.parse(readFileSync(marker,'utf8'))).toEqual(oldJournal)
  expect(readFileSync(join(f.home,'.credentials.yaml'),'utf8')).toBe('untouched-account-data')
 })
 it('rejects missing application modules before altering old profile metadata', () => {
  const f=fixture(); const old=readFileSync(join(f.web,'package.json'),'utf8')
  rmSync(f.directory,{recursive:true})
  expect(()=>prepareDesktopProfile(f.home,f.runtime,f.integrations)).toThrow('Missing integration')
  expect(readFileSync(join(f.web,'package.json'),'utf8')).toBe(old)
  expect(existsSync(join(f.home,'profiles/desktop/package.json'))).toBe(false)
 })
 it('replaces the legacy DeepViewer reasoning activation while retaining provider settings and rollback evidence', () => {
  const f = fixture(), legacy = '@deepviewer/dsh-plugin-reasoning'
  const models = {providers:{fixture:{api:'openai-completions',apiKeyEnv:'FIXTURE_KEY',models:[{id:'fixture-model',input:['text','image'],reasoningEfforts:{high:'high'}}]}}}
  const settings = JSON.stringify(models), report = JSON.stringify({version:2,jobs:[],models:{}})
  writeFileSync(join(f.home,'settings.yaml'),settings); writeFileSync(join(f.home,'deepviewer-model-scans.json'),report)
  writeFileSync(join(f.web,'package.json'),JSON.stringify({dependencies:{[legacy]:'0.1.0','other-plugin':'1.2.3'},optionalDependencies:{[legacy]:'0.1.0'},dsh:{profile:{bundles:[legacy,'other-plugin']}}}))
  const oldPatch = '- insert:\n  - id: deepviewer-model-reasoning\n    name: "@deepviewer/dsh-plugin-reasoning"\n    config:\n      settingsNamespace: llm-pi-ai\n      limits:\n        concurrency: 4\n      obsoleteOption: retained-in-backup\n- id: deepviewer-model-reasoning\n  disabled: true\n- id: custom-provider\n  config:\n    credential: secret-reference\n'
  writeFileSync(join(f.web,'cordis.patch.yml'),oldPatch)
  prepareDesktopProfile(f.home,f.runtime,f.integrations)
  const target = join(f.home,'profiles/desktop'), manifest = JSON.parse(readFileSync(join(target,'package.json'),'utf8'))
  expect(manifest.dependencies).toEqual({'other-plugin':'1.2.3'}); expect(manifest.optionalDependencies).toEqual({})
  expect(manifest.dsh.profile.bundles).not.toContain(legacy)
  expect(load(readFileSync(join(target,'cordis.patch.yml'),'utf8'))).toEqual([
   {id:'model-capabilities',config:{settingsNamespace:'llm-pi-ai',limits:{concurrency:4}}},
   {id:'model-capabilities',disabled:true},
   {id:'custom-provider',config:{credential:'secret-reference'}},
  ])
  expect(readFileSync(join(f.home,'settings.yaml'),'utf8')).toBe(settings)
  expect(readFileSync(join(f.home,'deepviewer-model-scans.json'),'utf8')).toBe(report)
  expect(readFileSync(join(f.home,'migration-backups/desktop-v1/web/cordis.patch.yml'),'utf8')).toBe(oldPatch)
  prepareDesktopProfile(f.home,f.runtime,f.integrations)
  expect(readFileSync(join(f.home,'settings.yaml'),'utf8')).toBe(settings)
 })
 it('keeps the replacement model scanner selected when converting an existing reasoning plugin profile', () => {
  const f=fixture(), target=join(f.home,'profiles/desktop'), name='@deepviewer/dsh-plugin-model-capabilities'
  mkdirSync(target,{recursive:true})
  writeFileSync(join(target,'package.json'),JSON.stringify({dependencies:{'@deepviewer/dsh-plugin-reasoning':'0.1.0'},dsh:{profile:{bundles:['@deepviewer/dsh-plugin-reasoning']}}}))
  writeFileSync(join(target,'cordis.patch.yml'),'- insert:\n  - id: deepviewer-model-reasoning\n    name: "@deepviewer/dsh-plugin-reasoning"\n')
  writeFileSync(join(f.home,'.deepviewer-desktop-migration.json'),JSON.stringify({schemaVersion:1,completedAt:'fixture',ownedLinks:{}}))
  const directory=join(f.root,'model-capabilities'); mkdirSync(directory); writeFileSync(join(directory,'package.json'),JSON.stringify({name,version:'1.0.2'}))
  prepareDesktopProfile(f.home,f.runtime,[{name,directory,version:'1.0.2'}])
  expect(readFileSync(join(target,'cordis.patch.yml'),'utf8')).not.toContain('disabled: true')
  expect(JSON.parse(readFileSync(join(target,'package.json'),'utf8')).dependencies).toEqual({})
 })
 it('validates the explicit frontend allowlist and strips unrelated credentials', () => {
  const draft=JSON.stringify({draft:'keep my draft',view:null}), values=filterWebState({'dsh.conversation.session-1':draft,'api-key':'private','browser-auth':'private'})
  expect(values).toEqual({'dsh.conversation.session-1':draft}); expect(()=>filterWebState({'dsh.conversation.s1':'{"draft":42}'})).toThrow('draft')
  expect(legacyOrigins('INFO runtime ready origin=http://127.0.0.1:19876\nINFO runtime ready origin=https://example.com\n')).toEqual(['http://127.0.0.1:19876'])
 })
})
