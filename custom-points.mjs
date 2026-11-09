const ID='neverwinter-atlas';
import {mapState,patchPoint} from './state.mjs';
import {showFloatingDialog} from './window.mjs';
const escape = text => text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');

export function customPlaces(map) {
  return game.journal.filter(journal=>journal.getFlag(ID,'point')?.map===map).map(journal=>{
    const point=journal.getFlag(ID,'point');
    return {...point,id:'custom-'+journal.id,document:journal,aliases:[],
      ru:{name:point.name},uk:{name:point.name}};
  });
}

export function editPoint({point,map,x,y,language,categories,districts=[]}) {
  const ua=language==='uk';
  const dialog=document.createElement('dialog');
  dialog.className='nw-point-editor nw-custom-editor';
  dialog.innerHTML=`<form>
    <h2>${ua?'Власна локація':'Своя локация'}</h2>
    <label>${ua?'Назва':'Название'}<input name="name" required maxlength="160"></label>
    <label>${ua?'Англійська назва (за наявності)':'Английское название (если есть)'}<input name="en" maxlength="160"></label>
    <label>${ua?'Категорія':'Категория'}<select name="category"></select></label>
    <label>${ua?'Район':'Район'}<select name="district"></select></label>
    <label>${ua?'Опис для ведучого':'Описание для ведущего'}<textarea name="description" rows="6" maxlength="20000"></textarea></label>
    <p class="nw-form-error" role="alert"></p>
    <div class="nw-form-actions"><button type="button" data-cancel>${ua?'Скасувати':'Отмена'}</button><button type="submit">${ua?'Зберегти':'Сохранить'}</button></div>
  </form>`;
  const form=dialog.querySelector('form');
  const field=name=>form.elements.namedItem(name);
  for(const [value,label] of Object.entries(categories)) field('category').add(new Option(label,value));
  field('district').add(new Option(ua?'Без району':'Без района',''));
  for(const district of districts) field('district').add(new Option(district.name,district.id));
  if(point?.district && !districts.some(d=>d.id===point.district)) field('district').add(new Option(ua?'Попередній район недоступний':'Ранее выбранный район недоступен',point.district));
  field('district').value=point?.district ?? '';
  field('name').value=point?.name ?? '';
  field('en').value=point?.en ?? '';
  field('category').value=point?.category ?? 'landmark';
  const previousPage=point?.document.pages.contents[0];
  if(previousPage) {
    const content=new DOMParser().parseFromString(previousPage.text.content,'text/html');
    content.querySelectorAll('br').forEach(br=>br.replaceWith('\n'));
    field('description').value=content.body.textContent;
  }
  dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
  dialog.onclose=()=>dialog.remove();
  form.onsubmit=async event=>{
    event.preventDefault();
    const name=field('name').value.trim();
    if(!name) {field('name').focus();return;}
    const en=field('en').value.trim();
    const nameWithEnglish=en ? name+' ('+en+')' : name;
    const text=field('description').value;
    const metadata={name,en,category:field('category').value,district:field('district').value || null,map,x:point?.x ?? x,y:point?.y ?? y};
    const pages=[{name:nameWithEnglish,type:'text',text:{format:1,content:'<p>'+escape(text).replaceAll('\n','<br>')+'</p>'}}];
    form.querySelector('[type=submit]').disabled=true;
    try {
      if(!game.user.isGM) throw Error('Требуются права ведущего');
      if(point) {
        const page=previousPage ? {...pages[0],_id:previousPage.id} : pages[0];
        // One document update preserves the marker and its text together.
        await point.document.update({name:nameWithEnglish,flags:{[ID]:{point:metadata}},pages:[page]});
        const published=mapState(map).points[point.id];
        if(published) await patchPoint({...point,...metadata},map,{en,category:metadata.category,district:metadata.district,
          ru:{...published.ru,name},uk:{...published.uk,name}});
      } else {
        await JournalEntry.create({name:nameWithEnglish,ownership:{default:0},
          flags:{[ID]:{point:metadata}},pages});
      }
      dialog.close();
    } catch(error) {
      dialog.querySelector('[role=alert]').textContent=error.message;
      form.querySelector('[type=submit]').disabled=false;
    }
  };
  showFloatingDialog(dialog);
  field('name').focus();
}
