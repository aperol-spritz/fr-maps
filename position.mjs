import {formDialog} from './access.mjs';
import {patchPoint} from './state.mjs';
export function positionSettings(place,map){
  if(!game.user.isGM)throw Error('Требуются права ведущего');
  const previous=place.position ?? {status:'unverified',ru:'',uk:''};
  const ui=formDialog('Точность расположения — '+place[game.settings.get('neverwinter-atlas','language')].name,'<label>Статус<select name="positionStatus"><option value="unverified">Требует сверки</option><option value="overview">Обзорная метка</option><option value="confirmed">Подтверждённая привязка</option></select></label><label>Основание RU<textarea name="positionRu" rows="3" maxlength="1000"></textarea></label><label>Обґрунтування UA<textarea name="positionUk" rows="3" maxlength="1000"></textarea></label><label>Источник привязки (HTTPS, необязательно)<input name="positionSource" type="url" maxlength="1024"></label><small>Статус меняет отметку и фильтр. Координаты, границы, исходный журнал и права доступа сохраняются.</small>',async form=>{
    const source=form.elements.positionSource.value.trim();
    if(source && new URL(source).protocol!=='https:')throw Error('Источник должен быть ссылкой HTTPS');
    await patchPoint(place,map,{position:{status:form.elements.positionStatus.value,ru:form.elements.positionRu.value.trim(),uk:form.elements.positionUk.value.trim(),...(source?{source}:{})}});
  });
  ui.dialog.classList.add('nw-position-editor');const f=ui.form.elements;
  f.positionStatus.value=previous.status;f.positionRu.value=previous.ru;f.positionUk.value=previous.uk;f.positionSource.value=previous.source ?? '';ui.show();
}
