import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

// Inspect Foundry's enriched and sanitized HTML, rather than just compiler output.
export async function playerProse(page,report){
 const evidence=new URL('../docs/testing/player-prose-2026-11-15/',import.meta.url);
 await fs.mkdir(evidence,{recursive:true});
 for(const language of ['ru','uk']){
  await page.evaluate(async language=>{
   for(const app of foundry.applications.instances.values())if(app.document?.documentName==='JournalEntry')await app.close();
   const books=await game.packs.get('neverwinter-atlas.city').getDocuments();
   const book=books.find(b=>b.getFlag('neverwinter-atlas','language')===language);
   const lake=book.pages.find(p=>p.getFlag('neverwinter-atlas','key')==='lake');
   await book.sheet.render({force:true,pageId:lake.id,mode:1});
  },language);
  const footer=page.locator('.journal-entry .nw-journal-notes:visible').first();await footer.waitFor();
  const actual=await footer.evaluate(el=>{
   const parent=el.parentElement,paragraph=parent.querySelector('p');
   return {font:parseFloat(getComputedStyle(el).fontSize),bodyFont:parseFloat(getComputedStyle(paragraph).fontSize),text:parent.innerText,bodyBeforeNotes:!!(paragraph.compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING),links:[...el.querySelectorAll('a.content-link')].map(a=>a.dataset.uuid),sources:[...el.querySelectorAll('a[href^="https:"]')].map(a=>a.href)};
  });
  assert.ok(actual.font<actual.bodyFont,JSON.stringify(actual));
  assert.ok(actual.bodyBeforeNotes);assert.match(actual.text,/1489/);
  assert.doesNotMatch(actual.text,/Реконструк|сохраняем|зберігаємо|2026-\d\d-\d\d/);
  assert.ok(actual.links.length>0);assert.ok(actual.sources.some(url=>url.includes('forgottenrealms.fandom.com')));
  await page.locator('.journal-entry:visible').last().screenshot({path:fileURLToPath(new URL(language+'-lake.png',evidence))});
  report.playerProse??=[];report.playerProse.push({language,bodyFont:actual.bodyFont,notesFont:actual.font,links:actual.links.length});
 }
 await page.evaluate(async()=>{for(const app of foundry.applications.instances.values())if(app.document?.documentName==='JournalEntry')await app.close();});
 report.checks.push('RU-UA-player-lore-without-editorial-labels','rendered-journal-notes-smaller-and-below-prose','rendered-source-and-location-links');
}
