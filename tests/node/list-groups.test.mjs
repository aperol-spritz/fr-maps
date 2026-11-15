import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupedPlaces,listGroup} from '../../list-groups.mjs';
const place=(id,name,category='inn',uk=name)=>({id,category,ru:{name},uk:{name:uk}});
test('functional groups override coarse categories and sort localized names without mutation',()=>{
 const source=[place('inn-b','Якорь','inn','Абетка'),place('knowledge','Дом знаний','temple'),place('inn-a','Берег','inn','Якір'),place('justice','Зал Правосудия','temple'),place('castle','Замок Невер','landmark')];
 const before=structuredClone(source),ru=groupedPlaces(source),uk=groupedPlaces(source,'uk');
 assert.deepEqual(ru.map(g=>g.id),['administration','inns','knowledge']);
 assert.deepEqual(ru[0].places.map(p=>p.id),['justice','castle']);
 assert.deepEqual(ru[1].places.map(p=>p.id),['inn-a','inn-b']);
 assert.deepEqual(uk[1].places.map(p=>p.id),['inn-b','inn-a']);assert.deepEqual(source,before);
 assert.equal(listGroup(place('sleeping-dragon','Мост','landmark')),'roads');
 assert.equal(listGroup(place('new','Место','unknown')),'landmarks');
 assert.deepEqual(groupedPlaces([]),[]);
 assert.equal(groupedPlaces([place('single','Таверна')]).length,1);
});
