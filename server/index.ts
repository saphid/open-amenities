import 'dotenv/config';
import express from 'express';
import { resolve } from 'node:path';
import { Store } from './store.ts';
import { OsmProvider } from './provider.ts';
import { createApp } from './app.ts';
import { publicOrigin } from './config.ts';
const production=process.env.NODE_ENV==='production';
const port=Number(process.env.PORT ?? 4173);
const geocoder=process.env.GEOCODER_URL ?? 'https://nominatim.openstreetmap.org/search';
const userAgent=process.env.UPSTREAM_USER_AGENT ?? 'OpenAmenities/0.1 (local development)';
const geocodingEnabled=Boolean(process.env.UPSTREAM_USER_AGENT);
const origin=publicOrigin(process.env.PUBLIC_ORIGIN,production);
if(production && (!process.env.UPSTREAM_USER_AGENT || userAgent.includes('local development')))throw new Error('Set an identifying UPSTREAM_USER_AGENT with an operator contact before public deployment.');
const store=new Store(process.env.DATABASE_PATH ?? resolve('data/amenities.sqlite'));
store.prune();
const provider=new OsmProvider(store,{overpass:process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter',geocoder,userAgent,geocodingEnabled});
const app=createApp(store,provider,{production,publicOrigin:origin,trustProxy:Number(process.env.TRUST_PROXY_HOPS ?? 0),reportsEnabled:process.env.REPORTS_ENABLED==='true',tileUrl:process.env.TILE_URL,tileAttribution:process.env.TILE_ATTRIBUTION});
if(production){app.use(express.static(resolve('dist'),{maxAge:'1h'}));app.get('/{*path}',(_req,res)=>res.sendFile(resolve('dist/index.html')));}
else {const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}
const server=app.listen(port,process.env.HOST ?? '127.0.0.1',()=>console.log(`Open Amenities listening on port ${(server.address() as {port:number}).port}. Reports ${process.env.REPORTS_ENABLED==='true'?'enabled':'disabled'}.`));
const pruneTimer=setInterval(()=>store.prune(),3600000);pruneTimer.unref();
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{clearInterval(pruneTimer);server.close(()=>{store.db.close();process.exit(0);});});
