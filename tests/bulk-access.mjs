import assert from 'node:assert/strict';
export async function bulkAccess(page,report){
 const ID='neverwinter-atlas',map='modules/neverwinter-atlas/assets/neverwinter.webp';
 const original=await page.evaluate(ID=>foundry.utils.deepClone(game.settings.get(ID,'atlasState')),ID);
 await page.locator('body').click({position:{x:500,y:20}});await page.keyboard.press('KeyM');
 const atlas=page.locator('.nw-atlas'),settings=page.locator('.nw-settings');await atlas.waitFor();
 const ids=await atlas.locator('.nw-pin').evaluateAll(pins=>pins.map(p=>p.dataset.place));assert.ok(ids.length>40);
 // A named override must be removed by the bulk action as well.
 await page.evaluate(async({ID,map,id})=>{const state=foundry.utils.deepClone(game.settings.get(ID,'atlasState'));state.maps[map].points[id].ownership={default:0,fixturePlayer:3};await game.settings.set(ID,'atlasState',state);},{ID,map,id:ids[0]});
 for(const [level,badge] of [['2','view'],['3','owner'],['0','none']]){
  await atlas.locator('input[type=search]').fill('Castle Never');
  await atlas.locator('[data-settings]').click();assert.equal(await settings.locator('[name=allMarkerAccess]').inputValue(),'');
  await settings.locator('[name=allMarkerAccess]').selectOption(level);await settings.locator('[type=submit]').click();await settings.waitFor({state:'detached'});
  const actual=await page.evaluate(({ID,map,ids})=>{const state=game.settings.get(ID,'atlasState');return {records:ids.map(id=>state.maps[map].points[id].ownership),others:Object.fromEntries(Object.entries(state.maps).filter(([key])=>key!==map)),ownership:state.maps[map].ownership};},{ID,map,ids});
  for(const grants of actual.records)assert.deepEqual(grants,{default:Number(level)});
  assert.deepEqual(actual.others,Object.fromEntries(Object.entries(original.maps).filter(([key])=>key!==map)));
  assert.deepEqual(actual.ownership,original.maps[map].ownership);
  assert.equal(await atlas.locator('.nw-access-icon').first().getAttribute('data-access'),badge);
 }
 await atlas.locator('[data-close]').click();await atlas.waitFor({state:'detached'});await page.locator('body').click({position:{x:500,y:20}});await page.keyboard.press('KeyM');await atlas.waitFor();
 assert.equal(await atlas.locator('.nw-access-icon').first().getAttribute('data-access'),'none');
 await atlas.locator('[data-settings]').click();await settings.locator('[name=allMarkerAccess]').selectOption('2');await settings.locator('[data-cancel]').click();
 assert.equal(await atlas.locator('.nw-access-icon').first().getAttribute('data-access'),'none');
 await page.evaluate(async({ID,original})=>game.settings.set(ID,'atlasState',original),{ID,original});
 await atlas.locator('[data-close]').click();
 report.checks.push('bulk-marker-view-owner-hide-including-filtered-out-pins','bulk-replaces-individual-grants','bulk-preserves-other-maps-and-map-permissions','bulk-access-persists-and-cancel-does-not-apply');
}
