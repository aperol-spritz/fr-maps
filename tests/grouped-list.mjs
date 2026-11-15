import assert from 'node:assert/strict';
export async function groupedList(page,report){
 await page.locator('body').click({position:{x:500,y:20}});await page.keyboard.press('KeyM');
 const atlas=page.locator('.nw-atlas');await atlas.waitFor();
 for(const language of ['ru','uk']){
  await atlas.locator(`[data-lang="${language}"]`).click();
  await atlas.locator('input[type=search]').fill('a');
  const result=await atlas.locator('nav').evaluate(nav=>{
   const groups=[];for(const el of nav.children){if(el.matches('[data-list-group]'))groups.push({id:el.dataset.listGroup,names:[]});else if(el.matches('[data-list-place]'))groups.at(-1).names.push(el.textContent.trim().replace(/\s+\([^)]*\)$/u,''));}
   return groups;
  });
  assert.ok(result.length>=3);
  for(const group of result){assert.ok(group.names.length);assert.deepEqual(group.names,[...group.names].sort(new Intl.Collator(language,{sensitivity:'base',numeric:true,ignorePunctuation:true}).compare));}
  await atlas.locator('input[type=search]').fill('Castle Never');
  assert.equal(await atlas.locator('[data-list-group]').count(),1);assert.equal(await atlas.locator('[data-list-group]').getAttribute('data-list-group'),'administration');
  await atlas.locator('[data-list-place=castle]').click();await atlas.locator('article h3').waitFor();
  await atlas.locator('input[type=search]').fill('no-location-matches-12345');assert.equal(await atlas.locator('[data-list-group]').count(),0);
 }
 await atlas.locator('[data-close]').click();await atlas.waitFor({state:'detached'});
 report.checks.push('functional-group-headings-RU-UA','alphabetical-rows-within-groups','search-preserves-groups-hides-empty-groups','grouped-row-opens-location');
}
