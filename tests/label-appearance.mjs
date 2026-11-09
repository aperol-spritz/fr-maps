import assert from 'node:assert/strict';
const ID='neverwinter-atlas',MAP='modules/neverwinter-atlas/assets/neverwinter.webp';
export async function labelAppearance(gm,reader,id,report,edit,save) {
  const atlas=gm.locator('.nw-atlas'),manager=gm.locator('.nw-territory-manager');
  const record=page=>page.evaluate(({ID,MAP,id})=>foundry.utils.deepClone(game.settings.get(ID,'atlasState').maps[MAP].points[id]),{ID,MAP,id});
  const label=page=>page.locator('[data-region-label="'+id+'"]');
  await edit();assert.equal(await manager.locator('[name=regionLabelColor]').inputValue(),'#362817');assert.equal(await manager.locator('[name=regionLabelOpacity]').inputValue(),'0.85');
  await manager.locator('[name=regionLabelColorHex]').fill('#124878');await manager.locator('[name=regionLabelBackgroundHex]').fill('#f7d69a');await manager.locator('[name=regionLabelBorderHex]').fill('#8a3a12');
  await manager.locator('[name=regionLabelOpacity]').press('Home');for(let i=0;i<7;i++)await gm.keyboard.press('ArrowRight');
  const preview=await manager.locator('.nw-region-label-preview').evaluate(e=>({color:getComputedStyle(e).color,background:getComputedStyle(e).backgroundColor,border:getComputedStyle(e).borderTopColor}));
  assert.deepEqual(preview,{color:'rgb(18, 72, 120)',background:'rgba(247, 214, 154, 0.35)',border:'rgb(138, 58, 18)'});
  await save();
  const style=page=>page.waitForFunction(id=>{const e=document.querySelector('[data-region-label="'+id+'"]');if(!e)return false;const s=getComputedStyle(e);return s.color==='rgb(18, 72, 120)' && s.backgroundColor==='rgba(247, 214, 154, 0.35)' && s.borderTopColor==='rgb(138, 58, 18)' && s.fontSize==='24px';},id);
  await style(gm);await style(reader);
  const original=await record(gm);
  async function drag(page,x,y){
    const handle=await page.waitForFunction(id=>{const e=document.querySelector('[data-region-label="'+id+'"]');if(!e)return false;const r=e.getBoundingClientRect();return r.width>0?{x:r.x,y:r.y,width:r.width,height:r.height}:false;},id);
    const box=await handle.jsonValue(),target=await page.locator('.nw-stage').evaluate((e,[x,y])=>{const r=e.getBoundingClientRect();return{x:r.x+r.width*x/100,y:r.y+r.height*y/100};},[x,y]);
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(target.x,target.y,{steps:8});await page.mouse.up();
  }
  const at=async(page,x,y)=>page.waitForFunction(({ID,MAP,id,x,y})=>{const l=game.settings.get(ID,'atlasState').maps[MAP].points[id].regionLabel;return Math.abs(l.x-x)<.15 && Math.abs(l.y-y)<.15;},{ID,MAP,id,x,y});
  await drag(gm,52,8);await at(gm,52,8);await at(reader,52,8);
  const moved=await record(gm);const {regionLabel:ignore,...unchanged}=moved,{regionLabel:old,...before}=original;assert.deepEqual(unchanged,before,'Label drag preserves territory geometry, marker coordinates, rights and prose');
  assert.deepEqual({...moved.regionLabel,x:old.x,y:old.y},old,'Label drag preserves label appearance and audience');
  await atlas.locator('.nw-viewport').focus();await gm.keyboard.press('Control+z');await at(gm,60,20);await at(reader,60,20);await style(reader);
  await drag(gm,52,8);await at(gm,52,8);await at(reader,52,8);
  assert.equal(await label(reader).getAttribute('data-draggable'),null);const playerBefore=await record(reader);await drag(reader,70,15);assert.deepEqual(await record(reader),playerBefore,'Player cannot move a territory label');
  await atlas.locator('[data-zoom="1"]').click();await style(gm);await at(gm,52,8);await atlas.locator('[data-zoom="-1"]').click();
  report.checks.push('territory-label-live-style-preview','territory-label-color-background-border-alpha-sync','territory-label-real-GM-drag-keeps-shape-prose-grants','territory-label-drag-Ctrl-Z-and-player-sync','territory-label-player-drag-denied','territory-label-fixed-font-size-after-zoom');
  return (await record(gm)).regionLabel;
}
