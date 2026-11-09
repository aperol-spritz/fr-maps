import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const source=path.resolve('F:/FoundryVTT/Data/worlds/koban/data/settings'),parent=path.resolve(os.tmpdir());
const temporary=await fs.mkdtemp(path.join(parent,'neverwinter-regions-read-')),ignored=new Set(['LOCK','LOG','LOG.old']);
const output=process.argv[2] ?? 'region-default-source.json';assert.ok(/^[a-z0-9-]+\.json$/.test(output),'Use a JSON filename inside data');
async function hashes(directory){const result={};for(const entry of (await fs.readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){if(ignored.has(entry.name))continue;assert.ok(entry.isFile());result[entry.name]=createHash('sha256').update(await fs.readFile(path.join(directory,entry.name))).digest('hex');}return result;}
try{
  const before=await hashes(source),destination=path.join(temporary,'settings');
  await fs.cp(source,destination,{recursive:true,filter:file=>!ignored.has(path.basename(file))});assert.deepEqual(await hashes(source),before);assert.deepEqual(await hashes(destination),before);
  const {ClassicLevel}=createRequire(import.meta.url)('F:/FoundryVTT/Foundry Virtual Tabletop/resources/app/node_modules/classic-level');
  const db=new ClassicLevel(destination,{valueEncoding:'json'});
  try{
    await db.open();let found=false;
    for await(const [,record]of db.iterator()){
      if(record.key!=='neverwinter-atlas.atlasState' || record.user)continue;
      const state=typeof record.value==='string'?JSON.parse(record.value):record.value;
      const map='modules/neverwinter-atlas/assets/neverwinter.webp',regions=[];
      for(const [id,p]of Object.entries(state.maps?.[map]?.points ?? {})){
        if(!p.shape?.points?.length)continue;
        assert.ok(p.shape.points.length>=3 && p.shape.points.every(p=>p.length===2&&p.every(v=>Number.isFinite(v)&&v>=0&&v<=100)));
        regions.push({id,shape:p.shape,area:Boolean(p.area),en:p.en,ru:{name:p.ru.name},uk:{name:p.uk.name},category:p.category,x:p.x,y:p.y});
      }
      assert.ok(regions.length,'No saved contours');
      const result={source:'User-edited region contours',world:'koban',map,captured:new Date().toISOString(),regions,sha256:createHash('sha256').update(JSON.stringify(regions)).digest('hex')};
      await fs.writeFile(new URL('../data/'+output,import.meta.url),JSON.stringify(result,null,2)+'\n');
      console.log(JSON.stringify(regions.map(r=>({id:r.id,vertices:r.shape.points.length,area:r.area}))));found=true;
    }
    assert.ok(found);
  }finally{await db.close();}
}finally{assert.equal(path.dirname(temporary),parent);assert.ok(path.basename(temporary).startsWith('neverwinter-regions-read-'));await fs.rm(temporary,{recursive:true,force:true});}
