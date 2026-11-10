import { afterEach,beforeEach,describe,expect,it } from 'vitest';
import request from 'supertest';
import { Store } from '../server/store';
import { createApp } from '../server/app';
import { normalize } from '../server/normalize';
import type { Provider } from '../server/provider';
let store:Store;
const [place]=normalize({type:'node',id:123,lat:0,lon:0,tags:{amenity:'drinking_water',access:'yes'}});
const provider:Provider={nearby:async center=>({places:[place],evidence:{},fetchedAt:new Date().toISOString(),center,stale:false,attribution:'OSM'}),search:async()=>[]};
const payload=()=>({requestId:crypto.randomUUID(),facilityId:place.id,type:'closed',observedOn:new Date().toISOString().slice(0,10),note:'Found a closure notice.',website:''});
beforeEach(()=>{store=new Store(':memory:');store.remember([place]);});afterEach(()=>store.db.close());
describe('API validation and privacy',()=>{
  it('rejects malformed coordinates and unknown API paths as JSON',async()=>{const app=createApp(store,provider);expect((await request(app).get('/api/nearby?lat=Infinity&lon=0')).status).toBe(400);expect((await request(app).get('/api/nearby?lat=&lon=0')).status).toBe(400);expect((await request(app).get('/api/unknown')).body.error).toBe('API route not found.');});
  it('returns no-store results and a health response',async()=>{const app=createApp(store,provider);const r=await request(app).get('/api/nearby?lat=0&lon=0');expect(r.status).toBe(200);expect(r.headers['cache-control']).toBe('no-store');expect((await request(app).get('/api/health')).body.status).toBe('ok');});
  it('disables reports until an operator enables moderation',async()=>{expect((await request(createApp(store,provider)).post('/api/reports').send(payload())).status).toBe(503);});
  it('rejects cross-site posts and invalid dates or fields',async()=>{const app=createApp(store,provider,{reportsEnabled:true,publicOrigin:'https://amenities.example'});expect((await request(app).post('/api/reports').set('Origin','https://other.example').send(payload())).status).toBe(403);expect((await request(app).post('/api/reports').send({...payload(),observedOn:'2099-01-01'})).status).toBe(400);expect((await request(app).post('/api/reports').send({...payload(),website:'spam'})).status).toBe(400);expect((await request(app).post('/api/reports').send({...payload(),note:'x'.repeat(401)})).status).toBe(400);});
  it('does not accept invented facility IDs',async()=>{const app=createApp(store,provider,{reportsEnabled:true});expect((await request(app).post('/api/reports').send({...payload(),facilityId:'node/999:water'})).status).toBe(404);});
  it('saves privately, retries idempotently, and requires a review for public evidence',async()=>{const app=createApp(store,provider,{reportsEnabled:true});const p=payload();const first=await request(app).post('/api/reports').send(p);const retry=await request(app).post('/api/reports').send(p);expect(first.status).toBe(201);expect(retry.status).toBe(200);expect(retry.body.id).toBe(first.body.id);expect(store.pending()).toHaveLength(1);expect(store.evidence([place.id])).toEqual({});store.moderate(first.body.id,'approved','Checked credible sign details');const evidence=store.evidence([place.id])[place.id];expect(evidence[0].type).toBe('closed');expect(JSON.stringify(evidence)).not.toContain(p.note);expect(()=>store.moderate(first.body.id,'rejected','duplicate review')).toThrow();});
  it('retains cautions even when later working reports exist',()=>{const warning=store.report(payload() as never);store.moderate(warning.id,'approved','Checked reported closure');for(let i=0;i<10;i++){const r=store.report({...payload(),type:'working'} as never);store.moderate(r.id,'approved','Checked working observation');}expect(store.evidence([place.id])[place.id].some(e=>e.type==='closed')).toBe(true);});
  it('expires old observations even when reviewed today',()=>{const p={...payload(),observedOn:new Date(Date.now()-20*86400000).toISOString().slice(0,10)};const r=store.report(p as never);store.moderate(r.id,'approved','Reviewed older observation');expect(store.evidence([place.id])).toEqual({});});
  it('deletes private report notes at the retention boundary',()=>{const r=store.report(payload() as never);store.db.prepare('UPDATE reports SET createdAt=? WHERE id=?').run('2000-01-01',r.id);store.prune();expect(store.pending()).toHaveLength(0);});
});

it('uses an index for per-place approved evidence lookups',()=>{
  const plan=store.db.prepare("EXPLAIN QUERY PLAN SELECT type FROM reports WHERE facilityId=? AND status='approved' AND observedOn>=?").all(place.id,'2026-01-01');
  expect(JSON.stringify(plan)).toContain('reports_lookup');
});
