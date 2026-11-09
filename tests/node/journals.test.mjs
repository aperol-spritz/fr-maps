import {test} from 'node:test';
import assert from 'node:assert/strict';
import {auditJournals} from '../../tools/journal-audit.mjs';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {journalOperations} from '../../tools/build-pack.mjs';
const manifest={id:'neverwinter-atlas'};
function fixture(content='',type='text',src='') {
  return {city:[['!journal!abcdefghijklmnop',{_id:'abcdefghijklmnop',name:'Journal',pages:['qrstuvwxyzABCDEF']}],['!journal.pages!abcdefghijklmnop.qrstuvwxyzABCDEF',{_id:'qrstuvwxyzABCDEF',name:'Page',type,src,text:{content}}]]};
}
const base='modules/neverwinter-atlas/assets/journals/';
test('audits image, audio, video, PDF pages and inline HTML, srcset, CSS media with exact casing',()=>{
  const assets={'assets/journals/Picture.webp':Buffer.from('fixture')};
  for(const type of ['image','audio','video','pdf'])assert.equal(auditJournals(manifest,fixture('',type,base+'Picture.webp'),assets).media.length,1);
  const html=`<img src="${base}Picture.webp"><video poster='${base}Picture.webp'><source src=${base}Picture.webp></video><object data="${base}Picture.webp"></object><img srcset="${base}Picture.webp 1x, ${base}Picture.webp 2x"><p style="background:url('${base}Picture.webp')"><a href="${base}Picture.webp">image</a>`;
  assert.equal(auditJournals(manifest,fixture(html),assets).media.length,8);
  assert.throws(()=>auditJournals(manifest,fixture('', 'image',base+'picture.webp'),assets),/case mismatch/);
  for(const src of ['worlds/campaign/image.webp','https://example.invalid/x.mp4',base+'../secret.pdf',base+'missing.pdf'])assert.throws(()=>auditJournals(manifest,fixture('','pdf',src),assets),/Journal audit/);
});
test('resolves journal and page UUIDs, reports citation links, rejects broken and external document links',()=>{
  const uuid='Compendium.neverwinter-atlas.city.JournalEntry.abcdefghijklmnop';
  const audit=auditJournals(manifest,fixture(`@UUID[${uuid}]{Journal} @UUID[${uuid}.JournalEntryPage.qrstuvwxyzABCDEF#heading]{Page}<a href="https://example.invalid/wiki">Source</a>`),{});
  assert.equal(audit.internalLinks,2);assert.deepEqual(audit.externalLinks,['https://example.invalid/wiki']);
  for(const link of [uuid+'.JournalEntryPage.missing','JournalEntry.abcdefghijklmnop','Compendium.other.pack.Item.abcdefghijklmnop'])assert.throws(()=>auditJournals(manifest,fixture('@UUID['+link+']'),{}),/Unresolved|dependencies/);
  assert.throws(()=>auditJournals(manifest,fixture('@JournalEntry[abcdefghijklmnop]'),{}),/Legacy/);
});
test('rejects missing, duplicate and orphan pages in the compiled pack',()=>{
  const missing=fixture();missing.city[0][1].pages.push('missing');assert.throws(()=>auditJournals(manifest,missing,{}),/Missing/);
  const duplicate=fixture();duplicate.city[0][1].pages.push('qrstuvwxyzABCDEF');assert.throws(()=>auditJournals(manifest,duplicate,{}),/Duplicate/);
  const orphan=fixture();orphan.city[0][1].pages=[];assert.throws(()=>auditJournals(manifest,orphan,{}),/Orphan/);
});
test('a territory label background color in packaged metadata is not a media path',()=>{
  const data=fixture();data.city[1][1].flags={location:{regionLabel:{background:'#fff1d1'}}};assert.equal(auditJournals(manifest,data,{}).media.length,0);
  data.city[1][1].flags.location.regionLabel.background='worlds/campaign/missing.webp';assert.throws(()=>auditJournals(manifest,data,{}),/Media outside/);
});
test('all six uploaded pin GIFs retain bytes and appear in both journal languages with portable paths',async()=>{
  const places=JSON.parse(await fs.readFile(new URL('../../data/places.json',import.meta.url)));
  const provenance=JSON.parse(await fs.readFile(new URL('../../data/pin-media-provenance.json',import.meta.url)));
  assert.equal(provenance.media.length,6);const entries={};
  for(const media of provenance.media){
    const file=media.path.replace('modules/neverwinter-atlas/',''),bytes=await fs.readFile(new URL('../../'+file,import.meta.url));entries[file]=bytes;
    assert.equal(bytes.length,media.bytes);assert.match(bytes.subarray(0,6).toString(),/^GIF8[79]a$/);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),media.sha256);
    assert.equal(places.find(p=>p.id===media.id).asset,media.path);
  }
  const rows=journalOperations(places).map(r=>[r.key,r.value]),audit=auditJournals(manifest,{city:rows},entries);
  assert.equal(audit.media.length,12);assert.equal(new Set(audit.media.map(m=>m.path)).size,6);
  assert.equal(JSON.stringify(rows).includes('worlds/koban/'),false);
});
