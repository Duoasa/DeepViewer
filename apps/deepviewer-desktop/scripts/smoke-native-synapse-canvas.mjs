import { createServer } from 'node:http';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const fixture=mkdtempSync('/private/tmp/deepviewer-canvas-');
const assets=join(root,'apps/deepviewer-adapter/assets/synapse');
const html=`<!doctype html><html><body style="margin:0;width:100vw;height:100vh;overflow:hidden"><iframe style="display:block;border:0;width:100%;height:100%" src="/map/index.html"></iframe><script>
window.composeCalls=[];window.sendCalls=[];window.layoutReports=[];window.delayCompose=0;window.delayProjection=0;window.projectionDetailPending=0;window.currentId='one';
const threads=[{id:'t-one',dshSessionId:'one',dshSessionTitle:'One',title:'One',parentId:null,seedLength:0,messages:[{kind:'user',text:'First question',sourceSeq:1,at:'2026-10-02T00:00:00Z'},{kind:'assistant',text:'First answer',sourceSeq:2,at:'2026-10-02T00:00:01Z'}]},{id:'t-two',dshSessionId:'two',dshSessionTitle:'Two',title:'Two',parentId:'t-one',seedLength:3,messages:[{kind:'user',text:'Second question',sourceSeq:5,at:'2026-10-02T00:00:00Z'},{kind:'assistant',text:'Second answer',sourceSeq:6,at:'2026-10-02T00:00:01Z'},{kind:'user',text:'/private/fixture-name.png',deepviewerAttachmentOnly:true,sourceSeq:7,at:'2026-10-02T00:00:02Z'},{kind:'assistant',text:'Attachment answer',sourceSeq:8,at:'2026-10-02T00:00:03Z'}]}];
window.presentation={locale:'zh-CN',fontSize:18,fontFamily:'Arial',tokens:{background:'#151515',surface:'#232323',text:'#eeeeee',muted:'#92969e',border:'#363638',accent:'#6a9aff'}};
window.sendMap=(type,payload)=>document.querySelector('iframe').contentWindow.postMessage({source:'dsh-synapse',type,...payload},location.origin);
window.addEventListener('message',event=>{if(event.source!==document.querySelector('iframe').contentWindow||event.origin!==location.origin||event.data.source!=='dsh-synapse')return;const data=event.data;if(data.type==='synapse:request-current'){sendMap('synapse:presentation',presentation);sendMap('synapse:theme',{dark:true});sendMap('synapse:workspaces',{workspaces:[{id:'wk',title:'Fixture',sessionIds:threads.map(thread=>thread.dshSessionId)}]});sendMap('synapse:current-session',{session:{id:currentId,title:currentId==='one'?'One':'Two'}});sendMap('synapse:map-opened',{});}if(data.type==='synapse:api'){const summary=data.path.endsWith('/workspaces'),value=summary?{workspaces:[{id:'projection',sessionIds:threads.map(thread=>thread.dshSessionId)}]}:{workspace:{id:'projection',threads}};if(!summary&&delayProjection>0){projectionDetailPending++;setTimeout(()=>{projectionDetailPending--;sendMap('synapse:api-result',{requestId:data.requestId,value});},delayProjection);}else sendMap('synapse:api-result',{requestId:data.requestId,value});}if(data.type==='synapse:layout')layoutReports.push(data);if(data.type==='synapse:compose'){composeCalls.push(data);setTimeout(()=>sendMap('synapse:composed',{requestId:data.requestId,session:{id:data.fork?'branch':data.sessionId}}),delayCompose);}if(data.type==='synapse:send-message')sendCalls.push(data);if(data.type==='synapse:activate-session'&&data.sessionId!==currentId){currentId=data.sessionId;document.querySelector('iframe').src='/map/index.html?native='+currentId;}});
</script></body></html>`;
const server=createServer((req,res)=>{res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'none'");if(req.url==='/')return res.end(html);const name=new URL(req.url,'http://localhost').pathname.replace('/map/','');if(!['index.html','styles.css','app.js'].includes(name)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',name.endsWith('html')?'text/html':name.endsWith('css')?'text/css':'text/javascript');res.end(readFileSync(join(assets,name)));});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
const probe=`(async()=>{const wait=async f=>{for(let i=0;i<200;i++){if(f())return;await new Promise(r=>setTimeout(r,20));}throw new Error('Timed out '+f.toString());};const frame=()=>document.querySelector('iframe'),doc=()=>frame().contentDocument;await wait(()=>doc()?.querySelectorAll('.thread-card').length===3);if([...doc().querySelectorAll('.graph-continue-button,.graph-fold-button,.graph-branch-button,.node-handle')].some(el=>el.getBoundingClientRect().width<32||el.getBoundingClientRect().height<32))throw new Error('Graph controls have undersized hit targets');if(doc().querySelector('.sidebar,.view-switch,form,textarea'))throw new Error('Independent shell/input remains');if(doc().documentElement.lang!=='zh-CN')throw new Error('Locale missing');if(doc().querySelector('.thread-card[data-card-id="t-two:turn:7"] .thread-title').textContent!=='附件消息'||!doc().querySelector('.thread-card[data-card-id="t-two:turn:7"] .thread-answer').textContent.includes('Attachment answer')||doc().querySelector('.thread-card[data-card-id="t-two:turn:5"] .thread-answer').textContent.includes('Attachment answer'))throw new Error('Attachment-only input lost its own turn or Chinese label');if(frame().contentWindow.getComputedStyle(doc().querySelector('.thread-answer')).fontSize!=='18px')throw new Error('Chat font size ignored');presentation.locale='en-US';sendMap('synapse:presentation',presentation);await wait(()=>doc().querySelector('[data-action="show-canvas"]').textContent==='Map');if(doc().querySelector('.thread-card[data-card-id="t-two:turn:7"] .thread-title').textContent!=='Attachment message'||doc().body.textContent.includes('fixture-name.png'))throw new Error('Attachment label not localized or contains a private path');if(frame().contentWindow.getComputedStyle(doc().querySelector('.thread-answer')).color!=='rgb(238, 238, 238)')throw new Error('Theme token ignored');sendMap('synapse:live-reply',{sessionId:'one',running:true,userSeq:99,text:'Wrong future reply'});await new Promise(resolve=>setTimeout(resolve,60));if(doc().querySelector('.thread-card[data-thread="t-one"] .thread-answer').textContent.includes('Wrong future reply'))throw new Error('Future reply attached to old turn');sendMap('synapse:live-reply',{sessionId:'one',running:true,userSeq:1,text:'Live partial answer'});await wait(()=>doc().querySelector('.thread-card[data-thread="t-one"] .thread-answer').textContent.includes('Live partial answer'));sendMap('synapse:live-reply',{sessionId:'one',running:false,userSeq:1,text:''});await wait(()=>doc().querySelector('.thread-card[data-thread="t-one"] .thread-answer').textContent.includes('First answer'));await new Promise(resolve=>setTimeout(resolve,80));doc().querySelector('[data-action="zoom-in"]').click();const beforeSwitchDoc=doc(),beforeSwitchCamera=doc().querySelector('.canvas-content').style.transform;const beforeSwitchCard=doc().querySelector('.thread-card[data-thread="t-two"]');doc().querySelector('.thread-card[data-thread="t-two"] .thread-answer').click();await wait(()=>doc()?.querySelector('.card-inspector[data-inspector-card="t-two:turn:5"]'));if(doc()!==beforeSwitchDoc||doc().querySelector('.thread-card[data-thread="t-two"]')!==beforeSwitchCard||currentId!=='one'||!doc().querySelector('.thread-card[data-card-id="t-two:turn:5"].selected')||doc().querySelector('.canvas-content').style.transform!==beforeSwitchCamera)throw new Error('Browsing must keep the native composer owner and canvas DOM stable');sendMap('synapse:current-session',{session:{id:'one',title:'One'}});await new Promise(r=>setTimeout(r,60));if(doc().querySelector('.thread-card[data-thread="t-two"]')!==beforeSwitchCard||!doc().querySelector('.card-inspector[data-inspector-card="t-two:turn:5"]'))throw new Error('Native pulse stole local inspection');doc().querySelector('.thread-card[data-card-id="t-two:turn:7"] [data-action="show-thread"]').click();if(doc().querySelector('.message-user[data-message-seq="7"] .message-body').textContent!=='Attachment message'||doc().querySelector('.detail-head h1').textContent!=='Attachment message'||doc().body.textContent.includes('fixture-name.png'))throw new Error('Attachment details localization failed');doc().querySelector('[data-action="show-canvas"]').click();const beforeReturnDoc=doc();doc().querySelector('.thread-card[data-thread="t-one"] .thread-answer').click();await wait(()=>doc()?.querySelector('.card-inspector[data-inspector-card="t-one:turn:1"]'));if(doc()!==beforeReturnDoc)throw new Error('Local inspection remounted frame');doc().querySelectorAll('[data-action="toggle-compare"]')[0].click();doc().querySelectorAll('[data-action="toggle-compare"]')[1].click();doc().querySelector('[data-action="show-compare"]').click();if(doc().querySelectorAll('.compare-columns article').length!==2)throw new Error('Compare unavailable');doc().querySelector('[data-action="show-thread"]').click();if(!doc().querySelector('.detail-scroll')||doc().querySelector('form,textarea'))throw new Error('Details did not use native composer');doc().querySelector('[data-action="open-branch"]').click();await wait(()=>composeCalls.length===1);if(!composeCalls[0].fork||composeCalls[0].sessionId!=='one'||composeCalls[0].atSeq!==2||sendCalls.length!==0)throw new Error('Branch must prepare native draft at the reply sequence');doc().querySelector('[data-action="show-canvas"]').click();doc().querySelector('[data-action="open-continue"]').click();await wait(()=>composeCalls.length===2);if(composeCalls[1].fork||composeCalls[1].text!==undefined||sendCalls.length)throw new Error('Followup must prepare native composer');doc().querySelector('[data-action="zoom-in"]').click();const zoom=doc().querySelector('.canvas-controls span').textContent;doc().querySelector('[data-action="show-thread"]').click();const previousDoc=doc();frame().src='/map/index.html?reload=1';await wait(()=>doc()!==previousDoc&&doc()?.querySelector('.detail-scroll'));doc().querySelector('[data-action="show-canvas"]').click();if(doc().querySelector('.canvas-controls span').textContent!==zoom)throw new Error('Camera/zoom did not survive tab remount');const saved=JSON.parse(frame().contentWindow.sessionStorage.getItem('deepviewer:synapse:view:v1:one'));if(JSON.stringify(saved).includes('First question')||JSON.stringify(saved).includes('First answer'))throw new Error('Private content persisted in UI state');return {attachmentOnlyTurn:true,attachmentLocale:true,liveReplyTurnBinding:true,graphHitTargets:true,standaloneShellRemoved:true,nativeDraftOnly:true,compare:true,locale:true,font:true,tokens:true,viewRestored:true,crossSessionBrowseStable:true};})()`;
writeFileSync(join(fixture,'package.json'),JSON.stringify({main:'main.cjs'}));
const geometryProbe="(()=>{const d=document.querySelector('iframe').contentDocument;const toolbar=d.querySelector('.map-toolbar'),tabs=d.querySelector('.canvas-tabs'),controls=d.querySelector('.canvas-controls');const a=tabs.getBoundingClientRect(),b=controls.getBoundingClientRect(),r=toolbar.getBoundingClientRect();if(a.right>b.left&&a.bottom>b.top&&b.bottom>a.top)throw new Error('Toolbar overlaps');if([...toolbar.querySelectorAll('button')].some(el=>el.getBoundingClientRect().right>r.right+1))throw new Error('Narrow toolbar overflows');if(Math.abs(d.querySelector('.synapse-shell').getBoundingClientRect().height-document.querySelector('iframe').clientHeight)>1)throw new Error('Map did not fill iframe');return {narrowToolbar:true,iframeHeight:true};})()";
const pointerFixture = async win => {
  const evaluate = fn => win.webContents.executeJavaScript(`(${fn.toString()})()`);
  const waitFor = async fn => { for (let i=0;i<200;i++) { if(await evaluate(fn))return; await new Promise(r=>setTimeout(r,20)); } throw new Error('Pointer fixture timed out: '+fn); };
  const click = async (selector, duringPress) => {
    const point = await win.webContents.executeJavaScript(`(()=>{const f=document.querySelector('iframe'),d=f.contentDocument,b=d.querySelector(${JSON.stringify(selector)});if(!b)throw new Error('Missing real click target');const r=b.getBoundingClientRect(),o=f.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;if(!b.contains(d.elementFromPoint(x,y)))throw new Error('Real click target is covered: '+${JSON.stringify(selector)});return {x:Math.round(x+o.left),y:Math.round(y+o.top)};})()`);
    win.webContents.sendInputEvent({type:'mouseMove',...point});
    await new Promise(r=>setTimeout(r,20));
    // Chromium can discard the first input while the subframe's initial hit
    // test data is arriving; retry only a press that never reached the DOM.
    let delivered=false;
    for(let i=0;i<3;i++){
      const count=await evaluate(()=>mouseDownCount);
      win.webContents.sendInputEvent({type:'mouseDown',...point,button:'left',clickCount:1});
      await new Promise(r=>setTimeout(r,35));
      if(await evaluate(()=>mouseDownCount)>count){delivered=true;break;}
      win.webContents.sendInputEvent({type:'mouseUp',...point,button:'left',clickCount:1});
      await new Promise(r=>setTimeout(r,100));
      // A release can reach the subframe even when its initial press did not.
      // Exclude that priming attempt; assert the delivered press/up/click chain.
      await evaluate(()=>{pointerTrace.length=0;});
    }
    if(!delivered)throw new Error('Trusted mouseDown did not reach iframe');
    if(duringPress)await duringPress();
    win.webContents.sendInputEvent({type:'mouseUp',...point,button:'left',clickCount:1});
    await new Promise(r=>setTimeout(r,60));
  };
  await waitFor(()=>document.querySelector('iframe').contentDocument?.querySelectorAll('.thread-card').length===3);
  win.webContents.focus();
  // Prime Chromium's initial subframe hit-test routing away from any action.
  win.webContents.sendInputEvent({type:'mouseMove',x:1,y:1});
  win.webContents.sendInputEvent({type:'mouseDown',x:1,y:1,button:'left',clickCount:1});
  win.webContents.sendInputEvent({type:'mouseUp',x:1,y:1,button:'left',clickCount:1});
  await new Promise(r=>setTimeout(r,350));
  await evaluate(()=>{const d=document.querySelector('iframe').contentDocument;window.pointerTrace=[];window.mouseDownCount=0;d.addEventListener('pointerdown',()=>mouseDownCount++,true);for(const type of ['pointerdown','pointerup','click'])d.addEventListener(type,event=>{const action=event.target.closest('[data-action]')?.dataset.action;if(action==='show-card-actions')pointerTrace.push({type:event.type,trusted:event.isTrusted});},true);window.pressedPlus=d.querySelector('.graph-continue-button');});
  await click('.thread-card[data-thread="t-one"] .graph-continue-button',async()=>{
    await evaluate(()=>{presentation.fontSize=19;sendMap('synapse:presentation',presentation);sendMap('synapse:current-session',{session:{id:'one',title:'One'}});});
    await new Promise(r=>setTimeout(r,35));
    if(!await evaluate(()=>pressedPlus.isConnected))throw new Error('Subscription replaced pressed button before click: '+JSON.stringify(await evaluate(()=>pointerTrace)));
  });
  await waitFor(()=>!!document.querySelector('iframe').contentDocument?.querySelector('.card-action-menu'));
  const chain=await evaluate(()=>pointerTrace);
  if(chain.map(e=>e.type).join(',')!=='pointerdown,pointerup,click'||chain.some(e=>!e.trusted))throw new Error('Missing real pointer click chain: '+JSON.stringify(chain));
  if(!await evaluate(()=>composeCalls.length===0))throw new Error('Plus must show choices before preparing native draft');
  await evaluate(()=>{delayCompose=250;});
  await click('.card-action-menu [data-action="open-continue"]');
  await evaluate(()=>{const d=document.querySelector('iframe').contentDocument;const b=d.querySelector('.card-action-menu [data-action="open-continue"]');if(!b?.disabled)throw new Error('Pending compose permits duplicate click');b.click();});
  await waitFor(()=>composeCalls.length===1&&!document.querySelector('iframe').contentDocument.querySelector('.card-action-menu'));
  if(!await evaluate(()=>composeCalls[0].sessionId==='one'&&!composeCalls[0].fork&&composeCalls[0].text===undefined&&sendCalls.length===0))throw new Error('Continue did not focus native draft without clearing it');
  await evaluate(()=>{delayCompose=0;presentation.fontSize=18;sendMap('synapse:presentation',presentation);});
  await new Promise(r=>setTimeout(r,40));
  await click('.thread-card[data-thread="t-one"] .graph-continue-button');
  await click('.card-action-menu [data-action="open-branch"]');
  await waitFor(()=>composeCalls.length===2);
  if(!await evaluate(()=>composeCalls[1].sessionId==='one'&&composeCalls[1].fork&&composeCalls[1].atSeq===2&&composeCalls[1].text===undefined&&sendCalls.length===0))throw new Error('Branch did not route actual reply sequence to native draft');
  // A non-current card can be inspected without touching the native owner.
  await evaluate(()=>{const d=document.querySelector('iframe').contentDocument;d.querySelector('.thread-card[data-thread="t-two"] .thread-answer').click();window.browseDoc=d;window.browseCard=d.querySelector('.thread-card[data-thread="t-two"]');sendMap('synapse:current-session',{session:{id:'one',title:'One'}});sendMap('synapse:layout',{composerHeight:120});});
  await waitFor(()=>layoutReports.some(item=>item.inspectorWidth===460));
  if(!await evaluate(()=>{const d=document.querySelector('iframe').contentDocument;return d===browseDoc&&d.querySelector('.thread-card[data-thread="t-two"]')===browseCard&&d.querySelector('.card-inspector[data-inspector-card="t-two:turn:5"]')&&currentId==='one'&&d.documentElement.style.getPropertyValue('--map-composer-height')==='120px';}))throw new Error('Local card inspection or compositor layout failed');
  await evaluate(()=>{const d=document.querySelector('iframe').contentDocument;const a=d.querySelector('.canvas-viewport').getBoundingClientRect(),b=d.querySelector('.card-inspector').getBoundingClientRect(),stage=d.querySelector('.canvas-view').getBoundingClientRect();if(a.right>b.left+1||Math.abs(b.bottom-stage.bottom)>1||Math.abs(stage.bottom-a.bottom-120)>1)throw new Error('Detail rail/composer geometry overlaps');d.querySelector('.card-inspector-close').click();});
  await waitFor(()=>!document.querySelector('iframe').contentDocument.querySelector('.card-inspector'));
  await evaluate(()=>{composeCalls.length=0;sendMap('synapse:layout',{composerHeight:0});sendMap('synapse:presentation',presentation);});
  return {realPointerPlus:true,pressedSubscriptionSafe:true,explicitComposeChoices:true,pendingDraftProtected:true,inspectorComposerLayout:true};
};
const currentTreeFixture = async win => {
  const evaluate = fn => win.webContents.executeJavaScript(`(${fn.toString()})()`);
  const waitFor = async fn => { for (let i=0;i<200;i++) { if(await evaluate(fn))return; await new Promise(r=>setTimeout(r,20)); } throw new Error('Current tree fixture timed out: '+fn); };
  await evaluate(() => {
    const d=document.querySelector('iframe').contentDocument;
    d.querySelector('.thread-card[data-card-id="t-two:turn:5"] .thread-answer').click();
    const current=d.querySelectorAll('.thread-card.current');
    const inspected=d.querySelector('.thread-card[data-card-id="t-two:turn:5"]');
    if(current.length!==1||current[0].dataset.cardId!=='t-one:turn:1'||!inspected.classList.contains('selected')||inspected.classList.contains('current'))throw new Error('Browsing stole the current native tree highlight');
    const w=document.querySelector('iframe').contentWindow;
    if(w.getComputedStyle(inspected).borderColor===w.getComputedStyle(current[0]).borderColor)throw new Error('Inspection still uses the native-current blue border');
    const saved=JSON.parse(w.sessionStorage.getItem('deepviewer:synapse:view:v1:one'));
    saved.activeId='t-one';saved.selectedCardId='t-one:turn:1';saved.inspectorCardId=null;saved.mode='canvas';
    w.sessionStorage.setItem('deepviewer:synapse:view:v1:two',JSON.stringify(saved));
    window.currentId='two';window.beforeCurrentFrame=d;
    document.querySelector('iframe').src='/map/index.html?native=two-stale-parent';
  });
  await waitFor(() => { const d=document.querySelector('iframe').contentDocument;return d!==beforeCurrentFrame&&d?.querySelector('.thread-card.current[data-card-id="t-two:turn:7"]'); });
  await evaluate(() => {
    const d=document.querySelector('iframe').contentDocument;
    if(d.querySelector('.thread-card[data-card-id="t-one:turn:1"]')?.classList.contains('current'))throw new Error('Restored parent browse selection became native-current');
    const edges=[...d.querySelectorAll('.active-connector')].map(e=>e.dataset.from+'>'+e.dataset.to).sort();
    if(JSON.stringify(edges)!==JSON.stringify(['t-one:turn:1>t-two:turn:5','t-two:turn:5>t-two:turn:7']))throw new Error('Native child route lost the ancestor entry edge: '+JSON.stringify(edges));
    d.querySelector('.thread-card[data-card-id="t-one:turn:1"] .thread-answer').click();
    if(d.querySelector('.thread-card.current')?.dataset.cardId!=='t-two:turn:7')throw new Error('Inspecting the trunk changed the active child');
    window.currentTreeCamera=d.querySelector('.canvas-content').style.transform;
    threads[0].messages.push({kind:'user',text:'Later trunk turn',sourceSeq:9},{kind:'assistant',text:'Trunk later answer',sourceSeq:10});
    threads[1].messages.push({kind:'user',text:'Pending child question',sourceSeq:11});
    threads.push({id:'t-sibling',dshSessionId:'sibling',title:'Sibling',parentId:'t-one',sourceSeedLength:3,messages:[{kind:'user',text:'Unrelated branch',sourceSeq:5},{kind:'assistant',text:'Unrelated reply',sourceSeq:6}]});
    sendMap('synapse:live-reply',{sessionId:'two',running:true,userSeq:11,text:'Live child reply'});
  });
  await waitFor(() => { const d=document.querySelector('iframe').contentDocument; return d?.querySelector('.connectors path[data-to="t-two:turn:11"]'); });
  await evaluate(() => {
    const d=document.querySelector('iframe').contentDocument;
    if(d.querySelector('.canvas-content').style.transform!==currentTreeCamera||!d.querySelector('.card-inspector[data-inspector-card="t-one:turn:1"]'))throw new Error('New current turn moved the camera or replaced inspected details');
    const edges=[...d.querySelectorAll('.active-connector')].map(e=>e.dataset.from+'>'+e.dataset.to).sort();
    if(JSON.stringify(edges)!==JSON.stringify(['t-one:turn:1>t-two:turn:5','t-two:turn:5>t-two:turn:7','t-two:turn:7>t-two:turn:11']))throw new Error('Current tree includes future trunk/sibling or omits pending child: '+JSON.stringify(edges));
    d.querySelector('.card-inspector-close').click();
  });
  await waitFor(() => !document.querySelector('iframe').contentDocument.querySelector('.card-inspector'));
  await evaluate(() => {document.querySelector('iframe').contentDocument.querySelector('[data-action="focus-active"]').click();});
  await waitFor(() => document.querySelector('iframe').contentDocument.querySelector('.thread-card.current[data-card-id="t-two:turn:11"]'));
  await evaluate(() => {
    const d=document.querySelector('iframe').contentDocument,current=d.querySelector('.thread-card.current');
    if(d.querySelectorAll('.thread-card.current').length!==1||current.getAttribute('aria-current')!=='true')throw new Error('Pending child is not the unique accessible current card');
    const a=current.getBoundingClientRect(),b=d.querySelector('.canvas-viewport').getBoundingClientRect();
    if(Math.abs((a.left+a.right)/2-(b.left+b.right)/2)>1||Math.abs((a.top+a.bottom)/2-(b.top+b.bottom)/2)>1)throw new Error('Locate targets inspected trunk instead of the current child');
    threads.push({id:'t-blank',dshSessionId:'blank',title:'Blank branch',parentId:'t-one',sourceSeedLength:3,messages:[]});
    const saved=JSON.parse(document.querySelector('iframe').contentWindow.sessionStorage.getItem('deepviewer:synapse:view:v1:two'));
    saved.activeId='t-one';saved.selectedCardId='t-one:turn:1';saved.inspectorCardId=null;
    document.querySelector('iframe').contentWindow.sessionStorage.setItem('deepviewer:synapse:view:v1:blank',JSON.stringify(saved));
    window.currentId='blank';window.beforeBlankFrame=d;
    document.querySelector('iframe').src='/map/index.html?native=blank-child';
  });
  await waitFor(() => {const d=document.querySelector('iframe').contentDocument;return d!==beforeBlankFrame&&d?.querySelector('.connectors path.active-connector[data-to="t-blank:turn:empty"]');});
  await evaluate(() => {document.querySelector('iframe').contentDocument.querySelector('[data-action="focus-active"]').click();});
  await waitFor(() => document.querySelector('iframe').contentDocument.querySelector('.thread-card.current[data-card-id="t-blank:turn:empty"]'));
  await evaluate(() => {
    window.delayProjection=160;
    threads.at(-1).messages.push({kind:'user',text:'First blank child message',sourceSeq:13});
    sendMap('synapse:live-reply',{sessionId:'blank',running:true,userSeq:13,text:''});
  });
  await waitFor(() => projectionDetailPending>0);
  await evaluate(() => {
    const f=document.querySelector('iframe'),d=f.contentDocument;
    window.pressedEmptyCard=d.querySelector('.thread-card.current');
    pressedEmptyCard.dispatchEvent(new f.contentWindow.PointerEvent('pointerdown',{bubbles:true,button:0,clientX:5,clientY:5}));
  });
  await new Promise(resolve=>setTimeout(resolve,220));
  await evaluate(() => {
    if(!pressedEmptyCard.isConnected)throw new Error('Projection response replaced the pressed empty card');
    const f=document.querySelector('iframe');window.delayProjection=0;
    f.contentDocument.dispatchEvent(new f.contentWindow.PointerEvent('pointerup',{bubbles:true,button:0}));
  });
  await waitFor(() => document.querySelector('iframe').contentDocument.querySelector('.thread-card.current[data-card-id="t-blank:turn:13"]')).catch(async error => {throw new Error(String(error)+' '+JSON.stringify(await evaluate(() => {const d=document.querySelector('iframe').contentDocument;return {owner:currentId,cards:[...d.querySelectorAll('.thread-card')].map(c=>({id:c.dataset.cardId,current:c.classList.contains('current')})),paths:[...d.querySelectorAll('.connectors path')].map(p=>({to:p.dataset.to,current:p.classList.contains('active-connector')})),camera:d.querySelector('.canvas-content').style.transform};})));});
  await evaluate(() => {const d=document.querySelector('iframe').contentDocument;if(d.querySelector('.thread-card[data-card-id="t-blank:turn:empty"]')||d.querySelector('.thread-card.current')?.dataset.cardId!=='t-blank:turn:13')throw new Error('First user turn did not replace the current empty branch marker');});
  await evaluate(() => {
    threads.at(-1).messages.push({kind:'assistant',text:'Final child reply',sourceSeq:14});
    sendMap('synapse:live-reply',{sessionId:'blank',running:false,userSeq:13,text:''});
  });
  await waitFor(() => document.querySelector('iframe').contentDocument.querySelector('.thread-card.current[data-card-id="t-blank:turn:13"] .thread-answer')?.textContent.includes('Final child reply'));
  return {nativeCurrentTree:true,neutralInspection:true,staleParentCacheSafe:true,ancestorRoute:true,pendingTurnCurrent:true,currentLocate:true,emptyBranchCurrent:true,firstBranchTurnCurrent:true,deferredProjectionCurrent:true,finalReplySameSummary:true};
};
writeFileSync(join(fixture,'main.cjs'),`const {app,BrowserWindow}=require('electron');app.setPath('userData',${JSON.stringify(join(fixture,'user-data'))});app.whenReady().then(async()=>{const win=new BrowserWindow({width:1000,height:650,show:false,webPreferences:{nodeIntegration:false,contextIsolation:true}});win.webContents.on('console-message',(...args)=>console.log(args[1]?.message??args[2]));try{await win.loadURL(${JSON.stringify(url)});const pointer=await (${pointerFixture.toString()})(win);const result=await win.webContents.executeJavaScript(${JSON.stringify(probe+".catch(error=>({error:String(error),stack:error.stack}))")});if(result.error)throw new Error(JSON.stringify(result));const tree=await (${currentTreeFixture.toString()})(win);win.setSize(430,500);await new Promise(r=>setTimeout(r,100));const geometry=await win.webContents.executeJavaScript(${JSON.stringify(geometryProbe)});console.log(JSON.stringify({result:'PASS',...pointer,...result,...tree,...geometry}));app.quit();}catch(error){console.error(error);app.exit(1);}});setTimeout(()=>app.exit(2),20000).unref();`);
const electron=createRequire(join(root,'apps/deepviewer-desktop/package.json'))('electron');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD/u.test(key))delete env[key];
try{const child=spawn(electron,[fixture],{cwd:fixture,env,stdio:['ignore','pipe','pipe']});child.stdout.pipe(process.stdout);child.stderr.pipe(process.stderr);const code=await new Promise(resolve=>child.on('exit',resolve));if(code!==0)process.exitCode=code;}finally{server.close();rmSync(fixture,{recursive:true,force:true});}
