import {watchUI} from './i18n.mjs';
// Pointer gestures are kept on the atlas so they cannot move the Foundry canvas.
export function raiseWindow(element) {
  const App=foundry.applications.api.ApplicationV2;
  element.style.zIndex=String(++App._maxZ);
}
export function showFloatingDialog(dialog) {
  if(!dialog.isConnected)document.body.append(dialog);
  if(!dialog.dataset.floatingReady) {
    dialog.dataset.floatingReady='true';
    const title=dialog.querySelector('h2');
    const header=document.createElement('header');header.className='nw-dialog-header';
    const close=document.createElement('button');close.type='button';close.textContent='×';close.dataset.dialogClose='';close.setAttribute('aria-label','Закрыть');close.onclick=()=>dialog.close();
    header.append(title,close);dialog.prepend(header);
    dialog.addEventListener('pointerdown',()=>raiseWindow(dialog));
    header.onpointerdown=event=>{
      if(event.button!==0 || event.target.closest('button'))return;
      event.preventDefault();const start=dialog.getBoundingClientRect(),x=event.clientX,y=event.clientY;
      header.setPointerCapture(event.pointerId);
      header.onpointermove=move=>{
        dialog.style.left=Math.max(0,Math.min(window.innerWidth-60,start.x+move.clientX-x))+'px';
        dialog.style.top=Math.max(0,Math.min(window.innerHeight-40,start.y+move.clientY-y))+'px';
      };
      const finish=()=>{header.onpointermove=null;header.onpointerup=null;header.onpointercancel=null;if(header.hasPointerCapture(event.pointerId))header.releasePointerCapture(event.pointerId);};
      header.onpointerup=finish;header.onpointercancel=finish;
    };
    dialog.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();dialog.close();}});
  }
  if(!dialog.open)dialog.show();
  if(!dialog.style.left) {
    const rect=dialog.getBoundingClientRect();
    Object.assign(dialog.style,{inset:'auto',left:Math.max(0,rect.x)+'px',top:Math.max(0,rect.y)+'px',margin:'0'});
  }
  raiseWindow(dialog);watchUI(dialog);return dialog;
}
export function configureWindow(element, saved, persist) {
  const header = element.querySelector('header');
  const handle = element.querySelector('.nw-resize');
  const maximize = element.querySelector('[data-maximize]');
  let normal;
  let expanded = false;
  const raise=()=>{
    const dialogs=[...document.querySelectorAll('.nw-point-editor[open]')];
    if(dialogs.length)element.style.zIndex=String(Math.min(...dialogs.map(dialog=>Number(dialog.style.zIndex)))-1);
    else raiseWindow(element);
  };
  element.addEventListener('pointerdown',raise);
  raise();
  function bounds() {
    const {x,y,width,height} = element.getBoundingClientRect();
    return {x,y,width,height};
  }
  function apply(rect) {
    const width = Math.min(window.innerWidth, Math.max(480, rect.width));
    const height = Math.min(window.innerHeight, Math.max(320, rect.height));
    Object.assign(element.style, {
      left: Math.max(0, Math.min(window.innerWidth-width, rect.x))+'px',
      top: Math.max(0, Math.min(window.innerHeight-height, rect.y))+'px',
      width: width+'px', height: height+'px'
    });
  }
  function toggle() {
    if (!expanded) normal = bounds();
    expanded = !expanded;
    element.classList.toggle('nw-expanded', expanded);
    maximize.setAttribute('aria-pressed', String(expanded));
    apply(expanded ? {x:0,y:0,width:window.innerWidth,height:window.innerHeight} : normal);
    persist(expanded ? normal : bounds());
  }
  maximize.onclick = toggle;
  header.ondblclick = event => {if (!event.target.closest('.nw-tools,button')) toggle();};
  function gesture(target, resizing) {
    target.onpointerdown = event => {
      if (event.button !== 0 || expanded || event.target.closest('.nw-tools,button,input,select,summary,label')) return;
      event.preventDefault();
      const start = bounds();
      const pointer = {x:event.clientX,y:event.clientY};
      target.setPointerCapture(event.pointerId);
      target.onpointermove = move => {
        const dx = move.clientX-pointer.x, dy = move.clientY-pointer.y;
        apply(resizing ? {...start,width:start.width+dx,height:start.height+dy} : {...start,x:start.x+dx,y:start.y+dy});
      };
      target.onpointerup = target.onpointercancel = () => {
        target.onpointermove = null;
        target.onpointerup = target.onpointercancel = null;
        if(target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
        persist(bounds());
      };
    };
  }
  gesture(header,false);
  gesture(handle,true);
  const onResize = () => apply(expanded ? {x:0,y:0,width:window.innerWidth,height:window.innerHeight} : bounds());
  window.addEventListener('resize',onResize);
  if (saved && ['x','y','width','height'].every(key=>Number.isFinite(saved[key]))) apply(saved);
  return () => {window.removeEventListener('resize',onResize);element.removeEventListener('pointerdown',raise);};
}

export function configureMap(viewport, stage, image, output, saved) {
  const space = viewport.querySelector('.nw-map-space');
  let zoom = Number.isFinite(saved?.zoom) ? Math.max(.5,Math.min(6,saved.zoom)) : 1;
  let center = saved?.center?.every(Number.isFinite) ? saved.center : [.5,.5];
  let ready = false;
  let notification;
  const changed=()=>{if(notification)return;notification=requestAnimationFrame(()=>{notification=null;viewport.dispatchEvent(new CustomEvent('nw-view-change'));});};
  function refreshPins(){
    for(const pin of stage.querySelectorAll('.nw-pin')) {
      const base=Number(pin.dataset.baseSize) || 34;
      pin.style.setProperty('--nw-pin-size',Math.max(12,Math.min(100,base*Math.pow(zoom,.6)))+'px');
    }
  }
  function positionAt(clientX,clientY) {
    const rect=stage.getBoundingClientRect();
    return [(clientX-rect.left)/rect.width,(clientY-rect.top)/rect.height];
  }
  function layout(anchor=center, screen=[viewport.clientWidth/2,viewport.clientHeight/2]) {
    if (!image.naturalWidth || !viewport.clientWidth || !viewport.clientHeight) return;
    const fit=Math.min(viewport.clientWidth/image.naturalWidth,viewport.clientHeight/image.naturalHeight);
    const width=image.naturalWidth*fit*zoom, height=image.naturalHeight*fit*zoom;
    const spaceWidth=Math.max(width,viewport.clientWidth), spaceHeight=Math.max(height,viewport.clientHeight);
    Object.assign(space.style,{width:spaceWidth+'px',height:spaceHeight+'px'});
    Object.assign(stage.style,{width:width+'px',height:height+'px',left:(spaceWidth-width)/2+'px',top:(spaceHeight-height)/2+'px'});
    viewport.scrollLeft=stage.offsetLeft+anchor[0]*width-screen[0];
    viewport.scrollTop=stage.offsetTop+anchor[1]*height-screen[1];
    center=positionAt(viewport.getBoundingClientRect().left+viewport.clientWidth/2,viewport.getBoundingClientRect().top+viewport.clientHeight/2);
    output.textContent=Math.round(zoom*100)+'%';
    refreshPins();
    ready=true;
    changed();
  }
  function changeZoom(value,clientX,clientY) {
    if (!ready) return;
    const rect=viewport.getBoundingClientRect();
    const x=clientX ?? rect.left+viewport.clientWidth/2;
    const y=clientY ?? rect.top+viewport.clientHeight/2;
    const anchor=positionAt(x,y);
    zoom=Math.max(.5,Math.min(6,value));
    layout(anchor,[x-rect.left,y-rect.top]);
  }
  viewport.addEventListener('wheel',event=>{
    event.preventDefault();
    event.stopPropagation();
    changeZoom(zoom*Math.exp(-Math.max(-200,Math.min(200,event.deltaY))*.002),event.clientX,event.clientY);
  },{passive:false});
  viewport.onpointerdown=event=>{
    if(event.button!==0 || event.target.closest('button') || ['nw-placing','nw-drawing','nw-editing-region','nw-measuring'].some(name=>viewport.classList.contains(name))) return;
    event.preventDefault();
    const initial={x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
    let moved=false;
    if(!event.target.closest('[data-zone]'))viewport.setPointerCapture(event.pointerId);
    viewport.classList.add('nw-panning');
    viewport.onpointermove=move=>{
      const dx=move.clientX-initial.x,dy=move.clientY-initial.y;
      moved ||= Math.hypot(dx,dy)>4;
      if(moved && !viewport.hasPointerCapture(event.pointerId))viewport.setPointerCapture(event.pointerId);
      viewport.scrollTo(initial.left-dx,initial.top-dy);
    };
    viewport.onpointerup=viewport.onpointercancel=()=>{
      viewport.onpointermove=null;
      viewport.onpointerup=viewport.onpointercancel=null;
      if(viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
      viewport.classList.remove('nw-panning');
      if(moved) {
        const suppress=event=>event.stopImmediatePropagation();
        viewport.addEventListener('click',suppress,{once:true,capture:true});
        // A captured pan does not always produce a click. Do not consume a
        // later deliberate click to place a new location.
        setTimeout(()=>viewport.removeEventListener('click',suppress,true),0);
      }
    };
  };
  viewport.onscroll=()=>{
    if(ready) {
      const rect=viewport.getBoundingClientRect();
      center=positionAt(rect.left+viewport.clientWidth/2,rect.top+viewport.clientHeight/2);
      changed();
    }
  };
  let lastWidth=0,lastHeight=0;
  const observer=new ResizeObserver(()=>{
    if(viewport.clientWidth===lastWidth && viewport.clientHeight===lastHeight)return;
    lastWidth=viewport.clientWidth;lastHeight=viewport.clientHeight;layout();
  });
  observer.observe(viewport);
  image.onload=()=>layout();
  if(image.complete) layout();
  return {
    zoomBy:delta=>changeZoom(zoom+delta),
    refreshPins,
    centerOn:(x,y)=>layout([x/100,y/100]),
    snapshot:()=>({zoom,center}),
    restore:view=>{
      zoom=view.zoom;
      layout(view.center);
    },
    point:(x,y)=>positionAt(x,y).map(v=>v*100),
    destroy:()=>{observer.disconnect();if(notification)cancelAnimationFrame(notification);}
  };
}
