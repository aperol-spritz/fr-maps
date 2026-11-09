import fs from 'node:fs/promises';
import {files} from './build.mjs';
import {verifyPackData} from './pack-check.mjs';
import {verifyRuntime} from './release/prepare.mjs';
const root=process.argv[2]??'build/release',manifest=JSON.parse(await fs.readFile(root+'/module.json'));
const entries=Object.fromEntries(await Promise.all((await files(root)).map(async file=>[file,await fs.readFile(root+'/'+file)])));
verifyRuntime(manifest,entries);
console.log(JSON.stringify(await verifyPackData({manifest,entries}),null,2));
console.log('Built runtime files, journal rows, media and UUID links verified.');
