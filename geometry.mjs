import {confirmUI,tr} from './i18n.mjs';
import {formDialog} from './access.mjs';
import {showFloatingDialog} from './window.mjs';
import {BUNDLED_MAP,mapState,patchPoint,removePoint,updateMap,copy} from './state.mjs';
import {labelDefaults,applyLabelStyle} from './label-style.mjs';
import {distanceText,walkingText} from './travel.mjs';
const NS='http://www.w3.org/2000/svg';
function svg(stage,cls) {
  const element=document.createElementNS(NS,'svg');element.classList.add(cls);
  element.setAttribute('viewBox','0 0 100 100');element.setAttribute('preserveAspectRatio','none');stage.append(element);
  return element;
}
const pathFor=points=>points.map(([x,y],i)=>(i?'L':'M')+x+','+y).join(' ');
export function regionEditor(el,stage,viewport,map,getMap,onMode,manager) {
  const panel=document.createElement('section');panel.className='nw-region-editor';panel.hidden=true;
  panel.innerHTML='<strong></strong><span>Щелчок — вершина · потяните вершину · + на ребре — вставить · ПКМ по вершине — удалить</span><label>Цвет <input name="regionColor" type="color"></label><label>Заливка <input name="opacity" type="range" min="0" max="0.6" step="0.01"></label><label><input name="hidden" type="checkbox">Скрыть контур</label><button data-region-save>Сохранить контур</button><button data-region-redraw>Обвести заново</button><button data-region-remove>Убрать контур</button><button data-region-cancel>Отмена</button>';
  manager.querySelector('[data-region-editor-host]').append(panel);
  const metadata=document.createElement('div');metadata.className='nw-region-metadata';
  metadata.innerHTML='<label>Название RU<input name="areaRu" required maxlength="160"></label><label>Назва UA<input name="areaUk" required maxlength="160"></label><label>English name<input name="areaEn" required maxlength="160"></label><label>Тип<select name="areaCategory"><option value="district">Район</option><option value="water">Водоём</option><option value="landmark">Область</option></select></label>';
  panel.querySelector('strong').after(metadata);
  const presentation=document.createElement('fieldset');presentation.className='nw-region-presentation';
  presentation.innerHTML='<legend>Порядок и подпись</legend><label>Порядок наложения<input name="regionOrder" type="number" min="-100" max="100" step="1" value="0"></label><small>Большее число — выше. При равном порядке небольшие области располагаются выше крупных. Alt+щелчок или ПКМ по области открывает выбор территорий в этой точке.</small><label><input name="regionLabelEnabled" type="checkbox">Показывать подпись на карте</label><label>Кому видна подпись<select name="regionLabelAudience"><option value="all">Всем с доступом к территории</option><option value="gm">Только ведущему</option></select></label><label>Размер подписи, px<input name="regionLabelSize" type="number" min="10" max="36" value="16"></label><label>Положение X, %<input name="regionLabelX" type="number" min="0" max="100" step="0.01"></label><label>Положение Y, %<input name="regionLabelY" type="number" min="0" max="100" step="0.01"></label>';
  metadata.after(presentation);
  const appearance=document.createElement('div');appearance.className='nw-label-appearance';
  appearance.innerHTML='<label>Цвет текста<span class="nw-colors"><input name="regionLabelColor" type="color"><input name="regionLabelColorHex" aria-label="Код цвета текста" maxlength="7" pattern="#[0-9a-fA-F]{6}"></span></label><label>Цвет фона<span class="nw-colors"><input name="regionLabelBackground" type="color"><input name="regionLabelBackgroundHex" aria-label="Код цвета фона" maxlength="7" pattern="#[0-9a-fA-F]{6}"></span></label><label>Цвет рамки<span class="nw-colors"><input name="regionLabelBorder" type="color"><input name="regionLabelBorderHex" aria-label="Код цвета рамки" maxlength="7" pattern="#[0-9a-fA-F]{6}"></span></label><label>Непрозрачность фона<input name="regionLabelOpacity" type="range" min="0" max="1" step="0.05"></label><output class="nw-region-label-preview" aria-label="Предпросмотр подписи"></output><small>Ведущий может перетащить подпись на самой карте. Контур и значок локации остаются на месте. Ctrl+Z отменяет перемещение подписи.</small>';
  presentation.append(appearance);
  let place,points=[],layer,handles,undo=[],changed=false,switching=false,anchorTouched=false;
  const fields=panel.querySelectorAll('input,select');
  const color=panel.querySelector('[name=regionColor]'),opacity=panel.querySelector('[name=opacity]'),hidden=panel.querySelector('[name=hidden]');
  function remember(){undo.push(copy(points));changed=true;}
  function paint() {
    layer?.remove();handles?.remove();
    if(!place) return;
    const preview=appearance.querySelector('output');preview.textContent=place[game.settings.get('neverwinter-atlas','language')].name+(place.omitEnglish?'':' ('+place.en+')');
    applyLabelStyle(preview,{size:Number(presentation.querySelector('[name=regionLabelSize]').value),color:appearance.querySelector('[name=regionLabelColor]').value,background:appearance.querySelector('[name=regionLabelBackground]').value,border:appearance.querySelector('[name=regionLabelBorder]').value,backgroundOpacity:Number(appearance.querySelector('[name=regionLabelOpacity]').value)});
    if(place.area && !mapState(map).points[place.id] && !anchorTouched && points.length>=3){for(const [field,index]of [['regionLabelX',0],['regionLabelY',1]])presentation.querySelector('[name='+field+']').value=(points.reduce((sum,p)=>sum+p[index],0)/points.length).toFixed(2);}
    manager.querySelectorAll('[data-region-row]').forEach(row=>row.dataset.editing=String(row.dataset.regionRow===place.id));
    layer=svg(stage,'nw-region-draft');
    const polygon=document.createElementNS(NS,'polygon');
    polygon.setAttribute('points',points.map(p=>p.join(',')).join(' '));polygon.setAttribute('fill',color.value);
    polygon.setAttribute('stroke',color.value);polygon.style.fillOpacity=opacity.value;
    polygon.setAttribute('vector-effect','non-scaling-stroke');layer.append(polygon);
    handles=document.createElement('div');handles.className='nw-region-handles';stage.append(handles);
    function handle(position,index,midpoint=false) {
      const button=document.createElement('button');button.type='button';
      button.className=midpoint?'nw-midpoint':'nw-vertex';button.dataset.vertex=String(index);
      button.setAttribute('aria-label',(midpoint?'Добавить вершину ':'Вершина ')+(index+1));
      Object.assign(button.style,{left:position[0]+'%',top:position[1]+'%'});
      if(midpoint) {
        button.textContent='+';
        button.onclick=event=>{event.stopPropagation();remember();points.splice(index+1,0,position);paint();};
      } else {
        button.oncontextmenu=event=>{event.preventDefault();event.stopPropagation();if(points.length>3){remember();points.splice(index,1);paint();}};
        button.onpointerdown=event=>{
          if(event.button!==0) return;
          event.preventDefault();event.stopPropagation();remember();button.setPointerCapture(event.pointerId);
          button.onpointermove=move=>{
            const point=getMap().point(move.clientX,move.clientY).map(v=>Math.max(0,Math.min(100,v)));
            points[index]=point;button.style.left=point[0]+'%';button.style.top=point[1]+'%';
            polygon.setAttribute('points',points.map(p=>p.join(',')).join(' '));
          };
          const finish=()=>{button.onpointermove=null;button.onpointerup=null;button.onpointercancel=null;if(button.hasPointerCapture(event.pointerId))button.releasePointerCapture(event.pointerId);paint();};
          button.onpointerup=finish;button.onpointercancel=finish;
        };
        button.onclick=event=>event.stopPropagation();
      }
      handles.append(button);
    }
    points.forEach((point,index)=>{
      handle(point,index);
      if(points.length>=3) {const next=points[(index+1)%points.length];handle([(point[0]+next[0])/2,(point[1]+next[1])/2],index,true);}
    });
    panel.querySelector('[data-region-save]').disabled=points.length<3;
  }
  function stop() {
    place=null;points=[];undo=[];changed=false;layer?.remove();handles?.remove();panel.hidden=true;
    manager.querySelectorAll('[data-region-row]').forEach(row=>delete row.dataset.editing);
    delete stage.dataset.gesture;viewport.classList.remove('nw-editing-region');
    stage.dispatchEvent(new CustomEvent('nw-redraw',{bubbles:true}));
  }
  async function start(target,select) {
    if(!game.user.isGM || switching) return false;
    if(place?.id===target.id)return true;
    if(place && changed) {
      switching=true;
      try {
        if(!await confirmUI({window:{title:'Несохранённая территория'},content:'<p>Отбросить несохранённые изменения и перейти к другой территории?</p>'}))return false;
      }finally{switching=false;}
    }
    stop();select?.();onMode();place=target;points=copy(target.shape?.points ?? []);undo=[];anchorTouched=false;
    el.querySelectorAll('.nw-tools details').forEach(panel=>{panel.open=false;});
    showFloatingDialog(manager);
    color.value=target.shape?.color || '#658d64';opacity.value=target.shape?.opacity ?? .15;hidden.checked=Boolean(target.shape?.hidden);
    metadata.hidden=!target.area;
    const label=target.regionLabel ?? {};
    presentation.querySelector('[name=regionOrder]').value=target.regionOrder ?? 0;
    presentation.querySelector('[name=regionLabelEnabled]').checked=Boolean(label.enabled);
    presentation.querySelector('[name=regionLabelAudience]').value=label.audience ?? 'all';
    presentation.querySelector('[name=regionLabelSize]').value=label.size ?? 16;
    presentation.querySelector('[name=regionLabelX]').value=Number(label.x ?? target.x).toFixed(2);
    presentation.querySelector('[name=regionLabelY]').value=Number(label.y ?? target.y).toFixed(2);
    for(const [field,key]of [['regionLabelColor','color'],['regionLabelBackground','background'],['regionLabelBorder','border'],['regionLabelOpacity','backgroundOpacity']])appearance.querySelector('[name='+field+']').value=label[key] ?? labelDefaults[key];
    for(const stem of ['Color','Background','Border'])appearance.querySelector('[name=regionLabel'+stem+'Hex]').value=appearance.querySelector('[name=regionLabel'+stem+']').value;
    for(const [field,value]of Object.entries({areaRu:target.ru.name,areaUk:target.uk.name,areaEn:target.en,areaCategory:target.category}))metadata.querySelector('[name='+field+']').value=value;
    panel.querySelector('strong').textContent=target[game.settings.get('neverwinter-atlas','language')].name;panel.hidden=false;
    stage.dataset.gesture='shape';viewport.classList.add('nw-editing-region');paint();return true;
  }
  panel.querySelector('[data-region-cancel]').onclick=stop;
  panel.querySelector('[data-region-redraw]').onclick=()=>{remember();points=[];paint();};
  panel.querySelector('[data-region-remove]').onclick=async()=>{
    try {await patchPoint(place,map,{shape:null});stop();}catch(error){ui.notifications.error(tr(error.message));}
  };
  panel.querySelector('[data-region-save]').onclick=async()=>{
    if(points.length<3) return;
    const button=panel.querySelector('[data-region-save]');button.disabled=true;
    try {
      const value=name=>presentation.querySelector('[name='+name+']').value;
      const order=Number(value('regionOrder')),size=Number(value('regionLabelSize')),x=Number(value('regionLabelX')),y=Number(value('regionLabelY'));
      if(!Number.isInteger(order)||order<-100||order>100||size<10||size>36||!Number.isFinite(size)||[x,y].some(n=>!Number.isFinite(n)||n<0||n>100))throw Error('Проверьте порядок, размер и положение подписи');
      for(const stem of ['Color','Background','Border'])if(!/^#[\da-f]{6}$/i.test(value('regionLabel'+stem+'Hex')))throw Error('Введите цвет подписи в формате #RRGGBB');
      const backgroundOpacity=Number(value('regionLabelOpacity'));
      if(!Number.isFinite(backgroundOpacity)||backgroundOpacity<0||backgroundOpacity>1)throw Error('Проверьте непрозрачность фона подписи');
      const patch={shape:{points:copy(points),color:color.value,opacity:Number(opacity.value),hidden:hidden.checked},regionOrder:order,regionLabel:{enabled:presentation.querySelector('[name=regionLabelEnabled]').checked,audience:value('regionLabelAudience'),size,x,y,color:value('regionLabelColor'),background:value('regionLabelBackground'),border:value('regionLabelBorder'),backgroundOpacity}};
      if(place.area) {
        const value=name=>metadata.querySelector('[name='+name+']').value.trim();
        if(!value('areaRu') || !value('areaUk') || !value('areaEn'))throw Error('Заполните названия RU, UA и English');
        if(place.category==='district' && value('areaCategory')!=='district' &&
          (Object.values(mapState(map).points).some(p=>p.district===place.id) || game.journal.some(j=>j.getFlag('neverwinter-atlas','point')?.district===place.id)))throw Error('Сначала выберите другой район для связанных локаций');
        Object.assign(patch,{ru:{...place.ru,name:value('areaRu')},uk:{...place.uk,name:value('areaUk')},en:value('areaEn'),category:value('areaCategory'),
        x:points.reduce((sum,p)=>sum+p[0],0)/points.length,y:points.reduce((sum,p)=>sum+p[1],0)/points.length});
      }
      await patchPoint(place,map,patch);stop();
    }catch(error){ui.notifications.error(tr(error.message));button.disabled=false;}
  };
  fields.forEach(field=>field.oninput=()=>{changed=true;if(['regionLabelX','regionLabelY'].includes(field.name))anchorTouched=true;paint();});
  for(const stem of ['Color','Background','Border']){const swatch=appearance.querySelector('[name=regionLabel'+stem+']'),hex=appearance.querySelector('[name=regionLabel'+stem+'Hex]');swatch.oninput=()=>{hex.value=swatch.value;changed=true;paint();};hex.oninput=()=>{if(/^#[\da-f]{6}$/i.test(hex.value))swatch.value=hex.value;changed=true;paint();};}
  viewport.addEventListener('click',event=>{
    if(!place || event.target.closest('button')) return;
    event.preventDefault();event.stopImmediatePropagation();
    const point=getMap().point(event.clientX,event.clientY);
    if(point.some(v=>v<0 || v>100)) return;
    remember();points.push(point);paint();
  },{capture:true});
  return {start,stop,active:()=>Boolean(place),activeId:()=>place?.id,undo:()=>{if(undo.length){points=undo.pop();paint();}},
    create:()=>{
      const ui=formDialog('Новая территория','<label>Название RU<input name="ru" required maxlength="160"></label><label>Назва UA<input name="uk" required maxlength="160"></label><label>English name<input name="en" required maxlength="160"></label><label>Тип<select name="category"><option value="district">Район</option><option value="water">Водоём</option><option value="landmark">Область</option></select></label>',async form=>{
        const f=form.elements;
        await start({id:'area-'+foundry.utils.randomID(),area:true,en:f.en.value.trim(),category:f.category.value,
          ru:{name:f.ru.value.trim(),lore:''},uk:{name:f.uk.value.trim(),lore:''},x:50,y:50,aliases:[]});
      });ui.show();
    },remove:id=>removePoint(id,map)};
}
// The printed 0–1000 ft bar spans approximately 625 pixels on the 3200px base.
// Calibration remains editable, and is required for a replacement map.
const printedScale={a:[9.75,95.62],b:[29.28125,95.62],feet:1000};
export function ruler(el,stage,viewport,img,map,getMap,onMode) {
  const tools=el.querySelector('.nw-ruler-tools'),button=tools.querySelector('[data-ruler]'),output=tools.querySelector('[data-distance]');
  const preferences={mode:'free',color:'#197fc0',pace:'normal',speed:300,...copy(game.settings.get('neverwinter-atlas','rulerPreferences'))};
  const mode=tools.querySelector('[name=rulerMode]');mode.value=preferences.mode;mode.prepend(mode.querySelector('[value=free]'));
  const settings=document.createElement('section');settings.className='nw-ruler-preferences';
  settings.innerHTML='<label>Цвет маршрута<span class="nw-colors"><input type="color" name="rulerColor"><input name="rulerColorHex" aria-label="Код цвета маршрута" maxlength="7"></span></label><label>Темп<select name="travelPace"><option value="slow">Медленный</option><option value="normal">Нормальный</option><option value="fast">Быстрый</option><option value="custom">Своя скорость</option></select></label><label>Скорость, фут/мин<input name="travelSpeed" type="number" min="1" max="10000"></label><small>Время пешком без остановок. Расчёт по скорости в футах за минуту.</small>';
  output.before(settings);const color=settings.querySelector('[name=rulerColor]'),hex=settings.querySelector('[name=rulerColorHex]'),pace=settings.querySelector('[name=travelPace]'),speed=settings.querySelector('[name=travelSpeed]');
  color.value=/^#[\da-f]{6}$/i.test(preferences.color)?preferences.color:'#197fc0';hex.value=color.value;pace.value=preferences.pace;speed.value=preferences.speed;
  const persist=()=>game.settings.set('neverwinter-atlas','rulerPreferences',copy(preferences)).catch(error=>ui.notifications.error(tr(error.message)));
  button.classList.add('nw-ruler-primary');
  let active=false,layer,result,points=[],cancel,calibrating=false;
  const language=()=>game.settings.get('neverwinter-atlas','language');
  const calibration=()=>mapState(map).calibration ?? (map===BUNDLED_MAP?printedScale:null);
  function scale() {const data=calibration();if(!data)return null;const dx=(data.b[0]-data.a[0])*img.naturalWidth/100,dy=(data.b[1]-data.a[1])*img.naturalHeight/100;return data.feet/Math.hypot(dx,dy);}
  function paint() {
    layer?.remove();result?.remove();layer=svg(stage,'nw-ruler-layer');
    for(const outline of [true,false]){const path=document.createElementNS(NS,'path');path.setAttribute('d',pathFor(points));path.setAttribute('vector-effect','non-scaling-stroke');path.classList.add(outline?'nw-ruler-outline':'nw-ruler-line');if(!outline)path.style.stroke=color.value;layer.append(path);}
    let length=0;for(let i=1;i<points.length;i++)length+=Math.hypot((points[i][0]-points[i-1][0])*img.naturalWidth/100,(points[i][1]-points[i-1][1])*img.naturalHeight/100);
    const feet=length*(scale() ?? 0),rate=Number(preferences.speed)||300,lang=language();
    output.dataset.feet=String(feet);output.dataset.minutes=String(feet/rate);output.dataset.meters=String(feet*.3048);
    output.textContent=calibrating?(lang==='uk'?'Виберіть дві позначки відомої відстані':'Выберите две отметки известного расстояния'):scale()?distanceText(feet,lang)+' · '+walkingText(feet,rate,lang):(lang==='uk'?'Потрібне калібрування масштабу':'Нужна калибровка масштаба');
    button.innerHTML='<i class="fas fa-route"></i> <span>'+(active?(lang==='uk'?'Завершити вимірювання':'Завершить измерение'):(lang==='uk'?'Прокласти маршрут':'Проложить маршрут'))+'</span>';
    if(points.length>=2 && scale() && !calibrating){
      result=document.createElement('div');result.className='nw-ruler-result';result.textContent=distanceText(feet,lang)+'\n'+walkingText(feet,rate,lang);result.dataset.feet=String(feet);result.dataset.minutes=String(feet/rate);
      const last=points.at(-1);Object.assign(result.style,{left:last[0]+'%',top:last[1]+'%'});stage.append(result);
      const r=result.getBoundingClientRect(),v=viewport.getBoundingClientRect();result.style.transform='translate('+(r.right>v.left+viewport.clientWidth?-result.offsetWidth-12:12)+'px,'+(r.top-result.offsetHeight<v.top?12:-result.offsetHeight-12)+'px)';
    }
  }
  function stop(){cancel?.();active=false;calibrating=false;viewport.classList.remove('nw-measuring');button.setAttribute('aria-pressed','false');paint();}
  function start(){onMode();active=true;viewport.classList.add('nw-measuring');button.setAttribute('aria-pressed','true');paint();}
  button.onclick=()=>active?stop():start();
  tools.querySelector('[data-ruler-clear]').onclick=()=>{points=[];paint();};
  mode.onchange=()=>{preferences.mode=mode.value;persist();};
  color.oninput=()=>{hex.value=color.value;preferences.color=color.value;persist();paint();};hex.oninput=()=>{if(/^#[\da-f]{6}$/i.test(hex.value)){color.value=hex.value;preferences.color=color.value;persist();paint();}};
  pace.onchange=()=>{preferences.pace=pace.value;if(pace.value!=='custom'){preferences.speed={slow:200,normal:300,fast:400}[pace.value];speed.value=preferences.speed;}persist();paint();};
  speed.oninput=()=>{const value=Number(speed.value);if(!Number.isFinite(value)||value<1||value>10000)return;preferences.speed=value;preferences.pace='custom';pace.value='custom';persist();paint();};
  tools.querySelector('[data-calibrate]').hidden=!game.user.isGM;tools.querySelector('[data-calibrate]').onclick=()=>{start();calibrating=true;points=[];paint();};
  viewport.addEventListener('pointerdown',event=>{
    if(!active || event.button!==0)return;event.preventDefault();event.stopImmediatePropagation();
    const point=getMap().point(event.clientX,event.clientY);if(point.some(v=>v<0||v>100))return;
    if(calibrating){points.push(point);paint();if(points.length===2){const anchors=copy(points);stop();const ui=formDialog('Калибровка линейки','<label>Расстояние между отметками, ft<input name="feet" type="number" min="1" max="10000000" value="1000" required></label>',async form=>{if(Math.hypot(anchors[1][0]-anchors[0][0],anchors[1][1]-anchors[0][1])<.01)throw Error('Отметки слишком близко');await updateMap(map,current=>{current.calibration={a:anchors[0],b:anchors[1],feet:Number(form.elements.feet.value)};});paint();});ui.show();}return;}
    points=[point];stage.dataset.gesture='ruler';viewport.setPointerCapture(event.pointerId);const free=mode.value==='free';
    const move=event=>{const next=getMap().point(event.clientX,event.clientY);if(next.some(v=>v<0||v>100))return;if(free){if(points.length<3000)points.push(next);}else points=[points[0],next];paint();};
    const finish=()=>{viewport.removeEventListener('pointermove',move);viewport.removeEventListener('pointerup',finish);viewport.removeEventListener('pointercancel',finish);if(viewport.hasPointerCapture(event.pointerId))viewport.releasePointerCapture(event.pointerId);cancel=null;delete stage.dataset.gesture;stage.dispatchEvent(new CustomEvent('nw-redraw',{bubbles:true}));};
    cancel=finish;viewport.addEventListener('pointermove',move);viewport.addEventListener('pointerup',finish);viewport.addEventListener('pointercancel',finish);paint();
  },{capture:true});
  paint();return {stop,active:()=>active,refresh:paint,destroy:()=>{stop();layer?.remove();result?.remove();}};
}
