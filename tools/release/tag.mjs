import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function versionOf(tag){if(typeof tag!=='string'||!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag))throw Error('Expected stable vMAJOR.MINOR.PATCH, without leading zeros or suffixes');return tag.slice(1);}
export function resolveTag(tag,cwd=process.cwd()){
  versionOf(tag);
  return execFileSync('git',['rev-parse','--verify',`refs/tags/${tag}^{commit}`],{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
}
export function repositoryName(value){if(typeof value!=='string'||! /^[\w.-]+\/[\w.-]+$/.test(value)||value.split('/').some(p=>p==='.'||p==='..'))throw Error('Expected OWNER/REPO');return value;}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const tag=process.env.RELEASE_TAG ?? process.argv[2],sha=resolveTag(tag);
  if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`tag=${tag}\nsha=${sha}\n`);
  console.log(`${tag} -> ${sha}`);
}
