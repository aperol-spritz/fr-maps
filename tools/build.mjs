import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildPack} from './build-pack.mjs';
export const ROOT=fileURLToPath(new URL('../',import.meta.url));
export async function files(directory){
  const result=[];
  async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);if(entry.isSymbolicLink())throw Error('Symlink in package inputs: '+file);
    if(entry.isDirectory())await walk(file);else if(entry.isFile())result.push(path.relative(directory,file).split(path.sep).join('/'));
  }}
  await walk(directory);return result.sort();
}
export async function build(output=path.join(ROOT,'build/release')){
  if(Number(process.versions.node.split('.')[0])!==24)throw Error('Use Node 24.x');
  output=path.resolve(output);
  // Never rebuild installed packs or recursively clear an existing directory.
  if(output===path.resolve(ROOT) || !output.startsWith(path.resolve(ROOT,'build')+path.sep))throw Error('Build output must be a NEW directory inside build/');
  await fs.mkdir(output,{recursive:false}).catch(async error=>{if(error.code!=='ENOENT')throw error;await fs.mkdir(path.dirname(output),{recursive:true});await fs.mkdir(output);});
  const manifest=JSON.parse(await fs.readFile(path.join(ROOT,'module.json'),'utf8'));
  const runtime=(await fs.readdir(ROOT)).filter(f=>f.endsWith('.mjs')).concat(['module.json','atlas.css','data/places.json','README.md','ASSET_NOTES.md','docs/journals.md']);
  for(const tree of ['assets','lang'])for(const file of await files(path.join(ROOT,tree)))runtime.push(tree+'/'+file);
  for(const file of runtime){await fs.mkdir(path.dirname(path.join(output,file)),{recursive:true});await fs.copyFile(path.join(ROOT,file),path.join(output,file));}
  for(const pack of manifest.packs){if(pack.name!=='city'||!/^packs\/city[-\w]*$/.test(pack.path))throw Error('Review the new compendium before packaging');await buildPack(path.join(output,pack.path),JSON.parse(await fs.readFile(path.join(ROOT,'data/places.json'),'utf8')));}
  return output;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(await build(process.argv[2]));
