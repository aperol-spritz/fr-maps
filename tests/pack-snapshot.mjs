import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {packSnapshot as readPacks} from '../../gem/tools/integration/server.mjs';
const ignored=new Set(['LOCK','LOG','LOG.old']);
async function files(root) {
  const result={};
  async function walk(directory){
    for(const entry of (await fs.readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
      if(ignored.has(entry.name))continue;
      const file=path.join(directory,entry.name);
      if(entry.isSymbolicLink())throw Error('Unexpected database symlink');
      if(entry.isDirectory())await walk(file);
      else result[path.relative(root,file)]=createHash('sha256').update(await fs.readFile(file)).digest('hex');
    }
  }
  await walk(root);return result;
}
// Never acquire a database handle against the installed module. Foundry may
// already have it open. Verify the entire data file set before/after copying,
// then read only our independent snapshot. Numeric *.log WAL files are included.
export async function packSnapshot(modulePath,app) {
  const sourceRoot=path.resolve(modulePath),parent=path.resolve(os.tmpdir());
  const temporary=await fs.mkdtemp(path.join(parent,'neverwinter-pack-snapshot-'));
  try {
    const manifest=await fs.readFile(path.join(sourceRoot,'module.json'));
    await fs.writeFile(path.join(temporary,'module.json'),manifest);
    for(const pack of JSON.parse(manifest).packs ?? []) {
      const source=path.resolve(sourceRoot,pack.path),target=path.resolve(temporary,pack.path);
      assert.ok(source.startsWith(sourceRoot+path.sep) && target.startsWith(temporary+path.sep),'Pack path escaped snapshot roots');
      const before=await files(source);
      await fs.mkdir(path.dirname(target),{recursive:true});
      await fs.cp(source,target,{recursive:true,filter:file=>!ignored.has(path.basename(file))});
      assert.deepEqual(await files(source),before,'Installed pack changed during snapshot');
      assert.deepEqual(await files(target),before,'Snapshot data differs from installed pack');
    }
    return await readPacks(temporary,app);
  } finally {
    assert.equal(path.dirname(temporary),parent);
    assert.ok(path.basename(temporary).startsWith('neverwinter-pack-snapshot-'));
    await fs.rm(temporary,{recursive:true,force:true});
  }
}
