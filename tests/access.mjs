import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {environment,startServer,playwright} from '../../gem/tools/integration/server.mjs';
import {packSnapshot} from './pack-snapshot.mjs';
import {backupFlow} from './backup-flow.mjs';
import {clickRegion} from './territories.mjs';
import {territoryPresentation} from './territory-presentation.mjs';
import {movementUndo} from './move-undo.mjs';
import {layersPosition} from './layers-position.mjs';
import {richMap} from './rich-map.mjs';
import {guard,login} from '../../gem/tests/integration/helpers.mjs';
const built=JSON.parse(await fs.readFile(new URL('../../gem/build/latest.json',import.meta.url)));
const env=await environment(),root=fileURLToPath(new URL('../',import.meta.url));
const before=await packSnapshot(root,env.app);
const report={scope:'access-tools-migration',status:'failed',started:new Date().toISOString(),checks:[],foundry:env.foundryVersion,inputs:{}};
for(const name of ['atlas.mjs','access.mjs','backup.mjs','state.mjs','geometry.mjs','map-art.mjs','custom-points.mjs','atlas.css','window.mjs','history.mjs','label-style.mjs','characters.mjs','viewport.mjs','travel.mjs','i18n.mjs','lang/uk-ui.json','layers.mjs','position.mjs','assets/evernight.jpg','assets/underground-pending.svg','data/forgottenmaps-candidates.json','tests/layers-position.mjs','data/places.json','module.json','tests/access.mjs','tests/backup-flow.mjs','tests/territories.mjs','tests/territory-presentation.mjs','tests/label-appearance.mjs','tests/move-undo.mjs','tests/rich-map.mjs','data/region-default-source.json','tests/pack-snapshot.mjs'])
  report.inputs[name]=createHash('sha256').update(await fs.readFile(new URL('../'+name,import.meta.url))).digest('hex');
const server=await startServer(env,built,['neverwinter-atlas']);
let browser,gm,reader,blocked;
const errors=[],requests=[];
const ID='neverwinter-atlas',MAP='modules/neverwinter-atlas/assets/neverwinter.webp';
try {
  browser=await playwright().chromium.launch({executablePath:process.env.GEM_BROWSER_EXECUTABLE,headless:true});
  async function page(){
    const context=await browser.newContext({viewport:{width:1500,height:1000}}),p=await context.newPage();
    await context.addInitScript(()=>localStorage.setItem('core.tourProgress',JSON.stringify({core:{welcome:3}})));
    p.on('pageerror',e=>errors.push(e.message));
    await p.route('**/*',route=>route.request().url().startsWith(server.baseURL)||!/^https?:/.test(route.request().url())?route.continue():route.abort());
    return p;
  }
  gm=await page();await login(gm,server);
  await gm.evaluate(()=>game.settings.set('core','moduleConfiguration',{'neverwinter-atlas':true}));
  await gm.reload();await gm.waitForFunction(()=>game.ready && game.modules.get('neverwinter-atlas').active);await guard(gm,server);
  const fixture=await gm.evaluate(async({ID,MAP})=>{
    const users=await User.createDocuments([{name:'Atlas Reader',role:CONST.USER_ROLES.PLAYER},{name:'Atlas Blocked',role:CONST.USER_ROLES.PLAYER}]);
    const keep=await JournalEntry.create({name:'Keep this lore',pages:[{name:'Private note',type:'text',text:{format:1,content:'<p>Keep intact</p>'}}]});
    const custom=await JournalEntry.create({name:'Старая мастерская (Old Workshop)',ownership:{default:0},flags:{[ID]:{point:{map:MAP,x:26,y:68,name:'Старая мастерская',en:'Old Workshop',category:'landmark'}}},pages:[{name:'Личная запись',type:'text',text:{format:1,content:'<p>Секрет ведущего — янтарный ключ.</p>'}}]});
    const overlay=await JournalEntry.create({name:'Legacy lake',ownership:{default:0},flags:{[ID]:{overlay:{id:'lake',map:MAP,x:39.875,y:29.875,category:'water',en:'Bluelake',ru:{name:'Голубое озеро',lore:'Старый публичный текст'},uk:{name:'Блакитне озеро',lore:'Старий публічний текст'}}}}});
    const control=await JournalEntry.create({name:'Legacy map control',ownership:{default:0},flags:{[ID]:{control:{map:MAP,color:'#a94328',size:34,records:{[overlay.id]:'lake'}}}}});
    const drawing=await JournalEntry.create({name:'Legacy drawing',ownership:{default:0},flags:{[ID]:{drawing:{map:MAP,color:'#ee1100',width:3,points:[[15,15],[20,20]]}}}});
    const next=foundry.utils.deepClone(game.settings.get(ID,'atlasState'));
    next.maps[MAP]={ownership:{default:0},points:{chasm:{id:'chasm',custom:false,map:MAP,x:69,y:70,en:'The Chasm',category:'landmark',ru:{name:'Запечатанный Разлом',lore:'Мой публичный текст района'},uk:{name:'Запечатаний Розлом',lore:'Мій публічний текст району'},ownership:{default:0},shape:{points:[[70,68],[75,68],[75,74]],color:'#776688',opacity:.1,hidden:false}}}};
    await game.settings.set(ID,'atlasState',next);
    return {users:users.map(u=>({id:u.id,name:u.name})),keep:keep.toObject(),custom:custom.toObject(),legacy:[overlay.id,control.id,drawing.id]};
  },{ID,MAP});
  reader=await page();blocked=await page();reader.on('request',request=>requests.push(request.url()));
  async function closeProfile(p){await p.locator('.user-config').waitFor();await p.locator('.user-config [data-action=close]').click();await p.locator('.user-config').waitFor({state:'detached'});}
  await login(reader,server,{user:fixture.users[0].name,gm:false});await closeProfile(reader);
  await login(blocked,server,{user:fixture.users[1].name,gm:false});await closeProfile(blocked);
  async function keyM(p){await p.locator('body').click({position:{x:550,y:20}});await p.keyboard.press('KeyM');}
  await keyM(reader);assert.equal(await reader.locator('.nw-atlas').count(),0);
  await keyM(gm);
  let atlas=gm.locator('.nw-atlas'),settings=gm.locator('.nw-settings');
  const territories=gm.locator('.nw-territory-manager');
  await atlas.locator('.nw-pin').first().waitFor();
  await gm.waitForFunction(()=>{const image=document.querySelector('.nw-stage>img'),stage=document.querySelector('.nw-stage');return image?.naturalWidth===3200 && parseFloat(stage.style.width)>0;});
  assert.equal(await atlas.locator('.nw-pin').count(),39);
  assert.equal(await atlas.locator('[data-visibility=hidden]').count(),51);
  assert.equal(await atlas.locator('[data-zone]').count(),12);
  const district=await gm.evaluate(({ID,MAP})=>game.settings.get(ID,'atlasState').maps[MAP].points.chasm,{ID,MAP});
  assert.equal(district.en,'Chasm District');assert.equal(district.category,'district');assert.equal(district.ru.name,'Район Разлома');assert.equal(district.uk.name,'Район Розлому');
  assert.equal(district.ru.lore,'Мой публичный текст района');assert.equal(district.uk.lore,'Мій публічний текст району');assert.deepEqual(district.shape.points,[[70,68],[75,68],[75,74]]);assert.deepEqual(district.ownership,{default:0});
  report.checks.push('old-canonical-Chasm-district-name-migrates-preserving-public-text-grants-and-own-contour');
  const migrated=await gm.evaluate(({ID,MAP,fixture})=>({
    keep:game.journal.get(fixture.keep._id).toObject(),custom:game.journal.get(fixture.custom._id).toObject(),remaining:fixture.legacy.filter(id=>game.journal.has(id)),
    backup:Object.keys(game.settings.get(ID,'legacyBackup')),drawings:game.settings.get(ID,'drawings')[MAP],count:game.journal.size
  }),{ID,MAP,fixture});
  assert.deepEqual(migrated.keep,fixture.keep);assert.deepEqual(migrated.custom,fixture.custom);assert.deepEqual(migrated.remaining,[]);
  assert.ok(fixture.legacy.every(id=>migrated.backup.includes(id)));assert.equal(migrated.drawings.length,1);assert.equal(migrated.count,2);
  assert.deepEqual(await reader.evaluate(ID=>game.settings.get(ID,'drawings'),ID),{});
  report.checks.push('legacy-control-points-drawings-migrated-and-private-backup','unrelated-lore-preserved','no-service-journals','GM-drawings-user-private');
  await atlas.locator('[data-zoom="1"]').click();await gm.keyboard.press('Control+z');
  await atlas.locator('[data-stroke]').waitFor({state:'detached'});
  await atlas.locator('[data-zoom="-1"]').click();
  await atlas.locator('[data-settings]').click();
  await settings.locator('[name=colorHex]').fill('#165db8');await settings.locator('[name=size]').fill('42');
  await settings.locator('[data-user="'+fixture.users[0].id+'"]').selectOption('2');
  await settings.locator('[type=submit]').click();await settings.waitFor({state:'detached'});
  await reader.waitForFunction(({ID,MAP,user})=>game.settings.get(ID,'atlasState').maps[MAP]?.ownership[user]===2,{ID,MAP,user:fixture.users[0].id});
  await keyM(reader);await reader.locator('.nw-atlas').waitFor();
  assert.equal(await reader.locator('.nw-pin').count(),0);await keyM(blocked);assert.equal(await blocked.locator('.nw-atlas').count(),0);
  assert.equal(await reader.locator('[data-settings]:visible').count(),0);assert.equal(await reader.locator('.nw-drawing-tools:visible').count(),0);
  const search=()=>atlas.locator('input[type=search]');
  async function select(query){await search().fill(query);await atlas.locator('nav button').click();}
  await gm.evaluate(async({ID,MAP,user})=>{const next=foundry.utils.deepClone(game.settings.get(ID,'atlasState'));next.maps[MAP].points.lake.ownership[user]=3;await game.settings.set(ID,'atlasState',next);},{ID,MAP,user:fixture.users[0].id});
  await select('Голубое озеро');await atlas.locator('[data-point-settings]').click();
  assert.equal(await settings.locator('[data-user="'+fixture.users[0].id+'"]').inputValue(),'2','An old movement grant retains territory viewing');
  await settings.locator('[data-user="'+fixture.users[0].id+'"]').selectOption('2');await settings.locator('[type=submit]').click();await settings.waitFor({state:'detached'});
  await reader.locator('[data-zone=lake]').waitFor();assert.equal(await reader.locator('[data-zone]').count(),1);
  assert.equal(await reader.locator('[data-place=lake]').count(),0,'Existing published region migrates without a duplicate pin');
  await territoryPresentation(gm,reader,fixture,report);
  await atlas.locator('[data-point-settings]').click();await settings.locator('[data-user="'+fixture.users[0].id+'"]').selectOption('0');await settings.locator('[type=submit]').click();await settings.waitFor({state:'detached'});
  await reader.locator('[data-zone=lake]').waitFor({state:'detached'});
  report.checks.push('published-territory-and-revocation','legacy-territory-move-grant-keeps-view-access');
  await select('Castle Never');
  let pin=atlas.locator('[data-place=castle]');
  assert.equal(await pin.evaluate(e=>e.offsetWidth),42);assert.equal(await pin.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(22, 93, 184)');
  await pin.hover();await atlas.locator('[role=tooltip]').waitFor();assert.match(await atlas.locator('[role=tooltip]').innerText(),/Castle Never/);
  await gm.waitForFunction(()=>document.querySelector('[data-place=castle]').getBoundingClientRect().width>52);
  await search().hover();await gm.waitForFunction(()=>document.querySelector('[data-place=castle]').getBoundingClientRect().width<43);
  await pin.dblclick();await settings.waitFor();
  const editorBefore=await settings.boundingBox();
  await settings.locator('.nw-dialog-header h2').hover();await gm.mouse.down();
  await gm.mouse.move(editorBefore.x+editorBefore.width/2+80,editorBefore.y+50,{steps:8});await gm.mouse.up();
  const editorMoved=await settings.boundingBox();assert.ok(Math.abs(editorMoved.x-editorBefore.x)>30,'Point editor moves by its title');
  await settings.locator('[data-browse]').click();
  const picker=gm.locator('#file-picker');await picker.waitFor();
  assert.equal(await picker.locator('.window-header').evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,'Native file picker receives mouse above atlas editor');
  const pickerBefore=await picker.boundingBox();await picker.locator('.window-header .window-title').hover();await gm.mouse.down();
  await gm.mouse.move(pickerBefore.x+pickerBefore.width/2+45,pickerBefore.y+45,{steps:8});await gm.mouse.up();
  assert.ok(Math.abs((await picker.boundingBox()).x-pickerBefore.x)>20,'Native file picker moves');
  await picker.locator('[name=file]').fill('modules/neverwinter-atlas/assets/neverwinter.webp');await picker.locator('[type=submit]').click();await picker.waitFor({state:'detached'});
  assert.equal(await settings.locator('[name=asset]').inputValue(),'modules/neverwinter-atlas/assets/neverwinter.webp');
  await settings.locator('[name=asset]').fill('');
  report.checks.push('movable-nonmodal-editor','native-file-picker-in-front-movable-and-selection');
  assert.equal(await settings.locator('[name=individual]').isChecked(),false);
  // The user's exact regression: change the picker without manually enabling individual styling.
  await settings.locator('[name=color]').fill('#4194be');await settings.locator('[name=size]').fill('48');
  assert.equal(await settings.locator('[name=individual]').isChecked(),true);
  await settings.locator('[name=publicRu]').fill('Открытая крепость.');await settings.locator('[name=publicUk]').fill('Відкрита фортеця.');
  await settings.locator('[data-user="'+fixture.users[0].id+'"]').selectOption('2');
  await settings.locator('[type=submit]').click();await settings.waitFor({state:'detached'});
  assert.equal(await pin.evaluate(e=>e.offsetWidth),48);assert.equal(await pin.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(65, 148, 190)');
  await pin.dblclick();assert.equal(await settings.locator('[name=colorHex]').inputValue(),'#4194be');assert.equal(await settings.locator('[name=size]').inputValue(),'48');
  await settings.locator('[data-cancel]').click();
  await reader.locator('[data-place=castle]').click();assert.equal(await reader.locator('.nw-summary').innerText(),'Открытая крепость.');
  await reader.getByRole('button',{name:'UA',exact:true}).click();assert.equal(await reader.locator('.nw-summary').innerText(),'Відкрита фортеця.');
  await reader.getByRole('button',{name:'Відкрити журнал',exact:true}).click();assert.equal(await reader.locator('.nw-public-reader p').innerText(),'Відкрита фортеця.');
  await reader.locator('.nw-public-reader > button').click();assert.equal(await reader.locator('[data-go=justice]').count(),0);
  report.checks.push('individual-map-access-and-player-M','default-hidden-points','blocked-player-denied','global-style','hover-grow-and-return','instant-name','double-click-editor','picker-enables-style-and-persists','public-RU-UA-reader-no-journal','hidden-related-links');
  async function coordinates(p){return p.evaluate(({ID,MAP})=>{const p=game.settings.get(ID,'atlasState').maps[MAP].points.castle;return {x:p.x,y:p.y};},{ID,MAP});}
  async function drag(p,selector='[data-place=castle]',dx=45,dy=28){
    const marker=p.locator('.nw-atlas '+selector);await marker.hover();const box=await marker.boundingBox();
    await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.mouse.move(box.x+box.width/2+dx,box.y+box.height/2+dy,{steps:8});await p.mouse.up();
  }
  const original=await coordinates(reader);await drag(reader);assert.deepEqual(await coordinates(reader),original);
  await gm.evaluate(()=>{
    globalThis.__atlasMoveEvents=[];
    Hooks.on('updateUser',(user,changes,options,author)=>{globalThis.__atlasMoveEvents.push({id:user.id,author,changes});});
  });
  const denied=await reader.evaluate(async ID=>{try {await game.settings.set(ID,'atlasState',{version:7,maps:{}});return false;}catch{return true;}},ID);
  assert.equal(denied,true,'Native server denies player world-setting update');
  await reader.evaluate(({ID,MAP})=>game.user.setFlag(ID,'moveRequest',{map:MAP,id:'castle',x:99,y:99,nonce:'unauthorized-observer'}),{ID,MAP});
  await gm.waitForFunction(({ID})=>game.users.find(u=>u.name==='Atlas Reader').getFlag(ID,'moveRequest')?.nonce==='unauthorized-observer',{ID});
  await drag(gm);await gm.waitForFunction(({ID,MAP,x})=>game.settings.get(ID,'atlasState').maps[MAP].points.castle.x>x+1,{ID,MAP,x:original.x});
  await atlas.locator('[data-point-settings]').click();await settings.locator('[data-user="'+fixture.users[0].id+'"]').selectOption('3');
  await settings.locator('[type=submit]').click();await settings.waitFor({state:'detached'});
  await reader.waitForFunction(({ID,MAP,user})=>game.settings.get(ID,'atlasState').maps[MAP].points.castle.ownership[user]===3,{ID,MAP,user:fixture.users[0].id});
  const gmMoved=await coordinates(reader);await drag(reader);
  await reader.waitForFunction(({ID,MAP,x})=>game.settings.get(ID,'atlasState').maps[MAP].points.castle.x>x+1,{ID,MAP,x:gmMoved.x});
  const moved=await coordinates(reader);assert.notEqual(moved.x,99);assert.notEqual(moved.y,99);
  await gm.waitForFunction(({ID,MAP,x})=>Math.abs(game.settings.get(ID,'atlasState').maps[MAP].points.castle.x-x)<.01,{ID,MAP,x:moved.x});
  report.checks.push('observer-drag-denied','server-world-write-denied','untrusted-move-request-rejected','GM-drag','authenticated-owner-drag-and-sync');
  await movementUndo(gm,reader,fixture,report,drag,coordinates);
  await richMap(gm,reader,blocked,fixture,report);
  await layersPosition(gm,reader,blocked,fixture,report);
  // File upload uses Foundry's real HTTP upload path for each requested raster format.
  const raster=await gm.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=16;canvas.height=16;
    const context=canvas.getContext('2d');context.fillStyle='#126ad3';context.fillRect(0,0,16,16);
    return {png:canvas.toDataURL('image/png').split(',')[1],jpg:canvas.toDataURL('image/jpeg').split(',')[1]};
  });
  const fixtures=[['pin.png','image/png',raster.png],['pin.gif','image/gif','R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'],['pin.jpg','image/jpeg',raster.jpg]];
  const uploads=[];
  for(const [name,mimeType,base64] of fixtures){
    await atlas.locator('[data-point-settings]').click();
    await settings.locator('[name=upload]').setInputFiles({name,mimeType,buffer:Buffer.from(base64,'base64')});
    await settings.locator('[name=asset]').inputValue().then(()=>{});
    await gm.waitForFunction(name=>document.querySelector('.nw-settings [name=asset]').value.endsWith('/'+name),name);
    uploads.push(await settings.locator('[name=asset]').inputValue());
    await settings.locator('[type=submit]').click();await settings.waitFor({state:'detached'});
    await pin.locator('img').waitFor();await gm.waitForFunction(()=>{const img=document.querySelector('[data-place=castle] img');return img?.complete && img.naturalWidth>0;});
    if(name==='pin.gif') {
      await atlas.locator('[data-zoom="-1"]').click();assert.ok(await pin.evaluate(e=>e.offsetWidth)<40,'GIF shrinks at 50%');
      for(let i=0;i<11;i++)await atlas.locator('[data-zoom="1"]').click();
      assert.equal(await atlas.locator('footer output').innerText(),'600%');assert.equal(await pin.evaluate(e=>e.offsetWidth),100,'GIF caps at 100px at maximum zoom');
      await atlas.locator('nav button').click();await pin.hover();
      await gm.waitForFunction(()=>document.querySelector('[data-place=castle]').getBoundingClientRect().width>=499);
      const decoration=await pin.evaluate(e=>({border:getComputedStyle(e).borderTopWidth,outline:getComputedStyle(e).outlineWidth,badge:e.querySelector('.nw-access-icon').getBoundingClientRect().width}));
      assert.equal(decoration.border,'1px');assert.equal(decoration.outline,'1px');assert.ok(decoration.badge<=17,'Access badge stays tiny at maximum hover size');
      await fs.mkdir(new URL('evidence/',import.meta.url),{recursive:true});await gm.screenshot({path:fileURLToPath(new URL('evidence/gif-max-zoom-hover.png',import.meta.url))});
      await search().hover();await gm.waitForFunction(()=>document.querySelector('[data-place=castle]').getBoundingClientRect().width<=101);
      for(let i=0;i<10;i++)await atlas.locator('[data-zoom="-1"]').click();
      assert.equal(await pin.evaluate(e=>e.offsetWidth),48);report.checks.push('GIF-scales-with-zoom-max100-hover500-small-badge-thin-frame-and-return');
    }
  }
  report.checks.push('PNG-GIF-JPG-real-upload-and-decoding');report.uploads=uploads;
  await search().fill('');
  await atlas.locator('.nw-drawing-tools summary').click();await atlas.locator('[data-draw]').click();
  const viewport=atlas.locator('.nw-viewport');
  async function mapPoint(p,x,y){return p.locator('.nw-stage').evaluate((e,[x,y])=>{const r=e.getBoundingClientRect();return {x:r.x+r.width*x/100,y:r.y+r.height*y/100};},[x,y]);}
  async function draw(p,points){const pixels=await Promise.all(points.map(([x,y])=>mapPoint(p,x,y)));await p.mouse.move(pixels[0].x,pixels[0].y);await p.mouse.down();for(const point of pixels.slice(1))await p.mouse.move(point.x,point.y,{steps:8});await p.mouse.up();}
  await draw(gm,[[20,20],[27,25],[36,21]]);await atlas.locator('[data-stroke]').waitFor();
  assert.equal(await gm.evaluate(()=>game.journal.size),2);assert.equal(await reader.locator('[data-stroke]').count(),0);
  const firstStroke=await atlas.locator('[data-stroke]').getAttribute('data-stroke');
  await atlas.locator('[data-edit-stroke="'+firstStroke+'"]').click();
  await settings.locator('[name=strokeName]').fill('СЕКРЕТ: путь засады');await settings.locator('[name=strokeLabel]').fill('Путь к докам <b>без HTML</b>');
  await settings.locator('[name=strokeGroup]').fill('СЕКРЕТ: маршруты');
  await settings.locator('[type=submit]').click();await settings.waitFor({state:'detached'});
  assert.match(await atlas.locator('[data-stroke-row="'+firstStroke+'"]').innerText(),/СЕКРЕТ/);
  assert.ok((await atlas.locator('[data-stroke-row="'+firstStroke+'"] span').boundingBox()).height<=36,'Drawing name stays readable in at most two lines');
  assert.equal(await atlas.locator('[data-stroke-label="'+firstStroke+'"]').innerText(),'Путь к докам <b>без HTML</b>');
  assert.equal(await atlas.locator('[data-stroke-label] b').count(),0);assert.equal(await reader.locator('[data-stroke-label]').count(),0);
  await draw(gm,[[40,40],[45,43],[49,39]]);await gm.waitForFunction(()=>document.querySelectorAll('.nw-atlas [data-stroke]').length===2);
  const secondStroke=await atlas.locator('[data-stroke]').last().getAttribute('data-stroke');
  await atlas.locator('[data-edit-stroke="'+secondStroke+'"]').click();await settings.locator('[name=strokeGroup]').fill('СЕКРЕТ: маршруты');await settings.locator('[type=submit]').click();await settings.waitFor({state:'detached'});
  await draw(gm,[[55,32],[60,35],[65,33]]);await gm.waitForFunction(()=>document.querySelectorAll('.nw-atlas [data-stroke]').length===3);
  const thirdStroke=await atlas.locator('[data-stroke]').last().getAttribute('data-stroke');
  const routeGroup=atlas.locator('[data-stroke-group="СЕКРЕТ: маршруты"]');
  await routeGroup.locator('[data-share-group=true]').click();await reader.waitForFunction(()=>document.querySelectorAll('.nw-atlas [data-stroke]').length===2);
  assert.equal(await reader.evaluate(({ID,MAP})=>JSON.stringify(game.settings.get(ID,'atlasState').maps[MAP].publicDrawings).includes('СЕКРЕТ'),{ID,MAP}),false);
  await routeGroup.locator('[data-rename-group]').click();await settings.locator('[name=newGroup]').fill('Маршрут и засада');await settings.locator('[type=submit]').click();await settings.waitFor({state:'detached'});
  const renamedGroup=atlas.locator('[data-stroke-group="Маршрут и засада"]');await renamedGroup.waitFor();assert.equal(await reader.locator('[data-stroke]').count(),2);
  await renamedGroup.locator('[data-delete-group]').click();assert.equal(await settings.locator('[name=groupFate]').inputValue(),'keep');await settings.locator('[type=submit]').click();await settings.waitFor({state:'detached'});assert.equal(await reader.locator('[data-stroke]').count(),2);assert.equal(await atlas.locator('[data-stroke]').count(),3);
  await atlas.locator('[data-edit-stroke="'+thirdStroke+'"]').click();await settings.locator('[name=strokeGroup]').fill('Удаляемая группа');await settings.locator('[type=submit]').click();await settings.waitFor({state:'detached'});
  const removable=atlas.locator('[data-stroke-group="Удаляемая группа"]');await removable.locator('[data-share-group=true]').click();await reader.waitForFunction(()=>document.querySelectorAll('.nw-atlas [data-stroke]').length===3);
  await removable.locator('[data-delete-group]').click();await settings.locator('[name=groupFate]').selectOption('delete');await settings.locator('[type=submit]').click();await settings.waitFor({state:'detached'});await reader.locator('[data-stroke="'+thirdStroke+'"]').waitFor({state:'detached'});
  assert.equal(await atlas.locator('[data-stroke]').count(),2);await atlas.locator('[data-stroke-group=""] [data-share-group=false]').click();await reader.locator('[data-stroke]').waitFor({state:'detached'});
  report.checks.push('group-share-two-strokes-only-hide-and-private-group-name');
  report.checks.push('group-rename-preserves-publication','group-delete-default-keeps-strokes-and-publication','group-delete-strokes-unpublishes-chosen-group-only');
  await atlas.locator('[data-share-stroke="'+firstStroke+'"]').click();await reader.locator('[data-stroke="'+firstStroke+'"]').waitFor();
  assert.equal(await reader.locator('[data-stroke]').count(),1,'Only the chosen stroke is public');
  await reader.locator('[data-stroke-label="'+firstStroke+'"]').waitFor();
  assert.equal(await reader.evaluate(({ID,MAP})=>JSON.stringify(game.settings.get(ID,'atlasState').maps[MAP].publicDrawings).includes('СЕКРЕТ'),{ID,MAP}),false,'Private drawing name never enters published state');
  await atlas.locator('[data-edit-stroke="'+firstStroke+'"]').click();await settings.locator('[name=strokeLabel]').fill('Маршрут к докам');
  await settings.locator('[type=submit]').click();await settings.waitFor({state:'detached'});
  await reader.waitForFunction(id=>document.querySelector('[data-stroke-label="'+id+'"]')?.textContent==='Маршрут к докам',firstStroke);
  report.checks.push('drawing-private-name-and-escaped-map-label','shared-caption-live-edit-without-private-name');
  await fs.mkdir(new URL('evidence/',import.meta.url),{recursive:true});
  await gm.screenshot({path:fileURLToPath(new URL('evidence/shared-drawings.png',import.meta.url))});
  await reader.screenshot({path:fileURLToPath(new URL('evidence/shared-drawings-player.png',import.meta.url))});
  await atlas.locator('[data-share-stroke="'+firstStroke+'"]').click();await reader.locator('[data-stroke]').waitFor({state:'detached'});
  await atlas.locator('[data-share-stroke="'+firstStroke+'"]').click();await reader.locator('[data-stroke]').waitFor();
  await reader.reload();await reader.waitForFunction(()=>game.ready);await closeProfile(reader);await keyM(reader);await reader.locator('[data-stroke="'+firstStroke+'"]').waitFor();
  assert.equal(await reader.locator('[data-stroke-label="'+firstStroke+'"]').innerText(),'Маршрут к докам');
  assert.deepEqual(await reader.evaluate(ID=>game.settings.get(ID,'drawings'),ID),{},'Public stroke does not expose the GM private store');
  await atlas.locator('[data-draw]').click();await gm.keyboard.press('Control+z');
  await gm.waitForFunction(()=>document.querySelectorAll('.nw-atlas [data-stroke]').length===1);
  assert.equal(await reader.locator('[data-stroke]').count(),1,'Undo of a private stroke preserves the published stroke');
  await gm.keyboard.press('Control+z');await atlas.locator('[data-stroke]').waitFor({state:'detached'});await reader.locator('[data-stroke]').waitFor({state:'detached'});
  report.checks.push('selected-stroke-share-hide-and-player-reload','private-stroke-not-published','undo-unpublishes-deleted-stroke');
  await atlas.locator('[data-draw]').click();await draw(gm,[[25,25],[30,31],[40,26]]);await atlas.locator('[data-stroke]').waitFor();
  await gm.reload();await gm.waitForFunction(()=>game.ready);await keyM(gm);atlas=gm.locator('.nw-atlas');settings=gm.locator('.nw-settings');pin=atlas.locator('[data-place=castle]');await atlas.locator('[data-stroke]').waitFor();
  await gm.waitForFunction(()=>document.querySelector('.nw-stage>img')?.naturalWidth===3200 && parseFloat(document.querySelector('.nw-stage')?.style.width)>0);
  assert.equal(await atlas.locator('footer output').innerText(),'100%','Reloaded map is ready before zoom and vertex gestures');
  assert.equal(await pin.evaluate(e=>e.offsetWidth),48);assert.equal(await pin.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(65, 148, 190)');
  assert.ok((await pin.locator('img').getAttribute('src')).endsWith('/pin.jpg'));assert.deepEqual(await coordinates(gm),moved);
  await atlas.locator('[data-zoom="1"]').click();await gm.keyboard.press('Control+z');await atlas.locator('[data-stroke]').waitFor({state:'detached'});await atlas.locator('[data-zoom="-1"]').click();
  report.checks.push('drawing-toolbar-header-pencil','drawing-no-journal','Ctrl-Z-undo','drawing-and-style-and-move-reload');
  await select('Protector');await atlas.locator('[data-territories]').click();await territories.locator('[data-outline-selected]').click();
  const vertices=atlas.locator('.nw-vertex'),oldCount=await vertices.count();assert.ok(oldCount>=3);
  await fs.mkdir(new URL('evidence/',import.meta.url),{recursive:true});
  await gm.screenshot({path:fileURLToPath(new URL('evidence/territory-editor.png',import.meta.url))});
  report.checks.push('territory-editor-screenshot');
  const sourceRegions=JSON.parse(await fs.readFile(new URL('../data/region-default-source.json',import.meta.url))),protectorPoints=sourceRegions.regions.find(r=>r.id==='protector').shape.points;
  const southIndex=protectorPoints.reduce((best,p,i)=>p[1]>protectorPoints[best][1]?i:best,0);
  const vertexBox=await vertices.nth(southIndex).boundingBox();await gm.mouse.move(vertexBox.x+vertexBox.width/2,vertexBox.y+vertexBox.height/2);await gm.mouse.down();await gm.mouse.move(vertexBox.x+35,vertexBox.y+30,{steps:6});await gm.mouse.up();
  const edge=await atlas.locator('.nw-midpoint').evaluateAll(nodes=>{
    const vertices=[...document.querySelectorAll('.nw-vertex')].map(n=>{const r=n.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
    const candidate=nodes.find(n=>{const r=n.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return document.elementFromPoint(x,y)===n && vertices.every(v=>Math.hypot(v.x-x,v.y-y)>34);});
    if(!candidate)throw Error('No unobstructed long edge for inserting a vertex');return Number(candidate.dataset.vertex);
  });
  await atlas.locator('.nw-midpoint[data-vertex="'+edge+'"]').click();assert.equal(await vertices.count(),oldCount+1);
  await vertices.nth(edge+1).click({button:'right'});assert.equal(await vertices.count(),oldCount);
  await territories.locator('[data-region-save]').click();await territories.locator('.nw-region-editor').waitFor({state:'hidden'});
  const savedShape=await gm.evaluate(({ID,MAP})=>game.settings.get(ID,'atlasState').maps[MAP].points.protector.shape,{ID,MAP});
  assert.equal(savedShape.points.length,oldCount);assert.ok(savedShape.points.every(p=>p.every(n=>n>=0&&n<=100)));
  assert.ok(savedShape.points[southIndex][1]>protectorPoints[southIndex][1]+1,'Southern map vertex is reachable and can be moved');
  await territories.locator('[data-dialog-close]').click();await search().fill('');await atlas.locator('[data-territories]').click();await territories.locator('[data-new-region]').click();
  await settings.locator('[name=ru]').fill('Новый район');await settings.locator('[name=uk]').fill('Новий район');await settings.locator('[name=en]').fill('New District');
  await settings.locator('[type=submit]').click();await settings.waitFor({state:'detached'});
  for(const [x,y] of [[55,15],[64,17],[61,25],[54,23]]){const p=await mapPoint(gm,x,y);await gm.mouse.click(p.x,p.y);}
  assert.equal(await vertices.count(),4);await territories.locator('[data-region-save]').click();await territories.locator('.nw-region-editor').waitFor({state:'hidden'});
  await territories.locator('[data-dialog-close]').click();await select('New District');assert.match(await atlas.locator('h3').innerText(),/Новый район/);assert.equal(await gm.evaluate(()=>game.journal.size),2);
  const areaId=await atlas.locator('[data-zone^=area-]').getAttribute('data-zone');
  await select('Old Workshop');await atlas.locator('[data-edit]').click();
  const customEditor=gm.locator('.nw-custom-editor');
  assert.equal(await customEditor.locator('[name=district]').inputValue(),'','Legacy point without district opens safely');
  await customEditor.locator('[name=district]').selectOption(areaId);await customEditor.locator('[type=submit]').click();await customEditor.waitFor({state:'detached'});
  await atlas.locator('[data-go="'+areaId+'"]').click();
  const customId='custom-'+fixture.custom._id;
  await atlas.locator('[data-connections=members] [data-go="'+customId+'"]').click();assert.match(await atlas.locator('.nw-summary').innerText(),/янтарный ключ/);
  await atlas.locator('[data-point-settings]').click();assert.equal(await settings.locator('[name=publicRu]').inputValue(),'');
  await settings.locator('[name=publicRu]').fill('Открытая мастерская.');await settings.locator('[name=publicUk]').fill('Відкрита майстерня.');
  await settings.locator('[data-user="'+fixture.users[0].id+'"]').selectOption('2');await settings.locator('[type=submit]').click();await settings.waitFor({state:'detached'});
  await reader.locator('[data-place="'+customId+'"]').click();assert.equal(await reader.locator('.nw-summary').innerText(),'Відкрита майстерня.');
  assert.equal(await reader.locator('[data-go="'+areaId+'"]').count(),0,'Unpublished district stays hidden');
  assert.equal(await reader.evaluate(({ID,MAP,customId})=>JSON.stringify(game.settings.get(ID,'atlasState').maps[MAP].points[customId]).includes('янтарный'),{ID,MAP,customId}),false);
  await select('New District');await atlas.locator('[data-point-settings]').click();await settings.locator('[name=publicUk]').fill('Район майстрів.');
  await settings.locator('[data-user="'+fixture.users[0].id+'"]').selectOption('2');await settings.locator('[type=submit]').click();await settings.waitFor({state:'detached'});
  await reader.locator('[data-go="'+areaId+'"]').click();assert.equal(await reader.locator('.nw-summary').innerText(),'Район майстрів.');
  await atlas.locator('[data-territories]').click();await territories.locator('[data-edit-region="'+areaId+'"]').click();await territories.locator('[name=areaCategory]').selectOption('water');await territories.locator('[data-region-save]').click();
  await gm.waitForFunction(()=>[...document.querySelectorAll('#notifications .notification')].some(e=>e.textContent.includes('Сначала выберите другой район')));
  assert.equal(await gm.evaluate(({ID,MAP,areaId})=>game.settings.get(ID,'atlasState').maps[MAP].points[areaId].category,{ID,MAP,areaId}),'district');
  await territories.locator('[data-region-cancel]').click();await territories.locator('[data-dialog-close]').click();
  report.checks.push('district-type-change-denied-while-member-attached');
  await reader.locator('[data-connections=members] [data-go="'+customId+'"]').click();
  await select('Old Workshop');await atlas.locator('[data-edit]').click();await customEditor.locator('[name=district]').selectOption('protector');
  await customEditor.locator('[type=submit]').click();await customEditor.waitFor({state:'detached'});
  await reader.waitForFunction(({ID,MAP,customId})=>game.settings.get(ID,'atlasState').maps[MAP].points[customId].district==='protector',{ID,MAP,customId});
  assert.equal(await reader.locator('[data-go="'+areaId+'"]').count(),0);assert.equal(await reader.locator('.nw-summary').innerText(),'Відкрита майстерня.');
  assert.equal(await gm.evaluate(id=>game.journal.get(id).pages.contents[0].text.content,fixture.custom._id),fixture.custom.pages[0].text.content);
  if(!await territories.isVisible())await atlas.locator('[data-territories]').click();
  await territories.locator('[data-select-region="'+areaId+'"]').click();assert.match(await atlas.locator('h3').innerText(),/New District/);
  await territories.locator('[data-toggle-region="'+areaId+'"]').click();await atlas.locator('[data-zone="'+areaId+'"]').waitFor({state:'detached'});await reader.locator('[data-zone="'+areaId+'"]').waitFor({state:'detached'});
  await territories.locator('[data-toggle-region="'+areaId+'"]').click();await reader.locator('[data-zone="'+areaId+'"]').waitFor();
  await territories.locator('[data-edit-region="'+areaId+'"]').click();assert.equal(await vertices.count(),4);
  const shapeBeforeRename=await gm.evaluate(({ID,MAP,areaId})=>game.settings.get(ID,'atlasState').maps[MAP].points[areaId].shape,{ID,MAP,areaId});
  await territories.locator('[name=areaRu]').fill('Несохранённое имя');
  await territories.locator('[data-edit-region=river]').click();await gm.locator('[data-action=no]').click();await gm.locator('[data-action=no]').waitFor({state:'detached'});
  assert.equal(await territories.locator('[name=areaRu]').inputValue(),'Несохранённое имя');assert.equal(await vertices.count(),4);
  await territories.locator('[data-edit-region=river]').click();await gm.locator('[data-action=yes]').click();await gm.locator('[data-action=yes]').waitFor({state:'detached'});
  assert.equal(await vertices.count(),35);assert.equal(await territories.locator('[data-region-row=river]').getAttribute('data-editing'),'true');
  await territories.locator('[data-region-cancel]').click();
  await territories.locator('[data-edit-region="'+areaId+'"]').click();assert.equal(await territories.locator('[name=areaRu]').inputValue(),'Новый район');
  await territories.locator('[name=areaRu]').fill('Тихая бухта');await territories.locator('[name=areaUk]').fill('Тиха затока');await territories.locator('[name=areaEn]').fill('Quiet Cove');await territories.locator('[name=areaCategory]').selectOption('water');
  await territories.locator('[data-region-save]').click();await territories.locator('.nw-region-editor').waitFor({state:'hidden'});
  const renamed=await gm.evaluate(({ID,MAP,areaId})=>game.settings.get(ID,'atlasState').maps[MAP].points[areaId],{ID,MAP,areaId});
  assert.equal(renamed.en,'Quiet Cove');assert.equal(renamed.category,'water');assert.equal(renamed.uk.lore,'Район майстрів.');assert.deepEqual(renamed.shape,shapeBeforeRename);
  await clickRegion(reader,areaId);assert.equal(await reader.locator('h3').innerText(),'Тиха затока (Quiet Cove)');
  await territories.locator('[data-dialog-close]').click();await gm.reload();await gm.waitForFunction(()=>game.ready);await keyM(gm);atlas=gm.locator('.nw-atlas');settings=gm.locator('.nw-settings');
  await select('Quiet Cove');assert.equal(await atlas.locator('h3').innerText(),'Тихая бухта (Quiet Cove)');
  await atlas.locator('[data-territories]').click();await territories.locator('[data-edit-region="'+areaId+'"]').click();assert.equal(await territories.locator('[name=areaCategory]').inputValue(),'water');await territories.locator('[data-region-cancel]').click();
  report.checks.push('territory-switch-cancel-and-discard-dirty-draft','territory-RU-UA-English-type-edit-preserves-shape-lore-access','territory-metadata-player-sync-and-GM-reload');
  await territories.locator('[data-remove-region="'+areaId+'"]').click();await gm.locator('[data-action=yes]').click();await gm.locator('[data-action=yes]').waitFor({state:'detached'});
  await reader.locator('[data-zone="'+areaId+'"]').waitFor({state:'detached'});await territories.locator('[data-region-row="'+areaId+'"]').waitFor({state:'detached'});
  assert.equal(await gm.evaluate(()=>game.journal.size),2,'Territory removal does not delete lore or custom points');
  report.checks.push('legacy-custom-point-district-selection','custom-district-member-navigation','custom-publication-keeps-private-note','published-district-links-apply-permissions','district-edit-sync-preserves-public-text','territory-list-select-toggle-edit-delete');
  report.checks.push('edit-district-south-vertex-with-unobstructed-map','insert-and-delete-vertex','create-custom-territory-no-journal');report.shape=savedShape;
  await territories.locator('[data-dialog-close]').click();await search().fill('');await atlas.locator('.nw-ruler-tools summary').click();await atlas.locator('[data-ruler]').click();
  await draw(gm,[[20,20],[39.53125,20]]);
  const straight=Number(await atlas.locator('[data-distance]').getAttribute('data-feet'));assert.ok(Math.abs(straight-1000)<6,straight);
  await atlas.locator('[name=rulerMode]').selectOption('free');await draw(gm,[[20,20],[39.53125,20],[39.53125,39.53125]]);
  const route=Number(await atlas.locator('[data-distance]').getAttribute('data-feet'));assert.ok(Math.abs(route-1705)<18,route);
  await atlas.locator('[data-calibrate]').click();for(const [x,y] of [[20,20],[39.53125,20]]){const p=await mapPoint(gm,x,y);await gm.mouse.click(p.x,p.y);}
  await settings.locator('[name=feet]').fill('2000');await settings.locator('[type=submit]').click();await settings.waitFor({state:'detached'});
  await atlas.locator('[data-ruler]').click();await atlas.locator('[name=rulerMode]').selectOption('line');await draw(gm,[[20,20],[39.53125,20]]);
  const calibrated=Number(await atlas.locator('[data-distance]').getAttribute('data-feet'));assert.ok(Math.abs(calibrated-2000)<12,calibrated);await atlas.locator('[data-ruler]').click();
  report.checks.push('printed-scale-straight-ruler','freehand-route-ruler','custom-scale-calibration');report.measurement={expected:{straight:1000,route:1705,calibrated:2000},actual:{straight,route,calibrated}};
  await select("Pirates' Skyhold");assert.match(await atlas.locator('.nw-summary').innerText(),/100 футах/);assert.match(await atlas.locator('.nw-era').innerText(),/1492/);
  assert.ok(await atlas.locator('[data-zone=pirates-skyhold]').count());report.checks.push('Pirates-Skyhold-bilingual-lore-and-island-territory');
  await backupFlow(gm,fixture,report);
  await atlas.locator('[data-settings]').click();await settings.locator('[data-user=default]').selectOption('2');await settings.locator('[data-user="'+fixture.users[0].id+'"]').selectOption('-1');await settings.locator('[data-user="'+fixture.users[1].id+'"]').selectOption('0');await settings.locator('[type=submit]').click();await settings.waitFor({state:'detached'});
  await reader.reload();await reader.waitForFunction(()=>game.ready);await closeProfile(reader);await keyM(reader);await reader.locator('[data-place=castle]').waitFor();await keyM(blocked);assert.equal(await blocked.locator('.nw-atlas').count(),0);
  await select('Castle Never');await atlas.locator('[data-point-settings]').click();await settings.locator('[data-user="'+fixture.users[0].id+'"]').selectOption('0');await settings.locator('[type=submit]').click();await settings.waitFor({state:'detached'});await reader.locator('[data-place=castle]').waitFor({state:'detached'});
  await atlas.locator('[data-settings]').click();await settings.locator('[data-user="'+fixture.users[0].id+'"]').selectOption('0');await settings.locator('[type=submit]').click();await settings.waitFor({state:'detached'});await reader.locator('.nw-atlas').waitFor({state:'detached'});
  assert.equal(requests.some(url=>url.includes('/data/places.json')),false);assert.equal(await gm.evaluate(()=>game.journal.size),2);
  report.checks.push('default-access-individual-exception','point-revocation-live','map-revocation-live','player-no-GM-catalog','no-service-journal-after-all-tools');
  await search().fill('');await fs.mkdir(new URL('evidence/',import.meta.url),{recursive:true});await gm.screenshot({path:fileURLToPath(new URL('evidence/editor-and-tools.png',import.meta.url))});
  assert.deepEqual(errors,[]);report.status='passed';
}catch(error){report.error=error.stack;
  async function diagnostics(p){return p?.evaluate(({ID,MAP})=>({events:globalThis.__atlasMoveEvents,
    layer:game.settings.get(ID,'activeLayer'),atlas:document.querySelector('.nw-atlas')?.outerHTML.slice(0,400),user:game.user.id,active:game.users.map(u=>({id:u.id,gm:u.isGM,active:u.active})),
    request:game.users.find(u=>u.name==='Atlas Reader')?.getFlag(ID,'moveRequest'),
    point:game.settings.get(ID,'atlasState').maps[MAP]?.points.castle,
    lake:game.settings.get(ID,'atlasState').maps[MAP]?.points.lake,
    zones:[...document.querySelectorAll('[data-zone]')].map(e=>({id:e.dataset.zone,rect:{w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}})),
    characters:game.settings.get(ID,'atlasState').maps[MAP]?.characters,acks:game.settings.get(ID,'atlasState').maps[MAP]?.requestAcks,notifications:[...document.querySelectorAll('#notifications .notification')].map(e=>e.innerText)}),{ID,MAP}).catch(()=>null);}
  report.diagnostics={gm:await diagnostics(gm),reader:await diagnostics(reader),errors};
  await gm?.screenshot({path:fileURLToPath(new URL('evidence/access-failure.png',import.meta.url))}).catch(()=>{});throw error;}
finally{
  try{await browser?.close();}finally{
    let cleanupError;
    try{report.cleanup=await server.stop();assert.deepEqual(await packSnapshot(root,env.app),before);report.cleanup.atlasPacksPreserved=true;}
    catch(error){cleanupError=error;report.cleanup ??= {};report.cleanup.error=error.stack;report.status='failed';}
    report.finished=new Date().toISOString();await fs.writeFile(new URL('access-latest.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
    if(cleanupError && !report.error)throw cleanupError;
  }
}
