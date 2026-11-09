import {ID,copy,mapState,updateMap,strokes,updateStrokes,strokeKey} from './state.mjs';
import {tr} from './i18n.mjs';
import {formDialog,escape} from './access.mjs';
const categories=['landmark','temple','water','inn','district','shop','service'];
const fail=message=>{throw Error('Резервная копия: '+message);};
const object=v=>v && typeof v==='object' && !Array.isArray(v);
const id=v=>typeof v==='string' && /^[a-zA-Z0-9_-]{1,96}$/.test(v) && !['__proto__','constructor','prototype'].includes(v);
const text=(v,max=20000)=>{if(typeof v!=='string' || v.length>max)fail('неверное текстовое поле');return v;};
const number=(v,min,max)=>{if(!Number.isFinite(v)||v<min||v>max)fail('число вне допустимого диапазона');return v;};
const color=v=>{if(typeof v!=='string'||!/^#[\da-f]{6}$/i.test(v))fail('неверный цвет');return v;};
const asset=v=>{text(v,1024);if(v && (!/^(modules|worlds|assets|icons)\//.test(v)||v.includes('..')||v.includes('\\')||/[<>\x00-\x1f]/.test(v)))fail('неверный путь к ресурсу');return v;};
function readableImage(path){return new Promise(resolve=>{const image=new Image(),timer=setTimeout(()=>finish(false),5000);function finish(ok){clearTimeout(timer);image.onload=image.onerror=null;image.removeAttribute('src');resolve(ok);}image.onload=()=>finish(image.naturalWidth>0);image.onerror=()=>finish(false);image.src=foundry.utils.getRoute(path);});}
function ownership(v) {
  if(!object(v))fail('неверные права');const result={};
  for(const [key,value]of Object.entries(v)){if(!id(key)||![0,2,3].includes(value))fail('неверные права');result[key]=value;}
  return result;
}
function points(v,max=5000){if(!Array.isArray(v)||v.length>max)fail('неверные вершины');return v.map(p=>{if(!Array.isArray(p)||p.length!==2)fail('неверная вершина');return p.map(n=>number(n,0,100));});}
function shape(v){if(v==null)return v;if(!object(v))fail('неверный контур');const p=points(v.points);if(p.length<3)fail('контур короче трёх вершин');return {points:p,color:color(v.color ?? '#658d64'),opacity:number(v.opacity ?? .15,0,.6),hidden:Boolean(v.hidden)};}
function local(v){if(!object(v))fail('нет текста RU/UA');return {name:text(v.name,160),lore:text(v.lore ?? '')};}
function point(v,key,map) {
  if(!object(v)||!id(key)||!categories.includes(v.category))fail('неверная локация');
  const result={id:key,map,x:number(v.x,0,100),y:number(v.y,0,100),en:text(v.en ?? '',160),category:v.category,
    ru:local(v.ru),uk:local(v.uk),ownership:ownership(v.ownership ?? {default:0}),custom:Boolean(v.custom),area:Boolean(v.area),territoryOnly:Boolean(v.territoryOnly),keepMarker:Boolean(v.keepMarker),omitEnglish:Boolean(v.omitEnglish)};
  if(v.area && !key.startsWith('area-'))fail('неверный идентификатор территории');
  if(v.shape!==undefined)result.shape=shape(v.shape);
  if(v.regionOrder!==undefined){result.regionOrder=number(v.regionOrder,-100,100);if(!Number.isInteger(result.regionOrder))fail('порядок должен быть целым числом');}
  if(v.regionLabel!==undefined){const l=v.regionLabel;if(!object(l)||!['all','gm'].includes(l.audience))fail('неверные настройки подписи');result.regionLabel={enabled:Boolean(l.enabled),audience:l.audience,size:number(l.size,10,36)};for(const field of ['x','y'])if(l[field]!==undefined)result.regionLabel[field]=number(l[field],0,100);for(const field of ['color','background','border'])if(l[field]!==undefined)result.regionLabel[field]=color(l[field]);if(l.backgroundOpacity!==undefined)result.regionLabel.backgroundOpacity=number(l.backgroundOpacity,0,1);}
  if(v.color!=null)result.color=color(v.color);
  if(v.size!=null)result.size=number(v.size,20,96);
  if(v.asset)result.asset=asset(v.asset);
  for(const field of ['district'])if(v[field]){if(!id(v[field]))fail('неверная ссылка');result[field]=v[field];}
  for(const field of ['related','aliases'])if(v[field]){if(!Array.isArray(v[field])||v[field].length>200)fail('неверный список');result[field]=v[field].map(s=>text(s,200));if(field==='related' && result[field].some(s=>!id(s)))fail('неверная связь');}
  if(v.period){if(!['dated','historical','uncertain'].includes(v.period.status))fail('неверный период');result.period={status:v.period.status,ru:text(v.period.ru,1000),uk:text(v.period.uk,1000)};}
  if(v.position){if(!['confirmed','overview','unverified'].includes(v.position.status))fail('неверная точность расположения');result.position={status:v.position.status,ru:text(v.position.ru,1000),uk:text(v.position.uk,1000)};if(v.position.source){const source=text(v.position.source,1024);if(new URL(source).protocol!=='https:')fail('неверный источник привязки');result.position.source=source;}}
  return result;
}
function description(journal) {
  const page=journal.pages.contents[0];
  if(page && page.type!=='text')fail('основная страница точки «'+journal.name+'» должна быть текстовой');
  const parsed=new DOMParser().parseFromString(page?.text?.content ?? '','text/html');
  parsed.querySelectorAll('br').forEach(br=>br.replaceWith('\n'));return parsed.body.textContent;
}
const ownJournals=map=>game.journal.filter(j=>j.getFlag(ID,'point')?.map===map);
export function snapshot(map) {
  if(!game.user.isGM)fail('требуются права ведущего');
  const journals=ownJournals(map),settings=copy(mapState(map));delete settings.publicDrawings;delete settings.requestAcks;
  for(const key of Object.keys(settings.points))if(key.startsWith('custom-')&&!journals.some(j=>'custom-'+j.id===key))delete settings.points[key];
  return {format:ID,version:1,sourceWorld:game.world.id,sourceWorldName:game.world.title ?? game.world.id,sourceUser:game.user.id,map,created:new Date().toISOString(),
    settings,customPoints:journals.map(j=>({sourceId:j.id,...copy(j.getFlag(ID,'point')),description:description(j)})),drawings:copy(strokes(map))};
}
export function validateBackup(data,map) {
  if(!object(data)||data.format!==ID||data.version!==1)fail('неподдерживаемый формат или версия');
  if(data.map!==map)fail('копия относится к другой подложке');
  if(!id(data.sourceWorld)||!id(data.sourceUser))fail('неверный источник');
  if(!object(data.settings)||!object(data.settings.points)||Object.keys(data.settings.points).length>2000)fail('слишком много локаций');
  const settings={color:color(data.settings.color),size:number(data.settings.size,20,96),ownership:ownership(data.settings.ownership),points:{}};
  if(data.settings.allowCharacters!==undefined)settings.allowCharacters=Boolean(data.settings.allowCharacters);
  if(data.settings.characters!==undefined){if(!object(data.settings.characters)||Object.keys(data.settings.characters).length>200)fail('неверные персонажи');settings.characters={};for(const [actorId,p]of Object.entries(data.settings.characters)){if(!/^[a-zA-Z0-9]{16}$/.test(actorId)||!object(p)||p.actorId!==actorId)fail('неверный персонаж');settings.characters[actorId]={actorId,x:number(p.x,0,100),y:number(p.y,0,100)};}}
  for(const [key,value]of Object.entries(data.settings.points))settings.points[key]=point(value,key,map);
  if(data.settings.calibration){const c=data.settings.calibration,anchors=points([c.a,c.b]);if(Math.hypot(anchors[0][0]-anchors[1][0],anchors[0][1]-anchors[1][1])<.01)fail('слишком близкие отметки масштаба');settings.calibration={a:anchors[0],b:anchors[1],feet:number(c.feet,1,10000000)};}
  if(!Array.isArray(data.customPoints)||data.customPoints.length>1000||!Array.isArray(data.drawings)||data.drawings.length>2000)fail('слишком много объектов');
  const seen=new Set();
  const customPoints=data.customPoints.map(p=>{
    if(!object(p)||!/^[a-zA-Z0-9]{16}$/.test(p.sourceId)||seen.has(p.sourceId)||!categories.includes(p.category))fail('неверная собственная точка');seen.add(p.sourceId);
    if(p.district && !id(p.district))fail('неверный район');
    return {sourceId:p.sourceId,map,name:text(p.name,160),en:text(p.en ?? '',160),category:p.category,district:p.district || null,x:number(p.x,0,100),y:number(p.y,0,100),description:text(p.description)};
  });
  const strokeIds=new Set();
  const drawings=data.drawings.map(s=>{
    if(!object(s)||!id(s.id)||strokeIds.has(s.id))fail('неверный рисунок');strokeIds.add(s.id);
    const vertices=points(s.points,1500);if(vertices.length<2)fail('слишком короткий рисунок');
    return {id:s.id,points:vertices,color:color(s.color),width:number(s.width,1,12),name:text(s.name ?? '',160),group:text(s.group ?? '',80),label:text(s.label ?? '',200),origin:s.origin?text(s.origin,240):undefined};
  });
  for(const key of Object.keys(settings.points))if(key.startsWith('custom-')&&!seen.has(key.slice(7)))fail('нет описания собственной точки');
  return {format:ID,version:1,map,sourceWorld:data.sourceWorld,sourceWorldName:text(data.sourceWorldName ?? data.sourceWorld,200),sourceUser:data.sourceUser,settings,customPoints,drawings};
}
function matchJournal(data,entry,map) {
  const key=data.sourceWorld+':'+entry.sourceId;
  return ownJournals(map).find(j=>j.getFlag(ID,'restoreSource')===key || (data.sourceWorld===game.world.id && j.id===entry.sourceId));
}
export async function restoreBackup(data,map,restoreAccess=false) {
  if(!game.user.isGM)fail('требуются права ведущего');
  data=validateBackup(data,map);
  if(restoreAccess && data.sourceWorld!==game.world.id)fail('права можно вернуть только в исходный мир');
  const beforeMap=copy(mapState(map)),beforeDrawings=copy(strokes(map));
  const created=[],changed=[],mapping=new Map(),restoredJournals=[];
  try {
    for(const entry of data.customPoints) {
      let journal=matchJournal(data,entry,map);
      const {description:body,sourceId,...metadata}=entry;
      const content='<p>'+escape(body).replaceAll('\n','<br>')+'</p>';
      const title=metadata.name+(metadata.en?' ('+metadata.en+')':'');
      if(journal) {
        const page=journal.pages.contents[0];changed.push({journal,point:copy(journal.getFlag(ID,'point')),name:journal.name,page:page?.toObject(),pageIds:journal.pages.map(p=>p.id)});
        await journal.update({name:title,flags:{[ID]:{point:metadata}}});
        if(page)await page.update({text:{format:1,content}});else await journal.createEmbeddedDocuments('JournalEntryPage',[{name:title,type:'text',text:{format:1,content}}]);
      } else {
        journal=await JournalEntry.create({name:title,ownership:{default:0},flags:{[ID]:{point:metadata,restoreSource:data.sourceWorld+':'+sourceId}},pages:[{name:title,type:'text',text:{format:1,content}}]});created.push(journal);
      }
      mapping.set('custom-'+sourceId,'custom-'+journal.id);
      restoredJournals.push(journal);
    }
    for(const journal of restoredJournals) {
      const metadata=copy(journal.getFlag(ID,'point'));
      if(mapping.has(metadata.district)){metadata.district=mapping.get(metadata.district);await journal.update({flags:{[ID]:{point:metadata}}});}
    }
    await updateMap(map,current=>{
      current.color=data.settings.color;current.size=data.settings.size;
      if(data.settings.calibration)current.calibration=copy(data.settings.calibration);
      else delete current.calibration;
      if(restoreAccess)current.ownership=copy(data.settings.ownership);
      if(restoreAccess && data.settings.allowCharacters!==undefined)current.allowCharacters=data.settings.allowCharacters;
      if(data.sourceWorld===game.world.id && data.settings.characters){current.characters ??= {};Object.assign(current.characters,copy(data.settings.characters));}
      for(const [original,record]of Object.entries(data.settings.points)) {
        const key=mapping.get(original) ?? original;
        const restored=copy(record);restored.id=key;
        restored.ownership=restoreAccess?copy(record.ownership):copy(current.points[key]?.ownership ?? {default:0});
        if(restored.district)restored.district=mapping.get(restored.district) ?? restored.district;
        if(restored.related)restored.related=restored.related.map(id=>mapping.get(id) ?? id);
        current.points[key]=restored;
      }
    });
    const restoredIds=[];
    await updateStrokes(map,list=>{
      for(const stroke of data.drawings) {
        const origin=stroke.origin || data.sourceWorld+':'+data.sourceUser+':'+stroke.id;
        const existing=list.find(s=>s.origin===origin || (data.sourceWorld===game.world.id && data.sourceUser===game.user.id && s.id===stroke.id));
        const restored={...copy(stroke),origin,id:existing?.id ?? foundry.utils.randomID()};restoredIds.push(restored.id);
        if(existing)Object.assign(existing,restored);else list.push(restored);
      }
    });
    await updateMap(map,current=>{for(const id of restoredIds)delete current.publicDrawings?.[strokeKey(id)];});
    return {points:data.customPoints.length,territories:Object.values(data.settings.points).filter(p=>p.area).length,drawings:data.drawings.length};
  } catch(error) {
    try {
      for(const entry of changed) {
        await entry.journal.update({name:entry.name,flags:{[ID]:{point:entry.point}}});
        const extra=entry.journal.pages.filter(p=>!entry.pageIds.includes(p.id)).map(p=>p.id);if(extra.length)await entry.journal.deleteEmbeddedDocuments('JournalEntryPage',extra);
        if(entry.page)await entry.journal.pages.get(entry.page._id).update(entry.page);
      }
      if(created.length)await JournalEntry.deleteDocuments(created.map(j=>j.id));
      await updateStrokes(map,list=>list.splice(0,list.length,...beforeDrawings));
      await updateMap(map,current=>{for(const key of Object.keys(current))delete current[key];Object.assign(current,beforeMap);});
    }catch(rollback){error.message+='; не удалось полностью отменить восстановление: '+rollback.message;}
    throw error;
  }
}
export function openBackup(map) {
  let reviewed,reviewSerial=0;
  const ui=formDialog('Резервная копия карты','<button type="button" data-export-backup>Скачать резервную копию</button><small>Файл содержит личные заметки и рисунки текущего ведущего. Изображения и другие файлы ресурсов в него не входят. Восстановление добавляет и обновляет данные; отсутствующие в копии объекты сохраняются.</small><label>Файл JSON для восстановления<input name="backupFile" type="file" accept=".json,application/json"></label><p data-backup-preview>Выберите файл для предварительного просмотра.</p><label class="nw-check"><input name="restoreAccess" type="checkbox" disabled>Восстановить права доступа из копии (только этот мир)</label><small>Без флажка текущие права сохраняются, новые объекты закрыты. Восстановленные рисунки становятся личными; для показа игрокам опубликуйте их снова. Сохраняется основное описание собственной точки; дополнительные страницы журнала не входят в копию.</small>',async form=>{
    if(!reviewed)throw Error('Сначала выберите и проверьте файл');
    const result=await restoreBackup(reviewed,map,form.elements.restoreAccess.checked);
    globalThis.ui.notifications.info(tr('Восстановлено: точки '+result.points+', территории '+result.territories+', рисунки '+result.drawings));
  });
  const previousPreview=ui.form.querySelector('[data-backup-preview]'),preview=document.createElement('section');preview.dataset.backupPreview='';preview.textContent=previousPreview.textContent;previousPreview.replaceWith(preview);
  const submit=ui.form.querySelector('[type=submit]');submit.textContent='Восстановить из копии';submit.disabled=true;
  ui.form.querySelector('[data-export-backup]').onclick=()=>{
    const data=JSON.stringify(snapshot(map),null,2),url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='neverwinter-'+game.world.id+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  ui.form.elements.backupFile.onchange=async()=>{
    const serial=++reviewSerial;
    reviewed=null;submit.disabled=true;ui.form.elements.restoreAccess.checked=false;ui.form.elements.restoreAccess.disabled=true;
    const output=ui.form.querySelector('[data-backup-preview]');
    output.replaceChildren();output.textContent='Проверка файла…';
    try {
      const file=ui.form.elements.backupFile.files[0];if(!file){output.textContent='Выберите файл для предварительного просмотра.';return;}
      if(file.size>10*1024*1024)throw Error('Файл больше 10 МБ');
      const parsed=validateBackup(JSON.parse(await file.text()),map);
      if(serial!==reviewSerial || !ui.dialog.isConnected)return;
      reviewed=parsed;
      const existing=reviewed.customPoints.filter(p=>matchJournal(reviewed,p,map)).length;
      output.textContent='Собственные точки: '+reviewed.customPoints.length+' (обновить '+existing+', добавить '+(reviewed.customPoints.length-existing)+'). Территории: '+Object.values(reviewed.settings.points).filter(p=>p.area).length+'. Настроенные локации: '+Object.keys(reviewed.settings.points).length+'. Рисунки: '+reviewed.drawings.length+'.';
      if(reviewed.settings.characters){const info=document.createElement('p');info.textContent=reviewed.sourceWorld===game.world.id?'Персонажи: '+Object.keys(reviewed.settings.characters).length+'; недоступные листы: '+Object.keys(reviewed.settings.characters).filter(id=>!game.actors.has(id)).length:'Маркеры персонажей другого мира не привязываются автоматически.';output.append(info);}
      const source=document.createElement('p');source.textContent='Источник: '+reviewed.sourceWorldName+' ('+reviewed.sourceWorld+'). Оформление: '+mapState(map).color+' / '+mapState(map).size+' px → '+reviewed.settings.color+' / '+reviewed.settings.size+' px.';
      const details=document.createElement('details'),summary=document.createElement('summary'),list=document.createElement('ul');summary.textContent='Объекты из копии';list.className='nw-backup-objects';
      for(const entry of reviewed.customPoints){const item=document.createElement('li');item.textContent=(matchJournal(reviewed,entry,map)?'Обновить точку: ':'Добавить точку: ')+entry.name+(entry.en?' ('+entry.en+')':'');list.append(item);}
      for(const entry of Object.values(reviewed.settings.points).filter(p=>!p.id.startsWith('custom-'))){const item=document.createElement('li');item.textContent=(mapState(map).points[entry.id]?'Обновить: ':'Добавить настройки: ')+entry.ru.name+(entry.omitEnglish?'':' ('+entry.en+')');list.append(item);}
      details.append(summary,list);output.append(source,details);
      ui.form.elements.restoreAccess.disabled=reviewed.sourceWorld!==game.world.id;
      const resourceList=document.createElement('section');resourceList.dataset.backupAssets='';resourceList.className='nw-backup-assets';output.append(resourceList);
      const grouped=new Map();for(const record of Object.values(reviewed.settings.points))if(record.asset && (record.keepMarker || !(record.area || record.territoryOnly || record.shape?.points?.length>=3))){if(!grouped.has(record.asset))grouped.set(record.asset,[]);grouped.get(record.asset).push(record);}
      const current=()=>serial===reviewSerial && ui.dialog.isConnected,statuses=[];
      const gate=()=>{if(current())submit.disabled=statuses.some(s=>!s.ok);};
      const checks=[];
      for(const [path,records]of grouped){
        const state={ok:false,revision:0};statuses.push(state);
        const row=document.createElement('div');row.className='nw-backup-asset';
        const label=document.createElement('label');label.textContent='Изображение: '+records.map(r=>r.ru.name).join(', ');
        const input=document.createElement('input');input.name='assetRepair';input.value=path;label.append(input);
        const message=document.createElement('small');message.dataset.assetStatus='';
        const actions=document.createElement('div');actions.className='nw-form-actions';
        const check=document.createElement('button');check.type='button';check.dataset.checkAsset='';check.textContent='Проверить путь';
        const browse=document.createElement('button');browse.type='button';browse.dataset.browseAsset='';browse.textContent='Выбрать файл';
        const clear=document.createElement('button');clear.type='button';clear.dataset.clearAsset='';clear.textContent='Убрать изображение';
        const verify=async()=>{
          const revision=++state.revision;state.ok=false;gate();message.textContent='Проверка изображения…';
          try{
            const value=asset(input.value.trim()),ok=!value || await readableImage(value);
            if(!current() || revision!==state.revision)return;
            state.ok=ok;message.textContent=ok?(value?'Изображение доступно':'Будет использован встроенный значок'):'Изображение не найдено или не читается — исправьте путь либо уберите изображение';
            if(ok)for(const record of records)record.asset=value;
          }catch(error){if(current() && revision===state.revision)message.textContent=error.message;}
          gate();
        };
        input.oninput=()=>{++state.revision;state.ok=false;message.textContent='Путь изменён — нажмите «Проверить путь»';gate();};
        check.onclick=verify;clear.onclick=()=>{input.value='';verify();};
        browse.onclick=async()=>{const Picker=foundry.applications.apps.FilePicker.implementation,picker=new Picker({type:'image',current:state.ok?input.value:'',callback:path=>{input.value=path;verify();}});await picker.render({force:true});picker.bringToFront();};
        actions.append(check,browse,clear);row.append(label,message,actions);resourceList.append(row);checks.push(verify);
      }
      if(!checks.length)resourceList.textContent='Загруженных изображений в копии нет.';
      let index=0;await Promise.all(Array.from({length:Math.min(4,checks.length)},async()=>{while(index<checks.length)await checks[index++]();}));gate();
    }catch(error){if(serial===reviewSerial && ui.dialog.isConnected)output.textContent='Ошибка: '+error.message;}
  };
  ui.show();
}
