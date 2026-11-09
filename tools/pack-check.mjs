import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {ClassicLevel} from 'classic-level';
import {journalOperations} from './build-pack.mjs';
// Read only an owned copy, never a database in the installed module.
export async function verifyPackData({manifest,entries}){
  const parent=path.resolve(os.tmpdir()),root=await fs.mkdtemp(path.join(parent,'neverwinter-release-check-'));
  try{
    const source=JSON.parse(Buffer.from(entries['data/places.json']).toString());
    for(const pack of manifest.packs){
      if(pack.name!=='city'||pack.type!=='JournalEntry')throw Error('Unsupported release pack');
      for(const [file,bytes]of Object.entries(entries))if(file.startsWith(pack.path+'/')){
        const target=path.resolve(root,...file.split('/'));assert.ok(target.startsWith(root+path.sep));await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes);
      }
      const db=new ClassicLevel(path.join(root,pack.path),{createIfMissing:false,valueEncoding:'json'});
      try{await db.open();if(!isDeepStrictEqual(new Map(await db.iterator().all()),new Map(journalOperations(source).map(r=>[r.key,r.value]))))throw Error('Archived compendium differs from canonical lore');}finally{await db.close();}
    }
  }finally{assert.equal(path.dirname(root),parent);assert.ok(path.basename(root).startsWith('neverwinter-release-check-'));await fs.rm(root,{recursive:true,force:true});}
}
