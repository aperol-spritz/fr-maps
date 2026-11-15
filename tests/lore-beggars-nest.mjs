import assert from 'node:assert/strict';

export async function beggarsNestLore(page,report){
  await page.locator('body').click({position:{x:500,y:20}});await page.keyboard.press('KeyM');
  const atlas=page.locator('.nw-atlas');await atlas.waitFor();
  await atlas.locator('input[type=search]').fill('');
  await atlas.locator('[data-category]').selectOption('all');
  await atlas.locator('[data-territories]').click();
  await page.locator('.nw-territory-manager [data-show-regions]').check();
  await page.locator('.nw-territory-manager [data-dialog-close]').click();
  const coverage=await atlas.evaluate(async el=>{
    const source=await (await fetch('/modules/neverwinter-atlas/data/places.json')).json();
    const pins=[...el.querySelectorAll('.nw-pin[data-place]')].map(p=>p.dataset.place);
    const areas=[...el.querySelectorAll('polygon[data-zone]')].map(p=>p.dataset.zone);
    const expectedPins=source.filter(p=>p.keepMarker||!(p.area||p.territoryOnly||p.shape?.points?.length>=3)).map(p=>p.id);
    const expectedAreas=source.filter(p=>p.shape?.points?.length>=3&&!p.shape.hidden).map(p=>p.id);
    return {pins:pins.sort(),areas:areas.sort(),expectedPins:expectedPins.sort(),expectedAreas:expectedAreas.sort(),unrepresented:source.filter(p=>!pins.includes(p.id)&&!areas.includes(p.id)).map(p=>p.id)};
  });
  assert.deepEqual(coverage.pins,coverage.expectedPins);assert.deepEqual(coverage.areas,coverage.expectedAreas);
  assert.equal(coverage.pins.length,54);assert.equal(coverage.areas.length,12);assert.deepEqual(coverage.unrepresented,[]);
  report.mapCoverage={locations:66,pins:54,territories:12,pinIds:coverage.pins,territoryIds:coverage.areas,unrepresented:[],scope:'Bundled Neverwinter defaults, GM, no search/category filter, regions enabled; does not audit an existing campaign world.'};
  for(const language of ['ru','uk']){
    await atlas.locator(`[data-lang="${language}"]`).click();
    for(const alias of ["Beggar's Nest",'Beggar’s Nest','Гнездо нищих','Гніздо жебраків']){
      await atlas.locator('input[type=search]').fill(alias);
      assert.equal(await atlas.locator('nav [data-list-place]').count(),1);
      await atlas.locator('nav [data-list-place="chasm"]').click();
      assert.match(await atlas.locator('.nw-summary').innerText(),/1451/);
      assert.match(await atlas.locator('.nw-summary').innerText(),language==='ru'?/Гнезда нищих/:/Гнізда жебраків/);
    }
    await atlas.locator('article [data-go="neverwinter-academy"]').click();
    await atlas.locator('article [data-go="shining-serpent"]').click();
    await atlas.locator('article [data-go="chasm"]').click();
    await atlas.locator('article [data-go="paupers"]').click();
    assert.match(await atlas.locator('article [data-open-journal]').innerText(),language==='ru'?/Поле нищих/:/Поле жебраків/);
  }
  await atlas.locator('input[type=search]').fill('');
  const territory=atlas.locator('polygon[data-zone="chasm"]');await territory.focus();await territory.press('Enter');
  assert.match(await atlas.locator('.nw-summary').innerText(),/Гнізда жебраків/);
  await atlas.locator('article [data-open-journal]').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.journal-entry')].some(el=>el.innerText.includes('Гніздо жебраків було житловим районом XIV століття')));
  const journals=await page.evaluate(async()=>{const docs=await game.packs.get('neverwinter-atlas.city').getDocuments();return docs.map(j=>({lang:j.getFlag('neverwinter-atlas','language'),pages:j.pages.map(p=>({key:p.getFlag('neverwinter-atlas','key'),html:p.text.content}))}));});
  for(const j of journals){assert.equal(j.pages.length,66);const text=id=>j.pages.find(p=>p.key===id).html;
    assert.match(text('chasm'),j.lang==='ru'?/Гнездо нищих было жилым районом/:/Гніздо жебраків було житловим районом/);
    assert.match(text('paupers'),j.lang==='ru'?/Гнездо нищих было жилым районом/:/Гніздо жебраків було житловим районом/);
    for(const id of ['neverwinter-academy','shining-serpent'])assert.match(text(id),/1451/);
  }
  await page.evaluate(async()=>{for(const app of foundry.applications.instances.values())if(app.document?.documentName==='JournalEntry')await app.close();});
  await atlas.locator('[data-close]').click();
  report.checks.push('all-66-locations-render-as-54-pins-and-12-territories','Beggars-Nest-four-aliases-open-existing-Chasm-RU-UA','historical-academy-inn-and-paupers-links-navigate','Chasm-territory-opens-historical-summary-and-UK-journal','Beggars-Nest-and-paupers-remain-distinct-in-both-journals');
}
