import {tr} from './i18n.mjs';
import {ID,mapState,recordFor,patchPoint,updateMap,canEditLocation,editPublicLocation} from './state.mjs';
import {showFloatingDialog} from './window.mjs';
export {BUNDLED_MAP,mapPath,canViewMap,canMove,accessiblePlaces,visibility,movePoint} from './state.mjs';
export const escape=text=>String(text ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function permissionFields(form,ownership,editing) {
  const container=form.querySelector('[data-permissions]');
  const rows=[['default','Все игроки'],...game.users.filter(user=>!user.isGM).map(user=>[user.id,user.name])];
  for(const [id,name] of rows) {
    const label=document.createElement('label');label.textContent=name;if(id!=='default')label.dataset.noTranslateText='';
    const select=document.createElement('select');select.dataset.user=id;
    if(id!=='default') select.add(new Option('Как у всех',-1));
    select.add(new Option('Нет доступа',0));select.add(new Option('Просмотр',2));
    if(editing) select.add(new Option('Владение',3));
    select.value=String(ownership?.[id] ?? (id==='default'?0:-1));
    label.append(select);container.append(label);
  }
}
function readOwnership(form) {
  const ownership={};
  for(const select of form.querySelectorAll('[data-user]')) {
    const value=Number(select.value);
    if(value!==-1) ownership[select.dataset.user]=value;
  }
  return ownership;
}
export function formDialog(title,body,save,{gmOnly=true}={}) {
  const dialog=document.createElement('dialog');dialog.className='nw-point-editor nw-settings';
  dialog.innerHTML='<form><h2></h2>'+body+'<p role="alert"></p><div class="nw-form-actions"><button type="button" data-cancel>Отмена</button><button type="submit">Сохранить</button></div></form>';
  dialog.querySelector('h2').textContent=title;
  const form=dialog.querySelector('form');
  form.querySelector('[data-cancel]').onclick=()=>dialog.close();
  form.onsubmit=async event=>{
    event.preventDefault();
    const button=form.querySelector('[type=submit]');button.disabled=true;
    try {
      if(gmOnly && !game.user.isGM) throw Error('Требуются права ведущего');
      await save(form);dialog.close();
    } catch(error) {form.querySelector('[role=alert]').textContent=error.message;button.disabled=false;}
  };
  dialog.onclose=()=>dialog.remove();
  return {dialog,form,show:()=>showFloatingDialog(dialog)};
}
const colorFields='<div class="nw-colors"><input name="color" type="color"><input name="colorHex" pattern="#[0-9a-fA-F]{6}" required aria-label="Код цвета"></div>';
export async function mapSettings(map) {
  const data=mapState(map);
  const ui=formDialog('Настройки карты',
    '<label>Цвет значков по умолчанию'+colorFields+'</label><label>Размер значков, px<input name="size" type="number" min="20" max="96" required></label><fieldset data-permissions><legend>Доступ к карте</legend></fieldset><button type="button" data-backup>Резервная копия карты</button>',
    form=>updateMap(map,current=>Object.assign(current,{ownership:readOwnership(form),color:form.elements.color.value,size:Number(form.elements.size.value)})));
  ui.form.elements.color.value=data.color;ui.form.elements.size.value=data.size;
  bindColor(ui.form);permissionFields(ui.form,data.ownership,false);
  ui.form.querySelector('[data-backup]').onclick=()=>import('./backup.mjs').then(module=>{ui.dialog.close();module.openBackup(map);}).catch(error=>globalThis.ui.notifications.error(tr(error.message)));
  ui.show();
}
export async function pointSettings(place,map) {
  if(!game.user.isGM && !canEditLocation(place))throw Error('Нет владения этой локацией');
  const data=recordFor(place,map),defaults=mapState(map);
  if(!place.keepMarker && (place.area || place.territoryOnly || place.shape?.points?.length>=3)) {
    const ui=formDialog('Территория — '+place[game.settings.get(ID,'language')].name,'<label>Публичный текст RU<textarea name="publicRu" rows="4" maxlength="20000"></textarea></label><label>Публічний текст UA<textarea name="publicUk" rows="4" maxlength="20000"></textarea></label><fieldset data-permissions><legend>Доступ к территории</legend></fieldset><small>Граница и заливка настраиваются в окне «Территории».</small>',form=>patchPoint(place,map,{ownership:readOwnership(form),ru:{...data.ru,lore:form.elements.publicRu.value},uk:{...data.uk,lore:form.elements.publicUk.value}}));
    ui.form.elements.publicRu.value=data.ru.lore ?? '';ui.form.elements.publicUk.value=data.uk.lore ?? '';
    const grants=Object.fromEntries(Object.entries(data.ownership ?? {}).map(([id,value])=>[id,value===3?2:value]));
    permissionFields(ui.form,grants,false);ui.show();return;
  }
  let upload;
  const ui=formDialog('Точка — '+place[game.settings.get(ID,'language')].name,
    '<label class="nw-check"><input name="individual" type="checkbox">Свой цвет и размер</label><small>Изменение цвета или размера автоматически включает индивидуальный вид.</small><label>Цвет'+colorFields+'</label><label>Размер, px<input name="size" type="number" min="20" max="96" required></label><label>Свой значок — JPG, PNG, GIF<input name="asset" type="text" placeholder="Путь к изображению"></label><div class="nw-form-actions"><button type="button" data-browse>Выбрать файл</button><label class="nw-upload">Загрузить<input name="upload" type="file" accept=".jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp"></label></div><label>Публичный текст RU<textarea name="publicRu" rows="4" maxlength="20000"></textarea></label><label>Публічний текст UA<textarea name="publicUk" rows="4" maxlength="20000"></textarea></label><fieldset data-permissions><legend>Доступ к локации</legend></fieldset>',
    async form=>{
      await upload;
      const asset=form.elements.asset.value.trim();
      if(asset && !/\.(jpe?g|png|gif|webp)(\?.*)?$/i.test(asset)) throw Error('Выберите изображение JPG, PNG, GIF или WebP');
      await editPublicLocation(place,map,{...(game.user.isGM?{ownership:readOwnership(form)}:{}),
        ru:{...(game.user.isGM?data.ru:{}),lore:form.elements.publicRu.value},uk:{...(game.user.isGM?data.uk:{}),lore:form.elements.publicUk.value},
        color:form.elements.individual.checked?form.elements.color.value:null,
        size:form.elements.individual.checked?Number(form.elements.size.value):null,asset});
    },{gmOnly:false});
  const fields=ui.form.elements;
  fields.individual.checked=Boolean(data.color || data.size);
  fields.color.value=data.color || defaults.color;fields.size.value=data.size || defaults.size;
  const individual=()=>{fields.individual.checked=true;};
  bindColor(ui.form,individual);fields.size.oninput=individual;
  fields.asset.value=data.asset ?? '';fields.publicRu.value=data.ru.lore;fields.publicUk.value=data.uk.lore;
  const Picker=foundry.applications.apps.FilePicker.implementation;
  ui.form.querySelector('[data-browse]').onclick=async()=>{
    const picker=new Picker({type:'image',current:fields.asset.value,callback:path=>{fields.asset.value=path;}});
    await picker.render({force:true});picker.bringToFront();
  };
  fields.upload.onchange=()=>{
    const file=fields.upload.files[0];
    if(!file) return;
    upload=(async()=>{
      if(!/\.(jpe?g|png|gif|webp)$/i.test(file.name)) throw Error('Неподдерживаемый формат изображения');
      const folder='worlds/'+game.world.id+'/neverwinter-icons';
      try {await Picker.createDirectory('data',folder,{notify:false});} catch(error) {
        await Picker.browse('data',folder);
      }
      const result=await Picker.upload('data',folder,file,{}, {notify:false});
      if(!result?.path) throw Error('Не удалось загрузить изображение');
      fields.asset.value=result.path;
    })();
    upload.catch(error=>{ui.form.querySelector('[role=alert]').textContent=error.message;});
  };
  if(game.user.isGM)permissionFields(ui.form,data.ownership,true);else ui.form.querySelector('[data-permissions]').remove();ui.show();
}
function bindColor(form,changed=()=>{}) {
  const fields=form.elements;
  fields.colorHex.value=fields.color.value;
  const picker=()=>{fields.colorHex.value=fields.color.value;changed();};
  fields.color.oninput=picker;fields.color.onchange=picker;
  const hex=()=>{if(/^#[0-9a-f]{6}$/i.test(fields.colorHex.value)) {fields.color.value=fields.colorHex.value;changed();}};
  fields.colorHex.oninput=hex;fields.colorHex.onchange=hex;
}
