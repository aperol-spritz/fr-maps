import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

// Run against the ZIP installed in a disposable Foundry world, never a campaign.
export async function designFlow(page,report){
  const ID='neverwinter-atlas',atlas=page.locator('.nw-atlas');
  const palette=atlas.locator('[data-design]'),menu=atlas.locator('.nw-design-tools');
  const open=async()=>{await page.locator('body').click({position:{x:500,y:20}});await page.keyboard.press('KeyM');await atlas.waitFor();};
  const selected=async value=>page.waitForFunction(value=>document.querySelector('.nw-atlas')?.dataset.design===value,value);
  const choose=async value=>{if(await menu.getAttribute('open')===null)await palette.click();await menu.locator(`[data-design-choice=${value}]`).click();await selected(value);};
  const geometry=async()=>{
    // Allow the existing ResizeObserver to finish refitting the map after a
    // window resize/maximize before comparing the two designs.
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    return atlas.evaluate(el=>Object.fromEntries([':scope','header','.nw-tools','.nw-body','.nw-viewport','.nw-stage','aside','footer'].map(selector=>{
    const node=selector===':scope'?el:el.querySelector(selector),r=node.getBoundingClientRect();
    return [selector,{x:r.x,y:r.y,width:r.width,height:r.height,padding:getComputedStyle(node).padding}];
    })));
  };
  const sameGeometry=(actual,expected)=>{
    for(const [selector,rect]of Object.entries(expected))for(const key of ['x','y','width','height'])assert.ok(Math.abs(actual[selector][key]-rect[key])<.1,`${selector}.${key} changed: ${rect[key]} -> ${actual[selector][key]}`);
    assert.equal(actual[':scope'].padding,expected[':scope'].padding,'Shared content padding');
  };
  const evidence=new URL('../docs/testing/design-menu-2026-11-15/',import.meta.url);await fs.mkdir(evidence,{recursive:true});
  const screenshot=async name=>atlas.screenshot({path:new URL(name+'.png',evidence).pathname.replace(/^\/([A-Z]:)/,'$1')});
  await page.evaluate(ID=>game.settings.set(ID,'design','classic'),ID);
  await open();await atlas.locator('[data-lang=ru]').click();
  assert.equal(await atlas.getAttribute('data-design'),'classic');
  assert.equal(await menu.evaluate(el=>el.previousElementSibling.hasAttribute('data-settings')&&el.nextElementSibling.dataset.lang==='ru'),true,'Palette menu between settings and RU');
  const state=await page.evaluate(ID=>JSON.stringify(game.settings.get(ID,'atlasState')),ID);
  assert.equal(await page.evaluate(ID=>game.settings.settings.get(ID+'.design').scope,ID),'client');
  await atlas.locator('input[type=search]').fill('Scar Keep');
  await atlas.locator('nav [data-list-place=scar-keep]').click();
  await atlas.locator('article h3').filter({hasText:'Scar Keep'}).waitFor({state:'visible'});
  await atlas.locator('[data-zoom="1"]').click();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const view=await atlas.locator('footer output').innerText(),normal=await geometry();
  await palette.focus();await page.keyboard.press('Enter');
  await menu.locator('[role=menu]').waitFor({state:'visible'});
  assert.equal(await atlas.getAttribute('data-design'),'classic','Opening menu never selects another design');
  assert.equal(await page.evaluate(ID=>game.settings.get(ID,'design'),ID),'classic');
  assert.equal(await menu.locator('[data-design-choice=classic]').getAttribute('aria-checked'),'true');
  assert.equal(await menu.locator('[data-design-choice=aged]').getAttribute('aria-checked'),'false');
  sameGeometry(await geometry(),normal);await screenshot('menu-classic');
  await page.keyboard.press('Escape');
  assert.equal(await menu.getAttribute('open'),null);assert.equal(await atlas.isVisible(),true,'Escape closes menu, preserves atlas');
  await palette.click();await atlas.locator('input[type=search]').click();assert.equal(await menu.getAttribute('open'),null,'Outside click dismisses menu');
  await palette.focus();await page.keyboard.press('Space');await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');
  assert.equal(await menu.locator('[data-design-choice=aged]').evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press('Enter');await selected('aged');sameGeometry(await geometry(),normal);
  assert.equal(await menu.getAttribute('open'),null,'Menu closes after selection');
  assert.equal(await palette.getAttribute('aria-expanded'),'false');
  assert.equal(await atlas.locator('input[type=search]').inputValue(),'Scar Keep');
  assert.match(await atlas.locator('article h3').first().innerText(),/Scar Keep/);
  assert.equal(await atlas.locator('footer output').innerText(),view);
  assert.match(await atlas.evaluate(el=>getComputedStyle(el,'::before').borderImageSource),/parchment-aged\.png/);
  await screenshot('aged');await palette.click();await screenshot('menu-aged');
  assert.equal(await menu.locator('[data-design-choice=aged]').getAttribute('aria-checked'),'true');
  await menu.locator('[data-design-choice=aged]').click();sameGeometry(await geometry(),normal);
  await choose('classic');sameGeometry(await geometry(),normal);await screenshot('classic');
  await atlas.locator('[data-maximize]').click();
  const maximized=await geometry();await choose('aged');sameGeometry(await geometry(),maximized);await screenshot('aged-maximized');
  await choose('classic');sameGeometry(await geometry(),maximized);await screenshot('classic-maximized');
  await atlas.locator('[data-maximize]').click();
  const originalViewport=page.viewportSize();await page.setViewportSize({width:1100,height:800});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const compact=await geometry();await choose('aged');sameGeometry(await geometry(),compact);await screenshot('aged-compact');
  await choose('classic');sameGeometry(await geometry(),compact);await screenshot('classic-compact');
  await page.setViewportSize(originalViewport);
  await choose('aged');await atlas.locator('[data-lang=uk]').click();
  await page.waitForFunction(()=>document.querySelector('.nw-design-tools summary')?.title==='Вибрати дизайн');
  await palette.click();assert.equal(await menu.locator('[data-design-choice=classic] span').nth(1).innerText(),'Класичний');
  assert.equal(await menu.locator('[data-design-choice=aged] span').nth(1).innerText(),'Старий пергамент');
  await palette.click();
  await atlas.locator('[data-close]').click();await atlas.waitFor({state:'detached'});await open();await selected('aged');
  assert.equal(await menu.getAttribute('open'),null,'Reopen starts with menu closed');
  await page.reload();await page.waitForFunction(()=>game.ready);await open();await selected('aged');
  await atlas.locator('[data-lang=ru]').click();await choose('classic');
  assert.match(await atlas.evaluate(el=>getComputedStyle(el,'::before').borderImageSource),/parchment\.png/);
  await atlas.locator('[data-close]').click();await atlas.waitFor({state:'detached'});await open();await selected('classic');
  assert.equal(await page.evaluate(ID=>JSON.stringify(game.settings.get(ID,'atlasState')),ID),state,'Design never changes map/world content');
  await atlas.locator('[data-close]').click();await atlas.waitFor({state:'detached'});
  report.design={geometry:{normal,maximized,compact}};
  report.checks.push('design-menu-between-settings-and-RU','opening-menu-preserves-design','design-menu-selected-checkmark','design-menu-keyboard-choice-Escape-outside-dismiss','design-identical-frame-content-map-geometry-normal-maximized-compact','design-preserves-selection-search-zoom','design-client-only-persists-reopen-reload','design-menu-RU-UA','classic-restored-world-content-unchanged');
}
