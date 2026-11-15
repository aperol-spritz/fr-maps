import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {journalOperations} from '../../tools/build-pack.mjs';
const read=async p=>JSON.parse(await fs.readFile(new URL('../../'+p,import.meta.url)));

test('historical Beggars Nest resolves to existing Chasm without creating a sixth district or changing its contour',async()=>{
  const places=await read('data/places.json'),chasm=places.find(p=>p.id==='chasm');
  assert.equal(places.length,66);assert.equal(places.filter(p=>p.category==='district').length,5);
  assert.equal(places.some(p=>p.id==='beggars-nest'),false);
  for(const alias of ["Beggar's Nest",'Beggar’s Nest','Гнездо нищих','Гніздо жебраків'])assert.ok(chasm.aliases.includes(alias));
  const baseline=await read('data/region-default-source.json');assert.deepEqual(chasm.shape,baseline.regions.find(p=>p.id==='chasm').shape);
  for(const lang of ['ru','uk']){assert.match(chasm[lang].lore,/1451/);assert.match(chasm[lang].lore,/1492/);assert.match(chasm[lang].description,/XIV/);}
  const registry=await read('data/forgottenmaps-candidates.json'),candidate=registry.features.find(p=>p.name==="Beggar's Nest");
  assert.equal(candidate.moduleId,'chasm');assert.equal(candidate.review.decision,'historical-predecessor-partial-correspondence');assert.equal(registry.features.filter(f=>f.status!=='included').length,10);
});
test('historical academy and inn link to Chasm while Paupers Section remains a different cemetery place',async()=>{
  const places=await read('data/places.json'),get=id=>places.find(p=>p.id===id),rows=journalOperations(places).filter(r=>r.key.startsWith('!journal.pages!'));
  assert.equal(rows.length,132);
  for(const id of ['paupers','neverwinter-academy','shining-serpent']){assert.ok(get(id).related.includes('chasm'));assert.ok(get('chasm').related.includes(id));}
  for(const id of ['neverwinter-academy','shining-serpent'])assert.equal(get(id).period.status,'historical');
  assert.equal(get('paupers').district,'protector');assert.ok(get('paupers').related.includes('neverdeath'));
  for(const lang of ['ru','uk'])assert.match(get('paupers')[lang].description,lang==='ru'?/жилым районом/:/житловим районом/);
  for(const row of rows.filter(r=>r.value.flags['neverwinter-atlas'].key==='chasm'))assert.match(row.value.text.content,/Neverwinter\/Beggar%27s_Nest/);
});
test('every canonical city record has a valid default map representation without hidden or missing geometry',async()=>{
  const places=await read('data/places.json');const pins=[],areas=[];
  for(const p of places){
    assert.ok(Number.isFinite(p.x)&&p.x>=0&&p.x<=100&&Number.isFinite(p.y)&&p.y>=0&&p.y<=100,p.id);
    const area=Array.isArray(p.shape?.points)&&p.shape.points.length>=3;
    if(area){assert.ok(!p.shape.hidden);assert.ok(p.shape.points.every(point=>Array.isArray(point)&&point.length===2&&point.every(Number.isFinite)));areas.push(p.id);}
    if(p.keepMarker||!(p.area||p.territoryOnly||area))pins.push(p.id);
    assert.ok(pins.includes(p.id)||areas.includes(p.id),p.id+' has no default map representation');
  }
  assert.equal(pins.length,54);assert.equal(areas.length,12);assert.equal(new Set([...pins,...areas]).size,66);
});
