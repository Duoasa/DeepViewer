/** Explicit publication entry. Upload immutable assets first and the mutable channel feed last. */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from 'js-yaml'
import { createRequire } from 'node:module'
import { updateFeed } from './package-native.mjs'
const appRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..'),upstream=resolve(appRoot,'../../upstream/deepseek-harness'),require=createRequire(join(upstream,'apps/desktop/package.json')), {gt,valid}=require('semver')
export function validateFeed(directory,channel) {
 const path=join(directory,`${channel}-mac.yml`),feed=load(readFileSync(path,'utf8'))
 if(!valid(feed.version) || (channel==='latest' && feed.version.includes('-')))throw new Error('Invalid channel version')
 const assets=[]
 for(const file of feed.files ?? []) {
  if(typeof file.url!=='string' || basename(file.url)!==file.url || !file.url.endsWith('.zip') || file.url.includes('unsigned'))continue
  const asset=join(directory,file.url);if(!existsSync(asset) || statSync(asset).size!==file.size || createHash('sha512').update(readFileSync(asset)).digest('base64')!==file.sha512)throw new Error('Update ZIP integrity mismatch')
  const blockmap=asset+'.blockmap';if(!existsSync(blockmap))throw new Error('Missing ZIP blockmap')
  assets.push(asset,blockmap)
 }
 if(assets.length!==2 || basename(assets[0])!==`DeepViewer-${feed.version}-arm64.zip` || feed.path!==basename(assets[0]))throw new Error('Channel feed must reference exactly the qualified arm64 ZIP')
 return {path,feed,assets}
}
export function validateQualification(receipt, feed, channel) {
 const zip=feed.files.find(file=>file.url===feed.path)
 if(receipt?.schemaVersion!==1 || receipt.channel!==channel || receipt.version!==feed.version || receipt.zipSha512!==zip?.sha512)throw new Error('Installed-update qualification does not match this channel and ZIP')
 for(const scenario of ['consecutive','skipped','fullDownload','differentialFallback','busyTaskDeferral','signedInstall','userDataPreserved','relaunch'])if(receipt.scenarios?.[scenario]!==true)throw new Error(`Installed-update qualification missing: ${scenario}`)
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 if(!process.argv.includes('--publish'))throw new Error('Use --publish only after release authorization and signed-update qualification')
 const channel=process.argv.includes('--channel=preview')?'preview':'latest',directory=resolve(process.argv.find(arg=>arg.startsWith('--from='))?.slice(7) ?? join(appRoot,'out',channel))
 const {path,feed,assets}=validateFeed(directory,channel),config=updateFeed(channel),tag=channel==='latest'?'updates-stable':'updates-preview'
 validateQualification(JSON.parse(readFileSync(join(directory,'qualification.json'),'utf8')),feed,channel)
 // This endpoint is fixed per channel: old blockmaps remain addressable across skipped versions.
 const previous=await fetch(`${config.url}/${basename(path)}`)
 if(previous.ok) {const current=load(await previous.text());if(!gt(feed.version,current.version))throw new Error('Public release must increase its semantic version')}
 else if(previous.status!==404)throw new Error(`Cannot verify existing feed: HTTP ${previous.status}`)
 const app=join(directory,'mac-arm64','DeepViewer.app');if(!existsSync(app))throw new Error('Signed application is required for publication verification')
 const {verifyMacOSNotarizedApplication}=await import(join(upstream,'apps/desktop/scripts/verify-macos-signature.mjs'))
 if(!process.env.DEEPVIEWER_SIGN_IDENTITY || !process.env.DEEPVIEWER_TEAM_ID)throw new Error('Release identity required')
 verifyMacOSNotarizedApplication(app,{signingIdentity:process.env.DEEPVIEWER_SIGN_IDENTITY,teamId:process.env.DEEPVIEWER_TEAM_ID})
 // Verify the ZIP users will receive, rather than trusting a separate signed app beside it.
 const unpacked=mkdtempSync(join(tmpdir(),'deepviewer-update-audit-'))
 try {
  execFileSync('/usr/bin/ditto',['-x','-k',assets[0],unpacked])
  const bundles=readdirSync(unpacked).filter(name=>name.endsWith('.app'));if(bundles.length!==1)throw new Error('Update ZIP must contain one application')
  const extracted=join(unpacked,bundles[0]),plist=join(extracted,'Contents/Info.plist')
  const property=key=>execFileSync('/usr/bin/plutil',['-extract',key,'raw','-o','-',plist],{encoding:'utf8'}).trim()
  if(property('CFBundleShortVersionString')!==feed.version || property('CFBundleIdentifier')!=='com.deepviewer.desktop')throw new Error('Update ZIP product/version mismatch')
  verifyMacOSNotarizedApplication(extracted,{signingIdentity:process.env.DEEPVIEWER_SIGN_IDENTITY,teamId:process.env.DEEPVIEWER_TEAM_ID})
 } finally {rmSync(unpacked,{recursive:true,force:true})}
 // The feed release must already be provisioned intentionally. This script never creates a public release silently.
 execFileSync('gh',['release','view',tag,'--repo','Duoasa/DeepViewer'],{stdio:'inherit'})
 execFileSync('gh',['release','upload',tag,...assets,'--repo','Duoasa/DeepViewer'],{stdio:'inherit'})
 execFileSync('gh',['release','upload',tag,path,'--clobber','--repo','Duoasa/DeepViewer'],{stdio:'inherit'})
 console.info(JSON.stringify({published:true,channel,version:feed.version,feedLast:true,keptHistoricalBlockmaps:true}))
}
