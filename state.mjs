import {layerMap,currentLayer,knownMap} from './layers.mjs';
export const ID='neverwinter-atlas';
export const BUNDLED_MAP='modules/'+ID+'/assets/neverwinter.webp';
export const mapPath=(layer=currentLayer())=>layerMap(layer);
export const copy=value=>foundry.utils.deepClone(value);
export const state=()=>game.settings.get(ID,'atlasState');
export const mapState=map=>state().maps[map] ?? {color:'#a94328',size:34,ownership:{default:0},points:{}};
export const permission=(ownership,user=game.user)=>user.isGM?3:Number(ownership?.[user.id] ?? ownership?.default ?? 0);
export const canViewMap=(map=mapPath())=>permission(mapState(map).ownership)>=2;
export const canMove=place=>permission(place.record?.ownership)>=3 && (game.user.isGM || place.keepMarker || !(place.area || place.territoryOnly || place.shape?.points?.length>=3));
export const canEditLocation=place=>canMove(place) && (place.keepMarker || !(place.area || place.territoryOnly || place.shape?.points?.length>=3));
let writes=Promise.resolve();
export function updateMap(map,mutate) {
  const work=writes.catch(()=>{}).then(async()=>{
    if(!game.user.isGM) throw Error('Требуются права ведущего');
    const next=copy(state());
    const current=copy(mapState(map));
    if(await mutate(current)===false) return;
    next.maps[map]=current;
    await game.settings.set(ID,'atlasState',next);
  });
  writes=work;
  return work;
}
export function recordFor(place,map) {
  const existing=mapState(map).points[place.id];
  if(existing) {
    const record=copy(existing);
    if(record.shape===undefined && place.shape) record.shape=copy(place.shape);
    return record;
  }
  const local=language=>({name:place[language].name,lore:place.document?'':place[language].lore ?? ''});
  return {id:place.id,custom:Boolean(place.document || place.area),area:place.area,map,
    x:place.x,y:place.y,en:place.en,category:place.category,ru:local('ru'),uk:local('uk'),
    aliases:place.aliases ?? [],period:place.period,position:copy(place.position),related:place.related ?? [],district:place.district,
    shape:place.shape?copy(place.shape):place.shape,territoryOnly:Boolean(place.territoryOnly),keepMarker:Boolean(place.keepMarker),omitEnglish:Boolean(place.omitEnglish),regionOrder:place.regionOrder ?? 0,regionLabel:copy(place.regionLabel ?? {enabled:false,audience:'all',size:16}),ownership:{default:0}};
}
export function patchPoint(place,map,patch) {
  return updateMap(map,current=>{current.points[place.id]={...recordFor(place,map),...copy(patch)};});
}
export function removePoint(id,map) {return updateMap(map,current=>{delete current.points[id];});}
export function syncTerritoryDefaults(base,map) {
  return updateMap(map,current=>{
    let changed=false;
    for(const source of base){const record=current.points[source.id];if(record && source.position && !record.position){record.position=copy(source.position);changed=true;}}
    for(const source of base.filter(p=>p.territoryOnly || p.keepMarker)) {
      const record=current.points[source.id];if(!record)continue;
      if(record.category!==source.category){record.category=source.category;changed=true;}
      // Only the old canonical title is renamed. Public prose, grants and
      // user-edited geometry remain the world's own data.
      if(source.id==='chasm' && record.en==='The Chasm' && record.ru?.name==='Запечатанный Разлом' && record.uk?.name==='Запечатаний Розлом') {
        record.en=source.en;record.ru.name=source.ru.name;record.uk.name=source.uk.name;changed=true;
      }
      for(const field of ['territoryOnly','keepMarker','omitEnglish'])if(record[field]!==Boolean(source[field])){record[field]=Boolean(source[field]);changed=true;}
      if(source.shape && record.shape===undefined){record.shape=copy(source.shape);changed=true;}
    }
    return changed;
  });
}
export function accessiblePlaces(base,map,custom) {
  const points=mapState(map).points;
  if(!game.user.isGM) {
    if(!canViewMap(map)) return [];
    return Object.values(points).filter(p=>permission(p.ownership)>=2).map(p=>({...p,aliases:p.aliases ?? [],record:p,isCustom:p.custom}));
  }
  const areas=Object.values(points).filter(p=>p.area);
  return [...base,...custom,...areas].map(place=>{
    const record=points[place.id];
    return {...place,aliases:place.aliases ?? [],...(record?{...(place.area?{en:record.en,category:record.category,ru:record.ru,uk:record.uk}:{}),x:record.x,y:record.y,color:record.color,size:record.size,asset:record.asset,regionOrder:record.regionOrder,regionLabel:record.regionLabel,
      position:record.position ?? place.position,shape:record.shape === undefined?place.shape:record.shape}:{}),
      isCustom:Boolean(place.document || place.area),record};
  });
}
export function visibility(place) {
  const users=game.users.filter(user=>!user.isGM && permission(place.record?.ownership,user)>=2);
  const players=game.users.filter(u=>!u.isGM),level=Math.max(0,...players.map(u=>permission(place.record?.ownership,u)),players.length?0:Number(place.record?.ownership.default)||0);
  return {open:level>=2,level,names:users.map(user=>user.name)};
}
export const primaryGM=()=>game.users.filter(u=>u.active && u.isGM).sort((a,b)=>a.id.localeCompare(b.id))[0];
export function authenticatedRequest(flag,map,data) {
  if(!primaryGM())return Promise.reject(Error('Для сохранения нужен подключённый ведущий'));
  const nonce=foundry.utils.randomID();
  return new Promise((resolve,reject)=>{
    const check=()=>{const ack=mapState(map).requestAcks?.[game.user.id];if(ack?.nonce===nonce){cleanup();ack.error?reject(Error(ack.error)):resolve();}};
    const hook=Hooks.on('updateSetting',check),timer=setTimeout(()=>{cleanup();reject(Error('Ведущий не подтвердил действие'));},8000);
    function cleanup(){clearTimeout(timer);Hooks.off('updateSetting',hook);}
    // Foundry merges nested flag objects. Replace only this request flag so a
    // previous rejected field cannot contaminate the next valid request.
    game.user.unsetFlag(ID,flag).then(()=>game.user.setFlag(ID,flag,{...copy(data),map,nonce})).then(check,error=>{cleanup();reject(error);});
  });
}
function publicPatch(patch) {
  if(!patch || typeof patch!=='object' || Array.isArray(patch) || Object.keys(patch).some(k=>!['color','size','asset','ru','uk'].includes(k)))throw Error('Недопустимое изменение локации');
  const result={};
  if('color'in patch){if(patch.color!==null && !/^#[\da-f]{6}$/i.test(patch.color))throw Error('Неверный цвет');result.color=patch.color;}
  if('size'in patch){if(patch.size!==null && (!Number.isFinite(patch.size)||patch.size<20||patch.size>96))throw Error('Неверный размер');result.size=patch.size;}
  if('asset'in patch){if(typeof patch.asset!=='string'||patch.asset.length>1024||(patch.asset && (!/^(modules|worlds|assets|icons)\//.test(patch.asset)||patch.asset.includes('..')||/[<>\\\x00-\x1f]/.test(patch.asset)||! /\.(jpe?g|png|gif|webp)$/i.test(patch.asset))))throw Error('Неверный путь к изображению');result.asset=patch.asset;}
  for(const lang of ['ru','uk'])if(lang in patch){if(!patch[lang] || Object.keys(patch[lang]).some(k=>k!=='lore') || typeof patch[lang].lore!=='string' || patch[lang].lore.length>20000)throw Error('Неверный публичный текст');result[lang]={lore:patch[lang].lore};}
  return result;
}
export function editPublicLocation(place,map,patch) {
  if(game.user.isGM)return patchPoint(place,map,patch);
  if(!canViewMap(map) || !canEditLocation(place))throw Error('Нет владения этой локацией');
  return authenticatedRequest('pointEditRequest',map,{id:place.id,patch:publicPatch(patch)});
}
export async function movePoint(place,map,x,y) {
  if(!canViewMap(map) || !canMove(place)) throw Error('Нет права перемещать эту точку');
  const patch={x:Math.max(0,Math.min(100,x)),y:Math.max(0,Math.min(100,y))};
  if(game.user.isGM) return patchPoint(place,map,patch);
  if(!primaryGM()) throw Error('Для сохранения перемещения нужен подключённый ведущий');
  const nonce=foundry.utils.randomID();
  // User updates are authenticated by Foundry. The GM checks that the author
  // matches this user document and independently verifies the map/point grants.
  return new Promise((resolve,reject)=>{
    const check=()=>{
      const last=mapState(map).points[place.id]?.lastMove;
      if(last?.nonce===nonce && last.user===game.user.id) {cleanup();resolve();}
    };
    const hook=Hooks.on('updateSetting',check);
    const timer=setTimeout(()=>{cleanup();reject(Error('Ведущий не подтвердил перемещение'));},8000);
    function cleanup(){clearTimeout(timer);Hooks.off('updateSetting',hook);}
    game.user.setFlag(ID,'moveRequest',{map,id:place.id,...patch,nonce}).then(check,error=>{cleanup();reject(error);});
  });
}
export function registerState() {
  game.settings.register(ID,'atlasState',{scope:'world',config:false,type:Object,default:{version:7,maps:{}}});
  game.settings.register(ID,'drawings',{scope:'user',config:false,type:Object,default:{}});
  game.settings.register(ID,'legacyBackup',{scope:'user',config:false,type:Object,default:{}});
  Hooks.on('updateUser',(user,changes,options,author)=>{
    if(!game.user.isGM || primaryGM()?.id!==game.user.id || author!==user.id || !foundry.utils.hasProperty(changes,'flags.'+ID+'.pointEditRequest'))return;
    const request=user.getFlag(ID,'pointEditRequest');if(!request || !state().maps[request.map] || !knownMap(request.map) || typeof request.nonce!=='string' || request.nonce.length>64)return;
    updateMap(request.map,current=>{
      let error;
      try{const record=current.points[request.id];if(permission(current.ownership,user)<2 || !record || permission(record.ownership,user)<3 || (!record.keepMarker && (record.area||record.territoryOnly||record.shape?.points?.length>=3)))throw Error('Нет владения этой локацией');
        const patch=publicPatch(request.patch);for(const [key,value]of Object.entries(patch))record[key]=['ru','uk'].includes(key)?{...record[key],...value}:value;
      }catch(e){error=e.message;}
      (current.requestAcks ??= {})[user.id]={nonce:request.nonce,error:error ?? null};
    }).catch(error=>console.error(ID,error));
  });
  Hooks.on('updateUser',(user,changes,options,author)=>{
    if(!game.user.isGM || primaryGM()?.id!==game.user.id || author!==user.id) return;
    // Subsequent updates only include changed members (map/id may be omitted).
    // Read the authenticated user's merged flag, but only for this flag's events.
    if(!foundry.utils.hasProperty(changes,'flags.'+ID+'.moveRequest')) return;
    const request=user.getFlag(ID,'moveRequest');
    if(!request || !knownMap(request.map) || typeof request.map!=='string' || typeof request.id!=='string' || !['x','y'].every(k=>Number.isFinite(request[k]) && request[k]>=0 && request[k]<=100) ||
      typeof request.nonce!=='string' || request.nonce.length>64) return;
    updateMap(request.map,current=>{
      const record=current.points[request.id];
      if(permission(current.ownership,user)<2 || !record || permission(record.ownership,user)<3 || (!record.keepMarker && (record.area || record.territoryOnly || record.shape?.points?.length>=3))) return false;
      record.x=request.x;record.y=request.y;record.lastMove={nonce:request.nonce,user:user.id};
    }).catch(error=>console.error(ID,error));
  });
}
let migration;
export function migrateLegacy() {
  if(!game.user.isGM) return Promise.resolve();
  return migration ??= (async()=>{
    // Only module-owned service records are migrated. Actual lore and custom
    // GM journals stay intact. A private server-side backup precedes deletion.
    const controls=game.journal.filter(j=>j.getFlag(ID,'control'));
    const allowed=new Set(controls.flatMap(j=>Object.keys(j.getFlag(ID,'control').records ?? {})));
    const records=game.journal.filter(j=>(j.getFlag(ID,'control') || allowed.has(j.id) || j.getFlag(ID,'drawing')) && !j.getFlag(ID,'point'));
    if(!records.length) return;
    const backup=copy(game.settings.get(ID,'legacyBackup'));
    for(const record of records) backup[record.id] ??= record.toObject();
    await game.settings.set(ID,'legacyBackup',backup);
    for(const control of controls) {
      const data=control.getFlag(ID,'control');
      await updateMap(data.map,current=>{
        if(current.legacyImported) return;
        Object.assign(current,{color:data.color,size:data.size,ownership:copy(control.ownership),legacyImported:true});
        for(const id of Object.keys(data.records ?? {})) {
          const journal=game.journal.get(id),overlay=journal?.getFlag(ID,'overlay');
          if(overlay) current.points[data.records[id]]={...copy(overlay),id:data.records[id],ownership:copy(journal.ownership)};
        }
      });
    }
    const drawings=copy(game.settings.get(ID,'drawings'));
    for(const record of records.filter(j=>j.getFlag(ID,'drawing') && !j.getFlag(ID,'overlay'))) {
      const data=record.getFlag(ID,'drawing');
      const list=drawings[data.map] ??= [];
      if(!list.some(stroke=>stroke.id===record.id)) list.push({...copy(data),id:record.id});
    }
    await game.settings.set(ID,'drawings',drawings);
    await JournalEntry.deleteDocuments(records.map(j=>j.id));
  })().catch(error=>{migration=null;throw error;});
}
let drawingWrites=Promise.resolve();
export const strokes=map=>game.user.isGM?(game.settings.get(ID,'drawings')[map] ?? []):[];
export const sharedStrokes=map=>canViewMap(map)?Object.values(mapState(map).publicDrawings ?? {}):[];
export const strokeKey=id=>game.user.id+'-'+id;
export function shareGroup(map,group,show) {
  if(!game.user.isGM)throw Error('Требуются права ведущего');
  const selected=strokes(map).filter(stroke=>(stroke.group || '')===group);
  return updateMap(map,current=>{
    current.publicDrawings ??= {};
    for(const stroke of selected) {
      const key=strokeKey(stroke.id);
      if(show)current.publicDrawings[key]={id:stroke.id,owner:game.user.id,points:copy(stroke.points),color:stroke.color,width:stroke.width,label:stroke.label ?? ''};
      else delete current.publicDrawings[key];
    }
  });
}
export function renameGroup(map,from,to) {
  to=String(to).trim();if(!to || to.length>80)throw Error('Введите название группы до 80 символов');
  return updateStrokes(map,list=>{for(const stroke of list)if((stroke.group || '')===from)stroke.group=to;});
}
export function removeGroup(map,group,removeStrokes=false) {
  return updateStrokes(map,list=>{for(let i=list.length-1;i>=0;i--)if((list[i].group || '')===group){if(removeStrokes)list.splice(i,1);else list[i].group='';}});
}
export async function shareStroke(map,id,show) {
  if(!game.user.isGM) throw Error('Требуются права ведущего');
  const stroke=strokes(map).find(stroke=>stroke.id===id);
  if(show && !stroke) throw Error('Рисунок не найден');
  return updateMap(map,current=>{
    current.publicDrawings ??= {};
    if(show) current.publicDrawings[strokeKey(id)]={id,owner:game.user.id,points:copy(stroke.points),color:stroke.color,width:stroke.width,label:stroke.label ?? ''};
    else delete current.publicDrawings[strokeKey(id)];
  });
}
export function updateStrokes(map,mutate) {
  const work=drawingWrites.catch(()=>{}).then(async()=>{
    if(!game.user.isGM) throw Error('Требуются права ведущего');
    const next=copy(game.settings.get(ID,'drawings'));
    const list=next[map] ??= [];
    mutate(list);
    await game.settings.set(ID,'drawings',next);
    const byId=new Map(list.map(stroke=>[stroke.id,stroke]));
    if(Object.values(mapState(map).publicDrawings ?? {}).some(stroke=>stroke.owner===game.user.id)) {
      await updateMap(map,current=>{
        for(const [key,stroke] of Object.entries(current.publicDrawings ?? {}))
          if(stroke.owner===game.user.id) {
            const own=byId.get(stroke.id);
            if(!own)delete current.publicDrawings[key];
            else stroke.label=own.label ?? '';
          }
      });
    }
  });
  drawingWrites=work;
  return work;
}
