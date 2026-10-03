import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,readFile,writeFile,lstat,stat,symlink,rm,realpath} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {prepareWorkspaceDeliveries} from '../workflows/workspace-delivery.ts'
import {generatedPaths} from '../workflows/auto-delivery.ts'
import {apply as chatGuard} from '../workflows/chat-guard.ts'
test('automatic delivery retains source bytes, uses outputs, records aliases and reuses the delivery',async()=>{
 const root=await mkdtemp(join(tmpdir(),'deepviewer-delivery-'))
 try{
  const cwd=join(root,'workspace'),source=join(root,'opaque-object');await mkdir(cwd);const bytes=await readFile(new URL('../assets/icon-light.png',import.meta.url));await writeFile(source,bytes)
  const fs={resolve:async(input,{cwd}={})=>({displayPath:resolve(cwd??root,input)}),processPath:value=>value.displayPath,processPathFromHostPath:value=>value,lstat:async(input,{cwd})=>({type:(await lstat(resolve(cwd,input))).isSymbolicLink()?'link':'file'}),stat:async(target)=>({type:(await stat(target.displayPath)).isFile()?'file':'directory'})}
  const ctx={fs,sandboxPolicy:{resolve:()=>({mode:'workspace-write'})}},events=[],session={header:{cwd},snapshotEvents:()=>events}
  const [delivery]=await prepareWorkspaceDeliveries(ctx,session,[{path:source}],new AbortController().signal)
  assert.ok(delivery.path.startsWith(join(await realpath(cwd),'outputs')+'/'));assert.ok(delivery.path.endsWith('.png'));assert.deepEqual(await readFile(delivery.path),bytes);assert.deepEqual(await readFile(source),bytes);assert.ok(delivery.sourcePaths.includes(source))
  events.push({type:'deliverables/presented',data:{files:[delivery]}})
  assert.equal((await prepareWorkspaceDeliveries(ctx,session,[{path:source}],new AbortController().signal))[0].path,delivery.path)
  await assert.rejects(prepareWorkspaceDeliveries(ctx,{header:{},snapshotEvents:()=>[]},[{path:source}],new AbortController().signal),/workspace/)
  const readonly={...ctx,sandboxPolicy:{resolve:()=>({mode:'read-only'})}};await assert.rejects(prepareWorkspaceDeliveries(readonly,{header:{cwd},snapshotEvents:()=>[]},[{path:source}],new AbortController().signal),/read-only/)
  await rm(join(cwd,'outputs'),{recursive:true});await symlink(root,join(cwd,'outputs'));await assert.rejects(prepareWorkspaceDeliveries(ctx,{header:{cwd},snapshotEvents:()=>[]},[{path:source}],new AbortController().signal),/real directory/)
 }finally{await rm(root,{recursive:true,force:true})}
})
test('only producer contracts trigger automatic delivery and Chat restricts project tools',()=>{
 assert.deepEqual(generatedPaths('read',{file_path:'/private/file'},{paths:['/private/file']}),[])
 assert.deepEqual(generatedPaths('bash',{command:'echo generated'},{paths:['/private/file']}),[])
 assert.deepEqual(generatedPaths('image_generate',{}, {paths:['/generated/image','/generated/image']}),['/generated/image'])
 let restriction,guard;chatGuard({tools:{restrict:value=>restriction=value,guard:value=>guard=value}})
 assert.deepEqual(restriction,{allow:[]});assert.equal(guard({name:'web_fetch'}),undefined);assert.match(guard({name:'bash'}),/unavailable/);assert.match(guard({name:'edit'}),/unavailable/)
})
