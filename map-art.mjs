import {confirmUI,tr} from './i18n.mjs';
import {movePoint,formDialog} from './access.mjs';
import {strokes,updateStrokes,sharedStrokes,shareStroke,shareGroup,renameGroup,removeGroup,strokeKey,mapState,visibility} from './state.mjs';
import {applyLabelStyle} from './label-style.mjs';
const ID='neverwinter-atlas';
const NS='http://www.w3.org/2000/svg';
function svgLayer(stage,name) {
  stage.querySelector('.'+name)?.remove();
  const svg=document.createElementNS(NS,'svg');
  svg.classList.add(name);
  svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');
  stage.append(svg);
  return svg;
}
export function renderTerritories(stage,places,choose,tooltip,labelFor=place=>place.ru.name,commitLabel) {
  const atlas=stage.closest('.nw-atlas'),viewport=stage.closest('.nw-viewport');
  atlas.querySelector('.nw-region-picker')?.remove();stage.querySelector('.nw-territory-labels')?.remove();
  const svg=svgLayer(stage,'nw-territories');
  const labels=document.createElement('div');labels.className='nw-territory-labels';stage.append(labels);
  const area=place=>Math.abs(place.shape.points.reduce((sum,p,i,list)=>{const next=list[(i+1)%list.length];return sum+p[0]*next[1]-next[0]*p[1];},0));
  const eligible=places.filter(place=>!place.shape?.hidden && Array.isArray(place.shape?.points) && place.shape.points.length>=3 && place.shape.points.every(point=>Array.isArray(point) && point.length===2 && point.every(Number.isFinite))).sort((a,b)=>(a.regionOrder ?? 0)-(b.regionOrder ?? 0)||area(b)-area(a));
  const byId=new Map(eligible.map(p=>[p.id,p]));
  const blocked=()=>['nw-placing','nw-drawing','nw-editing-region','nw-measuring'].some(name=>viewport.classList.contains(name));
  function picker(event,fallback){
    if(blocked())return;event.preventDefault();
    atlas.querySelector('.nw-region-picker')?.remove();
    const rect=stage.getBoundingClientRect(),target=event.currentTarget.getBoundingClientRect();
    const x=event.clientX || target.x+target.width/2,y=event.clientY || target.y+target.height/2;
    const point=new DOMPoint((x-rect.x)/rect.width*100,(y-rect.y)/rect.height*100);
    const candidates=[...svg.querySelectorAll('polygon')].reverse().filter(p=>p.isPointInFill(point)).map(p=>byId.get(p.dataset.zone));
    if(!candidates.length)candidates.push(fallback);
    const menu=document.createElement('section');menu.className='nw-region-picker';menu.setAttribute('role','dialog');menu.setAttribute('aria-label','Территории в этой точке');
    const title=document.createElement('strong');title.textContent='Территории в этой точке';
    const close=document.createElement('button');close.textContent='×';close.dataset.closeRegionPicker='';close.setAttribute('aria-label','Закрыть выбор территории');close.onclick=()=>{menu.remove();viewport.focus({preventScroll:true});};
    const head=document.createElement('div');head.append(title,close);menu.append(head);
    for(const place of candidates){const button=document.createElement('button');button.dataset.pickRegion=place.id;button.textContent=labelFor(place);button.onclick=()=>{menu.remove();choose(place);};menu.append(button);}
    menu.onkeydown=e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close.click();}};
    atlas.append(menu);const bounds=atlas.getBoundingClientRect();
    Object.assign(menu.style,{left:Math.max(8,Math.min(bounds.width-menu.offsetWidth-8,x-bounds.x+8))+'px',top:Math.max(8,Math.min(bounds.height-menu.offsetHeight-8,y-bounds.y+8))+'px'});
    menu.querySelector('[data-pick-region]')?.focus({preventScroll:true});
  }
  function select(event,place){if(blocked())return;event.stopPropagation();if(event.altKey)picker(event,place);else choose(place);}
  for(const place of eligible) {
    const polygon=document.createElementNS(NS,'polygon');
    polygon.setAttribute('points',place.shape.points.map(point=>point.join(',')).join(' '));
    polygon.setAttribute('fill',place.shape.color || '#658d64');
    polygon.setAttribute('stroke',place.shape.color || '#658d64');
    polygon.style.setProperty('--nw-region-opacity',String(place.shape.opacity ?? .15));
    polygon.style.setProperty('--nw-region-hover-opacity',String(Math.min(.65,(place.shape.opacity ?? .15)+.2)));
    polygon.setAttribute('vector-effect','non-scaling-stroke');
    polygon.dataset.zone=place.id;
    polygon.setAttribute('role','button');polygon.setAttribute('tabindex','0');polygon.setAttribute('aria-label',labelFor(place));
    if(game.user.isGM)polygon.dataset.visibility=visibility(place).open?'open':'hidden';
    polygon.setAttribute('aria-description','Alt+щелчок или ПКМ — выбор территорий в этой точке');
    polygon.onkeydown=event=>{if(event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10')){event.stopPropagation();picker(event,place);}else if(event.key==='Enter'||event.key===' '){event.preventDefault();select(event,place);}};
    polygon.onclick=event=>select(event,place);polygon.oncontextmenu=event=>picker(event,place);
    tooltip(polygon,place);
    svg.append(polygon);
    const options=place.regionLabel;
    if(options?.enabled && (game.user.isGM || options.audience!=='gm')){
      const label=document.createElement('button');label.className='nw-region-label';label.dataset.regionLabel=place.id;label.textContent=labelFor(place);
      Object.assign(label.style,{left:(options.x ?? place.x)+'%',top:(options.y ?? place.y)+'%'});applyLabelStyle(label,options);
      label.onclick=event=>select(event,place);label.oncontextmenu=event=>picker(event,place);
      tooltip(label,place);label.addEventListener('pointerenter',()=>polygon.classList.add('nw-region-active'));label.addEventListener('pointerleave',()=>polygon.classList.remove('nw-region-active'));
      if(game.user.isGM && commitLabel)draggableLabel(label,place,stage,viewport,blocked,commitLabel);
      labels.append(label);
    }
  }
}
function draggableLabel(label,place,stage,viewport,blocked,commit) {
  let dragged=false;label.dataset.draggable='true';
  label.onpointerdown=event=>{
    if(event.button!==0 || blocked())return;
    event.preventDefault();event.stopPropagation();viewport.focus({preventScroll:true});
    const start={x:event.clientX,y:event.clientY};let position=[place.regionLabel?.x ?? place.x,place.regionLabel?.y ?? place.y];dragged=false;
    label.setPointerCapture(event.pointerId);
    label.onpointermove=move=>{
      dragged ||= Math.hypot(move.clientX-start.x,move.clientY-start.y)>4;if(!dragged)return;
      stage.dataset.gesture='label';const r=stage.getBoundingClientRect();
      position=[Math.max(0,Math.min(100,(move.clientX-r.left)/r.width*100)),Math.max(0,Math.min(100,(move.clientY-r.top)/r.height*100))];
      Object.assign(label.style,{left:position[0]+'%',top:position[1]+'%'});
    };
    const finish=async end=>{
      label.onpointermove=null;label.onpointerup=null;label.onpointercancel=null;if(label.hasPointerCapture(event.pointerId))label.releasePointerCapture(event.pointerId);
      if(!dragged)return;
      try{if(end.type!=='pointercancel')await commit(place,...position);}catch(error){ui.notifications.error(tr(error.message));}
      finally{delete stage.dataset.gesture;stage.dispatchEvent(new CustomEvent('nw-redraw',{bubbles:true}));}
    };
    label.onpointerup=finish;label.onpointercancel=finish;
  };
  label.addEventListener('click',event=>{if(dragged){dragged=false;event.stopImmediatePropagation();}},true);
}
export function draggablePin(pin,place,map,onError,commit=(place,x,y)=>movePoint(place,map,x,y)) {
  let dragged=false;
  pin.onpointerdown=event=>{
    if(event.button!==0) return;
    event.preventDefault();event.stopPropagation();
    pin.closest('.nw-viewport').focus({preventScroll:true});
    const start={x:event.clientX,y:event.clientY};
    const stage=pin.parentElement;
    let position=[place.x,place.y];
    dragged=false;
    pin.setPointerCapture(event.pointerId);
    pin.onpointermove=move=>{
      dragged ||= Math.hypot(move.clientX-start.x,move.clientY-start.y)>4;
      if(!dragged) return;
      stage.dataset.gesture='pin';
      const rect=stage.getBoundingClientRect();
      position=[Math.max(0,Math.min(100,(move.clientX-rect.left)/rect.width*100)),Math.max(0,Math.min(100,(move.clientY-rect.top)/rect.height*100))];
      pin.style.left=position[0]+'%';pin.style.top=position[1]+'%';
    };
    const finish=async end=>{
      pin.onpointermove=null;pin.onpointerup=null;pin.onpointercancel=null;
      if(pin.hasPointerCapture(event.pointerId)) pin.releasePointerCapture(event.pointerId);
      if(dragged) {
        try {
          if(end.type!=='pointercancel') await commit(place,...position);
        } catch(error) {onError(error);}
        finally {delete stage.dataset.gesture;stage.dispatchEvent(new CustomEvent('nw-redraw',{bubbles:true}));}
      }
    };
    pin.onpointerup=finish;pin.onpointercancel=finish;
  };
  pin.addEventListener('click',event=>{if(dragged) {dragged=false;event.stopImmediatePropagation();}},true);
}
const pathFor=points=>points.map(([x,y],index)=>(index?'L':'M')+x.toFixed(3)+','+y.toFixed(3)).join(' ');
export function renderDrawings(stage,map) {
  const svg=svgLayer(stage,'nw-drawings');
  stage.querySelector('.nw-drawing-labels')?.remove();
  const labels=document.createElement('div');labels.className='nw-drawing-labels';stage.append(labels);
  const privateStrokes=strokes(map),ownIds=new Set(privateStrokes.map(stroke=>stroke.id));
  const published=sharedStrokes(map).filter(stroke=>stroke.owner!==game.user.id || !ownIds.has(stroke.id));
  for(const data of [...privateStrokes,...published]) {
    const path=document.createElementNS(NS,'path');
    path.setAttribute('d',pathFor(data.points));path.setAttribute('stroke',data.color);
    path.setAttribute('stroke-width',data.width);path.setAttribute('vector-effect','non-scaling-stroke');
    path.dataset.stroke=data.id;
    path.dataset.shared=String(Boolean(data.owner || mapState(map).publicDrawings?.[strokeKey(data.id)]));
    svg.append(path);
    if(data.label && data.points.length) {
      const label=document.createElement('span');label.className='nw-drawing-label';label.dataset.strokeLabel=data.id;
      label.textContent=data.label;const anchor=data.points[data.points.length-1];
      Object.assign(label.style,{left:anchor[0]+'%',top:anchor[1]+'%'});labels.append(label);
    }
  }
  return svg;
}
export function drawingTools(stage,viewport,map,getMap,controls,history) {
  let drawing=false;
  let cancelStroke;
  const groupLabel=document.createElement('label');groupLabel.textContent='Группа новых рисунков';
  const groupSelect=document.createElement('select');groupSelect.name='drawGroup';groupLabel.append(groupSelect);controls.querySelector('[data-stroke-list]').before(groupLabel);
  controls.querySelector('[data-draw]').onclick=()=>{
    drawing=!drawing;viewport.classList.toggle('nw-drawing',drawing);
    controls.querySelector('[data-draw]').setAttribute('aria-pressed',String(drawing));
  };
  const undoExisting=()=>updateStrokes(map,list=>{list.pop();});
  const undo=()=>history.undo('drawing',undoExisting);
  controls.querySelector('[data-undo]').onclick=()=>undo().catch(error=>ui.notifications.error(tr(error.message)));
  controls.querySelector('[data-clear]').onclick=async()=>{
    if(await confirmUI({window:{title:'Очистить рисунки ведущего'},content:'<p>Удалить все штрихи на этой карте?</p>'})) {
      await updateStrokes(map,list=>{list.splice(0);});
    }
  };
  viewport.addEventListener('pointerdown',event=>{
    if(!drawing || !game.user.isGM || event.button!==0) return;
    event.preventDefault();event.stopImmediatePropagation();
    viewport.focus({preventScroll:true});
    const points=[];
    stage.dataset.gesture='drawing';
    const svg=stage.querySelector('.nw-drawings');
    const draft=document.createElementNS(NS,'path');
    const color=controls.querySelector('[name=drawColor]').value;
    const width=Math.max(1,Math.min(12,Number(controls.querySelector('[name=drawWidth]').value) || 3));
    draft.setAttribute('stroke',color);draft.setAttribute('stroke-width',width);
    draft.setAttribute('vector-effect','non-scaling-stroke');svg.append(draft);
    function add(x,y) {
      const point=getMap().point(x,y);
      if(point.some(v=>v<0 || v>100) || points.length>=1500) return;
      points.push(point);draft.setAttribute('d',pathFor(points));
    }
    add(event.clientX,event.clientY);
    viewport.setPointerCapture(event.pointerId);
    const move=move=>add(move.clientX,move.clientY);
    const finish=async end=>{
      cancelStroke=null;
      viewport.removeEventListener('pointermove',move);
      viewport.removeEventListener('pointerup',finish);viewport.removeEventListener('pointercancel',finish);
      if(viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
      draft.remove();
      try {
        if(end.type!=='pointercancel' && points.length>=2) {
          const stroke={id:foundry.utils.randomID(),points,color,width,group:groupSelect.value};
          await history.perform('drawing',async()=>{
            await updateStrokes(map,list=>{list.push(stroke);});
            return async()=>{
              if(!strokes(map).some(item=>item.id===stroke.id))return false;
              await updateStrokes(map,list=>{const index=list.findIndex(item=>item.id===stroke.id);if(index>=0)list.splice(index,1);});
            };
          });
        }
      } catch(error) {ui.notifications.error(tr(error.message));}
      finally {delete stage.dataset.gesture;stage.dispatchEvent(new CustomEvent('nw-redraw',{bubbles:true}));}
    };
    cancelStroke=()=>finish({type:'pointercancel'});
    viewport.addEventListener('pointermove',move);viewport.addEventListener('pointerup',finish);viewport.addEventListener('pointercancel',finish);
  },{capture:true});
  const stop=()=>{
    drawing=false;viewport.classList.remove('nw-drawing');
    controls.querySelector('[data-draw]').setAttribute('aria-pressed','false');
    cancelStroke?.();
  };
  stop.undo=undo;
  stop.undoExisting=undoExisting;
  stop.active=()=>drawing;
  stop.refresh=()=>{
    const list=controls.querySelector('[data-stroke-list]');
    list.replaceChildren();
    const own=strokes(map),published=mapState(map).publicDrawings ?? {};
    const selectedGroup=groupSelect.value;
    groupSelect.replaceChildren(...['',...new Set(['Маршруты','Опасности','Заметки',...own.map(s=>s.group).filter(Boolean),...(selectedGroup?[selectedGroup]:[])])].map(group=>new Option(group || 'Без группы',group)));
    groupSelect.value=selectedGroup;
    if(!own.length) {list.textContent='Рисунков пока нет';return;}
    own.map((stroke,index)=>({stroke,index})).reverse().forEach(({stroke,index})=>{
      const row=document.createElement('div');row.className='nw-stroke-row';row.dataset.strokeRow=stroke.id;
      const label=document.createElement('span');label.textContent=stroke.name || 'Штрих '+(index+1);label.style.borderLeft='5px solid '+stroke.color;
      const edit=document.createElement('button');edit.dataset.editStroke=stroke.id;edit.title='Название и подпись';edit.setAttribute('aria-label',edit.title);edit.innerHTML='<i class="fas fa-pen"></i>';
      edit.onclick=()=>{
        const ui=formDialog('Название и подпись рисунка','<label>Название для ведущего<input name="strokeName" maxlength="160"></label><label>Группа для ведущего<input name="strokeGroup" maxlength="80" placeholder="Маршруты, Опасности, Заметки…"></label><label>Подпись на карте<textarea name="strokeLabel" rows="3" maxlength="200"></textarea></label><small>Название и группа остаются личными. Подпись видна игрокам только при показе рисунка.</small>',form=>updateStrokes(map,list=>{
          const target=list.find(item=>item.id===stroke.id);if(!target)throw Error('Рисунок уже удалён');
          target.name=form.elements.strokeName.value.trim();target.group=form.elements.strokeGroup.value.trim();target.label=form.elements.strokeLabel.value.trim();
        }));
        ui.form.elements.strokeName.value=stroke.name ?? '';ui.form.elements.strokeGroup.value=stroke.group ?? '';ui.form.elements.strokeLabel.value=stroke.label ?? '';ui.show();
      };
      const shared=Boolean(published[strokeKey(stroke.id)]);
      const button=document.createElement('button');button.dataset.shareStroke=stroke.id;
      button.textContent=shared?'Скрыть от игроков':'Показать игрокам';button.setAttribute('aria-pressed',String(shared));
      button.onclick=()=>shareStroke(map,stroke.id,!shared).catch(error=>ui.notifications.error(tr(error.message)));
      row.append(label,edit,button);list.append(row);
    });
    const rows=[...list.children];list.replaceChildren();
    for(const group of [...new Set(own.map(stroke=>stroke.group || ''))].sort()) {
      const section=document.createElement('section');section.className='nw-stroke-group';section.dataset.strokeGroup=group;
      const title=document.createElement('strong');title.textContent=group || 'Без группы';
      const actions=document.createElement('div');actions.className='nw-group-actions';
      for(const [show,text]of [[true,'Показать группу'],[false,'Скрыть группу']]) {
        const button=document.createElement('button');button.dataset.shareGroup=String(show);button.textContent=text;
        button.onclick=async()=>{try{await shareGroup(map,group,show);controls.querySelector('summary').focus({preventScroll:true});}catch(error){ui.notifications.error(tr(error.message));}};actions.append(button);
      }
      const manage=document.createElement('div');manage.className='nw-group-actions';
      const rename=document.createElement('button');rename.dataset.renameGroup='';rename.textContent='Переименовать';rename.disabled=!group;
      rename.onclick=()=>{
        const ui=formDialog('Переименовать группу','<label>Новое название<input name="newGroup" required maxlength="80"></label><small>Если такая группа уже есть, штрихи объединятся. Состояние показа игрокам сохраняется.</small>',async form=>{const selected=groupSelect.value===group;if(selected)groupSelect.value='';await renameGroup(map,group,form.elements.newGroup.value);if(selected)groupSelect.value=form.elements.newGroup.value.trim();});ui.form.elements.newGroup.value=group;ui.show();
      };
      const remove=document.createElement('button');remove.dataset.deleteGroup='';remove.textContent='Удалить группу';remove.disabled=!group;
      remove.onclick=()=>{
        const ui=formDialog('Удалить группу','<p data-group-delete-name></p><label>Что сделать со штрихами?<select name="groupFate"><option value="keep">Оставить без группы</option><option value="delete">Удалить все штрихи этой группы</option></select></label><small>При сохранении штрихов их показ игрокам сохраняется. При удалении штрихи исчезнут и у игроков.</small>',form=>{if(groupSelect.value===group)groupSelect.value='';return removeGroup(map,group,form.elements.groupFate.value==='delete');});
        ui.form.querySelector('[data-group-delete-name]').textContent=group+' · штрихов: '+own.filter(s=>(s.group || '')===group).length;ui.form.querySelector('[type=submit]').textContent='Применить';ui.show();
      };
      manage.append(rename,remove);section.append(title,actions,manage,...rows.filter(row=>(own.find(s=>s.id===row.dataset.strokeRow)?.group || '')===group));list.append(section);
    }
  };
  return stop;
}
