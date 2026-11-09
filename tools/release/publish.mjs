import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {unzipSync} from 'fflate';
import {versionOf,repositoryName} from './tag.mjs';
import {verifyArchive,sha256,releaseManifest} from './prepare.mjs';
import {verifyPackData} from '../pack-check.mjs';
export class GitHub {
  constructor(repository,token,{fetchImpl=fetch,api='https://api.github.com'}={}){this.repo=repositoryName(repository);this.token=token;this.fetch=fetchImpl;this.api=api;}
  async request(route,{method='GET',json,bytes,accept='application/vnd.github+json',optional404=false}={}){
    const url=route.startsWith('https://')?route:this.api+'/repos/'+this.repo+route;
    const response=await this.fetch(url,{method,headers:{Authorization:`Bearer ${this.token}`,Accept:accept,'X-GitHub-Api-Version':'2022-11-28',...(bytes?{'Content-Type':'application/octet-stream'}:json?{'Content-Type':'application/json'}:{})},body:bytes??(json?JSON.stringify(json):undefined)});
    if(response.status===404&&optional404)return null;
    if(!response.ok)throw Object.assign(Error(`GitHub ${method} ${route}: HTTP ${response.status}`),{status:response.status});
    return accept==='application/octet-stream'?Buffer.from(await response.arrayBuffer()):response.status===204?null:response.json();
  }
  async tagSHA(tag){let object=(await this.request('/git/ref/tags/'+tag)).object;for(let i=0;object.type==='tag'&&i<10;i++)object=(await this.request('/git/tags/'+object.sha)).object;if(object.type!=='commit')throw Error('Tag does not resolve to a commit');return object.sha;}
}
export function newer(a,b){const x=versionOf(a).split('.').map(BigInt),y=versionOf(b).split('.').map(BigInt);for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]>y[i];}return false;}
export function foundryPayload(manifest,tag,repository){
  const url='https://github.com/'+repositoryName(repository);if(manifest.version!==versionOf(tag))throw Error('Manifest version differs');
  return {id:manifest.id,release:{version:manifest.version,manifest:`${url}/releases/download/${tag}/module.json`,notes:`${url}/releases/tag/${tag}`,compatibility:structuredClone(manifest.compatibility)}};
}
async function priorReceipt(api,name,hash){
  const result=await api.request('/actions/artifacts?name='+name+'&per_page=100');
  for(const artifact of result.artifacts??[]){
    if(artifact.expired||artifact.name!==name)continue;
    const run=await api.request('/actions/runs/'+artifact.workflow_run.id);
    if(run.head_repository?.full_name!==api.repo||run.path!=='.github/workflows/release.yml'||!['push','workflow_dispatch'].includes(run.event)||run.status!=='completed')continue;
    const bytes=await api.request('/actions/artifacts/'+artifact.id+'/zip',{accept:'application/octet-stream'});
    try{const receipt=JSON.parse(Buffer.from(unzipSync(bytes)['foundry-receipt.json']).toString());if(receipt.requestHash===hash&&receipt.status==='success')return true;}catch{/* Invalid receipts do not authorize skipping a submission. */}
  }return false;
}
export async function publish({api,tag,sha,manifestBytes,zipBytes,token='',fetchPublic=fetch,fetchFoundry=fetch,warn=console.warn,receiptWriter=async()=>{},useReceipts=true,githubOnly=false}){
  versionOf(tag);if(!/^[a-f0-9]{40}$/.test(sha))throw Error('Invalid commit');
  await verifyPackData(verifyArchive(manifestBytes,zipBytes,{tag,repository:api.repo,sha}));
  if(await api.tagSHA(tag)!==sha)throw Error('Remote tag moved or differs from build commit');
  // No setting changes: an unavailable admin-only probe remains UNKNOWN.
  try{const setting=await api.request('/immutable-releases');console.log('Immutable releases enabled:',setting.enabled);}catch(error){if(![401,403,404].includes(error.status))throw error;warn('::warning::Immutable-release setting is not readable. Assets will never be overwritten.');}
  const marker=`<!-- neverwinter-atlas release automation ${tag} ${sha} -->`;
  let release=await api.request('/releases/tags/'+tag,{optional404:true});
  if(!release){
    const notes=await api.request('/releases/generate-notes',{method:'POST',json:{tag_name:tag,target_commitish:sha}});
    release=await api.request('/releases',{method:'POST',json:{tag_name:tag,target_commitish:sha,name:`Neverwinter: City Map ${versionOf(tag)}`,body:(notes.body??'')+'\n\n'+marker,draft:true,prerelease:false}});
  }
  const autoDraft=release.draft&&!release.prerelease&&release.body?.includes(marker);
  const assets=await api.request('/releases/'+release.id+'/assets?per_page=100');
  const expected={'module.json':Buffer.from(manifestBytes),'module.zip':Buffer.from(zipBytes)},existing={};
  for(const name of Object.keys(expected)){
    const matches=assets.filter(a=>a.name===name);if(matches.length>1)throw Error('Duplicate release asset: '+name);
    const asset=matches[0];if(asset){if(asset.state!=='uploaded')throw Error('Incomplete release asset: '+name);existing[name]=await api.request('/releases/assets/'+asset.id,{accept:'application/octet-stream'});}
  }
  // Reuse the original archive: LevelDB output bytes can vary across fresh builds.
  if(existing['module.zip']){
    const standalone=existing['module.json']??Buffer.from(unzipSync(existing['module.zip'])['module.json']??[]);
    const prior=verifyArchive(standalone,existing['module.zip'],{tag,repository:api.repo,sha});
    await verifyPackData(prior);
    if(!standalone.equals(expected['module.json']))throw Error('Existing manifest differs from this tag build');
    const fresh=verifyArchive(manifestBytes,zipBytes,{tag,repository:api.repo,sha});
    for(const [name,bytes]of Object.entries(fresh.entries))if(!name.startsWith('packs/')&&name!=='release-provenance.json'&&sha256(bytes)!==sha256(prior.entries[name]??[]))throw Error('Existing runtime differs: '+name);
    expected['module.zip']=existing['module.zip'];expected['module.json']=standalone;
  }else if(existing['module.json']&&!existing['module.json'].equals(expected['module.json']))throw Error('Existing standalone manifest differs');
  for(const [name,bytes]of Object.entries(expected))if(!existing[name]){
    if(release.immutable)throw Error(`Immutable release is missing ${name}. Use a new version; existing assets cannot be repaired.`);
    await api.request(release.upload_url.replace(/\{.*$/,'')+'?name='+name,{method:'POST',bytes});
  }
  // Confirm server-side bytes before publishing a new draft.
  const ready=await api.request('/releases/'+release.id+'/assets?per_page=100'),downloaded={};
  for(const name of Object.keys(expected)){const asset=ready.find(a=>a.name===name&&a.state==='uploaded');if(!asset)throw Error('Asset not ready: '+name);downloaded[name]=await api.request('/releases/assets/'+asset.id,{accept:'application/octet-stream'});if(!downloaded[name].equals(expected[name]))throw Error('Uploaded bytes differ: '+name);}
  verifyArchive(downloaded['module.json'],downloaded['module.zip'],{tag,repository:api.repo,sha});
  if(autoDraft){
    const latest=await api.request('/releases/latest',{optional404:true});let makeLatest='true';
    if(latest&&!latest.draft&&!latest.prerelease){try{if(newer(latest.tag_name,tag))makeLatest='false';}catch{makeLatest='false';}}
    if(await api.tagSHA(tag)!==sha)throw Error('Tag moved before publication');
    release=await api.request('/releases/'+release.id,{method:'PATCH',json:{draft:false,make_latest:makeLatest}});
  }
  if(release.draft||release.prerelease){warn('::notice::Foundry publication skipped: release is a draft or prerelease.');return {release,foundry:'ineligible'};}
  // Check public URLs without authentication; these are the URLs Foundry consumes.
  const base=`https://github.com/${api.repo}/releases/download/${tag}/`,publicAssets={};
  for(const name of Object.keys(expected)){const response=await fetchPublic(base+name);if(!response.ok)throw Error('Release asset is not publicly available: '+name);publicAssets[name]=Buffer.from(await response.arrayBuffer());if(!publicAssets[name].equals(expected[name]))throw Error('Public release asset differs: '+name);}
  const manifest=JSON.parse(publicAssets['module.json']);
  if(JSON.stringify(releaseManifest(manifest,tag,api.repo))!==JSON.stringify(manifest))throw Error('Public release manifest is invalid');
  if(githubOnly){warn('::notice::Foundry publication is intentionally disabled; GitHub release assets are ready.');return {release,foundry:'disabled'};}
  if(!token){warn('::warning::Foundry publishing skipped. Add repository secret FOUNDRYVTT_RELEASE_TOKEN to enable it.');return {release,foundry:'missing-token'};}
  const payload=foundryPayload(manifest,tag,api.repo),requestHash=sha256(JSON.stringify(payload)),receiptName=`foundry-${tag}-${sha}`;
  if(useReceipts&&await priorReceipt(api,receiptName,requestHash))return {release,foundry:'already-published'};
  const response=await fetchFoundry('https://foundryvtt.com/_api/packages/release_version/',{method:'POST',headers:{'Content-Type':'application/json',Authorization:token},body:JSON.stringify(payload)});
  if(!response.ok)throw Error(`Foundry release submission failed: HTTP ${response.status}. GitHub assets were retained. Check the package/token and retry; no success is assumed for duplicate or ambiguous responses.`);
  const body=await response.json();if(body.status!=='success')throw Error('Foundry did not confirm success');
  await receiptWriter({status:'success',requestHash,tag,sha,package:manifest.id,version:manifest.version});
  return {release,foundry:'published',receiptName};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.env.GITHUB_ACTIONS!=='true'||!['push','workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME))throw Error('Publication CLI is restricted to the release workflow. Local tests use a mock server.');
  const result=await publish({api:new GitHub(process.env.GITHUB_REPOSITORY,process.env.GITHUB_TOKEN),tag:process.env.RELEASE_TAG,sha:process.env.RELEASE_SHA,manifestBytes:await fs.readFile('dist/module.json'),zipBytes:await fs.readFile('dist/module.zip'),token:process.env.FOUNDRYVTT_RELEASE_TOKEN,githubOnly:process.argv.includes('--github-only'),receiptWriter:receipt=>fs.writeFile('dist/foundry-receipt.json',JSON.stringify(receipt,null,2)+'\n')});
  if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,`foundry_published=${result.foundry==='published'}\nreceipt_name=${result.receiptName??''}\n`);
  console.log(`GitHub release: ${result.release.html_url}; Foundry: ${result.foundry}`);
}
