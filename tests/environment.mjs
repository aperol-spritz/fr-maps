import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
// Current verified Atlas baseline (2026-11-15); GEM has an independent baseline.
export const CURRENT_DND5E_VERSION='6.1.0';
export const SUPPORTED_DND5E_VERSIONS=['6.0.6',CURRENT_DND5E_VERSION];
export async function environment(){
 assert.match(process.versions.node,/^24\./,'Use Node 24');
 const app=path.resolve(process.env.GEM_FOUNDRY_APP || 'F:/FoundryVTT/Foundry Virtual Tabletop/resources/app');
 const system=path.resolve(process.env.GEM_DND5E_SYSTEM || new URL('../../../systems/dnd5e/',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'));
 const license=path.resolve(process.env.GEM_FOUNDRY_LICENSE || 'F:/FoundryVTT/Config/license.json');
 const release=JSON.parse(await fs.readFile(path.join(app,'package.json'))).release;
 const foundryVersion=`${release.generation}.${release.build}`;
 assert.ok(['14.369','14.370'].includes(foundryVersion),'Unsupported Foundry: '+foundryVersion);
 const systemVersion=JSON.parse(await fs.readFile(path.join(system,'system.json'))).version;
 assert.ok(SUPPORTED_DND5E_VERSIONS.includes(systemVersion),'Unsupported dnd5e: '+systemVersion);
 await fs.access(license);
 const port=Number(process.env.GEM_TEST_PORT || 30147);assert.ok(Number.isInteger(port)&&port>1024&&port<65536);
 return {app,system,license,port,foundryVersion,systemVersion,baseURL:`http://127.0.0.1:${port}`};
}
