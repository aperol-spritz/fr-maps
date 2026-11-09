import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {journalOperations} from '../../tools/build-pack.mjs';
import {loreCases} from '../lore-summaries.mjs';

test('every city location has a short summary in each language and a stable compiled page',async()=>{
  const places=JSON.parse(await fs.readFile(new URL('../../data/places.json',import.meta.url)));
  assert.equal(places.length,60);
  const rows=journalOperations(places).filter(r=>r.key.startsWith('!journal.pages!'));
  assert.equal(rows.length,120);
  for(const place of places)for(const language of ['ru','uk']){
    const summary=place[language].lore;
    assert.ok(summary.trim().split(/\s+/u).length>=10,place.id+' needs actual lore');
    assert.ok(summary.trim().split(/\s+/u).length<=110,place.id+' should remain a short summary');
    assert.equal(rows.filter(r=>r.value.flags['neverwinter-atlas'].key===place.id).length,2);
  }
  for(const item of loreCases){
    const p=places.find(p=>p.id===item.id);assert.equal(p.period.status==='historical',item.historical);assert.equal(p.position.status,'overview');
    for(const language of ['ru','uk']){assert.match(p[language].lore,item.fact[language]);assert.match(p.period[language],item.era);assert.match(p[language].lore+p[language].details,/1492/);}
  }
  assert.ok(places.find(p=>p.id==='shining-serpent').y>50,'Reject northern website coordinate conflicting with historical district');
  const candidates=JSON.parse(await fs.readFile(new URL('../../data/forgottenmaps-candidates.json',import.meta.url)));
  for(const item of loreCases)if(!item.outsideCatalogue)assert.equal(candidates.features.find(f=>f.moduleId===item.id)?.status,'included');
  assert.equal(candidates.features.filter(f=>f.status!=='included').length,18);
});

test('historical school and replacement temple share only an overview; unsupported shops stay candidates',async()=>{
  const places=JSON.parse(await fs.readFile(new URL('../../data/places.json',import.meta.url))),get=id=>places.find(p=>p.id===id);
  const academy=get('magic-academy'),temple=get('waukeen-temple');
  assert.deepEqual([academy.x,academy.y],[temple.x,temple.y]);
  assert.ok(academy.related.includes(temple.id)&&temple.related.includes(academy.id));
  for(const place of [academy,temple]){assert.equal(place.position.status,'overview');assert.equal(place.period.status,'historical');assert.equal(place.coordinateApproximate,true);}
  assert.notDeepEqual([get('neverwinter-academy').x,get('neverwinter-academy').y],[academy.x,academy.y]);
  assert.ok(get('sand-shop').related.includes('sunken-flagon'));
  const registry=JSON.parse(await fs.readFile(new URL('../../data/forgottenmaps-candidates.json',import.meta.url)));
  for(const name of ["Claven's General Supplies and Armory",'Astorio Arms',"Buckman's Emporium",'Brandis Vrye Rookery','Temple of Amaunator',"Hazel's Apothecary"]){
    const candidate=registry.features.find(f=>f.name===name);assert.equal(candidate.review.decision,'needs-source');assert.equal(candidate.moduleId,null);assert.notEqual(candidate.status,'included');assert.equal(places.some(p=>p.en===name),false);
  }
});
