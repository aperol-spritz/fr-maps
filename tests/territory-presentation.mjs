import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {labelAppearance} from './label-appearance.mjs';
const ID='neverwinter-atlas',MAP='modules/neverwinter-atlas/assets/neverwinter.webp';
export async function territoryPresentation(gm,reader,fixture,report){
  await fs.mkdir(new URL('evidence/',import.meta.url),{recursive:true});
  const low='area-presentation-low',high='area-presentation-high',hidden='area-presentation-hidden';
  const original=await gm.evaluate(async({ID,MAP,user,low,high,hidden})=>{
    const before=foundry.utils.deepClone(game.settings.get(ID,'atlasState')),next=foundry.utils.deepClone(before),map=next.maps[MAP];
    for(const [id,name,uk,en,vertices,order,access]of [
      [low,'Нижняя область','Нижня область','Lower Region',[[55,15],[65,15],[65,25],[55,25]],0,2],
      [high,'Верхняя область','Верхня область','Upper Region',[[57,17],[63,17],[63,23],[57,23]],1,2],
      [hidden,'Закрытая область','Закрита область','Hidden Region',[[56,16],[64,16],[64,24],[56,24]],-10,0]])map.points[id]={id,map:MAP,area:true,custom:true,x:60,y:20,en,category:'district',ru:{name,lore:'Описание '+name},uk:{name:uk,lore:'Опис '+uk},ownership:{default:0,[user]:access},shape:{points:vertices,color:'#447766',opacity:.1,hidden:false},regionOrder:order};
    await game.settings.set(ID,'atlasState',next);return before;
  },{ID,MAP,user:fixture.users[0].id,low,high,hidden});
  const atlas=gm.locator('.nw-atlas'),playerAtlas=reader.locator('.nw-atlas'),manager=gm.locator('.nw-territory-manager'),settings=gm.locator('.nw-settings');
  await atlas.locator('input[type=search]').fill('');
  const point=async page=>page.locator('.nw-stage').evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width*.6,y:r.y+r.height*.2};});
  let p=await point(gm);await gm.mouse.click(p.x,p.y);assert.match(await atlas.locator('h3').innerText(),/Upper Region/);
  await gm.keyboard.down('Alt');await gm.mouse.click(p.x,p.y);await gm.keyboard.up('Alt');
  await atlas.locator('[data-pick-region="'+low+'"]').click();assert.match(await atlas.locator('h3').innerText(),/Lower Region/);
  p=await point(reader);await reader.mouse.click(p.x,p.y,{button:'right'});const picker=playerAtlas.locator('.nw-region-picker');await picker.waitFor();
  assert.deepEqual((await picker.locator('[data-pick-region]').evaluateAll(nodes=>nodes.map(n=>n.dataset.pickRegion))).sort(),[low,high].sort());
  assert.equal(await picker.locator('[data-pick-region="'+hidden+'"]').count(),0);
  await reader.screenshot({path:fileURLToPath(new URL('evidence/territory-picker-player.png',import.meta.url))});
  await reader.keyboard.press('Escape');await picker.waitFor({state:'detached'});assert.equal(await playerAtlas.count(),1,'Escape closes only the picker');
  const edit=async()=>{await atlas.locator('[data-territories]').click();await manager.locator('[data-edit-region="'+low+'"]').click();};
  const save=async()=>{await manager.locator('[data-region-save]').click();await manager.locator('.nw-region-editor').waitFor({state:'hidden'});await manager.locator('[data-dialog-close]').click();};
  await edit();await manager.locator('[name=regionOrder]').fill('20');await save();
  p=await point(gm);assert.equal(await gm.evaluate(p=>document.elementFromPoint(p.x,p.y)?.dataset.zone,p),low,'Configured layer is above the smaller region');await gm.mouse.click(p.x,p.y);assert.match(await atlas.locator('h3').innerText(),/Lower Region/);
  await edit();await manager.locator('[name=regionLabelEnabled]').check();await manager.locator('[name=regionLabelAudience]').selectOption('gm');await manager.locator('[name=regionLabelSize]').fill('22');await manager.locator('[name=regionLabelX]').fill('60');await manager.locator('[name=regionLabelY]').fill('20');await save();
  const label=atlas.locator('[data-region-label="'+low+'"]');
  const labelSize=async(page,size)=>page.waitForFunction(({id,size})=>{const e=document.querySelector('[data-region-label="'+id+'"]');return e?.isConnected && getComputedStyle(e).fontSize===size;},{id:low,size});
  // Setting hooks can replace a just-found node. Observe the current connected
  // label instead of reading a transient detached element's empty CSS style.
  await labelSize(gm,'22px');assert.equal(await playerAtlas.locator('[data-region-label="'+low+'"]').count(),0);
  await edit();await manager.locator('[name=regionLabelAudience]').selectOption('all');await manager.locator('[name=regionLabelSize]').fill('24');await save();
  await labelSize(reader,'24px');
  await reader.getByRole('button',{name:'UA',exact:true}).click();assert.equal(await playerAtlas.locator('[data-region-label="'+low+'"]').innerText(),'Нижня область (Lower Region)');
  await playerAtlas.locator('[data-region-label="'+low+'"]').click();assert.match(await playerAtlas.locator('h3').innerText(),/Нижня область/);
  const expectedLabel=await labelAppearance(gm,reader,low,report,edit,save);
  await gm.screenshot({path:fileURLToPath(new URL('evidence/territory-labels-GM.png',import.meta.url))});
  await reader.screenshot({path:fileURLToPath(new URL('evidence/territory-labels-player.png',import.meta.url))});
  // Exercise the existing backup UI for the new metadata, without a test-only production API.
  const openBackup=async()=>{await atlas.locator('[data-settings]').click();await settings.locator('[data-backup]').click();await settings.locator('[data-export-backup]').waitFor();};
  await openBackup();const downloading=gm.waitForEvent('download');await settings.locator('[data-export-backup]').click();const download=await downloading,data=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  assert.equal(data.settings.points[low].regionOrder,20);assert.deepEqual(data.settings.points[low].regionLabel,expectedLabel);
  await settings.locator('[data-cancel]').click();
  await gm.evaluate(async({ID,MAP,low})=>{const next=foundry.utils.deepClone(game.settings.get(ID,'atlasState'));next.maps[MAP].points[low].regionOrder=-5;next.maps[MAP].points[low].regionLabel={enabled:false,audience:'gm',size:12};await game.settings.set(ID,'atlasState',next);},{ID,MAP,low});
  await openBackup();const invalid=structuredClone(data);invalid.settings.points[low].regionOrder=101;
  const upload=async data=>settings.locator('[name=backupFile]').setInputFiles({name:'territory-labels.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await upload(invalid);await gm.waitForFunction(()=>document.querySelector('[data-backup-preview]')?.textContent.startsWith('Ошибка:'));assert.equal(await settings.locator('[type=submit]').isDisabled(),true);
  for(const [field,value]of [['color','url(bad)'],['backgroundOpacity',1.5]]){const bad=structuredClone(data);bad.settings.points[low].regionLabel[field]=value;await upload(bad);await gm.waitForFunction(()=>document.querySelector('[data-backup-preview]')?.textContent.startsWith('Ошибка:'));assert.equal(await settings.locator('[type=submit]').isDisabled(),true);}
  const legacy=structuredClone(data);for(const field of ['color','background','border','backgroundOpacity'])delete legacy.settings.points[low].regionLabel[field];await upload(legacy);await gm.waitForFunction(()=>!document.querySelector('.nw-settings [type=submit]').disabled);
  await upload(data);await gm.waitForFunction(()=>!document.querySelector('.nw-settings [type=submit]').disabled);await settings.locator('[type=submit]').click();await settings.waitFor({state:'detached'});
  await gm.reload();await gm.waitForFunction(()=>game.ready);await gm.locator('body').click({position:{x:550,y:20}});await gm.keyboard.press('KeyM');await label.waitFor();
  await labelSize(gm,'24px');assert.equal(await gm.evaluate(({ID,MAP,low})=>game.settings.get(ID,'atlasState').maps[MAP].points[low].regionOrder,{ID,MAP,low}),20);
  assert.deepEqual(await gm.evaluate(({ID,MAP,low})=>game.settings.get(ID,'atlasState').maps[MAP].points[low].regionLabel,{ID,MAP,low}),expectedLabel);
  await gm.waitForFunction(id=>{const e=document.querySelector('[data-region-label="'+id+'"]');return e && getComputedStyle(e).backgroundColor==='rgba(247, 214, 154, 0.35)';},low);
  await atlas.locator('input[type=search]').fill('Lower Region');await atlas.locator('nav button').click();await atlas.locator('[data-point-settings]').click();await settings.locator('[data-user="'+fixture.users[0].id+'"]').selectOption('0');await settings.locator('[type=submit]').click();await settings.waitFor({state:'detached'});
  await playerAtlas.locator('[data-region-label="'+low+'"]').waitFor({state:'detached'});await playerAtlas.locator('[data-zone="'+low+'"]').waitFor({state:'detached'});assert.equal(await playerAtlas.locator('[data-zone="'+high+'"]').count(),1);
  await reader.getByRole('button',{name:'RU',exact:true}).click();
  await gm.evaluate(({ID,original})=>game.settings.set(ID,'atlasState',original),{ID,original});
  await atlas.locator('input[type=search]').fill('Голубое озеро');await atlas.locator('nav button').click();
  assert.deepEqual(await gm.evaluate(id=>game.journal.get(id).toObject(),fixture.keep._id),fixture.keep);
  report.checks.push('overlap-default-click-Alt-picker-and-Escape','overlap-player-picker-excludes-closed-territories','territory-layer-priority-real-hit-test','territory-label-GM-only-and-shared-24px-ru-ua-click','territory-label-access-revocation-live','territory-order-label-backup-validation-restore-and-GM-reload','label-style-invalid-color-alpha-denied-and-legacy-backup-accepted');
}
