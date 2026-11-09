// Install a ZIP into an entirely new Foundry data directory. No installed pack
// is opened and no campaign/world configuration is read or changed.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {unzipSync} from 'fflate';
import {ROOT,files} from '../tools/build.mjs';
import {sha256,verifyArchive} from '../tools/release/prepare.mjs';
import {verifyPackData} from '../tools/pack-check.mjs';
import {journalOperations} from '../tools/build-pack.mjs';
import {environment,playwright} from '../../gem/tools/integration/server.mjs';
import {login,guard} from '../../gem/tests/integration/helpers.mjs';
import {loreSummaries} from './lore-summaries.mjs';

const zipFile=process.argv[2];if(!zipFile)throw Error('Usage: npm run test:foundry:journals -- build/local-…/module.zip');
const zip=await fs.readFile(zipFile),entries=unzipSync(zip),checked=verifyArchive(entries['module.json'],zip);
const audit=await verifyPackData(checked),env=await environment();
const root=await fs.mkdtemp(path.join(os.tmpdir(),'neverwinter-journal-test-'));
const token=randomUUID(),world='atlas-journals-'+token.slice(0,8),server={...env,world,token};
const report={status:'failed',foundry:env.foundryVersion,zipSha256:sha256(zip),audit,checks:[]};
let child,browser,log,exited;
const json=async(file,value)=>fs.writeFile(file,JSON.stringify(value,null,2)+'\n');
async function snapshot(directory) {return Object.fromEntries(await Promise.all((await files(directory)).filter(f=>!['LOCK','LOG','LOG.old'].includes(path.basename(f))).map(async f=>[f,sha256(await fs.readFile(path.join(directory,f)))])));}
try {
  // Refuse an occupied port; never attach to another Foundry instance.
  const {createServer}=await import('node:net'),probe=createServer();
  await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(env.port,'127.0.0.1',resolve);});await new Promise(resolve=>probe.close(resolve));
  for(const dir of ['Config',`Data/worlds/${world}`,'Data/modules/neverwinter-atlas','Data/systems'])await fs.mkdir(path.join(root,dir),{recursive:true});
  for(const [name,bytes]of Object.entries(entries)) {const target=path.join(root,'Data/modules/neverwinter-atlas',name);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes);}
  const before=await snapshot(env.system),systemCopy=path.join(root,'Data/systems/dnd5e');
  await fs.cp(env.system,systemCopy,{recursive:true,filter:f=>!['LOCK','LOG','LOG.old'].includes(path.basename(f))});
  assert.deepEqual(await snapshot(env.system),before);assert.deepEqual(await snapshot(systemCopy),before);
  await fs.copyFile(env.license,path.join(root,'Config/license.json'));
  await json(path.join(root,`Data/worlds/${world}/world.json`),{id:world,title:'Disposable atlas journal ZIP test',system:'dnd5e',coreVersion:env.foundryVersion,systemVersion:'6.0.6',compatibility:{minimum:'14',verified:env.foundryVersion}});
  await json(path.join(root,'Config/options.json'),{port:env.port,hostname:'127.0.0.1',localHostname:'127.0.0.1',upnp:false,telemetry:false,language:'en'});
  await fs.writeFile(path.join(root,'Data/gem-integration-marker.txt'),token);
  log=await fs.open(path.join(root,'server.log'),'w');
  child=spawn(process.execPath,['--import',new URL('../../gem/tools/integration/server-ready.mjs',import.meta.url).href,path.join(env.app,'main.js'),`--dataPath=${root}`,`--port=${env.port}`,`--world=${world}`,'--noupnp','--noipdiscovery','--noupdate'],{windowsHide:true,stdio:['ignore',log.fd,log.fd,'ipc']});
  exited=once(child,'exit');let ready=false;child.on('message',m=>{if(m==='gem-integration:addresses-ready')ready=true;});
  for(let i=0;i<360;i++) {if(child.exitCode!==null)throw Error('Disposable Foundry exited; see '+root+'/server.log');if(ready){try{const r=await fetch(env.baseURL+'/gem-integration-marker.txt');if(await r.text()===token)break;}catch{}}await delay(250);}
  assert.ok(ready,'Foundry readiness timeout');
  browser=await playwright().chromium.launch({executablePath:process.env.GEM_BROWSER_EXECUTABLE,headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().url().startsWith(env.baseURL)||!/^https?:/.test(route.request().url())?route.continue():route.abort());
  await login(page,server);await page.evaluate(()=>game.settings.set('core','moduleConfiguration',{'neverwinter-atlas':true}));await page.reload();
  await page.waitForFunction(()=>game.ready&&game.modules.get('neverwinter-atlas')?.active);await guard(page,server);
  const expected=journalOperations(JSON.parse(Buffer.from(entries['data/places.json']).toString()));
  async function compare() {
    const result=await page.evaluate(async()=>{
      const pack=game.packs.get('neverwinter-atlas.city'),journals=await pack.getDocuments(),links=[];
      for(const journal of journals)for(const page of journal.pages)for(const match of page.text.content.matchAll(/@UUID\[([^\]]+)\]/g))links.push(match[1]);
      return {worldJournals:game.journal.size,locked:pack.locked,journals:journals.map(j=>({id:j.id,name:j.name,pages:j.pages.contents.map(p=>({id:p.id,name:p.name,type:p.type,sort:p.sort,text:p.toObject().text}))})),resolved:(await Promise.all(links.map(link=>fromUuid(link)))).every(Boolean)};
    });
    assert.equal(result.worldJournals,0,'No startup import');assert.equal(result.locked,true);assert.equal(result.journals.length,audit.journals);assert.equal(result.resolved,true);
    for(const journal of result.journals) {
      const source=expected.find(r=>r.key==='!journal!'+journal.id).value;assert.equal(journal.name,source.name);assert.deepEqual(journal.pages.map(p=>p.id),source.pages);
      for(const page of journal.pages) {const source=expected.find(r=>r.key===`!journal.pages!${journal.id}.${page.id}`).value;assert.equal(page.name,source.name);assert.equal(page.type,source.type);assert.equal(page.sort,source.sort);assert.equal(page.text.content,source.text.content);assert.equal(page.text.format,source.text.format);}
    }
  }
  await compare();report.checks.push('ZIP-installed','module-enabled','no-startup-import','titles-page-order-types-rich-text-match','all-UUID-links-resolve');
  await page.locator('#sidebar-tabs [data-tab="compendium"], #sidebar-tabs [data-tab="compendiumDirectory"]').first().click();
  const pack=page.locator('[data-pack="neverwinter-atlas.city"]');await pack.waitFor();await pack.dblclick();
  const first=expected.find(r=>r.key.startsWith('!journal!')).value;
  await page.locator(`[data-entry-id="${first._id}"]`).first().dblclick();
  await page.waitForFunction(id=>[...foundry.applications.instances.values()].some(a=>a.rendered&&a.document?.id===id),first._id);
  report.checks.push('opened-from-compendium-sidebar','opened-journal-sheet');
  const pinSources=JSON.parse(Buffer.from(entries['data/places.json']).toString()).filter(p=>p.asset);
  if(pinSources.length) {
    await page.waitForFunction(()=>[...document.querySelectorAll('.journal-entry img')].some(img=>img.src.includes('/assets/journals/pins/')&&img.complete&&img.naturalWidth>0));
    await page.evaluate(async()=>{for(const a of foundry.applications.instances.values())if(a.document?.documentName==='JournalEntry')await a.close();});
    await page.locator('body').click({position:{x:500,y:20}});await page.keyboard.press('KeyM');
    await page.waitForFunction(ids=>ids.every(id=>{const img=document.querySelector(`.nw-pin[data-place="${id}"] img`);return img?.complete&&img.naturalWidth>0;}),pinSources.map(p=>p.id));
    for(const source of pinSources)assert.ok((await page.locator(`.nw-pin[data-place="${source.id}"] img`).getAttribute('src')).endsWith(source.asset));
    const portablePlaces=JSON.parse(Buffer.from(entries['data/places.json']).toString());
    for(const source of portablePlaces.filter(p=>['knowledge','mask','chasm-rift'].includes(p.id))) {
      const position=await page.locator(`.nw-pin[data-place="${source.id}"]`).evaluate(el=>[parseFloat(el.style.left),parseFloat(el.style.top)]);
      assert.ok(Math.abs(position[0]-source.x)<.0001&&Math.abs(position[1]-source.y)<.0001,'Captured coordinates: '+source.id);
    }
    assert.equal(await page.locator('.nw-pin[data-place="castle"]').getAttribute('data-base-size'),'25');
    const areaDefaults=await page.evaluate(async()=>{
      const {accessiblePlaces}=await import('/modules/neverwinter-atlas/state.mjs');
      const source=await (await fetch('/modules/neverwinter-atlas/data/places.json')).json();
      return accessiblePlaces(source,'modules/neverwinter-atlas/assets/neverwinter.webp',[]).filter(p=>['lake','river'].includes(p.id)).map(p=>({id:p.id,x:p.x,y:p.y,color:p.color,size:p.size}));
    });
    for(const actual of areaDefaults){const source=portablePlaces.find(p=>p.id===actual.id);assert.deepEqual(actual,{id:source.id,x:source.x,y:source.y,color:source.color,size:source.size});}
    const defaults=await page.evaluate(async()=>{
      const {mapState}=await import('/modules/neverwinter-atlas/state.mjs');
      const {defaultMaps}=await import('/modules/neverwinter-atlas/defaults.mjs');
      const map='modules/neverwinter-atlas/assets/neverwinter.webp',value=mapState(map);
      const journal=(await game.packs.get('neverwinter-atlas.city').getDocuments())[0];
      return {actual:value.calibration,expected:defaultMaps[map].calibration,pack:journal.getFlag('neverwinter-atlas','mapDefaults').find(v=>v.map===map).calibration,metadata:journal.pages.find(p=>p.getFlag('neverwinter-atlas','key')==='knowledge').getFlag('neverwinter-atlas','location').x};
    });
    assert.deepEqual(defaults.actual,defaults.expected);assert.deepEqual(defaults.pack,defaults.expected);assert.equal(defaults.metadata,portablePlaces.find(p=>p.id==='knowledge').x);
    report.checks.push('captured-five-point-coordinates','captured-pin-colors-and-sizes','bundled-calibration-and-compendium-location-metadata');
    // Existing world records without an image inherit the new bundled default;
    // an explicit empty image remains an intentional removal.
    assert.deepEqual(await page.evaluate(async source=>{
      const {accessiblePlaces,recordFor}=await import('/modules/neverwinter-atlas/state.mjs');
      const map='modules/neverwinter-atlas/assets/neverwinter.webp',next=foundry.utils.deepClone(game.settings.get('neverwinter-atlas','atlasState'));
      const record=recordFor(source,map);delete record.asset;next.maps[map]={points:{[source.id]:record},ownership:{default:0}};
      await game.settings.set('neverwinter-atlas','atlasState',next);
      const inherited=accessiblePlaces([source],map,[])[0].asset;
      next.maps[map].points[source.id].asset='';next.maps[map].points[source.id].x=7;next.maps[map].points[source.id].size=42;next.maps[map].calibration={a:[0,0],b:[10,0],feet:500};await game.settings.set('neverwinter-atlas','atlasState',next);
      const {mapState}=await import('/modules/neverwinter-atlas/state.mjs');const place=accessiblePlaces([source],map,[])[0];
      return [inherited,place.asset,place.x,place.size,mapState(map).calibration.feet];
    },pinSources[0]),[pinSources[0].asset,'',7,42,500]);
    await page.locator('.nw-atlas [data-close]').click();report.checks.push('journal-GIF-renders','six-default-pin-GIFs-load','existing-record-image-default-and-explicit-removal');
  }
  for(const item of audit.media)if(item.path!=='embedded data URI')assert.equal((await page.request.get(env.baseURL+'/'+item.path)).ok(),true);
  await page.reload();await page.waitForFunction(()=>game.ready);await compare();
  await page.evaluate(()=>game.packs.get('neverwinter-atlas.city').render(true));
  await page.locator(`[data-entry-id="${first._id}"]`).first().waitFor();
  await loreSummaries(page,report);
  report.checks.push('pack-reopens-after-reload');assert.deepEqual(errors,[]);report.status='passed';
} catch(error) {report.error=error.stack;throw error;}
finally {
  await browser?.close();if(child&&child.exitCode===null){child.kill();await exited;}await log?.close();
  // Keep diagnostics outside the web-served module. Remove only our owned payload.
  assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('neverwinter-journal-test-'));
  for(const name of ['Data','Config','Logs'])await fs.rm(path.join(root,name),{recursive:true,force:true});
  report.cleanup={serverStopped:true,disposablePayloadRemoved:true};report.finished=new Date().toISOString();
  await json(path.join(ROOT,'tests/journals-latest.json'),report);console.log(JSON.stringify(report,null,2));
}
