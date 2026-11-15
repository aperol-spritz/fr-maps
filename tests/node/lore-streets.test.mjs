import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {journalOperations} from '../../tools/build-pack.mjs';
import {streetCases} from '../lore-streets.mjs';

test('new surface lore is bilingual and street anchors do not invent routes or exact structures',async()=>{
  const places=JSON.parse(await fs.readFile(new URL('../../data/places.json',import.meta.url)));
  const rows=journalOperations(places).filter(r=>r.key.startsWith('!journal.pages!'));
  assert.equal(places.length,66);assert.equal(rows.length,132);
  for(const item of streetCases){
    const p=places.find(p=>p.id===item.id);assert.ok(p);assert.equal(p.position.status,'overview');assert.equal(p.period.status,'uncertain');assert.equal(p.shape,undefined);assert.equal(p.area,undefined);assert.equal(p.coordinateApproximate,true);
    for(const language of ['ru','uk'])assert.match(p[language].lore,item.fact[language]);
    const pages=rows.filter(r=>r.value.flags['neverwinter-atlas'].key===item.id);assert.equal(pages.length,2);
    for(const page of pages)assert.doesNotMatch(page.value.text.content,/Расположение —|Розташування —|Период сведений —|Період відомостей —|подложк|підклад/);
  }
  assert.ok(places.find(p=>p.id==='deekin-street').related.includes('coriol-street'));
});
test('Iron Flagon remains explicitly unresolved instead of becoming an unsupported canonical venue',async()=>{
  const places=JSON.parse(await fs.readFile(new URL('../../data/places.json',import.meta.url)));
  const registry=JSON.parse(await fs.readFile(new URL('../../data/forgottenmaps-candidates.json',import.meta.url)));
  const iron=registry.features.find(f=>f.name==='Iron Flagon Inn');assert.equal(iron.moduleId,null);assert.equal(iron.review.decision,'needs-source');assert.equal(places.some(p=>p.en==='Iron Flagon Inn'),false);
  for(const item of streetCases)assert.equal(registry.features.find(f=>f.moduleId===item.id)?.status,'included');
  assert.equal(registry.features.filter(f=>f.status!=='included').length,10);
});
