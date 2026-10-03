/** Real HTTP Range/blockmap reconstruction through the pinned updater; never invokes installation. */
import { createServer } from 'node:http'
import { createHash, randomBytes } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname, basename } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { dump } from 'js-yaml'
const appRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..'), desktopRequire=createRequire(resolve(appRoot,'../../upstream/deepseek-harness/apps/desktop/package.json')),buildRequire=createRequire(desktopRequire.resolve('app-builder-lib/package.json')),updaterRequire=createRequire(desktopRequire.resolve('electron-updater/package.json'))
const {buildBlockMap}=desktopRequire('app-builder-lib/out/targets/blockmap/blockmap.js'),{NodeHttpExecutor}=buildRequire('builder-util'),{CancellationToken}=updaterRequire('builder-util-runtime'),{AppUpdater}=desktopRequire('electron-updater/out/AppUpdater.js'),{GenericProvider}=desktopRequire('electron-updater/out/providers/GenericProvider.js')
const fixture=mkdtempSync(join(tmpdir(),'deepviewer-updates-')),cache=join(fixture,'cache');mkdirSync(join(cache,'pending'),{recursive:true})
const versions=['0.7.0','0.7.1','0.7.3'],base=randomBytes(1024*1024),bodies=new Map(),metadata=new Map()
for(let i=0;i<versions.length;i++){const bytes=Buffer.from(base);bytes.fill(i+1,130000,132000+i*2000);bodies.set(versions[i],bytes);const path=join(fixture,`DeepViewer-${versions[i]}-arm64.zip`);writeFileSync(path,bytes);metadata.set(versions[i],await buildBlockMap(path,'gzip',path+'.blockmap'))}
let mode='range',current='0.7.1',rangeBytes=0,fullBytes=0
const server=createServer((req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname
 if(path==='/latest-mac.yml'){const file=metadata.get(current);res.end(dump({version:current,files:[{url:`DeepViewer-${current}-arm64.zip`,sha512:file.sha512,size:file.size}],path:`DeepViewer-${current}-arm64.zip`,sha512:file.sha512,releaseDate:new Date().toISOString()}));return}
 const match=/^\/DeepViewer-(0\.7\.[0-9])-arm64\.zip(\.blockmap)?$/.exec(path)
 if(!match){res.writeHead(404);res.end();return}
 if(mode==='http-failure'){res.writeHead(503);res.end('fixture failure');return}
 const file=join(fixture,basename(path));if(!existsSync(file)){res.writeHead(404);res.end();return}
 const bytes=readFileSync(file)
 if(match[2]){res.end(mode==='bad-blockmap'?Buffer.from('invalid gzip'):bytes);return}
 if(req.headers.range && mode!=='no-range'){
  const range=/^bytes=(\d+)-(\d+)$/.exec(req.headers.range);if(!range){res.writeHead(416);res.end();return}
  const start=Number(range[1]),end=Number(range[2]);rangeBytes+=end-start+1;res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${bytes.length}`,'Content-Length':end-start+1,'Accept-Ranges':'bytes'});res.end(bytes.subarray(start,end+1))
 }else{fullBytes+=bytes.length;res.writeHead(200,{'Content-Length':bytes.length});res.end(bytes)}
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`,executor=new NodeHttpExecutor()
executor.download=desktopRequire('electron-updater/out/electronHttpExecutor.js').ElectronHttpExecutor.prototype.download
const request=executor.createRequest.bind(executor);executor.createRequest=(options,callback)=>request({...options,agent:false},callback)
async function attempt(oldVersion,newVersion,{missingCache=false,badHash=false}={}){
 current=newVersion;rangeBytes=0;fullBytes=0;rmSync(join(cache,'current.blockmap'),{force:true});rmSync(join(cache,'update.zip'),{force:true})
 if(!missingCache)copyFileSync(join(fixture,`DeepViewer-${oldVersion}-arm64.zip`),join(cache,'update.zip'))
 const updater=new AppUpdater(undefined,{version:oldVersion,name:'DeepViewer',isPackaged:true});updater.httpExecutor=executor;updater.logger={info(){},warn(){},error(){}};updater.downloadedUpdateHelper={cacheDir:cache,cacheDirForPendingUpdate:join(cache,'pending')}
 const provider=new GenericProvider({provider:'generic',url:origin,channel:'latest'},updater,{executor,platform:'darwin',isUseMultipleRangeRequest:false})
 const latest=await provider.getLatestVersion();assert.equal(latest.version,newVersion)
 const info=provider.resolveFiles(latest)[0];if(badHash)info.info.sha512=Buffer.alloc(64).toString('base64')
 const cancellationToken=new CancellationToken(),destination=join(fixture,'reconstructed.zip'),options={updateInfoAndProvider:{info:latest,provider},cancellationToken,requestHeaders:{}}
 const fallback=await updater.differentialDownloadInstaller(info,options,destination,provider,'update.zip')
 if(fallback)await executor.download(info.url,destination,{cancellationToken,sha512:info.info.sha512})
 assert.equal(createHash('sha512').update(readFileSync(destination)).digest('base64'),metadata.get(newVersion).sha512)
 return {fallback,rangeBytes,fullBytes}
}
try{
 mode='range';const consecutive=await attempt('0.7.0','0.7.1'),skipped=await attempt('0.7.0','0.7.3');assert.equal(consecutive.fallback,false);assert.equal(skipped.fallback,false);assert.ok(consecutive.rangeBytes<base.length/3);assert.ok(skipped.rangeBytes<base.length/3)
 const missing=await attempt('0.7.0','0.7.1',{missingCache:true});assert.equal(missing.fallback,true);assert.ok(missing.fullBytes>=base.length)
 mode='no-range';const noRange=await attempt('0.7.0','0.7.1');assert.equal(noRange.fallback,true)
 mode='bad-blockmap';const corruptMap=await attempt('0.7.0','0.7.1');assert.equal(corruptMap.fallback,true)
 mode='range';await assert.rejects(attempt('0.7.0','0.7.1',{badHash:true}),/sha512|checksum|mismatch/i)
 mode='http-failure';await assert.rejects(attempt('0.7.0','0.7.1'),/503/)
 console.info(JSON.stringify({result:'PASS',realHttp:true,consecutive,skipped,missingCacheFallback:true,noRangeFallback:true,corruptMapFallback:true,badHashRejected:true,httpFailureRejected:true,installationInvoked:false}))
}finally{await new Promise(resolve=>server.close(resolve));rmSync(fixture,{recursive:true,force:true})}
