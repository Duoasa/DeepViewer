/** Local arm64 packaging and separately authorized signed release preparation. Never publishes implicitly. */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { collectMachOFiles, resolveDeveloperIdApplication, runCapture } from './macos-signing.mjs'
import { auditNativePackagedApp } from './release-audit.mjs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dump } from 'js-yaml'
import { prepareNativeRuntime } from './prepare-native-runtime.mjs'
export function updateFeed(channel) {
 if (!['latest','preview'].includes(channel)) throw new Error('Unsupported update channel')
 return {provider:'generic',url:`https://github.com/Duoasa/DeepViewer/releases/download/updates-${channel==='latest'?'stable':'preview'}`,channel,updaterCacheDirName:`deepviewer-updater-${channel}`}
}
export async function packageNative(args=process.argv.slice(2)) {
 const appRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..'),root=resolve(appRoot,'../..'),upstream=join(root,'upstream/deepseek-harness')
 if (process.platform!=='darwin' || process.arch!=='arm64' || args.some(value=>value.startsWith('--arch=') && value!=='--arch=arm64')) throw new Error('Packaging requires macOS arm64')
 const signed=args.includes('--release'),channel=args.includes('--channel=preview') || args.includes('--preview')?'preview':'latest'
 if (signed && (!process.env.DEEPVIEWER_SIGN_IDENTITY || !process.env.DEEPVIEWER_TEAM_ID || !process.env.DEEPVIEWER_NOTARY_PROFILE || !process.env.CSC_KEYCHAIN)) throw new Error('Signed releases require DEEPVIEWER_SIGN_IDENTITY, DEEPVIEWER_TEAM_ID, DEEPVIEWER_NOTARY_PROFILE and CSC_KEYCHAIN')
 const output=resolve(args.find(value=>value.startsWith('--out='))?.slice(6) ?? join(appRoot,'out',signed?channel:'local-preview'))
 if (output===root || output===appRoot || output==='/') throw new Error('Packaging output must be a dedicated artifact directory')
 // Public assets always start with fresh generated runtimes and outputs. Locked download archives may be reused.
 for (const directory of ['.desktop/runtime','.desktop/native-runtime','.desktop/native-cli','.desktop/package-stage','.desktop/build','lib','renderer']) rmSync(join(appRoot,directory),{recursive:true,force:true})
 rmSync(output,{recursive:true,force:true})
 execFileSync(process.execPath,[join(appRoot,'scripts/bump-build-number.mjs')],{cwd:appRoot,stdio:'inherit'})
 execFileSync(process.execPath,[join(appRoot,'scripts/build-native-desktop.mjs'),'--runtime'],{cwd:appRoot,stdio:'inherit',env:{...process.env,DSH_DESKTOP_PRIMARY_RUNTIME_DIR:undefined}})
 // Materialize signing inputs outside synchronized source folders.
 const stage=await prepareNativeRuntime(mkdtempSync(join(tmpdir(),'deepviewer-package-stage-')))
 if (args.includes('--prepare-only')) return stage
 return packagePreparedNative(stage,{output,signed,channel})
}
/** Complete this build's freshly prepared stage after a signing/notary interruption. */
export async function packagePreparedNative(stage,{output,signed,channel='latest'}) {
 const appRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..'),root=resolve(appRoot,'../..'),upstream=join(root,'upstream/deepseek-harness')
 const current=JSON.parse(readFileSync(join(appRoot,'package.json'),'utf8')),prepared=JSON.parse(readFileSync(join(stage,'audit.json'),'utf8'))
 if(prepared.product!==current.version || prepared.build!==current.buildNumber || prepared.target.platform!=='darwin' || prepared.target.arch!=='arm64') throw new Error('Prepared stage does not match this release build')
 const desktopRequire=createRequire(join(upstream,'apps/desktop/package.json')), {build,Platform,Arch}=desktopRequire('electron-builder')
 const product=JSON.parse(readFileSync(join(stage,'app/package.json'),'utf8')), version=channel==='preview'?product.previewRelease:product.version
 const identity={signingIdentity:process.env.DEEPVIEWER_SIGN_IDENTITY,teamId:process.env.DEEPVIEWER_TEAM_ID}
 const certificate=signed?await resolveDeveloperIdApplication({requestedIdentity:`Developer ID Application: ${identity.signingIdentity}`,keychain:process.env.CSC_KEYCHAIN}):undefined
 const {register}=await import(createRequire(join(upstream,'package.json')).resolve('tsx/esm/api'));register()
 const {writeDesktopRuntime}=await import(join(upstream,'apps/desktop/src/runtime-tree.ts'))
 const descriptor=JSON.parse(readFileSync(join(stage,'app/dsh/desktop-runtime.json'),'utf8'))
 if (signed) {
  const {verifyMacOSRuntimeCode}=await import(join(upstream,'apps/desktop/scripts/verify-macos-signature.mjs'))
  // A bare person/team qualifier can also match Apple Distribution. Sign with
  // the resolved Developer ID certificate hash, then verify its public authority.
  for (const runtime of [join(stage,'app/dsh'),join(stage,'resources/runtime/primary-runtime')]) {
   const files=await collectMachOFiles(runtime);let next=0
   const workers=Array.from({length:Math.min(4,files.length)},async()=>{
    for(;;){const file=files[next++];if(!file)return;const path=relative(runtime,file).split('\\').join('/')
     const jit=path==='dependencies/node/bin/node' || /^node_modules\/@deepseek-ai\/libreoffice-kit-darwin-arm64\/bin\/libreoffice-kit$/u.test(path)
     await runCapture('/usr/bin/codesign',['--force','--sign',certificate.hash,'--keychain',process.env.CSC_KEYCHAIN,'--identifier',`com.deepviewer.desktop.runtime.${createHash('sha256').update(path).digest('hex')}`,'--timestamp','--options','runtime',...(jit?['--entitlements',join(upstream,'apps/desktop/scripts/jit-entitlements.plist')]:[]),file])
     verifyMacOSRuntimeCode(file,identity)
    }
   })
   const results=await Promise.allSettled(workers),errors=results.filter(result=>result.status==='rejected').map(result=>result.reason)
   if(errors.length)throw new AggregateError(errors,'DeepViewer runtime signing failed')
   console.info(`DeepViewer release runtime: signed and verified ${files.length} Mach-O files`)
  }
  writeDesktopRuntime(join(stage,'app/dsh'),descriptor.release,descriptor.sharedPackages.map(item=>item.name),{platform:'darwin',arch:'arm64'})
 }
 product.version=version;product.deepviewerUpdateChannel=channel;product.deepviewerLocalPreview=!signed;writeFileSync(join(stage,'app/package.json'),JSON.stringify(product,null,2)+'\n');writeFileSync(join(stage,'app/lib/package.json'),JSON.stringify(product)+'\n')
 const feed=updateFeed(channel)
 const artifacts=await build({projectDir:join(stage,'app'),targets:Platform.MAC.createTarget(['zip','dmg'],Arch.arm64),publish:'never',config:{
  appId:signed?'com.deepviewer.desktop':'com.deepviewer.desktop.preview',productName:signed?'DeepViewer':'DeepViewer Preview',buildVersion:String(product.buildNumber),electronVersion:product.devDependencies?.electron ?? '44.0.0',
  artifactName:`DeepViewer-${version}-arm64${signed?'':'-unsigned'}.\${ext}`,directories:{output},asar:true,
  electronFuses:{runAsNode:true},
  // File closure already materialized and audited; the builder must not resolve from the source workspace.
  beforeBuild:()=>false,files:['lib/**/*','renderer/**/*','package.json','THIRD-PARTY-SHELL.json',{from:join(stage,'app/node_modules'),to:'node_modules',filter:['**/*']},{from:join(stage,'app/dsh'),to:'dsh',filter:['**/*']},{from:join(stage,'app/dsh/node_modules'),to:'dsh/node_modules',filter:['**/*']}],
  asarUnpack:['**/*.{node,dylib,dll,so,exe}','**/*.so.*','**/spawn-helper','**/@vscode/ripgrep-*/bin/rg','**/node_modules/@deepseek-ai/libreoffice-kit-darwin-arm64/**/*'],extraResources:[{from:join(stage,'resources'),to:'.',filter:['**/*']}],
  beforePack:async context=>{const {officePackageDirectories}=await import(join(upstream,'scripts/libreoffice-packages.mjs'));const packages=await officePackageDirectories(join(stage,'app/dsh'),{platform:'darwin',arch:'arm64'});context.packager.config.asarUnpack.push(...packages.map(directory=>`**/${directory.slice(join(stage,'app/dsh').length+1)}/**/*`))},
  dmg:{sign:signed},
  mac:{icon:join(appRoot,'.desktop/native-icon/DeepViewer.icns'),category:'public.app-category.developer-tools',identity:signed?certificate.hash:null,
   // The default builder signer converts the hash back to a potentially ambiguous
   // display name. Retain the exact certificate through its standard sign helper.
   sign:signed?options=>desktopRequire('app-builder-lib/out/codeSign/macCodeSign.js').sign({...options,identity:certificate.hash,identityValidation:true}):undefined,
   forceCodeSigning:signed,hardenedRuntime:signed,entitlements:join(upstream,'apps/desktop/scripts/macos-entitlements.plist'),entitlementsInherit:join(upstream,'apps/desktop/scripts/macos-entitlements.plist'),signIgnore:['/Contents/Resources/app\\.asar\\.unpacked/dsh(?:/|$)','/Contents/Resources/runtime/primary-runtime(?:/|$)','\\.pak$'],notarize:false,extendInfo:{CFBundleIconName:'DeepViewer',CFBundleLocalizations:['en','zh_CN'],NSMicrophoneUsageDescription:'DeepViewer 使用麦克风进行语音输入。'}},
  publish:signed?[feed]:null,
  afterPack:async context=>{const app=join(context.appOutDir,`${context.packager.appInfo.productFilename}.app`);const resources=join(app,'Contents/Resources');execFileSync('/usr/bin/xattr',['-cr',app]);await auditNativePackagedApp({appPath:app,projectRoot:root});if(signed)writeFileSync(join(resources,'app-update.yml'),dump(feed));const {verifyRuntimeArchive}=await import(join(upstream,'apps/desktop/scripts/verify-runtime-archive.ts'));await verifyRuntimeArchive(join(resources,'app.asar'),JSON.parse(readFileSync(join(stage,'app/dsh/desktop-runtime.json'),'utf8')))},
  afterSign:signed?async context=>{const app=join(context.appOutDir,`${context.packager.appInfo.productFilename}.app`);await desktopRequire('@electron/notarize').notarize({tool:'notarytool',appPath:app,keychainProfile:process.env.DEEPVIEWER_NOTARY_PROFILE});const {verifyMacOSNotarizedApplication}=await import(join(upstream,'apps/desktop/scripts/verify-macos-signature.mjs'));verifyMacOSNotarizedApplication(app,identity)}:undefined,
  artifactBuildCompleted:signed?async artifact=>{if(!artifact.file.endsWith('.dmg'))return;execFileSync('/usr/bin/xcrun',['notarytool','submit',artifact.file,'--keychain-profile',process.env.DEEPVIEWER_NOTARY_PROFILE,'--wait'],{stdio:'inherit'});execFileSync('/usr/bin/xcrun',['stapler','staple',artifact.file],{stdio:'inherit'});const {verifyMacOSDiskImage}=await import(join(upstream,'apps/desktop/scripts/verify-macos-signature.mjs'));verifyMacOSDiskImage(artifact.file,identity)}:undefined,
 }})
 await auditNativePackagedApp({appPath:join(output,'mac-arm64',`${signed?'DeepViewer':'DeepViewer Preview'}.app`),projectRoot:root})
 if(signed && !artifacts.some(file=>file.endsWith('.zip.blockmap'))) throw new Error('Signed release is missing a ZIP blockmap; do not publish')
 console.info(JSON.stringify({result:'prepared',version,channel,signed,artifacts,published:false}));return artifacts
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) await packageNative()
