import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {ClassicLevel} from 'classic-level';
import {zipSync,unzipSync} from 'fflate';
import YAML from 'yaml';
import {ROOT,build} from '../../tools/build.mjs';
import {journalOperations} from '../../tools/build-pack.mjs';
import {versionOf,resolveTag} from '../../tools/release/tag.mjs';
import {prepare,verifyArchive,releaseManifest,sha256} from '../../tools/release/prepare.mjs';
import {GitHub,publish,newer} from '../../tools/release/publish.mjs';
const tag='v1.2.3',sha='1'.repeat(40),repository='aperol-spritz/fr-maps';
let dir,output,manifestBytes,zipBytes;
before(async()=>{
  await fs.mkdir(path.join(ROOT,'build'),{recursive:true});dir=await fs.mkdtemp(path.join(ROOT,'build/release-test-'));output=path.join(dir,'module');
  await build(output);await prepare({build:output,output:path.join(dir,'assets'),tag,repository,sha});
  manifestBytes=await fs.readFile(path.join(dir,'assets/module.json'));zipBytes=await fs.readFile(path.join(dir,'assets/module.zip'));
});
after(async()=>{if(dir){assert.equal(path.dirname(path.resolve(dir)),path.resolve(ROOT,'build'));assert.ok(path.basename(dir).startsWith('release-test-'));await fs.rm(dir,{recursive:true,force:true});}});
test('stable tag validation rejects suffixes, leading zeros and shell/ref injection',()=>{
  assert.equal(versionOf(tag),'1.2.3');for(const bad of ['1.2.3','v01.2.3','v1.2.3-beta','v1.2.3+meta','v1.2.3\nx=y','--help','v1.2.3^{commit}'])assert.throws(()=>versionOf(bad));assert.equal(newer('v10.0.0','v9.99.99'),true);
});
test('resolve exact lightweight/annotated tag, not a same-named branch; reject nonexistent tag',async()=>{
  const cwd=path.join(dir,'git');await fs.mkdir(cwd);const git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git('init','-b','main');await fs.writeFile(path.join(cwd,'file'),'fixture');git('add','file');git('-c','user.name=Release Test','-c','user.email=test@example.invalid','commit','-m','fixture');const head=git('rev-parse','HEAD');
  git('tag','v1.2.3');git('-c','user.name=Release Test','-c','user.email=test@example.invalid','tag','-a','v1.2.4','-m','fixture');git('branch','v9.9.9');assert.equal(resolveTag(tag,cwd),head);assert.equal(resolveTag('v1.2.4',cwd),head);assert.throws(()=>resolveTag('v9.9.9',cwd));
});
test('real portable build preserves both journals and all source pages through round trip',async()=>{
  const source=JSON.parse(await fs.readFile(path.join(ROOT,'data/places.json')));const db=new ClassicLevel(path.join(output,'packs/city-v17'),{createIfMissing:false,valueEncoding:'json'});
  try{await db.open();const rows=await db.iterator().all();assert.equal(rows.filter(([k])=>k.startsWith('!journal!')).length,2);assert.equal(rows.filter(([k])=>k.startsWith('!journal.pages!')).length,source.length*2);const page=rows.find(([,v])=>v.flags?.['neverwinter-atlas']?.key==='twisted-fane')[1];assert.match(page.text.content,/1492/);assert.match(page.text.content,/forgottenrealms/);assert.deepEqual(new Map(rows),new Map(journalOperations(source).map(r=>[r.key,r.value])));}finally{await db.close();}
});
test('release manifest comes from tag, preserves source identity and exact compatibility; source untouched',async()=>{
  const source=JSON.parse(await fs.readFile(path.join(ROOT,'module.json'))),release=JSON.parse(manifestBytes);assert.equal(release.version,'1.2.3');assert.equal(release.id,'neverwinter-atlas');assert.equal(release.title,'Neverwinter: City Map');assert.deepEqual(release.compatibility,{minimum:'14',verified:'14.370'});assert.deepEqual(release.compatibility,source.compatibility);assert.equal(source.version,JSON.parse(await fs.readFile(path.join(ROOT,'package.json'))).version);assert.equal(release.manifest,'https://github.com/aperol-spritz/fr-maps/releases/latest/download/module.json');assert.equal(release.download,'https://github.com/aperol-spritz/fr-maps/releases/download/v1.2.3/module.zip');
});
test('ZIP has manifest at root, original assets, runtime imports, only fresh compendium, no local/audit data',async()=>{
  const {entries}=verifyArchive(manifestBytes,zipBytes,{tag,repository,sha});assert.equal(Buffer.compare(Buffer.from(entries['module.json']),manifestBytes),0);
  for(const name of ['atlas.mjs','backup.mjs','position.mjs','layers.mjs','atlas.css','lang/uk-ui.json','data/places.json','assets/evernight.jpg'])assert.ok(entries[name],name);
  assert.equal(sha256(entries['assets/evernight.jpg']),sha256(await fs.readFile(path.join(ROOT,'assets/evernight.jpg'))));
  const media=JSON.parse(await fs.readFile(path.join(ROOT,'data/pin-media-provenance.json'))).media;
  for(const item of media)assert.equal(sha256(entries[item.path.replace('modules/neverwinter-atlas/','')]),item.sha256,'Uploaded GIF bytes preserved in final release ZIP: '+item.id);
  assert.ok(Object.keys(entries).some(f=>f.startsWith('packs/city-v17/')&& /\/\d+\.(ldb|log)$/.test(f)));assert.equal(Object.keys(entries).some(f=>/^(audit|tests|node_modules|tools|\.git|build)\//.test(f)),false);
  assert.throws(()=>verifyArchive(Buffer.from('{}'),zipBytes),/manifest differs/);const missing=unzipSync(zipBytes);delete missing['layers.mjs'];assert.throws(()=>verifyArchive(manifestBytes,zipSync(missing)),/checksum|Missing/);assert.throws(()=>verifyArchive(manifestBytes,zipBytes,{tag,repository,sha:'2'.repeat(40)}),/different tag/);
});
test('workflow has validated existing-tag dispatch, exact SHA checkout, scoped write token and explicit job dependency',async()=>{
  const workflow=YAML.parse(await fs.readFile(path.join(ROOT,'.github/workflows/release.yml'),'utf8'));assert.deepEqual(workflow.permissions,{});assert.equal(workflow.on.workflow_dispatch.inputs.tag.required,true);assert.equal(workflow.concurrency['cancel-in-progress'],false);assert.match(workflow.concurrency.group,/inputs.tag.*github.ref_name/);assert.equal(workflow.jobs.build.permissions.contents,'read');assert.equal(workflow.jobs.publish.permissions.contents,'write');assert.equal(workflow.jobs.publish.needs,'build');
  const steps=workflow.jobs.build.steps;assert.equal(steps.filter(s=>s.uses?.startsWith('actions/checkout')).length,2);assert.match(steps.find(s=>s.id==='tag').run,/tag.mjs/);assert.ok(steps.some(s=>s.run==='npm test'));assert.ok(steps.some(s=>s.run==='npm run build'));assert.equal(steps.some(s=>s.env?.FOUNDRYVTT_RELEASE_TOKEN),false);assert.equal(workflow.jobs.publish.permissions.actions,undefined);const publishStep=workflow.jobs.publish.steps.find(s=>s.id==='publish');assert.match(publishStep.run,/--github-only$/);assert.equal(publishStep.env.FOUNDRYVTT_RELEASE_TOKEN,undefined);assert.equal(workflow.on.release,undefined,'Empty repository has no Publish Release entry point to preserve');
});
async function service(t,{release=null,immutable=true,latest=null,foundryStatus=200,receipt=null,moved=false}={}){
  const calls=[],assets=new Map(),warnings=[];let next=1,foundryCalls=0;
  if(release?.assets)for(const [name,bytes]of Object.entries(release.assets)){assets.set(next,{id:next++,name,bytes,state:'uploaded'});}
  let current=release?{id:1,tag_name:tag,body:'Maintainer notes — keep exactly',draft:false,prerelease:false,immutable,...release,assets:undefined}:null;
  const server=http.createServer(async(req,res)=>{try{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const bytes=Buffer.concat(chunks),url=new URL(req.url,'http://fixture');calls.push({method:req.method,path:url.pathname,body:bytes});
    const send=(status,value,binary=false)=>{res.writeHead(status,{'Content-Type':binary?'application/octet-stream':'application/json'});res.end(binary?value:JSON.stringify(value));};
    const base='/repos/'+repository,p=url.pathname.slice(base.length);
    if(url.pathname==='/foundry'){foundryCalls++;assert.equal(req.headers.authorization,'fixture-foundry-token');send(foundryStatus,{status:foundryStatus===200?'success':'error'});return;}
    if(url.pathname.startsWith('/public/')){const asset=[...assets.values()].find(a=>a.name===url.pathname.slice(8));send(asset?200:404,asset?.bytes??Buffer.alloc(0),true);return;}
    if(p==='/git/ref/tags/'+tag){send(200,{object:{type:'commit',sha:moved?'2'.repeat(40):sha}});return;}
    if(p==='/immutable-releases'){send(401,{});return;}
    if(p==='/releases/tags/'+tag){send(current?200:404,current??{});return;}
    if(p==='/releases/generate-notes'){send(200,{body:'Generated notes'});return;}
    if(p==='/releases'&&req.method==='POST'){current={id:1,...JSON.parse(bytes),immutable:false,upload_url:'https://uploads.github.test/repos/'+repository+'/releases/1/assets{?name,label}',html_url:'https://github.com/'+repository+'/releases/tag/'+tag};send(201,current);return;}
    if(p==='/releases/latest'){send(latest?200:404,latest??{});return;}
    if(p==='/releases/1'&&req.method==='PATCH'){Object.assign(current,JSON.parse(bytes),{immutable});send(200,current);return;}
    if(p==='/releases/1/assets'&&req.method==='GET'){send(200,[...assets.values()].map(({bytes,...a})=>a));return;}
    if(p==='/releases/1/assets'&&req.method==='POST'){assert.equal(current.immutable,false);assert.equal([...assets.values()].some(a=>a.name===url.searchParams.get('name')),false);const a={id:next++,name:url.searchParams.get('name'),bytes,state:'uploaded'};assets.set(a.id,a);send(201,{...a,bytes:undefined});return;}
    if(p.startsWith('/releases/assets/')){const a=assets.get(Number(p.split('/').at(-1)));send(a?200:404,a?.bytes??Buffer.alloc(0),true);return;}
    if(p==='/actions/artifacts'){send(200,{artifacts:receipt?[{id:9,name:`foundry-${tag}-${sha}`,expired:false,workflow_run:{id:8}}]:[]});return;}
    if(p==='/actions/runs/8'){send(200,{head_repository:{full_name:repository},path:'.github/workflows/release.yml',event:'workflow_dispatch',status:'completed'});return;}
    if(p==='/actions/artifacts/9/zip'){send(200,zipSync({'foundry-receipt.json':Buffer.from(JSON.stringify(receipt))}),true);return;}
    send(500,{error:'Unexpected mock request '+req.method+' '+req.url});
  }catch(error){res.writeHead(500);res.end(error.stack);}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  const api=new GitHub(repository,'fixture-github-token',{api:origin,fetchImpl:(url,opts)=>{assert.ok(url.startsWith(origin)||url.startsWith('https://uploads.github.test/'));return fetch(url.replace('https://uploads.github.test',origin),opts);}});
  const args={api,tag,sha,manifestBytes,zipBytes,warn:s=>warnings.push(s),token:'fixture-foundry-token',fetchPublic:url=>{assert.ok(url.startsWith(`https://github.com/${repository}/releases/download/${tag}/`));return fetch(origin+'/public/'+url.split('/').at(-1));},fetchFoundry:(url,opts)=>{assert.equal(url,'https://foundryvtt.com/_api/packages/release_version/');return fetch(origin+'/foundry',opts);},receiptWriter:async value=>{receipt=value;}};
  return {args,calls,assets,warnings,get current(){return current;},get foundryCalls(){return foundryCalls;}};
}
test('publish uploads both assets into draft BEFORE publishing, then sends exact official Foundry payload',async t=>{
  const mock=await service(t),result=await publish(mock.args);assert.equal(result.foundry,'published');assert.equal(mock.assets.size,2);const uploads=mock.calls.map((x,i)=>[x,i]).filter(([x])=>x.method==='POST'&&x.path.endsWith('/assets'));const publication=mock.calls.findIndex(x=>x.method==='PATCH');assert.ok(uploads.every(([,i])=>i<publication));
  const payload=JSON.parse(mock.calls.find(x=>x.path==='/foundry').body);assert.deepEqual(payload,{id:'neverwinter-atlas',release:{version:'1.2.3',manifest:'https://github.com/aperol-spritz/fr-maps/releases/download/v1.2.3/module.json',notes:'https://github.com/aperol-spritz/fr-maps/releases/tag/v1.2.3',compatibility:{minimum:'14',verified:'14.370'}}});
  const notes=mock.current.body;assert.equal((await publish(mock.args)).foundry,'already-published');assert.equal(mock.foundryCalls,1);assert.equal(mock.current.body,notes);assert.equal(mock.calls.filter(x=>x.method==='POST'&&x.path.endsWith('/assets')).length,2);
});
test('missing Foundry secret leaves GitHub release successful and emits a clear warning',async t=>{const mock=await service(t);const result=await publish({...mock.args,token:''});assert.equal(result.foundry,'missing-token');assert.equal(mock.current.draft,false);assert.equal(mock.foundryCalls,0);assert.ok(mock.warnings.some(x=>x.includes('FOUNDRYVTT_RELEASE_TOKEN')));});
test('complete immutable release is reused byte-for-byte and keeps maintainer notes',async t=>{const mock=await service(t,{release:{assets:{'module.json':manifestBytes,'module.zip':zipBytes}}});await publish({...mock.args,token:''});assert.equal(mock.current.body,'Maintainer notes — keep exactly');assert.equal(mock.calls.some(x=>x.method==='PATCH'||x.method==='DELETE'||x.method==='POST'&&x.path.endsWith('/assets')),false);});
test('published mutable release backfills only missing matching asset and retains notes',async t=>{const mock=await service(t,{release:{immutable:false,upload_url:'https://uploads.github.test/repos/'+repository+'/releases/1/assets{?name,label}',assets:{'module.json':manifestBytes}}});await publish({...mock.args,token:''});assert.equal(mock.assets.size,2);assert.equal(mock.current.body,'Maintainer notes — keep exactly');assert.equal(mock.calls.filter(x=>x.method==='POST'&&x.path.endsWith('/assets')).length,1);assert.equal(mock.calls.some(x=>x.method==='PATCH'||x.method==='DELETE'),false);});
test('mismatching existing manifest stops retry without asset replacement',async t=>{const mock=await service(t,{release:{immutable:false,assets:{'module.json':Buffer.from('{}')}}});await assert.rejects(publish(mock.args),/manifest differs/);assert.equal(mock.calls.some(x=>x.method!=='GET'),false);});
test('incomplete immutable release fails safely without replacing or uploading assets',async t=>{const mock=await service(t,{release:{assets:{'module.json':manifestBytes}}});await assert.rejects(publish(mock.args),/Immutable release is missing/);assert.equal(mock.calls.some(x=>x.method!=='GET'),false);});
test('recover partial workflow draft, preserve generated notes and finish only automation-owned draft',async t=>{const body=`Original notes\n<!-- neverwinter-atlas release automation ${tag} ${sha} -->`;const mock=await service(t,{release:{draft:true,immutable:false,body,upload_url:'https://uploads.github.test/repos/'+repository+'/releases/1/assets{?name,label}',assets:{'module.json':manifestBytes}}});assert.equal((await publish({...mock.args,token:''})).foundry,'missing-token');assert.equal(mock.current.body,body);assert.equal(mock.current.draft,false);});
test('human drafts and prereleases never submit to Foundry or get promoted automatically',async t=>{for(const flags of [{draft:true,immutable:false},{prerelease:true}]){const mock=await service(t,{release:{...flags,assets:{'module.json':manifestBytes,'module.zip':zipBytes}}});assert.equal((await publish(mock.args)).foundry,'ineligible');assert.equal(mock.foundryCalls,0);assert.equal(mock.calls.some(x=>x.method==='PATCH'),false);}});
test('moved tag and mismatching archive fail before remote mutations',async t=>{const mock=await service(t,{moved:true});await assert.rejects(publish(mock.args),/tag moved/);assert.equal(mock.calls.some(x=>x.method!=='GET'),false);await assert.rejects(publish({...mock.args,tag:'v1.2.3-beta'}),/stable/);});
test('Foundry HTTP failure retains completed GitHub assets and does not save a success receipt',async t=>{const mock=await service(t,{foundryStatus:400});await assert.rejects(publish(mock.args),/Foundry release submission failed/);assert.equal(mock.assets.size,2);assert.equal(mock.current.draft,false);assert.equal(mock.calls.some(x=>x.method==='DELETE'),false);});
test('backfilling an older stable release does not replace latest',async t=>{const mock=await service(t,{latest:{tag_name:'v2.0.0',draft:false,prerelease:false}});await publish({...mock.args,token:''});assert.equal(mock.current.make_latest,'false');});

test('GitHub-only mode ignores even a configured Foundry token and creates no receipt',async t=>{const mock=await service(t);let receiptWritten=false;const result=await publish({...mock.args,githubOnly:true,receiptWriter:async()=>{receiptWritten=true;}});assert.equal(result.foundry,'disabled');assert.equal(mock.current.draft,false);assert.equal(mock.assets.size,2);assert.equal(mock.foundryCalls,0);assert.equal(receiptWritten,false);assert.equal(mock.calls.some(x=>x.path.includes('/actions/artifacts')),false);assert.ok(mock.warnings.some(x=>x.includes('intentionally disabled')));});
