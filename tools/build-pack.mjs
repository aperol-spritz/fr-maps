import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {defaultMaps} from '../defaults.mjs';

// Pure rows are shared by the portable builder and the legacy CLI.
export function journalOperations(places) {
const stableId = key => createHash('sha256').update(key).digest('hex').slice(0,16);
const escape = s => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const keys=new Set(places.map(place=>place.id));
if(keys.size!==places.length) throw Error('Duplicate place IDs');
for(const place of places) {
  if(!['landmark','temple','water','inn','district','shop','service'].includes(place.category)) throw Error('Unknown category: '+place.id);
  if(!Number.isFinite(place.x)||!Number.isFinite(place.y)||place.x<0||place.x>100||place.y<0||place.y>100) throw Error('Invalid coordinates: '+place.id);
  for(const related of place.related ?? []) if(!keys.has(related)) throw Error('Missing related place: '+related);
  if(!['historical','dated','uncertain'].includes(place.period?.status) || !place.period.ru || !place.period.uk) throw Error('Invalid period: '+place.id);
  if(place.district && places.find(other=>other.id===place.district)?.category!=='district') throw Error('Invalid district: '+place.id);
  for(const source of place.sources ?? []) {
    if(new URL(source.url).protocol!=='https:' || !source.label) throw Error('Invalid source: '+place.id);
  }
  for(const language of ['ru','uk']) if(!place[language]?.lore || !place[language]?.name || !place.en || !place.article) throw Error('Incomplete place: '+place.id);
}
const operations = [];
for (const language of ['ru','uk']) {
  const journalId = stableId(language);
  const journal = {_id:journalId,name:language==='ru'?'Невервинтер · 1492 ЛД':'Невервінтер · 1492 ЛД',pages:[],flags:{'neverwinter-atlas':{language,mapDefaults:Object.entries(defaultMaps).map(([map,defaults])=>({map,...structuredClone(defaults)}))}}};
  for (const place of places) {
    const local = place[language];
    const id = stableId(language + '/' + place.id);
    const source = 'https://forgottenrealms.fandom.com/wiki/' + place.article;
    const destinations=new Set([...(place.related ?? []),...(place.district ? [place.district] : []),...places.filter(other=>other.district===place.id).map(other=>other.id)]);
    const related=[...destinations].map(key=>{
      const other=places.find(place=>place.id===key);
      return '@UUID[Compendium.neverwinter-atlas.city.JournalEntry.'+journalId+'.JournalEntryPage.'+stableId(language+'/'+key)+']{'+escape(other[language].name)+(other.omitEnglish?'':' ('+escape(other.en)+')')+'}';
    }).join(' · ');
    const prose=[local.lore,local.description].filter(Boolean).map(text=>'<p>'+escape(text)+'</p>').join('');
    const links=related ? '<p><strong>'+(language==='ru'?'Связанные локации:':'Пов’язані локації:')+'</strong> '+related+'</p>' : '';
    const sourceLabel=language==='ru'?'Источники:':'Джерела:';
    const sources=[{url:source,label:'Forgotten Realms Wiki'},...(place.sources ?? [])];
    const citations=sources.map(item=>'<a href="'+escape(item.url)+'" target="_blank" rel="noopener noreferrer">'+escape(item.label)+'</a>').join(' · ');
    // Inline relative sizing also survives export/import into a world journal.
    const notes='<footer class="nw-journal-notes" style="font-size:0.8em;line-height:1.4;border-top:1px solid currentColor;margin-top:1.5em;padding-top:0.6em">'+links+'<p><strong>'+sourceLabel+'</strong> '+citations+'</p></footer>';
    const media=place.asset ? '<figure><img src="'+escape(place.asset)+'" alt="'+escape(local.name)+'"></figure>' : '';
    const page = {_id:id,name:local.name+(place.omitEnglish?'':' ('+place.en+')'),type:'text',sort:journal.pages.length*1000,
      flags:{'neverwinter-atlas':{key:place.id,location:structuredClone(place)}},text:{format:1,content:media+prose+notes}};
    journal.pages.push(id);
    operations.push({type:'put',key:'!journal.pages!'+journalId+'.'+id,value:page});
  }
  operations.push({type:'put',key:'!journal!'+journalId,value:journal});
}
return operations;
}
export async function buildPack(output,places){
  const require=createRequire(import.meta.url);
  let ClassicLevel;
  try {({ClassicLevel}=require('classic-level'));}
  catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;const app=process.env.GEM_FOUNDRY_APP ?? 'F:/FoundryVTT/Foundry Virtual Tabletop/resources/app';({ClassicLevel}=require(path.join(app,'node_modules/classic-level')));}
await fs.mkdir(path.dirname(path.resolve(output)),{recursive:true});
await fs.mkdir(output);
const db = new ClassicLevel(output,{valueEncoding:'json'});
try {
  await db.open();
  await db.batch(journalOperations(places));
} finally {await db.close();}

}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error('Supply a NEW output directory');
  await buildPack(process.argv[2],JSON.parse(await fs.readFile(new URL('../data/places.json',import.meta.url))));
}
