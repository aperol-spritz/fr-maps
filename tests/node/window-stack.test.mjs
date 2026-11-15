import {test} from 'node:test';
import assert from 'node:assert/strict';
test('native window raise invalidates Foundry cached active app so same journal can rise again',async()=>{
 const before={foundry:globalThis.foundry,ui:globalThis.ui};
 try{
  const journal={z:100},App={_maxZ:100};globalThis.foundry={applications:{api:{ApplicationV2:App}},utils:{getRoute:()=> 'data:application/json,%7B%7D'}};globalThis.ui={activeWindow:journal};
  const {raiseWindow}=await import('../../window.mjs');
  const atlas={style:{}};raiseWindow(atlas);assert.equal(atlas.style.zIndex,'101');assert.equal(ui.activeWindow,null);
  // Mirrors Foundry 14 bringToFront's active-window cache guard.
  if(ui.activeWindow!==journal)journal.z=++App._maxZ;
  assert.ok(journal.z>Number(atlas.style.zIndex));
 }finally{globalThis.foundry=before.foundry;globalThis.ui=before.ui;}
});
