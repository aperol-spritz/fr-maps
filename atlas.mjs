import {layerIds,currentLayer,layerMap,layerName,pendingMap} from './layers.mjs';
import {positionSettings} from './position.mjs';
import {watchUI,tr,confirmUI} from './i18n.mjs';
import {configureWindow,configureMap,showFloatingDialog} from './window.mjs';
import {customPlaces,editPoint} from './custom-points.mjs';
import {BUNDLED_MAP,mapPath,canViewMap,canMove,accessiblePlaces,visibility,mapSettings,pointSettings,movePoint,formDialog} from './access.mjs';
import {actionHistory} from './history.mjs';
import {mapState,registerState,migrateLegacy,removePoint,patchPoint,syncTerritoryDefaults,copy} from './state.mjs';
import {renderTerritories,renderDrawings,draggablePin,drawingTools} from './map-art.mjs';
import {regionEditor,ruler} from './geometry.mjs';
import {inViewport} from './viewport.mjs';
import {registerCharacters,characterTools,renderCharacters,changeCharacter} from './characters.mjs';
import {canEditLocation} from './state.mjs';
const ID='neverwinter-atlas';
const root=foundry.utils.getRoute('modules/'+ID);
const labels={
  ru:{title:'Невервинтер (Neverwinter)',search:'Поиск локации',all:'Все локации',landmark:'Ориентиры',temple:'Храмы',water:'Водоёмы',inn:'Заведения',full:'Открыть журнал',none:'Локаций не найдено',close:'Закрыть',map:'Карта города',add:'Добавить локацию',place:'Нажмите на карте, чтобы поставить точку',edit:'Изменить',remove:'Удалить',confirm:'Удалить эту локацию и его журнал?',maximize:'Развернуть / восстановить',resize:'Изменить размер окна'},
  uk:{title:'Невервінтер (Neverwinter)',search:'Пошук локації',all:'Усі локації',landmark:'Орієнтири',temple:'Храми',water:'Водойми',inn:'Заклади',full:'Відкрити журнал',none:'Локацій не знайдено',close:'Закрити',map:'Мапа міста',add:'Додати локацію',place:'Натисніть на мапі, щоб поставити точку',edit:'Змінити',remove:'Видалити',confirm:'Видалити цю локацію та його журнал?',maximize:'Розгорнути / відновити',resize:'Змінити розмір вікна'}
};
const icons={landmark:'landmark',temple:'place-of-worship',water:'water',inn:'wine-glass',district:'map',shop:'store',service:'handshake'};
labels.ru.district='Районы';
labels.uk.district='Райони';
labels.ru.shop='Магазины и мастерские';
labels.uk.shop='Крамниці й майстерні';
labels.ru.service='Городские услуги';
labels.uk.service='Міські послуги';
Object.assign(labels.ru,{back:'Назад',related:'Связанные локации',districtPlaces:'Локации района',districtLabel:'Район',periodLabel:'Период сведений',periodAll:'Все сведения',periodHide:'Без исторических объектов',periodHistorical:'Только исторические',own:'Своя точка кампании'});
Object.assign(labels.uk,{back:'Назад',related:'Пов’язані локації',districtPlaces:'Локації району',districtLabel:'Район',periodLabel:'Період відомостей',periodAll:'Усі відомості',periodHide:'Без історичних об’єктів',periodHistorical:'Лише історичні',own:'Власна точка кампанії'});
const normalize=value=>value.toLocaleLowerCase().replaceAll('ё','е').replaceAll('’',"'").trim();
const nameFor=(place,language)=>place.en && !place.omitEnglish ? place[language].name+' ('+place.en+')' : place[language].name;
let atlas,loading;
async function openAtlas() {
  if(!canViewMap()){const fallback=layerIds.find(id=>canViewMap(layerMap(id)));if(!fallback)return;await game.settings.set(ID,'activeLayer',fallback);}
  if(atlas?.isConnected){if(atlas.open){atlas.focus();return;}await new Promise(resolve=>atlas.addEventListener('close',resolve,{once:true}));}
  if(loading) return loading;
  loading=createAtlas().catch(error=>{
    console.error(ID,error);ui.notifications.error('Атлас: '+error.message);
  }).finally(()=>{loading=null;});
  return loading;
}
async function createAtlas() {
  let basePlaces=[],journals=[];
  if(game.user.isGM) {
    const response=await fetch(root+'/data/places.json');
    if(!response.ok) throw Error('places.json '+response.status);
    basePlaces=await response.json();
    journals=await game.packs.get(ID+'.city').getDocuments();
  }
  const books=new Map(journals.map(journal=>[journal.getFlag(ID,'language'),journal]));
  const bundledMap=BUNDLED_MAP;
  const layerId=currentLayer(),baseMap=mapPath(),pending=pendingMap(baseMap);
  basePlaces=basePlaces.filter(place=>(place.layer ?? 'city')===layerId);
  if(game.user.isGM) {await migrateLegacy();if(baseMap===bundledMap)await syncTerritoryDefaults(basePlaces,baseMap);}
  const el=document.createElement('dialog');
  el.className='nw-atlas';el.dataset.layer=layerId;
  el.innerHTML=`<header><h2></h2><span>1492 ЛД</span><div class="nw-tools"><details class="nw-drawing-tools"><summary title="Рисование" aria-label="Рисование"><i class="fas fa-pencil-alt"></i></summary><div><strong>Рисование</strong><button data-draw aria-pressed="false" title="Карандаш" aria-label="Карандаш"><i class="fas fa-pencil-alt"></i></button><input name="drawColor" type="color" value="#b12e21" aria-label="Цвет рисунка"><input name="drawWidth" type="number" min="1" max="12" value="3" aria-label="Толщина линии"><button data-undo title="Отменить штрих — Ctrl+Z" aria-label="Отменить штрих"><i class="fas fa-undo"></i></button><button data-clear title="Очистить рисунки" aria-label="Очистить рисунки"><i class="fas fa-trash"></i></button><section class="nw-stroke-list" data-stroke-list></section></div></details><button class="nw-territory-tools" data-territories title="Территории" aria-label="Территории"><i class="fas fa-draw-polygon"></i></button><details class="nw-ruler-tools"><summary title="Линейка" aria-label="Линейка"><i class="fas fa-ruler"></i></summary><div><button data-ruler aria-pressed="false">Измерять</button><select name="rulerMode" aria-label="Способ измерения"><option value="line">Прямая</option><option value="free">Свободный маршрут</option></select><button data-calibrate>Калибровка</button><button data-ruler-clear>Сбросить</button><output data-distance>0 ft · 0 м</output></div></details><button data-settings title="Настройки карты">⚙</button><button data-lang="ru">RU</button><button data-lang="uk">UA</button><button data-maximize aria-pressed="false">⛶</button><button data-close>×</button></div></header>
    <div class="nw-body"><section class="nw-viewport"><div class="nw-map-space"><div class="nw-stage"><img draggable="false"></div></div></section>
    <aside><input type="search"><select data-category></select><select data-period-filter></select><div class="nw-sidebar-tools"><button data-back></button><button data-add></button></div><article></article><nav></nav></aside></div>
    <footer><small></small><div><button data-zoom="-1" aria-label="−">−</button><output>100%</output><button data-zoom="1" aria-label="+">+</button></div></footer><span class="nw-resize"></span><div class="nw-tooltip" role="tooltip" hidden></div>`;
  const rail=document.createElement('div');rail.className='nw-layer-switch';rail.setAttribute('role','group');el.querySelector('.nw-body').prepend(rail);
  for(const id of layerIds){const button=document.createElement('button');button.type='button';button.dataset.layer=id;button.innerHTML='<span class="nw-lever-dot"><i class="fas fa-'+({evernight:'moon',city:'sun',underground:'dungeon'}[id])+'" aria-hidden="true"></i></span><span data-layer-name></span>';rail.append(button);button.onclick=async()=>{if(id===layerId)return;if(regions?.active() || document.querySelector('.nw-point-editor[open]')){ui.notifications.warn(tr('Завершите или закройте редактор перед сменой карты'));return;}if(!canViewMap(layerMap(id)))return;await new Promise(resolve=>{el.addEventListener('close',resolve,{once:true});el.close();});await game.settings.set(ID,'activeLayer',id);await openAtlas();};}
  const empty=document.createElement('section');empty.className='nw-layer-empty';empty.hidden=!pending;el.querySelector('.nw-viewport').append(empty);
  const manager=document.createElement('dialog');manager.className='nw-point-editor nw-territory-manager';
  const sidebarButton=document.createElement('button');sidebarButton.dataset.sidebar='';sidebarButton.setAttribute('aria-label','Скрыть панель');sidebarButton.innerHTML='<i class="fas fa-sidebar"></i>';el.querySelector('[data-settings]').before(sidebarButton);
  const characterButton=document.createElement('button');characterButton.dataset.characters='';characterButton.title='Персонажи';characterButton.innerHTML='<i class="fas fa-users"></i>';sidebarButton.before(characterButton);
  const accuracy=document.createElement('select');accuracy.dataset.positionFilter='';el.querySelector('[data-period-filter]').after(accuracy);
  const count=document.createElement('small');count.className='nw-list-count';el.querySelector('nav').before(count);
  manager.innerHTML='<h2>Территории</h2><div class="nw-territory-content"><button data-new-region>Создать территорию</button><button data-outline-selected disabled>Контур выбранной локации</button><label class="nw-check"><input data-show-regions type="checkbox" checked>Показать контуры</label><section class="nw-region-list" data-region-list></section><section data-region-editor-host></section></div>';
  Object.assign(manager.style,{inset:'auto',left:Math.max(10,window.innerWidth-450)+'px',top:'80px',margin:'0'});
  const find=selector=>el.querySelector(selector) ?? manager.querySelector(selector);
  const stage=find('.nw-stage'),viewport=find('.nw-viewport'),input=find('input[type=search]'),select=find('[data-category]'),periodFilter=find('[data-period-filter]'),img=find('img');
  viewport.tabIndex=0;
  img.src=foundry.utils.getRoute(baseMap);
  periodFilter.add(new Option('',game.settings.get(ID,'periodFilter')));
  let language=game.settings.get(ID,'language'),selectedId,placing=false,map;
  let placingCharacter,listed=[],sidebarCollapsed=game.settings.get(ID,'sidebarCollapsed');
  function sidebar(collapsed){sidebarCollapsed=collapsed;el.classList.toggle('nw-sidebar-collapsed',collapsed);sidebarButton.setAttribute('aria-expanded',String(!collapsed));sidebarButton.setAttribute('aria-label',collapsed?'Показать панель':'Скрыть панель');sidebarButton.innerHTML='<i class="fas '+(collapsed?'fa-angles-left':'fa-angles-right')+'"></i>';game.settings.set(ID,'sidebarCollapsed',collapsed).catch(error=>ui.notifications.error(tr(error.message)));}
  sidebar(sidebarCollapsed);sidebarButton.onclick=()=>sidebar(!sidebarCollapsed);
  const history=[];
  const actions=actionHistory();
  const places=()=>accessiblePlaces(basePlaces,baseMap,game.user.isGM?customPlaces(baseMap):[]);
  const commitLabelMove=(place,x,y)=>actions.perform('label',async()=>{
    if(!game.user.isGM)throw Error('Подписи перемещает только ведущий');
    const live=places().find(item=>item.id===place.id);
    if(!live?.regionLabel?.enabled)throw Error('Подпись больше недоступна');
    const before={x:live.regionLabel.x ?? live.x,y:live.regionLabel.y ?? live.y};
    if(Math.abs(before.x-x)<.00001 && Math.abs(before.y-y)<.00001)return;
    await patchPoint(live,baseMap,{regionLabel:{...copy(live.regionLabel),x,y}});
    return async()=>{
      const current=places().find(item=>item.id===place.id),label=current?.regionLabel;
      if(!label || Math.abs((label.x ?? current.x)-x)>.00001 || Math.abs((label.y ?? current.y)-y)>.00001)throw Error('Положение подписи уже изменено. Отмена этого перемещения пропущена.');
      await patchPoint(current,baseMap,{regionLabel:{...copy(label),...before}});
    };
  });
  const commitMove=(place,x,y)=>actions.perform('move',async()=>{
    const live=places().find(item=>item.id===place.id);
    if(!live)throw Error('Локация больше недоступна');
    const before={x:live.x,y:live.y};
    if(Math.abs(before.x-x)<.00001 && Math.abs(before.y-y)<.00001)return;
    await movePoint(live,baseMap,x,y);
    return async()=>{
      const current=places().find(item=>item.id===place.id);
      if(!current)throw Error('Нельзя отменить перемещение: локация больше недоступна');
      if(Math.abs(current.x-x)>.00001 || Math.abs(current.y-y)>.00001)throw Error('Положение уже изменено другим действием. Отмена этого перемещения пропущена.');
      await movePoint(current,baseMap,before.x,before.y);
    };
  });
  const districtOptions=()=>places().filter(place=>place.category==='district').map(place=>({id:place.id,name:nameFor(place,language)}));
  const tooltip=find('.nw-tooltip');
  function showTooltip(target,place) {
    const show=event=>{
      tooltip.textContent=nameFor(place,language)+(game.user.isGM?' · '+(visibility(place).level>=3?'Владение у игроков':visibility(place).open?'Доступно игрокам':'Скрыто от игроков'):'');
      tooltip.hidden=false;
      const rect=el.getBoundingClientRect();
      const box=target.getBoundingClientRect();
      const x=(event.clientX ?? box.x+box.width/2)-rect.x+12;
      const y=(event.clientY ?? box.y)-rect.y-36;
      tooltip.style.left=Math.max(8,Math.min(rect.width-tooltip.offsetWidth-8,x))+'px';
      tooltip.style.top=Math.max(8,y)+'px';
    };
    target.onpointerenter=show;target.onpointermove=show;
    target.onpointerleave=()=>{tooltip.hidden=true;};
    target.onfocus=show;target.onblur=()=>{tooltip.hidden=true;};
  }
  let stopDrawing=()=>{};
  let regions,measure,lastPinClick;
  el.addEventListener('pointerdown',event=>{if(!event.target.closest('.nw-pin'))lastPinClick=null;if(!event.target.closest('.nw-region-picker'))el.querySelector('.nw-region-picker')?.remove();},{capture:true});
  viewport.addEventListener('wheel',()=>el.querySelector('.nw-region-picker')?.remove(),{capture:true});
  const regionHint=document.createElement('small');regionHint.className='nw-region-hint';regionHint.textContent='Alt+щелчок или ПКМ по области — выбор перекрывающихся территорий.';manager.querySelector('[data-new-region]').after(regionHint);
  const toolPanels=[...el.querySelectorAll('.nw-tools details')];
  for(const panel of toolPanels) panel.addEventListener('toggle',()=>{
    if(panel.open) for(const other of toolPanels) if(other!==panel) other.open=false;
  });
  const editMarker=place=>pointSettings(place,baseMap).catch(error=>ui.notifications.error(tr(error.message)));
  const matchesPeriod=place=>periodFilter.value==='all' ||
    (periodFilter.value==='hide' ? place.period?.status!=='historical' : place.period?.status==='historical');
  function choose(place,{center=false,reveal=false}={}) {
    if(sidebarCollapsed)sidebar(false);
    if(selectedId!==place.id) history.push({
      selectedId,query:input.value,category:select.value,period:periodFilter.value,
      view:map.snapshot(),scroll:find('aside').scrollTop
    });
    if(reveal) {
      input.value='';select.value='all';
      if(!matchesPeriod(place)) periodFilter.value='all';
    }
    selectedId=place.id;placing=false;placingCharacter=null;render();
    find('aside').scrollTop=0;
    if(center && (place.isCustom || baseMap===bundledMap)) map.centerOn(place.x,place.y);
  }
  async function removeTerritory(place) {
    const title=place.area?'Удалить территорию':'Убрать контур';
    if(await confirmUI({window:{title},content:'<p>'+title+' «'+nameFor(place,language).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')+'»?</p>'})) {
      if(regions.activeId()===place.id)regions.stop();
      if(place.area) await removePoint(place.id,baseMap);else await patchPoint(place,baseMap,{shape:null});
    }
  }
  function renderTerritoryList() {
    const list=find('[data-region-list]');list.replaceChildren();
    if(!game.user.isGM) return;
    const areas=places().filter(place=>place.area || place.shape?.points?.length>=3);
    if(!areas.length) {list.textContent='Территорий пока нет';return;}
    for(const place of areas) {
      const row=document.createElement('div');row.className='nw-region-row';row.dataset.regionRow=place.id;
      const chooseButton=document.createElement('button');chooseButton.dataset.selectRegion=place.id;
      chooseButton.textContent=nameFor(place,language);chooseButton.title='Открыть территорию';
      chooseButton.onclick=async()=>{if(!regions.active())choose(place,{center:true,reveal:true});else await regions.start(place,()=>choose(place,{center:true,reveal:true}));};
      const edit=document.createElement('button');edit.dataset.editRegion=place.id;edit.innerHTML='<i class="fas fa-pen"></i>';edit.title='Изменить границу';
      edit.onclick=()=>regions.start(place,()=>choose(place,{center:true,reveal:true}));
      const toggle=document.createElement('button');toggle.dataset.toggleRegion=place.id;toggle.disabled=!place.shape;
      toggle.innerHTML='<i class="fas '+(place.shape?.hidden?'fa-eye-slash':'fa-eye')+'"></i>';toggle.title=place.shape?.hidden?'Показать контур':'Скрыть контур';
      toggle.onclick=()=>patchPoint(place,baseMap,{shape:{...place.shape,hidden:!place.shape.hidden}}).catch(error=>ui.notifications.error(tr(error.message)));
      const remove=document.createElement('button');remove.dataset.removeRegion=place.id;remove.innerHTML='<i class="fas fa-trash"></i>';remove.title=place.area?'Удалить территорию':'Убрать контур';
      remove.onclick=()=>removeTerritory(place).catch(error=>ui.notifications.error(tr(error.message)));
      for(const button of [edit,toggle,remove])button.setAttribute('aria-label',button.title+' — '+nameFor(place,language));
      row.append(chooseButton,edit,toggle,remove);list.append(row);
    }
  }
  function render() {
    if(!canViewMap()) {el.close();return;}
    if(stage.dataset.gesture) return;
    const t=labels[language];
    tooltip.hidden=true;
    find('[data-settings]').hidden=!game.user.isGM;
    find('[data-add]').hidden=!game.user.isGM;
    find('.nw-drawing-tools').hidden=!game.user.isGM;
    find('.nw-territory-tools').hidden=!game.user.isGM;
    const title=layerName(layerId,language);find('h2').textContent=title;img.alt=title;
    for(const button of rail.querySelectorAll('button')){const id=button.dataset.layer;button.disabled=!canViewMap(layerMap(id));button.setAttribute('aria-pressed',String(id===layerId));button.querySelector('[data-layer-name]').textContent=layerName(id,language);button.setAttribute('aria-label',layerName(id,language));button.title=layerName(id,language)+' · '+(id==='evernight'?(language==='uk'?'Інший план: Тіньопад':'Другой план: Шадоуфелл'):id==='underground'?(language==='uk'?'Нижній рівень':'Нижний уровень'):title);}
    empty.textContent=language==='uk'?'Підземна карта ще не обрана. Тут буде єдина карта каналізацій, тунелів і печер.':'Подземная карта ещё не выбрана. Здесь будет единая карта канализаций, тоннелей и пещер.';
    if(pending && game.user.isGM){const selectImage=document.createElement('button');selectImage.type='button';selectImage.dataset.layerImage='';selectImage.textContent=language==='uk'?'Обрати готову карту':'Выбрать готовую карту';selectImage.onclick=()=>{const ui=formDialog('Карта канализаций, тоннелей и пещер','<label>Путь к изображению<input name="layerImagePath" required></label><button type="button" data-browse-layer>Выбрать файл</button><small>Новая подложка получает собственные локации и масштаб. После выбора откалибруйте линейку.</small>',async form=>{const path=form.elements.layerImagePath.value.trim();if(!/^(modules|worlds|assets|icons)\//.test(path)||path.includes('..')||/[<>\\\x00-\x1f]/.test(path)||! /\.(jpe?g|png|gif|webp)$/i.test(path))throw Error('Неверный путь к изображению');await game.settings.set(ID,'undergroundMap',path);el.close();setTimeout(()=>openAtlas(),0);});ui.form.querySelector('[data-browse-layer]').onclick=()=>{const Picker=foundry.applications.apps.FilePicker.implementation;new Picker({type:'image',callback:path=>{ui.form.elements.layerImagePath.value=path;}}).render({force:true});};ui.show();};empty.append(selectImage);}
    for(const selector of ['[data-add]','.nw-drawing-tools','.nw-territory-tools','[data-characters]','.nw-ruler-tools'])find(selector).hidden=pending || (!game.user.isGM && ['[data-add]','.nw-drawing-tools','.nw-territory-tools'].includes(selector));
    find('footer small').textContent=placing ? t.place : title+' · 1492 ЛД';
    input.placeholder=t.search;input.setAttribute('aria-label',t.search);
    for(const [selector,label] of [['[data-close]',t.close],['[data-maximize]',t.maximize],['.nw-resize',t.resize]]) find(selector).setAttribute('aria-label',label);
    el.setAttribute('aria-label',title);
    el.querySelectorAll('[data-lang]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.lang===language)));
    const category=select.value || 'all';
    select.replaceChildren(...['all',...Object.keys(icons)].map(key=>new Option(t[key],key)));
    select.value=category;select.setAttribute('aria-label',t.all);
    const period=periodFilter.value || 'all';
    periodFilter.replaceChildren(...[['all',t.periodAll],['hide',t.periodHide],['historical',t.periodHistorical]].map(([key,text])=>new Option(text,key)));
    periodFilter.value=period;periodFilter.setAttribute('aria-label',t.periodLabel);
    find('[data-back]').textContent='← '+t.back;
    find('[data-back]').disabled=!history.length;
    find('[data-add]').textContent=placing ? (language==='uk'?'Скасувати':'Отмена') : '+ '+t.add;
    find('[data-add]').setAttribute('aria-pressed',String(placing));
    viewport.classList.toggle('nw-placing',placing || Boolean(placingCharacter));
    const nav=find('nav');nav.replaceChildren();
    const selectedAccuracy=accuracy.value || 'all';accuracy.replaceChildren(...[['all',language==='uk'?'Точність: усі':'Точность: все'],['confirmed',language==='uk'?'Підтверджена прив’язка':'Подтверждённая привязка'],['overview',language==='uk'?'Оглядова позначка':'Обзорная метка'],['unverified',language==='uk'?'Потребує звірки':'Требует сверки'],['custom',language==='uk'?'Власні локації':'Свои локации']].map(([key,text])=>new Option(text,key)));accuracy.value=selectedAccuracy;
    stage.querySelectorAll('.nw-pin').forEach(pin=>pin.remove());
    const query=normalize(input.value);
    const visible=places().filter(place=>matchesPeriod(place) && (selectedAccuracy==='all'||(selectedAccuracy==='custom'?place.isCustom:(place.position?.status ?? (place.isCustom?'custom':'unverified'))===selectedAccuracy)) && (category==='all'||place.category===category) &&
      [place.en,place.ru.name,place.uk.name,place.ru.services ?? '',place.uk.services ?? '',place.ru.organizations ?? '',place.uk.organizations ?? '',...place.aliases].some(text=>normalize(text).includes(query)));
    const selected=visible.find(place=>place.id===selectedId);
    find('[data-outline-selected]').disabled=!selected;
    find('[data-outline-selected]').textContent=selected?'Контур — '+nameFor(selected,language):'Выберите локацию на карте';
    renderTerritories(stage,find('[data-show-regions]').checked?visible:[],place=>choose(place),showTooltip,place=>nameFor(place,language),commitLabelMove);
    renderDrawings(stage,baseMap);
    renderCharacters(stage,baseMap,actions);
    stopDrawing.refresh?.();
    renderTerritoryList();
    const defaults=mapState(baseMap);
    for(const place of visible) {
      const name=nameFor(place,language);
      if((place.keepMarker || !(place.area || place.territoryOnly || place.shape?.points?.length>=3)) && (place.isCustom || baseMap===bundledMap) && Number.isFinite(place.x) && Number.isFinite(place.y)) {
        const pin=document.createElement('button');
        pin.className='nw-pin'+(place.document?' nw-custom':'')+(place.period?.status==='historical'?' nw-historical':'');
        pin.dataset.place=place.id;
        pin.style.left=place.x+'%';pin.style.top=place.y+'%';
        const color=/^#[0-9a-f]{6}$/i.test(place.color ?? '')?place.color:defaults.color;
        pin.style.setProperty('--nw-pin-color',color);
        pin.dataset.baseSize=String(Math.max(20,Math.min(96,Number(place.size || defaults.size) || 34)));
        pin.style.setProperty('--nw-pin-size',pin.dataset.baseSize+'px');
        pin.innerHTML='<i class="fas fa-'+(icons[place.category] || icons.landmark)+'" aria-hidden="true"></i>';
        if(place.asset) {
          const asset=document.createElement('img');asset.src=foundry.utils.getRoute(place.asset);asset.alt='';asset.draggable=false;
          asset.onload=()=>pin.classList.add('nw-asset');
          asset.onerror=()=>{pin.classList.remove('nw-asset');asset.remove();};pin.append(asset);
        }
        pin.setAttribute('aria-label',name);showTooltip(pin,place);
        if(game.user.isGM) {
          const state=visibility(place);
          const badge=document.createElement('i');badge.className='fas fa-eye nw-access-icon';badge.dataset.access=state.level>=3?'owner':state.open?'view':'none';
          badge.title=(state.level>=3?'Владение у игроков':state.open?'Доступно игрокам':'Скрыто от игроков')+(state.names.length?' — '+state.names.join(', '):'');
          pin.dataset.visibility=state.open?'open':'hidden';
          pin.append(badge);
        }
        if(canMove(place)) draggablePin(pin,place,baseMap,error=>ui.notifications.error(tr(error.message)),commitMove);
        pin.setAttribute('aria-pressed',String(place.id===selectedId));
        pin.onclick=event=>{
          event.stopPropagation();
          if(canEditLocation(place) && event.detail>0 && lastPinClick?.id===place.id && performance.now()-lastPinClick.at<400 && Math.hypot(event.clientX-lastPinClick.x,event.clientY-lastPinClick.y)<6) {lastPinClick=null;editMarker(place);return;}
          lastPinClick=event.detail>0?{id:place.id,at:performance.now(),x:event.clientX,y:event.clientY}:null;choose(place);
        };
        pin.ondblclick=event=>{event.stopPropagation();if(canEditLocation(place) && !document.querySelector('.nw-settings'))editMarker(place);};
        stage.append(pin);
      }
    }
    map?.refreshPins();
    listed=visible;refreshList();
    const card=find('article');card.replaceChildren();card.hidden=!selected;
    if(!selected) return;
    const page=selected.document ? selected.document.pages.contents[0] :
      game.user.isGM && !selected.area ? books.get(language).pages.find(page=>page.getFlag(ID,'key')===selected.id) : undefined;
    const heading=document.createElement('h3');heading.textContent=nameFor(selected,language);
    const summary=document.createElement('p');summary.className='nw-summary';
    const parsed=new DOMParser().parseFromString(page?.text?.content ?? '','text/html');
    summary.textContent=selected.document ? parsed.body.innerText : page?parsed.querySelector('p')?.textContent:selected[language].lore;
    const button=document.createElement('button');button.textContent=t.full;
    button.onclick=()=>{
      if(selected.document || (game.user.isGM && !selected.area)) (selected.document ?? books.get(language)).sheet.render({force:true,pageId:page?.id,mode:1});
      else {
        const reader=document.createElement('dialog');reader.className='nw-point-editor nw-public-reader';
        const heading=document.createElement('h2');heading.textContent=nameFor(selected,language);
        const text=document.createElement('p');text.textContent=selected[language].lore ?? '';
        const close=document.createElement('button');close.textContent=t.close;close.onclick=()=>reader.close();
        reader.append(heading,text,close);reader.onclose=()=>reader.remove();showFloatingDialog(reader);
      }
    };
    card.append(heading,summary,button);
    const era=document.createElement('p');era.className='nw-era';
    era.textContent=selected.isCustom ? t.own : t.periodLabel+' — '+(selected.period?.[language] ?? t.own);
    card.insertBefore(era,summary);
    const position=document.createElement('p');position.className='nw-position-status';position.dataset.precision=selected.position?.status ?? (selected.isCustom?'custom':'unverified');
    const positionNames=language==='uk'?{confirmed:'Підтверджена прив’язка',overview:'Оглядова позначка',unverified:'Потребує звірки',custom:'Власна локація'}:{confirmed:'Подтверждённая привязка',overview:'Обзорная метка',unverified:'Требует сверки',custom:'Своя локация'};
    position.textContent=positionNames[position.dataset.precision]+(selected.position?.[language]?' — '+selected.position[language]:'');card.insertBefore(position,summary);
    if(selected.position?.source && /^https:\/\//.test(selected.position.source)){const source=document.createElement('a');source.href=selected.position.source;source.target='_blank';source.rel='noopener noreferrer';source.textContent=language==='uk'?'Джерело прив’язки':'Источник привязки';source.dataset.positionSource='';card.insertBefore(source,summary);}
    if(game.user.isGM) {
      const state=visibility(selected);
      const access=document.createElement('p');access.className='nw-access-status';
      access.textContent=state.open?(state.level>=3?'◉ Владение у игроков':'◉ Доступно игрокам')+(state.names.length?' — '+state.names.join(', '):''):'◌ Скрыто от игроков';
      const settings=document.createElement('button');settings.dataset.pointSettings='';settings.textContent=!selected.keepMarker && (selected.area || selected.territoryOnly || selected.shape?.points?.length>=3)?'Текст и доступ территории':'Вид значка и доступ';
      settings.onclick=()=>editMarker(selected);
      card.append(access,settings);
      const precision=document.createElement('button');precision.dataset.editPosition='';precision.textContent=language==='uk'?'Точність розташування':'Точность расположения';precision.onclick=()=>positionSettings(selected,baseMap);card.append(precision);

    }
    else if(canEditLocation(selected)){const settings=document.createElement('button');settings.dataset.pointSettings='';settings.textContent=language==='uk'?'Оформлення та публічний текст':'Оформление и публичный текст';settings.onclick=()=>editMarker(selected);card.append(settings);}
    if(selected[language].details) {
      const details=document.createElement('p');
      details.className='nw-period';
      details.textContent=selected[language].details;
      card.insertBefore(details,button);
    }
    if(selected[language].services) {
      const services=document.createElement('p');
      services.className='nw-services';
      services.textContent=(language==='uk'?'Послуги — ':'Услуги — ')+selected[language].services;
      card.insertBefore(services,card.querySelector('.nw-period') ?? button);
    }
    if(selected[language].organizations) {
      const group=document.createElement('section');group.className='nw-organizations';
      const title=document.createElement('h4');title.textContent=language==='uk'?'Організації та 1492 рік':'Организации и 1492 год';
      const text=document.createElement('p');text.textContent=selected[language].organizations;
      group.append(title,text);card.insertBefore(group,button);
    }
    const allPlaces=places();
    function connections(title,targets,kind) {
      if(!targets.length) return;
      const group=document.createElement('section');group.className='nw-connections';
      group.dataset.connections=kind;
      const heading=document.createElement('h4');heading.textContent=title;group.append(heading);
      for(const target of targets) {
        const link=document.createElement('button');
        link.type='button';link.dataset.go=target.id;link.textContent=nameFor(target,language);
        link.onclick=()=>choose(target,{center:true,reveal:true});
        group.append(link);
      }
      card.append(group);
    }
    const district=allPlaces.find(place=>place.id===selected.district);
    connections(t.districtLabel,district ? [district] : [],'district');
    if(selected.district && !district && game.user.isGM) {
      const missing=document.createElement('p');missing.className='nw-district-missing';
      missing.textContent=language==='uk'?'Обраний район недоступний. Змініть його в редакторі локації.':'Выбранный район недоступен. Измените его в редакторе локации.';card.append(missing);
    }
    const related=allPlaces.filter(place=>(selected.related ?? []).includes(place.id) && place.id!==selected.district && matchesPeriod(place));
    connections(t.related,related,'related');
    if(selected.category==='district') connections(t.districtPlaces,allPlaces.filter(place=>place.district===selected.id && matchesPeriod(place)),'members');
    if(selected.document && game.user.isGM) {
      const edit=document.createElement('button');edit.textContent=t.edit;edit.dataset.edit='';
      edit.onclick=()=>editPoint({point:selected,map:baseMap,language,categories:Object.fromEntries(Object.keys(icons).map(key=>[key,t[key]])),districts:districtOptions()});
      const remove=document.createElement('button');remove.textContent=t.remove;remove.dataset.delete='';
      remove.onclick=async()=>{
        if(await confirmUI({window:{title:t.remove},content:'<p>'+t.confirm+'</p>'})) {
          try {await removePoint(selected.id,baseMap);await selected.document.delete();} catch(error) {ui.notifications.error(tr(error.message));}
        }
      };
      card.append(edit,remove);
    }

  }
  function refreshList(){
    const nav=find('nav');nav.replaceChildren();const global=Boolean(input.value.trim()),inFrame=global?listed:listed.filter(place=>inViewport(place,stage,viewport));
    for(const place of inFrame){const button=document.createElement('button');button.textContent=nameFor(place,language);button.dataset.listPlace=place.id;button.setAttribute('aria-pressed',String(place.id===selectedId));button.onclick=()=>choose(place,{center:true});nav.append(button);}
    if(!inFrame.length)nav.textContent=language==='uk'?'У цій області локацій немає':'В этой области локаций нет';
    count.textContent=global?(language==='uk'?'Пошук у всьому місті: ':'Поиск по всему городу: ')+inFrame.length:(language==='uk'?'У кадрі: ':'В кадре: ')+inFrame.length+' / '+listed.length;
  }
  viewport.addEventListener('nw-view-change',()=>{refreshList();measure?.refresh();});
  viewport.addEventListener('nw-redraw',render);
  el.querySelectorAll('[data-lang]').forEach(button=>button.onclick=async()=>{
    language=button.dataset.lang;render();await game.settings.set(ID,'language',language);measure?.refresh();
  });
  select.onchange=render;accuracy.onchange=render;input.oninput=()=>{lastPinClick=null;render();};periodFilter.onchange=render;
  find('[data-back]').onclick=()=>{
    const previous=history.pop();
    if(!previous) return;
    selectedId=previous.selectedId;placing=false;placingCharacter=null;input.value=previous.query;select.value=previous.category;periodFilter.value=previous.period;
    render();map.restore(previous.view);find('aside').scrollTop=previous.scroll;
  };
  find('[data-settings]').onclick=()=>mapSettings(baseMap).catch(error=>ui.notifications.error(tr(error.message)));
  characterButton.onclick=()=>characterTools(baseMap,actorId=>{stopDrawing();measure.stop();regions.stop();placing=false;placingCharacter=null;placingCharacter=actorId;viewport.classList.add('nw-placing');find('footer small').textContent=language==='uk'?'Клацніть на мапі, щоб поставити персонажа':'Щёлкните по карте, чтобы поставить персонажа';},record=>{map.centerOn(record.x,record.y);const token=stage.querySelector('[data-character="'+record.actorId+'"]');token?.focus({preventScroll:true});token?.animate([{outline:'4px solid #248fc7'},{outline:'0px solid transparent'}],{duration:1500});});
  find('[data-add]').onclick=()=>{stopDrawing();measure.stop();regions.stop();placing=!placing;render();};
  find('[data-territories]').onclick=()=>{if(game.user.isGM)showFloatingDialog(manager);};
  find('[data-new-region]').onclick=()=>regions.create();
  find('[data-outline-selected]').onclick=()=>{const place=places().find(p=>p.id===selectedId);if(place)regions.start(place);};
  find('[data-show-regions]').onchange=render;
  stage.onclick=event=>{
    if(placingCharacter && !event.target.closest('button')){const [x,y]=map.point(event.clientX,event.clientY);if(x>=0&&x<=100&&y>=0&&y<=100){const id=placingCharacter;placingCharacter=null;viewport.classList.remove('nw-placing');changeCharacter(baseMap,'place',id,x,y).catch(error=>ui.notifications.error(tr(error.message)));}return;}
    if(!placing || event.target.closest('button')) return;
    const [x,y]=map.point(event.clientX,event.clientY);
    if(x<0 || y<0 || x>100 || y>100) return;
    placing=false;render();
    editPoint({map:baseMap,x,y,language,categories:Object.fromEntries(Object.keys(icons).map(key=>[key,labels[language][key]])),districts:districtOptions()});
  };
  el.querySelectorAll('[data-zoom]').forEach(button=>button.onclick=()=>map.zoomBy(Number(button.dataset.zoom)*.5));
  find('[data-close]').onclick=()=>el.close();
  el.onkeydown=event=>{
    event.stopPropagation();
    if((event.ctrlKey || event.metaKey) && (event.code==='KeyZ' || event.key.toLowerCase()==='z') && !event.target.closest('input,textarea,select,[contenteditable=true]')) {
      event.preventDefault();
      if(regions.active()) regions.undo();else actions.undo(undefined,game.user.isGM?stopDrawing.undoExisting:undefined).catch(error=>ui.notifications.error(tr(error.message)));
    }
    if(event.key==='Escape') {
      event.preventDefault();
      if(regions.active())regions.stop();else if(measure.active())measure.stop();else if(stopDrawing.active?.())stopDrawing();else if(placing || placingCharacter) {placing=false;placingCharacter=null;render();} else el.close();
    }
  };
  const hooks=['updateActor','deleteActor','createActor','createJournalEntry','updateJournalEntry','deleteJournalEntry','createJournalEntryPage','updateJournalEntryPage','deleteJournalEntryPage','updateSetting'].map(hook=>[hook,Hooks.on(hook,()=>{if(el.isConnected) render();})]);
  render();document.body.append(el);watchUI(el,()=>language);atlas=el;el.show();
  const cleanupWindow=configureWindow(el,game.settings.get(ID,'window'),rect=>{
    game.settings.set(ID,'window',rect).catch(error=>ui.notifications.error(tr(error.message)));
  });
  map=configureMap(viewport,stage,img,find('footer output'),layerId==='city'?game.settings.get(ID,'view'):game.settings.get(ID,'layerViews')[layerId]);
  regions=regionEditor(el,stage,viewport,baseMap,()=>map,()=>{stopDrawing();measure.stop();placing=false;placingCharacter=null;},manager);
  manager.addEventListener('close',()=>regions.stop());
  manager.addEventListener('keydown',event=>{
    if((event.ctrlKey || event.metaKey) && event.code==='KeyZ' && !event.target.closest('input,textarea,select') && regions.active()) {event.preventDefault();regions.undo();}
  });
  viewport.addEventListener('contextmenu',event=>{event.preventDefault();event.stopPropagation();if(!event.target.closest('[data-zone],.nw-pin,.nw-region-label,.nw-character,.nw-vertex,.nw-midpoint') && !regions.active()){selectedId=undefined;lastPinClick=null;render();}});
  measure=ruler(el,stage,viewport,img,baseMap,()=>map,()=>{stopDrawing();regions.stop();placing=false;placingCharacter=null;render();});
  if(game.user.isGM) {
    stopDrawing=drawingTools(stage,viewport,baseMap,()=>map,find('.nw-drawing-tools'),actions);
    stopDrawing.refresh();
    find('[data-draw]').addEventListener('click',()=>{measure.stop();regions.stop();placing=false;placingCharacter=null;render();});
  }
  el.onclose=()=>{
    (layerId==='city'?game.settings.set(ID,'view',map.snapshot()):game.settings.set(ID,'layerViews',{...game.settings.get(ID,'layerViews'),[layerId]:map.snapshot()})).catch(error=>ui.notifications.error(tr(error.message)));
    game.settings.set(ID,'periodFilter',periodFilter.value).catch(error=>ui.notifications.error(tr(error.message)));
    stopDrawing();regions.stop();measure.destroy();manager.close();manager.remove();map.destroy();cleanupWindow();
    hooks.forEach(([hook,handle])=>Hooks.off(hook,handle));
    el.remove();atlas=null;
  };
  input.focus();
}
Hooks.once('init',()=>{
  registerState();
  registerCharacters();
  for(const [key,type,value] of [['activeLayer',String,'city'],['layerViews',Object,{}],['language',String,'ru'],['window',Object,{}],['view',Object,{}],['sidebarCollapsed',Boolean,false],['rulerPreferences',Object,{}]]) {
    game.settings.register(ID,key,{scope:'client',config:false,type,default:value});
  }
  game.keybindings.register(ID,'openAtlas',{
    name:tr('Neverwinter: City Map — открыть карту'),
    hint:tr('Открыть атлас Невервинтера. Клавишу можно изменить здесь.'),
    editable:[{key:'KeyM'}],
    restricted:false,
    repeat:false,
    onDown:context=>{
      if(context.event?.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return false;
      if(!layerIds.some(id=>canViewMap(layerMap(id)))) return false;
      openAtlas();
      return true;
    }
  });

  game.settings.register(ID,'periodFilter',{scope:'client',config:false,type:String,default:'all'});
  game.settings.register(ID,'controlIds',{scope:'world',config:false,type:Object,default:{}});
  for(const [key,name]of [['evernightMap','Карта Эвернайта'],['undergroundMap','Карта канализаций, тоннелей и пещер']])game.settings.register(ID,key,{name:tr(name),hint:tr('Выберите файл в данных Foundry.'),scope:'world',config:true,type:String,filePicker:'image',default:''});
  game.settings.register(ID,'baseMap',{name:tr('Официальная карта Невервинтера'),hint:tr('Выберите файл в данных Foundry.'),scope:'world',config:true,type:String,filePicker:'image',default:''});
});
const journalRoots=new Set();
function launchButton(element) {
  element.querySelector('.nw-launch')?.remove();
  if(!layerIds.some(id=>canViewMap(layerMap(id)))) return;
  const button=document.createElement('button');
  button.type='button';button.className='nw-launch';
  button.innerHTML='<i class="fas fa-map"></i> Neverwinter: City Map';
  button.onclick=openAtlas;
  (element.querySelector('.directory-header') || element).prepend(button);
}
Hooks.on('renderJournalDirectory',(app,element)=>{journalRoots.add(element);launchButton(element);});
for(const hook of ['createJournalEntry','updateJournalEntry','deleteJournalEntry','updateSetting']) Hooks.on(hook,()=>{
  for(const element of journalRoots) {
    if(element.isConnected) launchButton(element);else journalRoots.delete(element);
  }
});
