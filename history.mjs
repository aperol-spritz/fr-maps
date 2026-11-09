// One window's ordered history. Only successful operations are recorded.
// Serializing an undo behind a pending save also handles a quick Ctrl+Z.
export function actionHistory(limit=100) {
  const entries=[];let pending=Promise.resolve();
  const enqueue=action=>{const next=pending.catch(()=>{}).then(action);pending=next;return next;};
  return {
    perform(kind,action){return enqueue(async()=>{const undo=await action();if(typeof undo==='function'){entries.push({kind,undo});if(entries.length>limit)entries.shift();}});},
    undo(kind,fallback){return enqueue(async()=>{
      for(let i=entries.length-1;i>=0;i--)if(!kind || entries[i].kind===kind){const [entry]=entries.splice(i,1);if(await entry.undo()!==false)return;}
      await fallback?.();
    });}
  };
}
