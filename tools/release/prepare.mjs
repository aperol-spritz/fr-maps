import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {zipSync,unzipSync} from 'fflate';
import {files} from '../build.mjs';
import {verifyPackData} from '../pack-check.mjs';
import {versionOf,repositoryName} from './tag.mjs';
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export function releaseManifest(source,tag,repository){
  const version=versionOf(tag),repo=repositoryName(repository),url=`https://github.com/${repo}`;
  if(source.id!=='neverwinter-atlas'||source.title!=='Neverwinter: City Map'||!source.compatibility?.minimum||!source.compatibility?.verified)throw Error('Unexpected package identity/compatibility');
  return {...structuredClone(source),version,url,manifest:`${url}/releases/latest/download/module.json`,download:`${url}/releases/download/${tag}/module.zip`};
}
function safeFile(name){if(!name||name.startsWith('/')||name.includes('\\')||name.split('/').some(p=>p==='..'||p==='.')||/^[A-Za-z]:/.test(name))throw Error('Unsafe archive path: '+name);}
export function verifyRuntime(manifest,entries){
  for(const name of Object.keys(entries))safeFile(name);
  const exists=name=>{safeFile(name);if(!entries[name])throw Error('Missing runtime file: '+name);};
  for(const name of [...(manifest.esmodules??[]),...(manifest.scripts??[]),...(manifest.styles??[]),...(manifest.languages??[]).map(x=>x.path)])exists(name);
  for(const p of manifest.packs??[]){safeFile(p.path);exists(p.path+'/CURRENT');if(!Object.keys(entries).some(f=>f.startsWith(p.path+'/MANIFEST-'))||!Object.keys(entries).some(f=>f.startsWith(p.path+'/')&& /\/\d+\.(ldb|log)$/.test(f)&&entries[f].length>0))throw Error('Missing built LevelDB: '+p.path);}
  for(const [name,bytes]of Object.entries(entries)){
    const text=Buffer.from(bytes).toString('utf8');
    if(name.endsWith('.mjs'))for(const match of text.matchAll(/(?:from\s*|import\s*\(\s*)['"](\.\.?\/[^'"]+)['"]/g))exists(path.posix.normalize(path.posix.join(path.posix.dirname(name),match[1])));
    if(name.endsWith('.css'))for(const match of text.matchAll(/url\(["']?([^"')]+)["']?\)/g))if(!/^(https?:|data:)/.test(match[1]))exists(path.posix.normalize(path.posix.join(path.posix.dirname(name),match[1])));
  }
  for(const f of ['data/places.json','lang/uk-ui.json','assets/neverwinter.webp','assets/evernight.jpg','assets/underground-pending.svg'])exists(f);
}
export function verifyArchive(manifestBytes,zipBytes,{tag,repository,sha}={}){
  // Reject duplicate ZIP entries before unzipSync would collapse their names.
  const buffer=Buffer.from(zipBytes);let end=-1;
  for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50){end=i;break;}
  if(end<0)throw Error('Missing ZIP directory');
  const count=buffer.readUInt16LE(end+10);let offset=buffer.readUInt32LE(end+16);const names=new Set();
  for(let i=0;i<count;i++){
    if(buffer.readUInt32LE(offset)!==0x02014b50)throw Error('Invalid ZIP directory');
    const size=buffer.readUInt16LE(offset+28),name=buffer.subarray(offset+46,offset+46+size).toString();safeFile(name);
    if(names.has(name))throw Error('Duplicate ZIP entry');names.add(name);
    if((buffer.readUInt32LE(offset+38)>>>16 & 0xf000)===0xa000)throw Error('Symlink in ZIP');
    offset+=46+size+buffer.readUInt16LE(offset+30)+buffer.readUInt16LE(offset+32);
  }
  const entries=unzipSync(buffer);
  if(!entries['module.json']||!Buffer.from(entries['module.json']).equals(Buffer.from(manifestBytes)))throw Error('ZIP root manifest differs from standalone asset');
  const manifest=JSON.parse(Buffer.from(manifestBytes).toString());
  if(tag&&JSON.stringify(releaseManifest(manifest,tag,repository))!==JSON.stringify(manifest))throw Error('Release URLs/version do not match tag');
  const provenance=JSON.parse(Buffer.from(entries['release-provenance.json']??[]).toString());
  if(tag&&provenance.tag!==tag||sha&&provenance.sha!==sha)throw Error('Archive was built from a different tag commit');
  for(const [file,hash]of Object.entries(provenance.files??{}))if(!entries[file]||sha256(entries[file])!==hash)throw Error('Archive checksum mismatch: '+file);
  if(Object.keys(entries).some(f=>f!=='release-provenance.json'&&!provenance.files?.[f]))throw Error('Unrecorded archive entry');
  verifyRuntime(manifest,entries);return {manifest,provenance,entries};
}
export async function prepare({build,output,tag,repository,sha}){
  versionOf(tag);repositoryName(repository);if(!/^[0-9a-f]{40}$/.test(sha))throw Error('Expected exact tag commit SHA');
  const manifest=releaseManifest(JSON.parse(await fs.readFile(path.join(build,'module.json'),'utf8')),tag,repository),entries={};
  for(const file of await files(build))if(!['LOCK','LOG','LOG.old'].includes(path.posix.basename(file)))entries[file]=new Uint8Array(await fs.readFile(path.join(build,file)));
  const standalone=Buffer.from(JSON.stringify(manifest,null,2)+'\n');entries['module.json']=standalone;
  const hashes=Object.fromEntries(Object.keys(entries).sort().map(file=>[file,sha256(entries[file])]));
  entries['release-provenance.json']=Buffer.from(JSON.stringify({schema:1,tag,sha,files:hashes},null,2)+'\n');
  const zip=zipSync(Object.fromEntries(Object.entries(entries).map(([name,bytes])=>[name,[bytes,{mtime:new Date('1980-01-01T00:00:00Z')}]])),{level:6});
  await verifyPackData(verifyArchive(standalone,zip,{tag,repository,sha}));await fs.mkdir(output,{recursive:false});
  await fs.writeFile(path.join(output,'module.json'),standalone);await fs.writeFile(path.join(output,'module.zip'),zip);
  return {manifest,sha,files:Object.keys(entries).length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(await prepare({build:'build/release',output:'dist',tag:process.env.RELEASE_TAG,repository:process.env.GITHUB_REPOSITORY,sha:process.env.RELEASE_SHA}));
