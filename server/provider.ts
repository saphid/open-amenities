import { z } from 'zod';
import type { Point, SearchResult, Facility } from '../shared/model.ts';
import { distanceMeters } from '../shared/model.ts';
import { normalize, type OsmElement } from './normalize.ts';
import { Store } from './store.ts';
export class ProviderError extends Error { constructor(message:string, public status=503){super(message);} }
export interface PlaceSuggestion extends Point { name:string }
export interface Provider { nearby(point:Point):Promise<SearchResult>; search(query:string):Promise<PlaceSuggestion[]> }
const TTL=15*60*1000, STALE=7*86400000;
export function cacheCenter(point:Point):Point { return {lat:Math.round(point.lat*100)/100,lon:Math.round(point.lon*100)/100}; }
export class OsmProvider implements Provider {
  private inFlight=new Map<string,Promise<SearchResult>>();
  private overpassBusy=false;
  private geocodeBusy=false;
  private nextGeocode=0;
  constructor(private store:Store, private config:{overpass:string;geocoder:string;userAgent:string;geocodingEnabled:boolean}){}
  async nearby(point:Point):Promise<SearchResult> {
    // Share a ~1km grid-cell cache. Query 4km to contain every 3km search in the cell.
    // Results and distances are projected back to the caller's rounded (~100m) center.
    const center={lat:Math.round(point.lat*1000)/1000,lon:Math.round(point.lon*1000)/1000};
    const cell=cacheCenter(center);
    const key=`near:v2:${cell.lat},${cell.lon}`;
    const withEvidence=(result:SearchResult,stale=false):SearchResult=>{
      const places=result.places.filter(p=>distanceMeters(center,p)<=3000);
      if(places.length>2000)throw new ProviderError('This area has too many results. Try a nearby location.');
      this.store.remember(places); // Cache hits must remain reportable after place-table eviction.
      return {...result,places,center,stale,evidence:this.store.evidence(places.map(p=>p.id))};
    };
    const cached=this.store.cached<SearchResult>(key,TTL);
    if(cached) return withEvidence(cached.value);
    const existing=this.inFlight.get(key);
    if(existing) return existing.then(r=>withEvidence(r,r.stale));
    const stale=this.store.cached<SearchResult>(key,STALE);
    if(this.overpassBusy){if(stale)return withEvidence(stale.value,true);throw new ProviderError('Another area is loading. Please try again in a moment.',429);}
    const request=(async()=>{
      this.overpassBusy=true;
      try {
        const around=`(around:4000,${cell.lat},${cell.lon})`;
        const selectors=['[amenity=toilets]','[amenity=drinking_water]','[man_made=water_tap][drinking_water=yes]','[amenity=water_point][drinking_water=yes]','[amenity=fountain][drinking_water=yes]','[natural=spring][drinking_water=yes]','["drinking_water:refill"=yes]'];
        const query=`[out:json][timeout:20];(${selectors.map(s=>`nwr${s}${around};`).join('')});out meta center;`;
        const data=await this.getJson(this.config.overpass,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:query}).toString()});
        const schema=z.object({elements:z.array(z.object({type:z.enum(['node','way','relation']),id:z.number().int().positive(),lat:z.number().optional(),lon:z.number().optional(),center:z.object({lat:z.number(),lon:z.number()}).optional(),timestamp:z.string().optional(),tags:z.record(z.string(),z.string()).optional()})).max(10000),remark:z.string().optional()});
        const parsed=schema.parse(data);
        // Overpass can return HTTP 200 with a timeout and partial elements.
        if(parsed.remark)throw new ProviderError('The map source returned incomplete results. Try again later.');
        const places=[...new Map(parsed.elements.flatMap(e=>normalize(e as OsmElement)).filter(p=>distanceMeters(cell,p)<=4000).map(p=>[p.id,p])).values()];
        const result:SearchResult={places,evidence:{},fetchedAt:new Date().toISOString(),center:cell,stale:false,attribution:'© OpenStreetMap contributors · ODbL 1.0'};
        this.store.cache(key,result);return result;
      } catch(e){if(stale)return {...stale.value,stale:true};if(e instanceof ProviderError)throw e;throw new ProviderError('The map source is unavailable. Please try again later.');}
      finally{this.overpassBusy=false;this.inFlight.delete(key);}
    })();
    this.inFlight.set(key,request);return request.then(r=>withEvidence(r,r.stale));
  }
  async search(query:string):Promise<PlaceSuggestion[]> {
    if(!this.config.geocodingEnabled)throw new ProviderError('Place-name search is not configured. Use coordinates or your location instead.',503);
    const key=`geo:${query.toLowerCase()}`;
    const cached=this.store.cached<PlaceSuggestion[]>(key,86400000);
    if(cached)return cached.value;
    // App-wide limit, single process. Reject bursts rather than accumulating a queue.
    if(this.geocodeBusy || Date.now()<this.nextGeocode)throw new ProviderError('Please wait a moment before searching again.',429);
    this.geocodeBusy=true;this.nextGeocode=Date.now()+1100;
    try {
      const url=new URL(this.config.geocoder);url.searchParams.set('q',query);url.searchParams.set('format','jsonv2');url.searchParams.set('limit','5');
      const data=await this.getJson(url.toString());
      const rows=z.array(z.object({lat:z.string(),lon:z.string(),display_name:z.string()})).max(10).parse(data);
      const results=rows.map(r=>({lat:Number(r.lat),lon:Number(r.lon),name:r.display_name})).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=85&&Math.abs(p.lon)<=180);
      this.store.cache(key,results);return results;
    }catch(e){if(e instanceof ProviderError)throw e;throw new ProviderError('Place search is unavailable. Try coordinates or your location.');}
    finally{this.geocodeBusy=false;}
  }
  private async getJson(url:string,init:RequestInit={}):Promise<unknown>{
    const response=await fetch(url,{...init,headers:{...init.headers,'User-Agent':this.config.userAgent,Accept:'application/json'},signal:AbortSignal.timeout(25000)});
    if(!response.ok)throw new ProviderError(response.status===429 ? 'The map source is busy. Please try again later.' : 'The map source is unavailable.',response.status===429?429:503);
    if(Number(response.headers.get('content-length'))>8_000_000)throw new ProviderError('The source response was too large.');
    const reader=response.body?.getReader();if(!reader)throw new ProviderError('The map source returned no data.');
    let size=0;const chunks:Uint8Array[]=[];
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8_000_000){await reader.cancel();throw new ProviderError('The source response was too large.');}chunks.push(value);}
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
}
