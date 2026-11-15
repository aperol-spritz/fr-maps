import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {journalOperations} from '../../tools/build-pack.mjs';
import {loreCases} from '../lore-summaries.mjs';

test('player lore is developed prose, retains identities and excludes editorial instructions and later events',async()=>{
 const places=JSON.parse(await fs.readFile(new URL('../../data/places.json',import.meta.url)));
 const pages=journalOperations(places).filter(row=>row.key.startsWith('!journal.pages!'));
 for(const place of places)for(const language of ['ru','uk']){
  const local=place[language],prose=Object.entries(local).filter(([key])=>key!=='name').map(([,text])=>text).join(' ');
  const words=prose.trim().split(/\s+/u).length;
  assert.ok(words>=60&&words<=200,`${place.id}/${language}: ${words} words`);
  assert.ok(local.description,place.id+' needs developed location prose');
  for(const field of ['reconstruction','details','organizations'])assert.equal(local[field],undefined,place.id+' keeps editorial fields out of player copy');
  assert.doesNotMatch(prose,/реконструкц|сохраняем|допускаем|принимаем|ведущий|ведучий|MMORPG|\bMMO\b|Вики |Вікі |не (?:установлен|встановлен|подтвержд|підтвердж)|2026-\d\d-\d\d/iu);
  assert.doesNotMatch(prose,/\b(?:149[3-9]|15\d\d)\b/,place.id+' contains a later event');
  const journalId=createHash('sha256').update(language).digest('hex').slice(0,16);
  const compiled=pages.find(row=>row.key.startsWith('!journal.pages!'+journalId+'.')&&row.value.flags['neverwinter-atlas'].key===place.id);
  assert.ok(compiled?.value.text.content.includes(local.description));
  const html=compiled.value.text.content;
  assert.ok(html.indexOf(local.description)<html.indexOf('<footer'));
  assert.match(html,/<footer class="nw-journal-notes" style="font-size:0\.8em;/);
  assert.doesNotMatch(html,/<h3>|2026-\d\d-\d\d/);
 }
 const castle=places.find(p=>p.id==='castle');assert.doesNotMatch(castle.ru.lore+castle.ru.description,/принимают в Зале|дела власти решают в Зале/);
 assert.match(places.find(p=>p.id==='lake').ru.lore,/1489/);
 assert.match(places.find(p=>p.id==='chasm-rift').ru.lore,/магически запечатан/);
 assert.match(places.find(p=>p.id==='shining-serpent').ru.lore,/разрушена.*1451/);
});

test('every city location has a short summary in each language and a stable compiled page',async()=>{
  const places=JSON.parse(await fs.readFile(new URL('../../data/places.json',import.meta.url)));
  assert.equal(places.length,66);
  const rows=journalOperations(places).filter(r=>r.key.startsWith('!journal.pages!'));
  assert.equal(rows.length,132);
  for(const place of places)for(const language of ['ru','uk']){
    const summary=place[language].lore;
    assert.ok(summary.trim().split(/\s+/u).length>=10,place.id+' needs actual lore');
    assert.ok(summary.trim().split(/\s+/u).length<=110,place.id+' should remain a short summary');
    assert.equal(rows.filter(r=>r.value.flags['neverwinter-atlas'].key===place.id).length,2);
  }
  for(const item of loreCases){
    const p=places.find(p=>p.id===item.id);assert.equal(p.period.status==='historical',item.historical);assert.equal(p.position.status,'overview');
    for(const language of ['ru','uk']){assert.match(p[language].lore,item.fact[language]);assert.match(p.period[language],item.era);assert.ok(p.period[language]);}
  }
  assert.ok(places.find(p=>p.id==='shining-serpent').y>50,'Reject northern website coordinate conflicting with historical district');
  const candidates=JSON.parse(await fs.readFile(new URL('../../data/forgottenmaps-candidates.json',import.meta.url)));
  for(const item of loreCases)if(!item.outsideCatalogue)assert.equal(candidates.features.find(f=>f.moduleId===item.id)?.status,'included');
  assert.equal(candidates.features.filter(f=>f.status!=='included').length,10);
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

test('player journals omit development caveats and retain expanded animated-location lore',async()=>{
 const places=JSON.parse(await fs.readFile(new URL('../../data/places.json',import.meta.url)));
 const pages=journalOperations(places).filter(r=>r.key.startsWith('!journal.pages!')).map(r=>r.value);
 for(const page of pages)assert.doesNotMatch(page.text.content,/Расположение —|Розташування —|Период сведений —|Період відомостей —|подложк|підклад/);
 for(const place of places.filter(p=>p.asset?.endsWith('.gif')))for(const lang of ['ru','uk'])assert.ok(place[lang].description.length>200);
});
