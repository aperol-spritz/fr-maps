import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export async function regionPoint(page,id) {
  return page.locator('.nw-atlas .nw-viewport').evaluate((viewport,id)=>{
    const polygon=viewport.querySelector('[data-zone="'+id+'"]');if(!polygon)throw Error('Missing territory '+id);
    const r=polygon.getBoundingClientRect(),v=viewport.getBoundingClientRect();
    for(let y=Math.max(v.top+2,r.top);y<Math.min(v.bottom-2,r.bottom);y+=3)for(let x=Math.max(v.left+2,r.left);x<Math.min(v.right-2,r.right);x+=3)if(document.elementFromPoint(x,y)===polygon)return{x,y};
    throw Error('No visible surface for '+id);
  },id);
}
export async function clickRegion(page,id) {const p=await regionPoint(page,id);await page.mouse.click(p.x,p.y);}
export async function territoriesFlow(page,report) {
  const atlas=page.locator('.nw-atlas'),ids=['lake','river','river-district','blacklake-district','chasm','protector','pirates-skyhold','fisher','neverdeath','paupers','docks','mask-earthmote'];
  const source=JSON.parse(await fs.readFile(new URL('../data/region-default-source.json',import.meta.url)));
  assert.equal(createHash('sha256').update(JSON.stringify(source.regions)).digest('hex'),source.sha256);
  for(const region of source.regions)assert.deepEqual((await atlas.locator('[data-zone="'+region.id+'"]').getAttribute('points')).split(' ').map(p=>p.split(',').map(Number)),region.shape.points);
  assert.deepEqual((await atlas.locator('[data-zone]').evaluateAll(nodes=>nodes.map(n=>n.dataset.zone))).sort(),ids.slice().sort());
  for(const id of ids)assert.equal(await atlas.locator('[data-place="'+id+'"]').count(),0,'Territory has no separate pin: '+id);
  assert.equal(await atlas.locator('[data-place=mask]').count(),1,'The inn keeps its own marker');
  await atlas.locator('input[type=search]').hover();const region=atlas.locator('[data-zone=lake]');
  const before=await region.evaluate(e=>({fill:Number(getComputedStyle(e).fillOpacity),stroke:parseFloat(getComputedStyle(e).strokeWidth)}));
  assert.equal(await region.evaluate(e=>getComputedStyle(e).strokeDasharray),'none','Hidden territory outlines are solid');
  const hover=await regionPoint(page,'lake');await page.mouse.move(hover.x,hover.y);
  await page.waitForFunction(({id,before})=>{const e=document.querySelector('[data-zone="'+id+'"]'),s=getComputedStyle(e);return Number(s.fillOpacity)>before.fill+.1 && parseFloat(s.strokeWidth)>before.stroke+1;},{id:'lake',before});
  const names={lake:'Bluelake',river:'Neverwinter River','river-district':'River District','blacklake-district':'Bluelake District',chasm:'Chasm District',protector:'Protector’s Enclave','pirates-skyhold':"Pirates' Skyhold",fisher:'Fisher’s Float',neverdeath:'Neverdeath',paupers:'Pauper',docks:'Neverwinter Docks','mask-earthmote':'Маска Лунного Камня'};
  for(const id of ids){await clickRegion(page,id);assert.ok((await atlas.locator('h3').innerText()).includes(names[id]),'Click opens the correct territory lore: '+id);}
  assert.equal(await atlas.locator('h3').innerText(),'Маска Лунного Камня');
  await atlas.getByRole('button',{name:'Открыть журнал',exact:true}).click();
  await page.waitForFunction(()=>[...foundry.applications.instances.values()].some(a=>a.rendered && a.document?.documentName==='JournalEntry' && a.element.innerText.includes('Парящий участок земли')));
  await page.evaluate(async()=>{for(const a of foundry.applications.instances.values())if(a.document?.documentName==='JournalEntry')await a.close();});
  await clickRegion(page,'paupers');assert.match(await atlas.locator('h3').innerText(),/Pauper/);
  await clickRegion(page,'neverdeath');assert.match(await atlas.locator('h3').innerText(),/Neverdeath/);
  await atlas.locator('[data-close]').click();await page.locator('body').click({position:{x:500,y:20}});await page.keyboard.press('KeyM');
  await page.waitForFunction(()=>document.querySelector('.nw-stage>img')?.naturalWidth===3200 && parseFloat(document.querySelector('.nw-stage')?.style.width)>0);
  report.checks.push('twelve-user-contours-exact-defaults','twelve-territories-without-duplicate-pins-and-Mask-inn-retained','territory-hover-outline-and-fill','real-territory-click-opens-lore-and-journal','nested-Paupers-and-Neverdeath-independently-clickable','Mask-island-name-without-English-suffix');
}
