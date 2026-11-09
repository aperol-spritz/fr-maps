import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const source=path.resolve('F:/FoundryVTT/Data/worlds/koban/data/settings');
const parent=path.resolve(os.tmpdir());
const temporary=await fs.mkdtemp(path.join(parent,'neverwinter-river-read-'));
const ignored=new Set(['LOCK','LOG','LOG.old']);
async function hashes(directory){
  const result={};
  for(const entry of (await fs.readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
    if(ignored.has(entry.name))continue;
    assert.ok(entry.isFile(),'Unexpected settings database member');
    result[entry.name]=createHash('sha256').update(await fs.readFile(path.join(directory,entry.name))).digest('hex');
  }
  return result;
}
try{
  const before=await hashes(source),destination=path.join(temporary,'settings');
  await fs.cp(source,destination,{recursive:true,filter:file=>!ignored.has(path.basename(file))});
  assert.deepEqual(await hashes(source),before,'Settings changed during copy');
  assert.deepEqual(await hashes(destination),before,'Settings copy differs');
  const {ClassicLevel}=createRequire(import.meta.url)('F:/FoundryVTT/Foundry Virtual Tabletop/resources/app/node_modules/classic-level');
  const db=new ClassicLevel(destination,{valueEncoding:'json'});
  try{
    await db.open();let found=false;
    for await(const [,record]of db.iterator()){
      if(record.key!=='neverwinter-atlas.atlasState' || record.user)continue;
      const state=typeof record.value==='string'?JSON.parse(record.value):record.value;
      for(const [map,data]of Object.entries(state.maps ?? {})){
        const shape=data.points?.river?.shape;
        if(!shape?.points?.length)continue;
        assert.ok(shape.points.length>=3 && shape.points.every(p=>p.length===2 && p.every(v=>Number.isFinite(v)&&v>=0&&v<=100)));
        const result={source:'User-edited river contour',world:'koban',map,shape,
          sha256:createHash('sha256').update(JSON.stringify(shape)).digest('hex'),captured:new Date().toISOString()};
        await fs.writeFile(new URL('../data/river-default-source.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
        console.log(JSON.stringify({map,vertices:shape.points.length,sha256:result.sha256}));found=true;
      }
    }
    if(!found)throw Error('No saved river contour found');
  }finally{await db.close();}
}finally{
  assert.equal(path.dirname(temporary),parent);assert.ok(path.basename(temporary).startsWith('neverwinter-river-read-'));
  await fs.rm(temporary,{recursive:true,force:true});
}
