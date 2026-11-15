import {test} from 'node:test';
import assert from 'node:assert/strict';
import {visibility,recordFor,syncTerritoryDefaults} from '../../state.mjs';
// Import the browser UI module with only its dictionary dependency supplied.
globalThis.foundry={utils:{getRoute:value=>value}};
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>({ok:true,json:async()=>({})});
const {cycleLocationAccess}=await import('../../access.mjs');
globalThis.fetch=originalFetch;
const map='modules/neverwinter-atlas/assets/neverwinter.webp';
const users=[{id:'a',name:'Alice'},{id:'b',name:'Bob'},{id:'gm',name:'GM',isGM:true}];
function fixture(ownership={default:0}){
 let value={version:7,maps:{[map]:{ownership:{default:2},points:{castle:{id:'castle',ownership,ru:{name:'Замок',lore:'Текст кампании'},uk:{name:'Замок',lore:'Текст кампанії'}}}}}};
 globalThis.foundry={utils:{deepClone:structuredClone}};
 globalThis.game={user:users[2],users,settings:{get:()=>value,set:async(_id,_key,next)=>{value=next;}}};
 const source={id:'castle',ru:{name:'Замок',lore:'Исходный текст',description:'История',reconstruction:'Допущение'},uk:{name:'Замок',lore:'Джерельний текст',description:'Історія',reconstruction:'Припущення'}};
 return {source,read:()=>value.maps[map]};
}
test('indicator describes actual player visibility, inherited grants and mixed ownership',()=>{
 fixture();const status=ownership=>visibility({record:{ownership}}).access;
 assert.equal(status({default:0}),'none');assert.equal(status({default:2}),'view');assert.equal(status({default:3}),'owner');
 assert.equal(status({default:0,a:3}),'partial');assert.equal(status({default:3,b:0}),'partial');
 assert.equal(status({default:3,b:2}),'view');assert.equal(status({default:0,a:2,b:3}),'view');
});
test('quick cycle persists default view, owner, hidden without losing player exceptions or prose',async()=>{
 const f=fixture({default:2,b:0});
 for(const expected of [3,0,2]){await cycleLocationAccess(f.source,map);assert.deepEqual(f.read().points.castle.ownership,{default:expected,b:0});}
 assert.equal(f.read().points.castle.ru.lore,'Текст кампании');assert.deepEqual(f.read().ownership,{default:2});
});
test('quick cycle rejects a player and leaves settings untouched',async()=>{
 const f=fixture({default:2});game.user=users[0];await assert.rejects(cycleLocationAccess(f.source,map),/права ведущего/);assert.equal(f.read().points.castle.ownership.default,2);
});
test('reference paragraphs reach existing public records without replacing campaign edits',async()=>{
 const f=fixture();f.read().points.castle.ru.description='Авторское описание';
 await syncTerritoryDefaults([f.source],map);
 const saved=f.read().points.castle;assert.equal(saved.ru.description,'Авторское описание');assert.equal(saved.uk.description,'Історія');
 assert.equal(saved.ru.lore,'Текст кампании');assert.equal(saved.ru.reconstruction,'Допущение');
 const before=structuredClone(f.read());await syncTerritoryDefaults([f.source],map);assert.deepEqual(f.read(),before);
 assert.equal(recordFor(f.source,map).uk.reconstruction,'Припущення');
});
