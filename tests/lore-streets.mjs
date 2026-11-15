import assert from 'node:assert/strict';

export const streetCases=[
  {id:'scar-keep',en:'Scar Keep',ru:'Крепость Шрама',uk:'Фортеця Шраму',fact:{ru:/гарнизон.*Разлома/,uk:/гарнізон.*Розлому/}},
  {id:'deekin-street',en:"Deekin's Street",ru:'Улица Дикина',uk:'Вулиця Дікіна',fact:{ru:/кобольда-барда Дикина/,uk:/кобольда-барда Дікіна/}},
  {id:'coriol-street',en:'Coriol Street',ru:'Улица Кориол',uk:'Вулиця Коріол',fact:{ru:/восточнее улицы Дикина/,uk:/на схід від вулиці Дікіна/}},
  {id:'tymor-street',en:'Tymor Street',ru:'Улица Тимор',uk:'Вулиця Тимор',fact:{ru:/улиц Анклава Защитника/,uk:/вулиць Анклаву Захисника/}}
];
export async function streetLore(page,report){
  await page.locator('body').click({position:{x:500,y:20}});await page.keyboard.press('KeyM');
  const atlas=page.locator('.nw-atlas');await atlas.waitFor();
  for(const language of ['ru','uk']){
    await atlas.locator(`[data-lang="${language}"]`).click();
    for(const item of streetCases){
      await atlas.locator('input[type=search]').fill(item.en);
      await atlas.locator(`nav [data-list-place="${item.id}"]`).click();
      assert.equal(await atlas.locator('article h3').first().innerText(),`${item[language]} (${item.en})`);
      assert.match(await atlas.locator('.nw-summary').innerText(),item.fact[language]);
      assert.equal(await atlas.locator('.nw-era').count(),0);
      assert.equal(await atlas.locator('.nw-position-status').count(),0);
    }
  }
  await atlas.locator('input[type=search]').fill("Deekin's Street");await atlas.locator('nav [data-list-place="deekin-street"]').click();
  await atlas.locator('article [data-go="coriol-street"]').click();assert.match(await atlas.locator('.nw-summary').innerText(),/на схід/);
  await atlas.locator('[data-open-journal]').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.journal-entry')].some(e=>e.innerText.includes('Вулиця Коріол')&&e.innerText.includes('на схід від вулиці Дікіна')));
  const pages=await page.evaluate(async()=>{
    const journals=await game.packs.get('neverwinter-atlas.city').getDocuments();return journals.map(j=>({language:j.getFlag('neverwinter-atlas','language'),pages:j.pages.map(p=>({key:p.getFlag('neverwinter-atlas','key'),html:p.text.content}))}));
  });
  for(const j of pages){assert.equal(j.pages.length,66);for(const item of streetCases)assert.match(j.pages.find(p=>p.key===item.id).html,item.fact[j.language]);}
  await page.evaluate(async()=>{for(const a of foundry.applications.instances.values())if(a.document?.documentName==='JournalEntry')await a.close();});
  await atlas.locator('[data-close]').click();
  report.checks.push('four-surface-lore-cards-RU-UA','street-related-navigation-opens-ukrainian-journal','all-new-lore-present-in-132-pages','new-lore-does-not-restore-editorial-metadata');
}
