import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {journalOperations} from '../../tools/build-pack.mjs';
import {skyholdCases} from '../lore-skyhold.mjs';
const read=async file=>JSON.parse(await fs.readFile(new URL('../../'+file,import.meta.url)));

test('two surface island records have bilingual lore, parent links and overview positions',async()=>{
  const places=await read('data/places.json'),rows=journalOperations(places).filter(r=>r.key.startsWith('!journal.pages!'));
  assert.equal(places.length,66);assert.equal(rows.length,132);
  const island=places.find(p=>p.id==='pirates-skyhold');
  for(const item of skyholdCases){
    const p=places.find(p=>p.id===item.id);assert.equal(p.period.status,'uncertain');assert.equal(p.position.status,'overview');assert.equal(p.coordinateApproximate,true);assert.equal(p.shape,undefined);
    assert.ok(p.related.includes(island.id)&&island.related.includes(p.id));
    for(const lang of ['ru','uk']){assert.match(p[lang].lore,item.fact[lang]);assert.match(p[lang].description,/1479/);assert.equal(p[lang].reconstruction,undefined);}
    assert.equal(rows.filter(r=>r.value.flags['neverwinter-atlas'].key===p.id).length,2);
  }
  assert.ok(places.find(p=>p.id==='vilebog').x<places.find(p=>p.id==='skull-fortress').x);
});
test('Tower District is an eastern-part search alias with unchanged district and island contours',async()=>{
  const places=await read('data/places.json'),river=places.find(p=>p.id==='river-district');
  assert.equal(places.filter(p=>p.category==='district').length,5);
  assert.equal(places.some(p=>p.id==='tower-district'),false);
  for(const alias of ['Tower District','Башенный район','Вежовий район'])assert.ok(river.aliases.includes(alias));
  assert.match(river.ru.lore,/Восточная часть/);assert.match(river.uk.lore,/Східна частина/);
  const reference=await read('data/region-default-source.json');
  for(const id of ['river-district','pirates-skyhold'])assert.deepEqual(places.find(p=>p.id===id).shape,reference.regions.find(r=>r.id===id).shape);
  const registry=await read('data/forgottenmaps-candidates.json');assert.equal(registry.features.find(f=>f.name==='Tower District').moduleId,'river-district');
  assert.equal(registry.features.filter(f=>f.status!=='included').length,10);
});
test('underground island candidates remain deferred without adding cave or dungeon records',async()=>{
  const places=await read('data/places.json'),registry=await read('data/forgottenmaps-candidates.json');
  for(const [name,decision] of [["Scalefather's Hollow",'deferred-underground-scope'],["Pirate King's Retreat",'deferred-mixed-underground-scope']]){
    const candidate=registry.features.find(f=>f.name===name);assert.equal(candidate.review.decision,decision);assert.equal(candidate.moduleId,null);assert.notEqual(candidate.status,'included');assert.equal(places.some(p=>p.en===name),false);
  }
});
