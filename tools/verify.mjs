import fs from 'node:fs/promises';
import {ClassicLevel} from 'classic-level';
import assert from 'node:assert/strict';
import {files} from './build.mjs';
import {journalOperations} from './build-pack.mjs';
import {verifyRuntime} from './release/prepare.mjs';
const root=process.argv[2]??'build/release',manifest=JSON.parse(await fs.readFile(root+'/module.json'));
const entries=Object.fromEntries(await Promise.all((await files(root)).map(async file=>[file,await fs.readFile(root+'/'+file)])));
verifyRuntime(manifest,entries);
const db=new ClassicLevel(root+'/'+manifest.packs[0].path,{createIfMissing:false,valueEncoding:'json'});
try{await db.open();const actual=[...await db.iterator().all()].sort(([a],[b])=>a.localeCompare(b));const expected=journalOperations(JSON.parse(entries['data/places.json'])).map(r=>[r.key,r.value]).sort(([a],[b])=>a.localeCompare(b));assert.deepEqual(actual,expected);}finally{await db.close();}
console.log('Built runtime files and all journal rows verified.');
