import assert from 'node:assert/strict';
const ID='neverwinter-atlas',MAP='modules/neverwinter-atlas/assets/neverwinter.webp';
export async function movementUndo(gm,reader,fixture,report,drag,coordinates) {
  const atlas=gm.locator('.nw-atlas'),settings=gm.locator('.nw-settings');
  const baseline=await coordinates(gm);
  const same=async(page,expected)=>page.waitForFunction(({ID,MAP,expected})=>{
    const p=game.settings.get(ID,'atlasState').maps[MAP].points.castle;
    return Math.abs(p.x-expected.x)<.00001 && Math.abs(p.y-expected.y)<.00001;
  },{ID,MAP,expected});
  const changed=async(page,before)=>page.waitForFunction(({ID,MAP,before})=>Math.abs(game.settings.get(ID,'atlasState').maps[MAP].points.castle.x-before.x)>1,{ID,MAP,before});
  const undo=async page=>{await page.locator('.nw-atlas .nw-viewport').focus();await page.keyboard.press('Control+z');};
  // The earlier real reader drag superseded the GM drag: do not undo it.
  await undo(gm);await gm.getByText('Положение уже изменено другим действием. Отмена этого перемещения пропущена.',{exact:true}).waitFor();
  assert.deepEqual(await coordinates(gm),baseline);
  await drag(gm);await changed(gm,baseline);await undo(gm);await same(gm,baseline);await same(reader,baseline);
  const tool=atlas.locator('.nw-drawing-tools');
  const draw=async()=>{
    if(!await tool.evaluate(e=>e.open))await tool.locator('summary').click();
    await tool.locator('[data-draw]').click();
    const points=await atlas.locator('.nw-stage').evaluate(e=>{const r=e.getBoundingClientRect();return [[.52,.35],[.57,.4]].map(([x,y])=>({x:r.x+r.width*x,y:r.y+r.height*y}));});
    await gm.mouse.move(points[0].x,points[0].y);await gm.mouse.down();await gm.mouse.move(points[1].x,points[1].y,{steps:8});await gm.mouse.up();
    await atlas.locator('[data-stroke]').waitFor();await tool.locator('[data-draw]').click();
    await tool.locator('summary').click();
  };
  await draw();await drag(gm);await changed(gm,baseline);await undo(gm);await same(gm,baseline);
  assert.equal(await atlas.locator('[data-stroke]').count(),1,'Move undo retains the preceding stroke');
  await undo(gm);await atlas.locator('[data-stroke]').waitFor({state:'detached'});
  await drag(gm);await changed(gm,baseline);const moved=await coordinates(gm);await draw();
  await undo(gm);await atlas.locator('[data-stroke]').waitFor({state:'detached'});assert.deepEqual(await coordinates(gm),moved,'Drawing undo retains the preceding move');
  await undo(gm);await same(gm,baseline);
  // Ctrl+Z in a form keeps its native text-editing meaning.
  await drag(gm);await changed(gm,baseline);const edited=await coordinates(gm);
  await atlas.locator('[data-point-settings]').click();await settings.locator('[name=publicRu]').fill('Черновик');await gm.keyboard.press('Control+z');
  assert.deepEqual(await coordinates(gm),edited);await settings.locator('[data-cancel]').click();await undo(gm);await same(gm,baseline);
  await same(reader,baseline);await drag(reader);await changed(reader,baseline);await undo(reader);await same(reader,baseline);await same(gm,baseline);
  // Permission must still be valid when undo runs, not just at drag time.
  await drag(reader);await changed(reader,baseline);const beforeRevocation=await coordinates(reader);
  await atlas.locator('[data-point-settings]').click();await settings.locator('[data-user="'+fixture.users[0].id+'"]').selectOption('2');await settings.locator('[type=submit]').click();await settings.waitFor({state:'detached'});
  await reader.waitForFunction(({ID,MAP,id})=>game.settings.get(ID,'atlasState').maps[MAP].points.castle.ownership[id]===2,{ID,MAP,id:fixture.users[0].id});
  await undo(reader);await reader.getByText('Немає права переміщувати цю локацію',{exact:true}).waitFor();assert.deepEqual(await coordinates(reader),beforeRevocation);
  await atlas.locator('[data-point-settings]').click();await settings.locator('[data-user="'+fixture.users[0].id+'"]').selectOption('3');await settings.locator('[type=submit]').click();await settings.waitFor({state:'detached'});
  // Return only the movement fixture to its earlier state. Keep unrelated data.
  await gm.evaluate(async({ID,MAP,baseline})=>{const next=foundry.utils.deepClone(game.settings.get(ID,'atlasState'));Object.assign(next.maps[MAP].points.castle,baseline);await game.settings.set(ID,'atlasState',next);},{ID,MAP,baseline});
  await same(reader,baseline);assert.equal(await atlas.locator('[data-stroke]').count(),0);
  report.checks.push('move-undo-Ctrl-Z-GM-and-player-sync','move-and-drawing-undo-in-chronological-order','move-undo-preserves-native-text-undo','move-undo-rechecks-current-permission','move-undo-does-not-overwrite-another-user-position');
}
