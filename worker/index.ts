import { DurableObject } from 'cloudflare:workers';
import { OsmProvider } from '../server/provider.ts';
import { SourceCache } from './cache.ts';
import { ClientLimits, json, serveApi } from './api.ts';

interface Env {
  AMENITIES:DurableObjectNamespace;
  ASSETS:Fetcher;
  OVERPASS_URL:string;
  GEOCODER_URL:string;
  UPSTREAM_USER_AGENT:string;
}

/** All API calls use one named object: one upstream queue and durable cache. */
export class Amenities extends DurableObject<Env> {
  private provider:OsmProvider;
  private limits=new ClientLimits();
  constructor(ctx:DurableObjectState,env:Env){
    super(ctx,env);
    const store=new SourceCache(ctx.storage.sql);
    this.provider=new OsmProvider(store,{overpass:env.OVERPASS_URL,geocoder:env.GEOCODER_URL,userAgent:env.UPSTREAM_USER_AGENT,geocodingEnabled:true,claimGeocode:()=>store.claimGeocode()});
  }
  async fetch(request:Request):Promise<Response> {
    const client=request.headers.get('CF-Connecting-IP') ?? 'unknown';
    if(!this.limits.allow(client))return json({error:'Too many requests. Please try again in a minute.'},429,{'Retry-After':'60'});
    return serveApi(request,this.provider);
  }
}

export default {
  async fetch(request:Request,env:Env):Promise<Response> {
    const path=new URL(request.url).pathname;
    if(path==='/api' || path.startsWith('/api/')){
      try {return await env.AMENITIES.get(env.AMENITIES.idFromName('public-pilot-v1')).fetch(request);}
      catch {return json({error:'The service is temporarily unavailable. Please try again later.'},503);}
    }
    return env.ASSETS.fetch(request);
  }
};
