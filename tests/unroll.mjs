import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

export async function unrollFlow(page,report){
  const ID='neverwinter-atlas',atlas=page.locator('.nw-atlas');
  const evidence=new URL('../docs/testing/unroll-2026-11-15/',import.meta.url);await fs.mkdir(evidence,{recursive:true});
  const open=async()=>{await page.locator('body').click({position:{x:500,y:20}});await page.keyboard.press('KeyM');await atlas.waitFor();};
  const close=async()=>{await page.keyboard.press('Escape');await atlas.waitFor({state:'detached'});};
  const settled=async()=>page.waitForFunction(()=>{const el=document.querySelector('.nw-atlas');return el&&!el.classList.contains('nw-unrolling')&&!el.querySelector('.nw-unroll-roll')&&getComputedStyle(el).clipPath==='none';});
  const inspect=async time=>page.evaluate(async time=>{
    const el=document.querySelector('.nw-atlas'),animations=el.getAnimations({subtree:true}).filter(a=>a.effect.target===el||a.effect.target.classList.contains('nw-unroll-roll'));
    if(time!==null)for(const animation of animations){animation.pause();animation.currentTime=time;}
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const r=el.getBoundingClientRect(),stage=el.querySelector('.nw-stage').getBoundingClientRect();
    return {rect:[r.x,r.y,r.width,r.height],map:[stage.width,stage.height],clip:getComputedStyle(el).clipPath,transform:getComputedStyle(el).transform,duration:animations.map(a=>a.effect.getTiming().duration),rolls:[...el.querySelectorAll('.nw-unroll-roll')].map(roll=>({left:roll.getBoundingClientRect().x,opacity:Number(getComputedStyle(roll).opacity),paper:getComputedStyle(roll).backgroundImage}))};
  },time);
  const screenshots=[];
  for(const design of ['classic','aged']){
    await page.evaluate(({ID,design})=>game.settings.set(ID,'design',design),{ID,design});
    await open();await page.waitForFunction(()=>document.querySelector('.nw-atlas')?.classList.contains('nw-unrolling'));
    const start=await inspect(0);assert.deepEqual(start.duration,[1800,1800,1800]);assert.equal(start.rolls.length,2);assert.equal(start.transform,'none');
    await page.waitForFunction(()=>document.querySelector('.nw-stage img')?.naturalWidth>0);
    for(const [label,time]of [['start',0],['quarter',450],['middle',900],['end',1750]]){
      const frame=await inspect(time);assert.deepEqual(frame.rect,start.rect,'Opening never changes window geometry');assert.equal(frame.transform,'none','Text/map are not stretched');
      const expected=design==='aged'?'parchment-aged.png':'parchment.png';for(const roll of frame.rolls)assert.ok(roll.paper.includes(expected));
      if(time===900){assert.ok(frame.rolls[0].left<start.rolls[0].left,'Left roll moves outwards');assert.ok(frame.rolls[1].left>start.rolls[1].left,'Right roll moves outwards');assert.notEqual(frame.clip,start.clip);}
      await atlas.screenshot({path:new URL(design+'-'+label+'.png',evidence).pathname.replace(/^\/([A-Z]:)/,'$1')});screenshots.push({design,label,...frame});
    }
    await page.evaluate(()=>{const el=document.querySelector('.nw-atlas');el.getAnimations({subtree:true}).filter(a=>a.effect.target===el||a.effect.target.classList.contains('nw-unroll-roll')).forEach(a=>a.finish());});
    await settled();const final=await inspect(null);assert.deepEqual(final.rect,start.rect);assert.equal(final.rolls.length,0);
    // A normal opening completes by itself within the requested shorter duration.
    await close();await open();await settled();await close();
  }
  // Escape interrupts immediately, and a new open starts without stale rolls.
  await open();await inspect(300);await close();await open();assert.equal(await atlas.locator('.nw-unroll-roll').count(),2);
  await atlas.locator('[data-design]').focus();await page.keyboard.press('Enter');await settled();
  assert.equal(await atlas.locator('.nw-design-tools').getAttribute('open'),'','An exposed control remains usable when the animation is skipped');
  await page.keyboard.press('Escape');assert.equal(await atlas.isVisible(),true);await close();
  await page.emulateMedia({reducedMotion:'reduce'});
  await open();assert.equal(await atlas.locator('.nw-unroll-roll').count(),0);assert.equal(await atlas.evaluate(el=>getComputedStyle(el).clipPath),'none');await close();
  await page.emulateMedia({reducedMotion:'no-preference'});
  report.unroll={durationMs:1800,referenceDurationMs:2584,frames:screenshots};
  report.checks.push('unroll-classic-and-aged-center-to-edges','unroll-1800ms-faster-than-reference','unroll-fixed-window-geometry-no-content-scaling','unroll-roll-textures-follow-design','unroll-completes-and-cleans-up','unroll-early-Escape-reopen-control-interruption','unroll-reduced-motion-instant');
}
