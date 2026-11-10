import { describe,expect,it,vi,afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { SqlStorage } from '@cloudflare/workers-types';
import { SourceCache } from '../worker/cache.ts';
import { ClientLimits, serveApi } from '../worker/api.ts';
import { OsmProvider, ProviderError, type Provider } from '../server/provider.ts';
const databases:DatabaseSync[]=[];
function cache(){
  const db=new DatabaseSync(':memory:');databases.push(db);
  const sql={exec:(query:string,...params:unknown[])=>{
    const statement=db.prepare(query);
    if(statement.columns().length)return {toArray:()=>statement.all(...params as (string|number)[])};
    statement.run(...params as (string|number)[]);return {toArray:()=>[]};
  }} as unknown as SqlStorage;
  return {store:new SourceCache(sql),sql,db};
}
afterEach(()=>{for(const db of databases.splice(0))db.close();vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('hosted read-only cache and global policy',()=>{
  it('keeps source data and the geocoder gate across cache instances',()=>{
    const {store,sql}=cache();store.cache('source',{count:3});expect(store.claimGeocode()).toBe(true);
    const restarted=new SourceCache(sql);expect(restarted.cached('source',10000)?.value).toEqual({count:3});expect(restarted.claimGeocode()).toBe(false);
    expect(restarted.evidence()).toEqual({});
  });
  it('bounds persistent cache count, expiration and SQLite row size',()=>{
    const {store,db}=cache();for(let i=0;i<305;i++)store.cache(`key:${i}`,i);
    expect(db.prepare('SELECT count(*) AS n FROM cache').get()?.n).toBe(300);
    db.prepare('UPDATE cache SET created=0').run();store.cache('fresh',true);
    expect(db.prepare('SELECT count(*) AS n FROM cache').get()?.n).toBe(1);
    store.cache('huge','x'.repeat(1_500_001));expect(store.cached('huge',10000)).toBeNull();
  });
  it('prevents geocoder bursts after provider reconstruction but allows cached searches',async()=>{
    const {store,sql}=cache();const fetcher=vi.fn().mockResolvedValue(new Response('[{"lat":"1","lon":"2","display_name":"Example"}]'));vi.stubGlobal('fetch',fetcher);
    const config={overpass:'https://example.org',geocoder:'https://example.org',userAgent:'Test contact',geocodingEnabled:true,claimGeocode:()=>store.claimGeocode()};
    await new OsmProvider(store,config).search('Sydney');
    const restarted=new SourceCache(sql);const provider=new OsmProvider(restarted,{...config,claimGeocode:()=>restarted.claimGeocode()});
    expect(await provider.search('Sydney')).toHaveLength(1);await expect(provider.search('London')).rejects.toThrow('wait');expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('limits clients across a minute, bounds memory and expires counters',()=>{
    const limits=new ClientLimits();for(let i=0;i<60;i++)expect(limits.allow('a',0)).toBe(true);expect(limits.allow('a',1)).toBe(false);
    expect(limits.allow('b',1)).toBe(true);expect(limits.allow('a',60000)).toBe(true);
    const bounded=new ClientLimits();for(let i=0;i<5000;i++)expect(bounded.allow(String(i),0)).toBe(true);expect(bounded.allow('extra',1)).toBe(false);expect(bounded.allow('extra',60001)).toBe(true);
  });
});

describe('hosted API contract',()=>{
  const provider:Provider={nearby:vi.fn(),search:vi.fn()};
  it('leaves reports impossible to enable and never sends private notes upstream',async()=>{
    const r=await serveApi(new Request('https://example.org/api/reports',{method:'POST',body:'private note'}),provider);expect(r.status).toBe(503);
    const config=await serveApi(new Request('https://example.org/api/config'),provider);expect((await config.json()).reportsEnabled).toBe(false);
  });
  it('validates coordinates, methods, search and unknown API routes',async()=>{
    for(const path of ['/api/nearby?lat=NaN&lon=2','/api/nearby?lat=86&lon=2','/api/search?q=x'])expect((await serveApi(new Request('https://example.org'+path),provider)).status).toBe(400);
    expect((await serveApi(new Request('https://example.org/api/nearby',{method:'POST'}),provider)).status).toBe(405);
    expect((await serveApi(new Request('https://example.org/api/nope'),provider)).status).toBe(404);
  });
  it('preserves source failure messages and never claims an empty successful search',async()=>{
    vi.mocked(provider.nearby).mockRejectedValueOnce(new ProviderError('Source busy',429));
    const r=await serveApi(new Request('https://example.org/api/nearby?lat=1&lon=2'),provider);expect(r.status).toBe(429);expect(await r.json()).toEqual({error:'Source busy'});expect(r.headers.get('Cache-Control')).toBe('no-store');
  });
});
