import assert from 'node:assert/strict';

export const skyholdCases=[
  {id:'skull-fortress',en:'Skull Fortress',ru:'Крепость Черепа',uk:'Фортеця Черепа',fact:{ru:/заграждений, обращённых к болоту/,uk:/загороджень, обернених до болота/}},
  {id:'vilebog',en:'Vilebog',ru:'Гиблое болото',uk:'Згубне болото',fact:{ru:/западнее Крепости Черепа/,uk:/на захід від Фортеці Черепа/}}
];
export async function skyholdLore(page,report){
  await page.locator('body').click({position:{x:500,y:20}});await page.keyboard.press('KeyM');
  const atlas=page.locator('.nw-atlas');await atlas.waitFor();
  for(const language of ['ru','uk']){
    await atlas.locator(`[data-lang="${language}"]`).click();
    for(const item of skyholdCases){
      await atlas.locator('input[type=search]').fill(item.en);
      await atlas.locator(`nav [data-list-place="${item.id}"]`).click();
      assert.equal(await atlas.locator('article [data-open-journal]').innerText(),`${item[language]} (${item.en})`);
      assert.match(await atlas.locator('.nw-summary').innerText(),item.fact[language]);
    }
    for(const alias of ['Tower District','Башенный район','Вежовий район']){
      await atlas.locator('input[type=search]').fill(alias);
      assert.equal(await atlas.locator('nav [data-list-place="river-district"]').count(),1);
      await atlas.locator('nav [data-list-place="river-district"]').click();
      assert.match(await atlas.locator('article [data-open-journal]').innerText(),/River District/);
      assert.match(await atlas.locator('.nw-summary').innerText(),language==='ru'?/Восточная часть/:/Східна частина/);
    }
  }
  await atlas.locator('input[type=search]').fill('Skull Fortress');await atlas.locator('nav [data-list-place="skull-fortress"]').click();
  await atlas.locator('article [data-go="pirates-skyhold"]').click();
  await atlas.locator('article [data-go="vilebog"]').click();
  assert.match(await atlas.locator('.nw-summary').innerText(),/на захід від Фортеці Черепа/);
  await atlas.locator('article [data-go="skull-fortress"]').click();
  await atlas.locator('[data-open-journal]').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.journal-entry')].some(e=>e.innerText.includes('Фортеця Черепа')&&e.innerText.includes('загороджень, обернених до болота')));
  const actual=await page.evaluate(async()=>{
    const docs=await game.packs.get('neverwinter-atlas.city').getDocuments();return docs.map(j=>({language:j.getFlag('neverwinter-atlas','language'),pages:j.pages.map(p=>({key:p.getFlag('neverwinter-atlas','key'),html:p.text.content}))}));
  });
  for(const journal of actual){assert.equal(journal.pages.length,66);for(const item of skyholdCases)assert.match(journal.pages.find(p=>p.key===item.id).html,item.fact[journal.language]);}
  await page.evaluate(async()=>{for(const a of foundry.applications.instances.values())if(a.document?.documentName==='JournalEntry')await a.close();});
  await atlas.locator('[data-close]').click();
  report.checks.push('two-island-surface-summaries-RU-UA','Tower-District-three-aliases-open-one-River-District','island-parent-and-surface-links-navigate','island-ukrainian-journal-opens','66-pages-per-language-no-extra-Tower-District');
}
