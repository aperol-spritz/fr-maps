import {knownMap} from './layers.mjs';
import {tr} from './i18n.mjs';
import {ID,mapPath,mapState,state,permission,primaryGM,updateMap,authenticatedRequest,copy} from './state.mjs';
import {formDialog} from './access.mjs';
import {draggablePin} from './map-art.mjs';
const owner=(actor,user=game.user)=>Boolean(actor?.testUserPermission(user,'OWNER'));
const allowedPlace=(map,user=game.user)=>user.isGM || (permission(mapState(map).ownership,user)>=2 && mapState(map).allowCharacters);
function mutate(current,request,user) {
  const actor=game.actors.get(request.actorId);if(!actor || actor.type!=='character')throw Error('Выберите персонажа мира');
  if(!user.isGM && (permission(current.ownership,user)<2 || !owner(actor,user)))throw Error('Нет владения этим персонажем');
  const records=current.characters ??= {},existing=records[actor.id];
  if(request.action==='remove'){
    if(!user.isGM && !allowedPlace(request.map,user))throw Error('Размещение персонажей разрешает ведущий');
    delete records[actor.id];return;
  }
  if(!existing && !allowedPlace(request.map,user))throw Error('Размещение персонажей разрешает ведущий');
  if(!['place','move'].includes(request.action)||[request.x,request.y].some(n=>!Number.isFinite(n)||n<0||n>100))throw Error('Неверное положение персонажа');
  records[actor.id]={actorId:actor.id,x:request.x,y:request.y};
}
export function changeCharacter(map,action,actorId,x,y) {
  const request={map,action,actorId,x,y};
  if(game.user.isGM)return updateMap(map,current=>mutate(current,request,game.user));
  return authenticatedRequest('characterRequest',map,request);
}
export function registerCharacters(){
  Hooks.on('updateUser',(user,changes,options,author)=>{
    if(!game.user.isGM || primaryGM()?.id!==game.user.id || author!==user.id || !foundry.utils.hasProperty(changes,'flags.'+ID+'.characterRequest'))return;
    const request=user.getFlag(ID,'characterRequest');if(!request || !state().maps[request.map] || !knownMap(request.map) || typeof request.nonce!=='string'||request.nonce.length>64)return;
    updateMap(request.map,current=>{
      let error;try{mutate(current,request,user);}catch(e){error=e.message;}
      (current.requestAcks ??= {})[user.id]={nonce:request.nonce,error:error ?? null};
    }).catch(error=>console.error(ID,error));
  });
}
export function characterTools(map,onPlace,onLocate){
  const actors=game.actors.filter(a=>a.type==='character'&&(game.user.isGM || owner(a)));
  const ui=formDialog('Персонажи на карте','<label>Поиск персонажа<input type="search" name="characterSearch" placeholder="Имя персонажа"></label><label>Персонаж<select name="actorId" required></select></label><small>Щелчок по маркеру открывает лист персонажа с его обычными правами Foundry.</small><section data-character-list></section>',async form=>{onPlace(form.elements.actorId.value);},{gmOnly:false});
  const refresh=()=>{
    const query=ui.form.elements.characterSearch.value.trim().toLocaleLowerCase();
    const online=new Set(game.users.filter(user=>!user.isGM && user.active).map(user=>user.character?.id));
    const sorted=actors.filter(actor=>query?actor.name.toLocaleLowerCase().includes(query):online.has(actor.id)).sort((a,b)=>a.name.localeCompare(b.name,game.i18n.lang));
    const shown=query?sorted:sorted.slice(0,3);
    ui.form.elements.actorId.replaceChildren(...shown.map(actor=>new Option(actor.name,actor.id)));
    ui.form.querySelector('[type=submit]').disabled=!shown.length || !allowedPlace(map);
  };
  ui.form.elements.characterSearch.oninput=refresh;refresh();
  ui.form.querySelector('[type=submit]').textContent='Поставить на карту';
  if(game.user.isGM){
    const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=Boolean(mapState(map).allowCharacters);check.dataset.allowCharacters='';
    label.append(check,document.createTextNode('Игроки могут размещать своих персонажей'));ui.form.querySelector('[data-character-list]').before(label);
    check.onchange=()=>updateMap(map,current=>{current.allowCharacters=check.checked;}).catch(error=>globalThis.ui.notifications.error(tr(error.message)));
  }
  for(const record of Object.values(mapState(map).characters ?? {})){
    const actor=game.actors.get(record.actorId);const row=document.createElement('div');row.className='nw-character-row';
    const name=document.createElement('span');name.dataset.noTranslate='';name.textContent=actor?.name ?? 'Персонаж недоступен';row.append(name);
    if(actor){const locate=document.createElement('button');locate.type='button';locate.dataset.locateCharacter=actor.id;locate.textContent='Найти на карте';locate.onclick=()=>{onLocate(record);ui.dialog.close();};row.append(locate);}
    if(game.user.isGM || owner(actor)){
      const remove=document.createElement('button');remove.type='button';remove.dataset.removeCharacter=record.actorId;remove.textContent='Убрать с карты';
      remove.onclick=async()=>{try{await changeCharacter(map,'remove',record.actorId);row.remove();}catch(error){globalThis.ui.notifications.error(tr(error.message));}};row.append(remove);
    }ui.form.querySelector('[data-character-list]').append(row);
  }
  ui.show();
}
export function renderCharacters(stage,map,history){
  stage.querySelectorAll('.nw-character').forEach(e=>e.remove());
  if(permission(mapState(map).ownership)<2)return;
  for(const record of Object.values(mapState(map).characters ?? {})){
    const actor=game.actors.get(record.actorId);if(!actor)continue;
    const token=document.createElement('button');token.className='nw-character';token.dataset.character=actor.id;token.setAttribute('aria-label',actor.name);token.title=actor.name;
    Object.assign(token.style,{left:record.x+'%',top:record.y+'%'});
    const image=document.createElement('img');image.draggable=false;image.alt=actor.name;image.src=foundry.utils.getRoute(actor.prototypeToken?.texture?.src || actor.img || 'icons/svg/mystery-man.svg');token.append(image);
    image.onerror=()=>{image.onerror=null;image.src=foundry.utils.getRoute(actor.img || 'icons/svg/mystery-man.svg');};
    const name=document.createElement('span');name.textContent=actor.name;token.append(name);
    if(game.user.isGM || owner(actor))draggablePin(token,{...record,id:actor.id},map,error=>ui.notifications.error(tr(error.message)),(place,x,y)=>history.perform('character',async()=>{
      const before=copy(mapState(map).characters?.[actor.id]);if(!before)throw Error('Маркер персонажа удалён');
      await changeCharacter(map,'move',actor.id,x,y);
      return async()=>{const now=mapState(map).characters?.[actor.id];if(!now || Math.abs(now.x-x)>.00001 || Math.abs(now.y-y)>.00001)throw Error('Положение персонажа уже изменено');await changeCharacter(map,'move',actor.id,before.x,before.y);};
    }));
    token.onclick=event=>{event.stopPropagation();if(actor.testUserPermission(game.user,'LIMITED'))actor.sheet.render({force:true});else ui.notifications.warn(tr('Нет доступа к листу персонажа'));};
    stage.append(token);
  }
}
