import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const ID='neverwinter-atlas',MAP='modules/neverwinter-atlas/assets/neverwinter.webp';
export async function backupFlow(gm,fixture,report) {
  const atlas=gm.locator('.nw-atlas'),dialog=gm.locator('.nw-settings');
  const original=await gm.evaluate(async({ID,MAP})=>{
    const before={state:foundry.utils.deepClone(game.settings.get(ID,'atlasState')),drawings:foundry.utils.deepClone(game.settings.get(ID,'drawings'))};
    const next=foundry.utils.deepClone(before.state),map=next.maps[MAP];
    delete map.points.lake.shape.opacity;
    map.points['area-backup-fixture']={id:'area-backup-fixture',area:true,custom:true,map:MAP,x:50,y:50,en:'Backup Cove',category:'water',ru:{name:'Бухта копии',lore:'Публичное описание'},uk:{name:'Затока копії',lore:'Публічний опис'},ownership:{default:0},shape:{points:[[45,45],[55,45],[55,55],[45,55]],color:'#2266aa',opacity:.2,hidden:false}};
    await game.settings.set(ID,'atlasState',next);
    const own=foundry.utils.deepClone(before.drawings);own[MAP]=[{id:'backup-stroke',points:[[20,20],[30,30]],color:'#112233',width:4,name:'Личное имя копии',group:'Заметки',label:'Подпись копии'}];await game.settings.set(ID,'drawings',own);
    return before;
  },{ID,MAP});
  const open=async()=>{await atlas.locator('[data-settings]').click();await dialog.locator('[data-backup]').click();await dialog.locator('[data-export-backup]').waitFor();};
  const upload=async value=>{
    await dialog.locator('[name=backupFile]').setInputFiles({name:'atlas.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
    await gm.waitForFunction(()=>{const p=document.querySelector('[data-backup-preview]');return p && !p.textContent.includes('Выберите файл');});
  };
  await open();const downloadPromise=gm.waitForEvent('download');await dialog.locator('[data-export-backup]').click();const download=await downloadPromise;
  const exported=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  assert.equal(exported.format,ID);assert.equal(exported.version,1);assert.equal(exported.customPoints.length,1);assert.match(exported.customPoints[0].description,/янтарный ключ/);
  assert.equal(exported.drawings[0].group,'Заметки');assert.equal(exported.settings.points['area-backup-fixture'].en,'Backup Cove');assert.equal(exported.settings.publicDrawings,undefined);
  assert.equal(JSON.stringify(exported).includes('Keep intact'),false,'Unrelated journal never enters backup');
  assert.equal(exported.settings.points.castle.asset.endsWith('/pin.jpg'),true,'Asset reference is retained');
  await dialog.locator('[data-cancel]').click();
  const mutated=await gm.evaluate(async({ID,MAP,fixture})=>{
    const journal=game.journal.get(fixture.custom._id);await journal.update({name:'Изменённая мастерская',flags:{[ID]:{point:{...journal.getFlag(ID,'point'),name:'Изменённая мастерская'}}}});await journal.pages.contents[0].update({text:{content:'<p>Изменённая личная запись.</p>',format:1}});
    const next=foundry.utils.deepClone(game.settings.get(ID,'atlasState')),map=next.maps[MAP];map.color='#010203';map.ownership={default:0};delete map.points['area-backup-fixture'];
    map.points['area-extra-control']={id:'area-extra-control',area:true,custom:true,map:MAP,x:20,y:20,en:'Extra Control',category:'landmark',ru:{name:'Контрольная область',lore:''},uk:{name:'Контрольна область',lore:''},ownership:{default:0}};
    await game.settings.set(ID,'atlasState',next);const own=foundry.utils.deepClone(game.settings.get(ID,'drawings'));own[MAP]=[];await game.settings.set(ID,'drawings',own);
    return {state:next,drawings:own,name:journal.name,point:foundry.utils.deepClone(journal.getFlag(ID,'point')),text:journal.pages.contents[0].text.content};
  },{ID,MAP,fixture});
  await open();await upload({...exported,version:99});await gm.waitForFunction(()=>document.querySelector('[data-backup-preview]')?.textContent.startsWith('Ошибка:'));
  assert.equal(await dialog.locator('[type=submit]').isDisabled(),true);
  const unsafe=structuredClone(exported);unsafe.settings.points.castle.asset='https://example.invalid/icon.png';await upload(unsafe);await gm.waitForFunction(()=>document.querySelector('[data-backup-preview]')?.textContent.includes('неверный путь'));
  assert.equal(await dialog.locator('[type=submit]').isDisabled(),true);assert.deepEqual(await gm.evaluate(ID=>game.settings.get(ID,'atlasState'),ID),mutated.state);
  await upload(exported);await gm.waitForFunction(()=>!document.querySelector('.nw-settings [type=submit]').disabled);
  assert.match(await dialog.locator('[data-backup-preview]').innerText(),/обновить 1, добавить 0/);assert.equal(await dialog.locator('[name=restoreAccess]').isChecked(),false);
  await dialog.locator('[data-backup-preview] summary').click();assert.match(await dialog.locator('.nw-backup-objects').innerText(),/Backup Cove/);
  assert.match(await dialog.locator('[data-backup-preview]').innerText(),/Источник:/);
  await gm.evaluate(()=>{const original=File.prototype.text;File.prototype.text=function(){if(this.name==='delayed.json')return new Promise(resolve=>{globalThis.__releaseBackupRead=()=>original.call(this).then(resolve);});return original.call(this);};globalThis.__restoreFileText=()=>{File.prototype.text=original;};});
  await dialog.locator('[name=backupFile]').setInputFiles({name:'delayed.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...exported,version:99}))});await gm.waitForFunction(()=>globalThis.__releaseBackupRead);
  await upload(exported);await gm.waitForFunction(()=>!document.querySelector('.nw-settings [type=submit]').disabled);
  await gm.evaluate(async()=>{await globalThis.__releaseBackupRead();await new Promise(requestAnimationFrame);globalThis.__restoreFileText();});
  assert.equal(await dialog.locator('[type=submit]').isEnabled(),true);assert.match(await dialog.locator('[data-backup-preview]').innerText(),/обновить 1, добавить 0/);
  // Inject one failed world write after journal changes; rollback must preserve actual content.
  await gm.evaluate(ID=>{const original=game.settings.set;let fired=false;game.settings.set=function(namespace,key,...rest){if(!fired && namespace===ID && key==='atlasState'){fired=true;throw Error('Injected restore write failure');}return original.call(this,namespace,key,...rest);};globalThis.__restoreSettingsSet=()=>{game.settings.set=original;};},ID);
  await dialog.locator('[type=submit]').click();await gm.waitForFunction(()=>document.querySelector('.nw-settings [role=alert]')?.textContent.includes('Injected restore write failure'));
  await gm.evaluate(()=>globalThis.__restoreSettingsSet());
  assert.deepEqual(await gm.evaluate(ID=>game.settings.get(ID,'atlasState'),ID),mutated.state);assert.deepEqual(await gm.evaluate(ID=>game.settings.get(ID,'drawings'),ID),mutated.drawings);
  assert.deepEqual(await gm.evaluate(({ID,id})=>{const j=game.journal.get(id);return {name:j.name,point:j.getFlag(ID,'point'),text:j.pages.contents[0].text.content};},{ID,id:fixture.custom._id}),{name:mutated.name,point:mutated.point,text:mutated.text});
  await dialog.locator('[type=submit]').click();await dialog.waitFor({state:'detached'});
  const restored=await gm.evaluate(({ID,MAP,fixture})=>({state:game.settings.get(ID,'atlasState').maps[MAP],drawings:game.settings.get(ID,'drawings')[MAP],custom:game.journal.get(fixture.custom._id).pages.contents[0].text.content,keep:game.journal.get(fixture.keep._id).toObject(),count:game.journal.size}),{ID,MAP,fixture});
  assert.equal(restored.state.color,exported.settings.color);assert.equal(restored.state.points['area-backup-fixture'].en,'Backup Cove');assert.equal(restored.state.points['area-extra-control'].en,'Extra Control');assert.deepEqual(restored.state.ownership,{default:0});
  assert.equal(restored.state.points.lake.shape.opacity,.15,'Old contours without saved opacity restore with their visual default');
  assert.match(restored.custom,/янтарный ключ/);assert.deepEqual(restored.keep,fixture.keep);assert.equal(restored.count,2);assert.equal(restored.drawings.length,1);assert.equal(restored.drawings[0].name,'Личное имя копии');
  assert.equal(Object.values(restored.state.publicDrawings ?? {}).some(s=>s.id===restored.drawings[0].id),false);
  const missing=structuredClone(exported);missing.settings.points.castle.asset='worlds/'+exported.sourceWorld+'/missing-atlas-icon.gif';
  await open();await upload(missing);await gm.waitForFunction(()=>document.querySelector('[data-asset-status]')?.textContent.includes('не найдено'));
  assert.equal(await dialog.locator('[type=submit]').isDisabled(),true,'Missing asset must be resolved before restore');
  await dialog.locator('[data-clear-asset]').click();await gm.waitForFunction(()=>!document.querySelector('.nw-settings [type=submit]').disabled);assert.match(await dialog.locator('[data-asset-status]').innerText(),/встроенный значок/);
  await upload(missing);await gm.waitForFunction(()=>document.querySelector('[data-asset-status]')?.textContent.includes('не найдено'));
  await dialog.locator('[data-browse-asset]').click();const picker=gm.locator('#file-picker');await picker.waitFor();await picker.locator('[name=file]').fill('modules/neverwinter-atlas/assets/neverwinter.webp');await picker.locator('[type=submit]').click();await picker.waitFor({state:'detached'});
  await gm.waitForFunction(()=>!document.querySelector('.nw-settings [type=submit]').disabled);assert.match(await dialog.locator('[data-asset-status]').innerText(),/доступно/);
  await dialog.locator('[type=submit]').click();await dialog.waitFor({state:'detached'});assert.equal(await gm.evaluate(({ID,MAP})=>game.settings.get(ID,'atlasState').maps[MAP].points.castle.asset,{ID,MAP}),'modules/neverwinter-atlas/assets/neverwinter.webp');
  await open();await upload(exported);await gm.waitForFunction(()=>!document.querySelector('.nw-settings [type=submit]').disabled);await dialog.locator('[name=restoreAccess]').check();await dialog.locator('[type=submit]').click();await dialog.waitFor({state:'detached'});
  assert.deepEqual(await gm.evaluate(({ID,MAP})=>game.settings.get(ID,'atlasState').maps[MAP].ownership,{ID,MAP}),exported.settings.ownership);
  assert.equal(await gm.evaluate(()=>game.journal.size),2);assert.equal(await gm.evaluate(({ID,MAP})=>game.settings.get(ID,'drawings')[MAP].length,{ID,MAP}),1);
  const foreign=structuredClone(exported);foreign.sourceWorld='other-world';await open();await upload(foreign);await gm.waitForFunction(()=>!document.querySelector('.nw-settings [type=submit]').disabled);assert.equal(await dialog.locator('[name=restoreAccess]').isDisabled(),true);await dialog.locator('[type=submit]').click();await dialog.waitFor({state:'detached'});
  const imported=await gm.evaluate(({ID,MAP})=>{const j=game.journal.find(j=>j.getFlag(ID,'restoreSource')?.startsWith('other-world:'));return {count:game.journal.size,ownership:j.ownership,point:game.settings.get(ID,'atlasState').maps[MAP].points['custom-'+j.id]};},{ID,MAP});
  assert.equal(imported.count,3);assert.equal(imported.ownership.default,0);assert.deepEqual(imported.point.ownership,{default:0});
  // A colliding ID belonging to an unrelated journal must create a new private module point.
  const collision=structuredClone(exported),sourceId=collision.customPoints[0].sourceId;collision.customPoints[0].sourceId=fixture.keep._id;collision.settings.points['custom-'+fixture.keep._id]=collision.settings.points['custom-'+sourceId];delete collision.settings.points['custom-'+sourceId];
  await open();await upload(collision);await gm.waitForFunction(()=>!document.querySelector('.nw-settings [type=submit]').disabled);assert.match(await dialog.locator('[data-backup-preview]').innerText(),/добавить 1/);await dialog.locator('[type=submit]').click();await dialog.waitFor({state:'detached'});
  assert.deepEqual(await gm.evaluate(id=>game.journal.get(id).toObject(),fixture.keep._id),fixture.keep);assert.equal(await gm.evaluate(()=>game.journal.size),4);
  await open();await upload(collision);await gm.waitForFunction(()=>!document.querySelector('.nw-settings [type=submit]').disabled);await dialog.locator('[type=submit]').click();await dialog.waitFor({state:'detached'});assert.equal(await gm.evaluate(()=>game.journal.size),4);
  await gm.evaluate(async({ID,original,fixture})=>{
    const created=game.journal.filter(j=>j.id!==fixture.keep._id && j.id!==fixture.custom._id && j.getFlag(ID,'point'));
    await JournalEntry.deleteDocuments(created.map(j=>j.id));await game.settings.set(ID,'drawings',original.drawings);await game.settings.set(ID,'atlasState',original.state);
  },{ID,original,fixture});
  report.checks.push('backup-real-download-preview-and-upload','backup-preview-target-list-and-newer-file-wins-delayed-read','backup-invalid-version-and-unsafe-resource-denied-before-write','backup-injected-failure-rolls-back-notes-map-drawings','backup-restores-private-note-area-style-and-drawing','backup-preserves-extra-data-and-unrelated-journal','backup-access-default-preserved-explicit-same-world-restore','backup-repeat-no-duplicates-and-collision-safe-private-copy','backup-foreign-world-access-restore-disabled');
  report.checks.push('backup-images-real-decode-missing-path-gate-and-fallback','backup-missing-image-native-picker-repair-and-restored-path');
}
