import { afterEach,beforeEach,describe,it,expect,vi } from 'vitest';
import { Store } from '../server/store';
import { OsmProvider } from '../server/provider';
let store:Store;const center={lat:-33.869,lon:151.209};
const config={overpass:'https://overpass.example/api',geocoder:'https://geocoder.example/search',userAgent:'OpenAmenities/0.1 (https://example.org)',geocodingEnabled:true};
const data={elements:[{type:'node',id:1,lat:center.lat,lon:center.lon,tags:{amenity:'toilets'}}]};
beforeEach(()=>{store=new Store(':memory:');});afterEach(()=>{store.db.close();vi.unstubAllGlobals();});
describe('upstream reliability and resource limits',()=>{
  it('coalesces simultaneous requests, caches results, and refreshes evidence separately',async()=>{const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify(data)));vi.stubGlobal('fetch',fetcher);const p=new OsmProvider(store,config);const [a,b]=await Promise.all([p.nearby(center),p.nearby(center)]);expect(a.places).toHaveLength(1);expect(b.places).toEqual(a.places);await p.nearby(center);expect(fetcher).toHaveBeenCalledTimes(1);});
  it('rejects partial HTTP-200 Overpass responses instead of claiming complete coverage',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({...data,remark:'runtime error: timeout'}))));await expect(new OsmProvider(store,config).nearby(center)).rejects.toThrow('incomplete');expect(store.cached(`near:${center.lat},${center.lon}`,10000)).toBeNull();});
  it('serves stale cached results explicitly during an outage',async()=>{const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(data))).mockRejectedValue(new Error('offline'));vi.stubGlobal('fetch',fetcher);const p=new OsmProvider(store,config);await p.nearby(center);store.db.prepare('UPDATE cache SET created=?').run(Date.now()-3600000);const r=await p.nearby(center);expect(r.stale).toBe(true);expect(r.places).toHaveLength(1);});
  it('does not silently turn an outage into zero results',async()=>{vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));await expect(new OsmProvider(store,config).nearby(center)).rejects.toThrow('unavailable');});
  it('limits geocoding app-wide, caches submitted searches, and identifies the app',async()=>{const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify([{lat:'1',lon:'2',display_name:'A place'}])));vi.stubGlobal('fetch',fetcher);const p=new OsmProvider(store,config);expect(await p.search('Sydney')).toHaveLength(1);await p.search('sydney');await expect(p.search('London')).rejects.toThrow('wait');expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher.mock.calls[0][1].headers['User-Agent']).toContain('OpenAmenities');});
  it('requires operator configuration for place geocoding',async()=>{await expect(new OsmProvider(store,{...config,geocodingEnabled:false}).search('Sydney')).rejects.toThrow('not configured');});
});

describe('shared-cell cache and reportability regressions',()=>{
  it('shares an upstream query between nearby search centers without moving the requested distance origin',async()=>{const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify(data)));vi.stubGlobal('fetch',fetcher);const p=new OsmProvider(store,config);await p.nearby(center);const adjacent={lat:-33.868,lon:151.208};const r=await p.nearby(adjacent);expect(fetcher).toHaveBeenCalledTimes(1);expect(r.center).toEqual(adjacent);expect(String(fetcher.mock.calls[0][1].body)).toContain('4000');});
  it('restores evicted known places on fresh and stale cache reads',async()=>{const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(data))).mockRejectedValue(new Error('offline'));vi.stubGlobal('fetch',fetcher);const p=new OsmProvider(store,config);const first=await p.nearby(center);const id=first.places[0].id;store.db.exec('DELETE FROM places');expect(store.place(id)).toBeNull();await p.nearby(center);expect(store.place(id)).not.toBeNull();store.db.exec('DELETE FROM places');store.db.prepare('UPDATE cache SET created=?').run(Date.now()-3600000);expect((await p.nearby(center)).stale).toBe(true);expect(store.place(id)).not.toBeNull();});
});

it('does not reject a valid 3km result because the surrounding shared cell has over 2000 places',async()=>{
  const outside=Array.from({length:2001},(_,i)=>({type:'node',id:i+10,lat:center.lat+0.03,lon:center.lon,tags:{amenity:'toilets'}}));
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({elements:[...data.elements,...outside]}))));
  const result=await new OsmProvider(store,config).nearby(center);expect(result.places).toHaveLength(1);
});
