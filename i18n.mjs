const response=await fetch(foundry.utils.getRoute('modules/neverwinter-atlas/lang/uk-ui.json'));
if(!response.ok)throw Error('Atlas UI dictionary '+response.status);
const dictionary=await response.json();
export const uiLanguage=()=>{try{return game.settings.get('neverwinter-atlas','language');}catch{return 'ru';}};
export function tr(text,language=uiLanguage()){
  if(language!=='uk' || typeof text!=='string')return text;
  const key=text.trim();let translated=dictionary[key];
  if(!translated){const dash=key.indexOf(' — ');if(dash>=0 && dictionary[key.slice(0,dash)])translated=dictionary[key.slice(0,dash)]+key.slice(dash);}
  if(!translated){const quote=key.indexOf(' «');if(quote>=0 && dictionary[key.slice(0,quote)])translated=dictionary[key.slice(0,quote)]+key.slice(quote);}
  if(!translated){const colon=key.indexOf(':');if(colon>=0 && dictionary[key.slice(0,colon+1)])translated=dictionary[key.slice(0,colon+1)]+tr(key.slice(colon+1),language);}
  if(!translated && /^Собственные точки:/.test(key))translated=key.replace('Собственные точки:','Власні локації:').replace('обновить','оновити').replace('добавить','додати').replace('Территории:','Території:').replace('Настроенные локации:','Налаштовані локації:').replace('Рисунки:','Малюнки:');
  if(!translated && /^Персонажи:/.test(key))translated=key.replace('Персонажи:','Персонажі:').replace('недоступные листы:','недоступні аркуші:');
  if(!translated && /^Восстановлено:/.test(key))translated=key.replace('Восстановлено: точки','Відновлено: локації').replace('территории','території').replace('рисунки','малюнки');
  if(translated && translated.includes('. Оформление:'))translated=translated.replace('. Оформление:','. Оформлення:');
  if(!translated && /^Штрих \d+$/.test(key))translated=key.replace('Штрих','Штрих');
  if(!translated && /^Вершина \d+$/.test(key))translated=key;
  if(!translated && /^Добавить вершину \d+$/.test(key))translated=key.replace('Добавить вершину','Додати вершину');
  if(!translated && /^[◉◌] /.test(key))translated=key.slice(0,2)+tr(key.slice(2),language);
  if(!translated && key.includes(' · '))translated=key.split(' · ').map(part=>tr(part,language)).join(' · ');
  return translated?text.replace(key,translated):text;
}
const sources=new WeakMap(),attributes=new WeakMap(),watched=new WeakMap();
export function translateUI(root,language=uiLanguage()){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
  while((node=walker.nextNode())){
    if(node.parentElement?.closest('textarea,script,style,nav,.nw-summary,.nw-period,.nw-era,.nw-position-status,.nw-services,.nw-organizations p,.nw-region-label,.nw-region-label-preview,.nw-character,.nw-public-reader p,[data-no-translate]') || node.parentElement?.hasAttribute('data-no-translate-text'))continue;
    const before=sources.get(node),source=before && node.data===before.last?before.source:node.data,value=tr(source,language);sources.set(node,{source,last:value});if(node.data!==value)node.data=value;
  }
  for(const el of [root,...root.querySelectorAll('[title],[aria-label],[placeholder]')])for(const key of ['title','aria-label','placeholder'])if(el.hasAttribute(key)){
    const data=attributes.get(el) ?? {},before=data[key],current=el.getAttribute(key),source=before && current===before.last?before.source:current,value=tr(source,language);data[key]={source,last:value};attributes.set(el,data);if(current!==value)el.setAttribute(key,value);
  }
}
export function watchUI(root,getLanguage=uiLanguage){
  if(watched.has(root))return watched.get(root);
  let pending=false;const apply=()=>{if(pending)return;pending=true;queueMicrotask(()=>{pending=false;if(root.isConnected)translateUI(root,getLanguage());});};
  const observer=new MutationObserver(apply);observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder']});
  const hook=Hooks.on('updateSetting',setting=>{if(setting.key==='neverwinter-atlas.language')apply();});
  const stop=()=>{observer.disconnect();Hooks.off('updateSetting',hook);watched.delete(root);};watched.set(root,stop);root.addEventListener('close',stop,{once:true});apply();return stop;
}
export function confirmUI(options){
  const body=document.createElement('div');body.innerHTML=options.content ?? '';translateUI(body);
  return foundry.applications.api.DialogV2.confirm({...options,window:{...options.window,title:tr(options.window?.title)},content:body.innerHTML,yes:{...options.yes,label:tr('Да')},no:{...options.no,label:tr('Отмена')}});
}
