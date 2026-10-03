import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditRuntime, locatePackage, materializeClosure, productionGraph } from './native-package-closure.mjs'
import { auditNativePayload, pruneForeignRuntimePackages } from './audit-native-payload.mjs'
const appRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..'), root=resolve(appRoot,'../..'), upstream=join(root,'upstream/deepseek-harness')
export async function prepareNativeRuntime(outputStage = join(appRoot, '.desktop/package-stage')) {
 const {register}=await import(createRequire(join(upstream,'package.json')).resolve('tsx/esm/api'));register()
 const {desktopRuntimeFileExclusion}=await import(join(upstream,'apps/desktop/scripts/runtime-file-policy.ts'))
 const {writeDesktopRuntime,verifyDesktopRuntime}=await import(join(upstream,'apps/desktop/src/runtime-tree.ts'))
 const stage=resolve(outputStage);rmSync(stage,{recursive:true,force:true});mkdirSync(stage,{recursive:true})
 const runtime=join(stage,'app/dsh'), devRuntime=join(appRoot,'.desktop/native-runtime')
 const names=['@deepseek-ai/dsh','@deepseek-ai/dsh-desktop-host','@deepviewer/adapter','@deepviewer/dsh-plugin-model-capabilities','dsh-plugin-subscriptions']
 const graph=productionGraph(names.map(name=>locatePackage(name,devRuntime)))
 const inventory=materializeClosure(graph,runtime,desktopRuntimeFileExclusion,readFileSync(join(upstream,'LICENSE'),'utf8'))
 const dev=JSON.parse(readFileSync(join(devRuntime,'desktop-runtime.json'),'utf8'))
 writeFileSync(join(runtime,'package.json'),readFileSync(join(devRuntime,'package.json')))
 writeDesktopRuntime(runtime,dev.release,[...new Set(inventory.filter(item=>item.name.startsWith('@deepseek-ai/') || names.includes(item.name)).map(item=>item.name))],graph.target)
 await verifyDesktopRuntime(runtime,dev.release.version,graph.target)
 const shellRoots=['electron-updater','semver','ws','@deepseek-ai/cordis','@deepseek-ai/dsh-api-gateway']
 const shell=join(stage,'app'),shellGraph=productionGraph(shellRoots.map(name=>locatePackage(name,join(upstream,'apps/desktop'))))
 // Materialize separately so the shell never depends on a developer's node_modules tree.
 const shellTemp=join(stage,'shell');materializeClosure(shellGraph,shellTemp,desktopRuntimeFileExclusion,readFileSync(join(upstream,'LICENSE'),'utf8'))
 cpSync(join(shellTemp,'node_modules'),join(shell,'node_modules'),{recursive:true});cpSync(join(shellTemp,'THIRD-PARTY-PACKAGES.json'),join(shell,'THIRD-PARTY-SHELL.json'));rmSync(shellTemp,{recursive:true,force:true})
 cpSync(join(appRoot,'lib'),join(shell,'lib'),{recursive:true,filter:path=>!path.endsWith('.map')})
 cpSync(join(appRoot,'renderer'),join(shell,'renderer'),{recursive:true,filter:path=>!path.endsWith('.map')})
 cpSync(join(appRoot,'package.json'),join(shell,'package.json'))
 const product=JSON.parse(readFileSync(join(shell,'package.json'),'utf8'));delete product.devDependencies;delete product.scripts;product.dependencies=Object.fromEntries(shellRoots.map(name=>[name,JSON.parse(readFileSync(join(shell,'node_modules',name,'package.json'),'utf8')).version]));writeFileSync(join(shell,'package.json'),JSON.stringify(product,null,2)+'\n');writeFileSync(join(shell,'lib/package.json'),JSON.stringify(product)+'\n')
 if (!existsSync(join(appRoot,'.desktop/runtime/primary-runtime/runtime.json'))) throw new Error('Prepare DeepViewer-owned primary runtime before packaging; official app fixtures are forbidden')
 // pnpm's published payload is bin/dist plus its manifest and notices. Cloud
 // synchronization may leave unrelated build artifacts and duplicate folders.
 const pnpmPayload = path => !path || ['bin','dist','package.json','LICENSE','README.md','CHANGELOG.md'].includes(path.split('/')[0]) && !path.endsWith('.map')
 const primarySource = join(appRoot,'.desktop/runtime')
 cpSync(primarySource,join(stage,'resources/runtime'),{recursive:true,filter:path=>{
  const child=relative(primarySource,path).split('\\').join('/')
  const prefix='primary-runtime/dependencies/pnpm/'
  return !child.startsWith(prefix) || pnpmPayload(child.slice(prefix.length))
 }})
 const pnpmSource = join(root,'node_modules/pnpm')
 cpSync(pnpmSource,join(stage,'resources/runtime/pnpm'),{recursive:true,filter:path=>pnpmPayload(relative(pnpmSource,path).split('\\').join('/'))})
 cpSync(join(upstream,'apps/desktop/scripts/node-bin'),join(stage,'resources/runtime/bin'),{recursive:true})
 cpSync(join(appRoot,'.desktop/native-icon/DeepViewerDockThemes'),join(stage,'resources/DeepViewerDockThemes'),{recursive:true})
 cpSync(join(root,'apps/deepviewer-adapter/assets/icon-light.png'),join(stage,'resources/icon.png'))
 const removedForeignPackages=pruneForeignRuntimePackages(join(stage,'resources/runtime')),architecture=auditNativePayload(stage)
 const report={schemaVersion:1,product:product.version,build:product.buildNumber,kernel:dev.release.version,protocol:dev.release.hostProtocolVersion,target:graph.target,dependencyPackages:inventory.length,runtime:auditRuntime(runtime),architecture,removedForeignPackages}
 writeFileSync(join(stage,'audit.json'),JSON.stringify(report,null,2)+'\n');console.info(JSON.stringify({...report,architecture:{machOBinaries:architecture.machOBinaries},audit:join(stage,'audit.json')}));return stage
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) await prepareNativeRuntime()
