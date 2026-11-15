import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {login} from '../../gem/tests/integration/helpers.mjs';
export async function locationPanel(page,report,server){
 const ID='neverwinter-atlas',map='modules/neverwinter-atlas/assets/neverwinter.webp';
 const original=await page.evaluate(ID=>foundry.utils.deepClone(game.settings.get(ID,'atlasState')),ID);
 const players=await page.evaluate(async()=>{const users=await User.createDocuments([{name:'Panel Reader',role:CONST.USER_ROLES.PLAYER},{name:'Panel Excluded',role:CONST.USER_ROLES.PLAYER}]);return users.map(u=>u.id);});
 const atlas=page.locator('.nw-atlas'),settings=page.locator('.nw-settings');let readerContext,blockedContext;
 await page.locator('body').click({position:{x:500,y:20}});await page.keyboard.press('KeyM');await atlas.waitFor();await atlas.locator('[data-lang=ru]').click();
 const select=async id=>{await atlas.locator('input[type=search]').fill(id==='castle'?'Castle Never':'Hall of Justice');await atlas.locator(`nav [data-list-place="${id}"]`).click();await page.waitForFunction(id=>document.querySelector('.nw-atlas article')?.dataset.selectedPlace===id,id);};
 try{
  await select('castle');
  const card=atlas.locator('article'),title=card.locator('[data-open-journal]');
  const layout=await card.evaluate(card=>{const r=card.getBoundingClientRect(),nav=card.parentElement.querySelector('nav').getBoundingClientRect(),style=getComputedStyle(card);return {border:parseFloat(style.borderTopWidth),bottom:r.bottom,navTop:nav.top,containsConnections:[...card.querySelectorAll('.nw-connections')].every(e=>{const b=e.getBoundingClientRect();return b.top>=r.top&&b.bottom<=r.bottom;})};});
  assert.ok(layout.border>=1&&layout.containsConnections&&layout.navTop>=layout.bottom);
  const before=await title.evaluate(el=>getComputedStyle(el).boxShadow);await title.hover();await page.waitForTimeout(180);assert.notEqual(await title.evaluate(el=>getComputedStyle(el).boxShadow),before);
  await title.click();await page.waitForFunction(()=>[...foundry.applications.instances.values()].some(a=>a.rendered&&a.document?.documentName==='JournalEntry'));
  // Reopen the same already-rendered sheet after native atlas pointer events.
  // Foundry caches its front ApplicationV2 separately from our native dialog.
  for(let attempt=0;attempt<3;attempt++){
    await atlas.locator('header').click({position:{x:150,y:8}});
    await title.click();
    await page.waitForFunction(()=>{const sheet=[...foundry.applications.instances.values()].find(a=>a.rendered&&a.document?.documentName==='JournalEntry');return sheet && Number(getComputedStyle(sheet.element).zIndex)>Number(getComputedStyle(document.querySelector('.nw-atlas')).zIndex);});
    const onTop=await page.evaluate(()=>{const sheet=[...foundry.applications.instances.values()].find(a=>a.rendered&&a.document?.documentName==='JournalEntry'),journal=sheet.element,atlas=document.querySelector('.nw-atlas'),a=atlas.getBoundingClientRect(),b=journal.getBoundingClientRect();const left=Math.max(a.left,b.left),right=Math.min(a.right,b.right),top=Math.max(a.top,b.top),bottom=Math.min(a.bottom,b.bottom);if(right<=left||bottom<=top)return false;return journal.contains(document.elementFromPoint((left+right)/2,(top+bottom)/2));});
    assert.equal(onTop,true,'Reopened journal receives pointer hits above overlapping atlas');
  }
  report.checks.push('repeated-journal-reopen-above-native-atlas-z-order-and-hit-test');
  const closeJournals=()=>page.evaluate(async()=>{for(const a of foundry.applications.instances.values())if(a.document?.documentName==='JournalEntry')await a.close();});await closeJournals();
  // Double click from a collapsed card, before a single click can move the row.
  await atlas.locator('.nw-viewport').dispatchEvent('contextmenu',{bubbles:true,cancelable:true});assert.equal(await card.isVisible(),false);
  await atlas.locator('input[type=search]').fill('Hall of Justice');await atlas.locator('nav [data-list-place=justice]').dblclick();
  await page.waitForFunction(()=>[...foundry.applications.instances.values()].some(a=>a.rendered&&a.document?.documentName==='JournalEntry'&&a.pageId===a.document.pages.find(p=>p.getFlag('neverwinter-atlas','key')==='justice')?.id));
  await closeJournals();await select('castle');
  await page.evaluate(async({ID,map})=>{const {patchPoint}=await import('/modules/neverwinter-atlas/state.mjs');const source=(await(await fetch('/modules/neverwinter-atlas/data/places.json')).json()).find(p=>p.id==='castle');await patchPoint(source,map,{ownership:{default:2}});},{ID,map});
  const eye=card.locator('.nw-card-access');
  for(const [level,color]of [[3,'owner'],[0,'none'],[2,'view']]){await eye.click({button:'right'});await page.waitForFunction(({ID,map,level})=>game.settings.get(ID,'atlasState').maps[map].points.castle.ownership.default===level,{ID,map,level});assert.equal(await eye.getAttribute('data-access'),color);assert.equal(await atlas.locator('.nw-pin[data-place=castle] .nw-access-icon').getAttribute('data-access'),color);}
  assert.equal(await eye.evaluate(el=>el.classList.contains('fa-eye-slash')),false);
  await eye.dblclick();assert.equal(await settings.locator('[data-user=default]').inputValue(),'2');await settings.locator(`[data-user="${players[1]}"]`).selectOption('0');await settings.locator('[type=submit]').click();await settings.waitFor({state:'detached'});assert.equal(await eye.getAttribute('data-access'),'partial');
  // Check the published reader, marker and loss of access in independent clients.
  await page.evaluate(async({ID,map})=>{const {updateMap}=await import('/modules/neverwinter-atlas/state.mjs');await updateMap(map,value=>{value.ownership={default:2};});},{ID,map});
  readerContext=await page.context().browser().newContext({viewport:{width:1440,height:1000}});await readerContext.addInitScript(()=>localStorage.setItem('core.tourProgress',JSON.stringify({core:{welcome:3}})));const reader=await readerContext.newPage();await login(reader,server,{user:'Panel Reader',gm:false});
  blockedContext=await page.context().browser().newContext({viewport:{width:1440,height:1000}});await blockedContext.addInitScript(()=>localStorage.setItem('core.tourProgress',JSON.stringify({core:{welcome:3}})));const excluded=await blockedContext.newPage();await login(excluded,server,{user:'Panel Excluded',gm:false});
  for(const [client,expected]of [[reader,2],[excluded,0]]){
    // Independent clients may still be consuming the preceding setting update.
    // Assert their effective grants before testing the resulting marker UI.
    await client.waitForFunction(({ID,map,expected})=>{const value=game.settings.get(ID,'atlasState').maps[map],grants=value?.points.castle?.ownership;return Number(value?.ownership.default)===2&&Number(grants?.[game.user.id]??grants?.default??0)===expected;},{ID,map,expected});
    await client.locator('body').click({position:{x:500,y:20}});await client.keyboard.press('KeyM');await client.locator('.nw-atlas').waitFor();
  }
  await reader.locator('.nw-pin[data-place=castle]').waitFor({state:'attached'});
  assert.equal(await reader.locator('.nw-pin[data-place=castle]').count(),1);assert.equal(await excluded.locator('.nw-pin[data-place=castle]').count(),0);
  await reader.locator('.nw-atlas input[type=search]').fill('Castle Never');await reader.locator('[data-list-place=castle]').dblclick();await reader.locator('.nw-public-reader').waitFor();
  const readerText=await reader.locator('.nw-public-reader').innerText();
  assert.match(readerText,/1451/);assert.match(readerText,/1489/);assert.doesNotMatch(readerText,/Реконструк|Реконструкц|сохраняем|2026-/);assert.equal(await reader.locator('.nw-card-access').count(),0);
  await reader.locator('.nw-public-reader button').last().click();
  const evidence=new URL('../docs/testing/location-panel-2026-11-15/',import.meta.url);await fs.mkdir(evidence,{recursive:true});
  await atlas.locator('input[type=search]').fill('');
  await atlas.screenshot({path:new URL('selected-card.png',evidence).pathname.replace(/^\/([A-Z]:)/,'$1')});
  await atlas.locator('input[type=search]').fill('Castle Never');
  await eye.click({button:'right'});await page.waitForFunction(({ID,map})=>game.settings.get(ID,'atlasState').maps[map].points.castle.ownership.default===3,{ID,map});assert.equal(await eye.getAttribute('data-access'),'partial');
  await eye.dblclick();assert.equal(await settings.locator(`[data-user="${players[1]}"]`).inputValue(),'0');await settings.locator('[data-cancel]').click();
  await card.locator('[data-point-settings]').click();assert.equal(await settings.locator('[data-permissions]').count(),0);await settings.locator('[data-cancel]').click();
  // The pin eye has the same independent gestures and must not select/drag it.
  const pinEye=atlas.locator('.nw-pin[data-place=castle] .nw-access-icon');await pinEye.dblclick();await settings.waitFor();await settings.locator('[data-cancel]').click();
  await reader.locator('.nw-atlas [data-open-journal]').click();await reader.locator('.nw-public-reader').waitFor();
  await pinEye.click({button:'right'});await page.waitForFunction(({ID,map})=>game.settings.get(ID,'atlasState').maps[map].points.castle.ownership.default===0,{ID,map});assert.equal(await eye.getAttribute('data-access'),'none');assert.equal(await eye.evaluate(el=>el.classList.contains('fa-eye-slash')),true);
  await reader.locator('.nw-pin[data-place=castle]').waitFor({state:'detached'});assert.equal(await reader.locator('.nw-atlas article').isVisible(),false);
  await reader.locator('.nw-public-reader').waitFor({state:'detached'});
  report.checks.push('location-card-frame-and-title-hover','list-double-click-opens-exact-journal-page','blank-map-right-click-clears-selection','eye-default-view-owner-hide-cycle','partial-player-access-is-yellow','eye-manual-access-and-pin-gestures','gear-does-not-edit-access','quick-cycle-preserves-individual-exceptions','independent-player-reader-gets-expanded-lore','excluded-player-has-no-marker','revocation-removes-player-marker-and-card');
 } finally{
  if(await settings.count())await settings.locator('[data-cancel]').click();
  await readerContext?.close();await blockedContext?.close();
  await page.evaluate(async({ID,original,players})=>{await game.settings.set(ID,'atlasState',original);for(const id of players)await game.users.get(id)?.delete();},{ID,original,players});
  await atlas.locator('[data-close]').click();
 }
}
