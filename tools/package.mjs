import fs from 'node:fs/promises';
import path from 'node:path';
import {zipSync} from 'fflate';
import {ROOT,build,files} from './build.mjs';
import {verifyRuntime,verifyArchive,sha256} from './release/prepare.mjs';
import {verifyPackData} from './pack-check.mjs';

// Local installable ZIP, without release URLs, tags or publishing operations.
await fs.mkdir(path.join(ROOT,'build'),{recursive:true});
const run=await fs.mkdtemp(path.join(ROOT,'build/local-'));
const output=await build(path.join(run,'module')),entries={};
for(const file of await files(output))if(!['LOCK','LOG','LOG.old'].includes(path.basename(file)))entries[file]=await fs.readFile(path.join(output,file));
const manifest=JSON.parse(entries['module.json']);verifyRuntime(manifest,entries);
entries['release-provenance.json']=Buffer.from(JSON.stringify({schema:1,local:true,files:Object.fromEntries(Object.entries(entries).map(([file,bytes])=>[file,sha256(bytes)]))},null,2)+'\n');
const zip=zipSync(entries,{level:6}),checked=verifyArchive(entries['module.json'],zip);
const audit=await verifyPackData(checked);
await fs.writeFile(path.join(run,'module.zip'),zip);
await fs.writeFile(path.join(run,'verification.json'),JSON.stringify({zipSha256:sha256(zip),...audit},null,2)+'\n');
console.log(path.join(run,'module.zip'));
