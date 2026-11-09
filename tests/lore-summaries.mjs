import assert from 'node:assert/strict';

// Editorial expectations, independent of the journal compiler and source prose.
export const loreCases=[
  {id:'starshine',en:'Starshine Academy',ru:'Академия Звёздного сияния',uk:'Академія Зоряного сяйва',fact:{ru:/садоводства/,uk:/садівництва/},era:/1480/,historical:false},
  {id:'blackule-lane',en:'Blackule Lane',ru:'Блэкьюл-лейн',uk:'Блек’юл-лейн',fact:{ru:/Улица района озера/,uk:/Вулиця району озера/},era:/1480/,historical:false},
  {id:'neverwinter-academy',en:'Neverwinter Academy',ru:'Невервинтерская академия',uk:'Невервінтерська академія',fact:{ru:/1372/,uk:/1372/},era:/1372/,historical:true},
  {id:'shining-serpent',en:'Shining Serpent Inn',ru:'Гостиница «Сияющий змей»',uk:'Готель «Сяйний змій»',fact:{ru:/разрушена.*1451/,uk:/зруйновано.*1451/},era:/1451/,historical:true},
  {id:'board-laid-bare',en:'The Board Laid Bare',ru:'«Накрытый стол»',uk:'«Накритий стіл»',fact:{ru:/не подавали/,uk:/не подавали/},era:/XIV/,historical:true},
  {id:'sune-park',en:'Sacred Park of Sune',ru:'Священный парк Суны',uk:'Священний парк Суни',fact:{ru:/богини любви и красоты/,uk:/богині кохання та краси/},era:/1492/,historical:false},
  {id:'magic-academy',en:'Neverwinter Academy of Magic',ru:'Невервинтерская академия магии',uk:'Невервінтерська академія магії',fact:{ru:/академию уничтожил пожар/,uk:/академію знищила пожежа/},era:/1374/,historical:true},
  {id:'waukeen-temple',en:'Temple of Waukeen',ru:'Храм Вокин',uk:'Храм Вокін',fact:{ru:/конторы торговых объединений/,uk:/контори торговельних об’єднань/},era:/1374/,historical:true,outsideCatalogue:true},
  {id:'sand-shop',en:"Sand's Magic Shop",ru:'Магическая лавка Сэнда',uk:'Магічна крамниця Сенда',fact:{ru:/Сифон Вантина/,uk:/Сифон Вантіна/},era:/1374/,historical:true},
  {id:'sunken-flagon',en:'Sunken Flagon',ru:'Таверна «Затонувшая кружка»',uk:'Таверна «Затонулий кухоль»',fact:{ru:/Дункана Фарлонга/,uk:/Дункана Фарлонга/},era:/1374/,historical:true}
];

export async function loreSummaries(page,report){
  await page.locator('body').click({position:{x:500,y:20}});await page.keyboard.press('KeyM');
  const atlas=page.locator('.nw-atlas');await atlas.waitFor();
  await atlas.locator('[data-period-filter]').selectOption('all');
  const stored=await page.evaluate(async()=>{
    const journals=await game.packs.get('neverwinter-atlas.city').getDocuments();
    return journals.map(j=>({language:j.getFlag('neverwinter-atlas','language'),pages:j.pages.contents.map(p=>({key:p.getFlag('neverwinter-atlas','key'),id:p.id,html:p.text.content}))}));
  });
  assert.deepEqual(stored.map(j=>j.language).sort(),['ru','uk']);
  for(const journal of stored){
    assert.equal(journal.pages.length,60);
    for(const item of loreCases){
      const p=journal.pages.find(p=>p.key===item.id);assert.ok(p);assert.match(p.html,item.fact[journal.language]);assert.match(p.html,item.era);assert.match(p.html,/1492/);
    }
  }
  for(const language of ['ru','uk']){
    await atlas.locator(`[data-lang="${language}"]`).click();
    for(const item of loreCases){
      await atlas.locator('input[type=search]').fill(item.en);
      const entry=atlas.locator(`nav [data-list-place="${item.id}"]`);await entry.click();
      assert.equal(await atlas.locator('article h3').first().innerText(),`${item[language]} (${item.en})`);
      assert.match(await atlas.locator('.nw-summary').innerText(),item.fact[language]);
      assert.match(await atlas.locator('.nw-era').innerText(),item.era);
      assert.equal(await atlas.locator('.nw-position-status').getAttribute('data-precision'),'overview');
    }
  }
  // Exercise the existing historical filter: destroyed establishments are not
  // presented as current services, while post-catastrophe school lore remains.
  for(const item of loreCases){
    await atlas.locator('[data-period-filter]').selectOption('all');
    await atlas.locator('input[type=search]').fill(item.en);
    await atlas.locator('[data-period-filter]').selectOption('hide');
    assert.equal(await atlas.locator(`nav [data-list-place="${item.id}"]`).count(),item.historical?0:1);
  }
  await atlas.locator('[data-period-filter]').selectOption('all');
  await atlas.locator('input[type=search]').fill('Neverwinter Academy of Magic');
  await atlas.locator('nav [data-list-place="magic-academy"]').click();
  await atlas.locator('article [data-go="waukeen-temple"]').click();
  assert.match(await atlas.locator('.nw-summary').innerText(),/рештках школи магії/);
  await atlas.locator('article [data-go="magic-academy"]').click();
  assert.equal(await atlas.locator('article h3').first().innerText(),'Невервінтерська академія магії (Neverwinter Academy of Magic)');
  await atlas.locator('input[type=search]').fill('Starshine Academy');
  await atlas.locator('nav button').filter({hasText:'Starshine Academy'}).click();
  await atlas.getByRole('button',{name:'Відкрити журнал',exact:true}).click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.journal-entry')].some(el=>el.innerText.includes('Академія Зоряного сяйва')&&el.innerText.includes('садівництва')));
  await page.evaluate(async()=>{for(const app of foundry.applications.instances.values())if(app.document?.documentName==='JournalEntry')await app.close();});
  await atlas.locator('[data-close]').click();
  report.checks.push('60-bilingual-summary-pages','ten-lore-facts-and-era-limits-RU-UA','search-opens-localized-summary-cards','historical-filter-keeps-current-school-hides-old-venues','academy-temple-linked-navigation-distinguishes-historical-sites','summary-opens-ukrainian-journal');
}
