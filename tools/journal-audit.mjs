// Audit the actual compiled rows, with case-sensitive ZIP names on every OS.
// No network requests: a release must carry its media rather than depend on a host.
export function auditJournals(manifest, packs, entries) {
  const documents=new Set(), report={journals:0,pages:0,pageTypes:{},media:[],internalLinks:0,externalLinks:[],dependencies:[]};
  const fail=message=>{throw Error('Journal audit: '+message);};
  for(const [name,rows] of Object.entries(packs)) {
    const journals=new Map(rows.filter(([key])=>key.startsWith('!journal!')).map(([,value])=>[value._id,value]));
    const pages=new Map(rows.filter(([key])=>key.startsWith('!journal.pages!')));
    for(const [id,journal] of journals) {
      report.journals++;
      const uuid=`Compendium.${manifest.id}.${name}.JournalEntry.${id}`;
      documents.add(uuid);documents.add(`Compendium.${manifest.id}.${name}.${id}`);
      if(new Set(journal.pages).size!==journal.pages.length)fail('Duplicate page ID: '+uuid);
      for(const pageId of journal.pages) {
        const page=pages.get(`!journal.pages!${id}.${pageId}`);
        if(!page || page._id!==pageId)fail('Missing/mismatched page: '+uuid+'.'+pageId);
        documents.add(uuid+'.JournalEntryPage.'+pageId);
        documents.add(`Compendium.${manifest.id}.${name}.${id}.JournalEntryPage.${pageId}`);
        report.pages++;report.pageTypes[page.type]=(report.pageTypes[page.type]??0)+1;
      }
    }
    if(pages.size!==[...journals.values()].reduce((n,j)=>n+j.pages.length,0))fail('Orphan page in '+name);
  }
  const decode=value=>value.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#(?:x([0-9a-f]+)|(\d+));/gi,(_,hex,dec)=>String.fromCodePoint(parseInt(hex??dec,hex?16:10)));
  function media(value,location) {
    value=decode(value).trim();if(!value)return;
    if(/^data:/i.test(value)) {report.media.push({location,path:'embedded data URI'});return;}
    if(/^(?:https?:|\/\/)/i.test(value))fail('External media must be bundled: '+value+' at '+location);
    let file;try{file=decodeURIComponent(value.split(/[?#]/)[0]);}catch{fail('Invalid URL: '+value);}
    const prefix=`modules/${manifest.id}/`;
    if(!file.startsWith(prefix))fail('Media outside this module: '+value+' at '+location);
    file=file.slice(prefix.length);
    if(!file.startsWith('assets/')||file.includes('\\')||file.split('/').some(p=>!p||p==='.'||p==='..'))fail('Unsafe media path: '+value);
    if(!Object.hasOwn(entries,file))fail('Missing asset or filename case mismatch: '+file+' at '+location);
    report.media.push({location,path:prefix+file});
  }
  function scan(value,location,key='') {
    if(Array.isArray(value)){value.forEach((v,i)=>scan(v,location+'.'+i));return;}
    if(value&&typeof value==='object'){for(const [k,v]of Object.entries(value))scan(v,location+'.'+k,k);return;}
    if(typeof value!=='string')return;
    if(['src','img','background','poster'].includes(key)&&!(key==='background'&&/^#[0-9a-f]{3,8}$/i.test(value)))media(value,location);
    for(const match of value.matchAll(/@UUID\[([^\]]+)\]/g)) {
      const uuid=match[1].split('#')[0];
      if(documents.has(uuid))report.internalLinks++;
      else if(uuid.startsWith(`Compendium.${manifest.id}.`) || /^(?:JournalEntry\.|\.)/.test(uuid))fail('Unresolved journal link: '+match[1]);
      else report.dependencies.push({location,uuid:match[1]});
    }
    if(/@JournalEntry\[/.test(value))fail('Legacy world journal link at '+location);
    for(const match of value.matchAll(/\b(?:src|poster|data)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi))media(match[1]??match[2]??match[3],location);
    for(const match of value.matchAll(/\bsrcset\s*=\s*(?:"([^"]*)"|'([^']*)')/gi))for(const candidate of (match[1]??match[2]).split(','))media(candidate.trim().split(/\s+/)[0],location);
    for(const match of value.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi))media(match[1]??match[2]??match[3],location);
    for(const match of value.matchAll(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
      const url=decode(match[1]??match[2]);
      // Hyperlinks (including cited PDF books) are references, not embedded
      // page media. Preserve them and explicitly report their online dependency.
      if(/^https?:/i.test(url))report.externalLinks.push(url);
      else if(/\.(?:pdf|png|jpe?g|webp|gif|svg|avif|mp[34]|ogg|wav|webm|m4[av])(?:[?#]|$)/i.test(url))media(url,location);
      else if(url&&!url.startsWith('#'))fail('Unresolved HTML link: '+url+' at '+location);
    }
  }
  for(const [pack,rows]of Object.entries(packs))for(const [key,value]of rows)scan(value,pack+':'+key);
  report.externalLinks=[...new Set(report.externalLinks)].sort();
  if(report.dependencies.length)fail('External document dependencies: '+JSON.stringify(report.dependencies));
  return report;
}
