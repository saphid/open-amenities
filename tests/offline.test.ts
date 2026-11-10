// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {normalize} from '../server/normalize';
const [place]=normalize({type:'node',id:123,lat:1,lon:2,tags:{amenity:'drinking_water',access:'yes'}});
function offline(expiry:number){
  document.body.innerHTML='<section id="saved"></section><button id="clear">Clear</button>';
  const snapshot={label:'Test area',result:{fetchedAt:'2026-01-01',places:[place],evidence:{[place.id]:[{type:'not-drinkable',observedOn:'2026-01-01',expiresAt:new Date(expiry).toISOString()}]}}};
  const localStorage={getItem:()=>JSON.stringify(snapshot),removeItem:()=>{}};
  runInNewContext(readFileSync('public/offline.js','utf8'),{document,localStorage,Date});
  return document.getElementById('saved')!.textContent;
}
describe('saved water warnings',()=>{
  it('keeps an active unsafe-water observation prominent offline',()=>expect(offline(Date.now()+86400000)).toContain('DO NOT DRINK'));
  it('does not silently present an expired saved water warning as safe',()=>expect(offline(Date.now()-86400000)).toContain('current water safety is unknown'));
});
