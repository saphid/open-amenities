import { describe,it,expect } from 'vitest';
import { normalize,type OsmElement } from '../server/normalize';
import { defaultFilters,matches,distanceMeters,hasCaution,type Evidence } from '../shared/model';
const element=(tags:Record<string,string>,extra:Partial<OsmElement>={}):OsmElement=>({type:'node',id:123,lat:-33.86,lon:151.2,tags,...extra});
describe('conservative source normalization',()=>{
  it('does not invent free, accessible, open or surveyed facts',()=>{const [p]=normalize(element({amenity:'toilets'}));expect(p).toMatchObject({fee:'unknown',wheelchair:'unknown',access:'unknown',aroundTheClock:false,sourceCheckedAt:null});expect(matches(p,{...defaultFilters,free:true})).toBe(false);expect(matches(p,{...defaultFilters,wheelchair:true})).toBe(false);});
  it.each(['private','no','military'])('excludes access=%s',access=>expect(normalize(element({amenity:'toilets',access}))).toEqual([]));
  it('excludes private venues even when the toilet subtag is public',()=>expect(normalize(element({amenity:'toilets',access:'private','toilets:access':'yes'}))).toEqual([]));
  it.each<Record<string,string>>([{access:'customers'},{centralkey:'mlak'},{'access:conditional':'yes @ (Mo-Fr)'}])('hides restricted access by default: %j',tags=>{const [p]=normalize(element({amenity:'toilets',...tags}));expect(p.access).toBe('restricted');expect(matches(p,defaultFilters)).toBe(false);expect(matches(p,{...defaultFilters,restricted:true})).toBe(true);});
  it.each<Record<string,string>>([{amenity:'fountain'},{man_made:'water_tap'},{amenity:'drinking_water',drinking_water:'no'},{amenity:'drinking_water','drinking_water:conditional':'no @ (summer)'},{amenity:'drinking_water',disused:'yes'}])('excludes unsafe, unknown or inactive water: %j',tags=>expect(normalize(element(tags))).toEqual([]));
  it('accepts explicit drinkable taps but does not treat toilet sinks as refill points',()=>{expect(normalize(element({man_made:'water_tap',drinking_water:'yes'}))[0].kind).toBe('water');expect(normalize(element({amenity:'toilets',drinking_water:'yes'}))).toHaveLength(1);});
  it('reads way and relation centers with stable type-aware ids',()=>{const [p]=normalize(element({amenity:'toilets'},{type:'way',lat:undefined,lon:undefined,center:{lat:1,lon:2}}));expect(p.id).toBe('way/123:toilet');expect(p.lat).toBe(1);expect(normalize(element({amenity:'toilets'},{lat:NaN}))).toEqual([]);});
  it('keeps edit dates separate and rejects impossible/future check dates',()=>{const [p]=normalize(element({amenity:'toilets',check_date:'2025-02-30'},{timestamp:'2026-01-02T00:00:00Z'}));expect(p.sourceCheckedAt).toBeNull();expect(p.sourceEditedAt).toBe('2026-01-02T00:00:00Z');expect(normalize(element({amenity:'toilets',check_date:'2099-01-01'}))[0].sourceCheckedAt).toBeNull();});
  it('treats conditional/seasonal availability conservatively',()=>{const [p]=normalize(element({amenity:'toilets',opening_hours:'24/7',seasonal:'summer',fee:'no','fee:conditional':'yes @ (summer)',wheelchair:'yes','wheelchair:conditional':'no @ (winter)'}));expect(p.aroundTheClock).toBe(false);expect(p.fee).toBe('unknown');expect(p.wheelchair).toBe('unknown');});
  it('requires a full yes rather than limited accessibility',()=>{const [p]=normalize(element({amenity:'toilets',wheelchair:'limited'}));expect(matches(p,{...defaultFilters,wheelchair:true})).toBe(false);});
});
describe('distance and evidence',()=>{
  it('handles the international date line',()=>expect(distanceMeters({lat:0,lon:179.999},{lat:0,lon:-179.999})).toBeCloseTo(222.39,0));
  it('does not cancel warnings with working reports or retain expired claims',()=>{const make=(type:Evidence['type'],expiry:number):Evidence=>({type,observedOn:'2026-01-01',reviewedAt:'2026-01-01',expiresAt:new Date(expiry).toISOString()});expect(hasCaution([make('closed',Date.now()+10000),make('working',Date.now()+10000)])).toBe(true);expect(hasCaution([make('closed',Date.now()-10000)])).toBe(false);});
});
