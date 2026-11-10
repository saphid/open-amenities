import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pointSchema, reportSchema } from '../shared/model.ts';
import { Store } from './store.ts';
import { ProviderError, type Provider } from './provider.ts';
export function createApp(store:Store,provider:Provider, options:{production?:boolean;publicOrigin?:string;trustProxy?:number;reportsEnabled?:boolean;tileUrl?:string;tileAttribution?:string}={}){
  const app=express();app.disable('x-powered-by');
  if(options.trustProxy)app.set('trust proxy',options.trustProxy);
  const tileUrl=options.tileUrl ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const tileOrigin=new URL(tileUrl).origin;
  app.use(helmet({contentSecurityPolicy: options.production ? {directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'data:',tileOrigin],connectSrc:["'self'"],objectSrc:["'none'"],frameAncestors:["'none'"],upgradeInsecureRequests:[]}}:false, referrerPolicy:{policy:'strict-origin-when-cross-origin'},strictTransportSecurity:options.production?undefined:false}));
  app.use('/api',(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
  app.use('/api',rateLimit({windowMs:60000,limit:60,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many requests. Please try again in a minute.'}}));
  app.use(express.json({limit:'8kb'}));
  app.get('/api/health',(_req,res)=>{store.db.prepare('SELECT 1').get();res.json({status:'ok',version:'0.1.0'});});
  app.get('/api/config',(_req,res)=>res.json({reportsEnabled:options.reportsEnabled ?? false,tileUrl,tileAttribution:options.tileAttribution ?? '© OpenStreetMap contributors'}));
  app.get('/api/nearby',async(req,res)=>{
    const p=pointSchema.safeParse(req.query);if(!p.success){res.status(400).json({error:'Enter valid coordinates between 85° south and 85° north.'});return;}
    res.json(await provider.nearby(p.data));
  });
  app.get('/api/search',async(req,res)=>{
    const q=req.query.q;
    if(typeof q!=='string'||q.trim().length<2||q.trim().length>120){res.status(400).json({error:'Enter a place name between 2 and 120 characters.'});return;}
    res.json({results:await provider.search(q.trim())});
  });
  app.post('/api/reports',rateLimit({windowMs:3600000,limit:10,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Report limit reached. Please try again in an hour.'}}), (req,res)=>{
    if(!options.reportsEnabled){res.status(503).json({error:'Community reports are not open yet. You can suggest a correction on OpenStreetMap.'});return;}
    // Browsers send Origin for JSON POSTs. CLI clients may omit it; rate limits still apply.
    const origin=req.get('origin');
    const expected=options.publicOrigin ?? `${req.protocol}://${req.get('host')}`;
    if(origin && origin!==expected){res.status(403).json({error:'Reports must be sent from this site.'});return;}
    const parsed=reportSchema.safeParse(req.body);
    if(!parsed.success){res.status(400).json({error:'Check the report fields and try again.'});return;}
    const {website:_,...input}=parsed.data;
    const observed=new Date(input.observedOn).getTime(),today=new Date(new Date().toISOString().slice(0,10)).getTime();
    if(observed>today || observed<today-90*86400000){res.status(400).json({error:'Use an observation date within the last 90 days, up to today (UTC).'});return;}
    const place=store.place(input.facilityId);
    if(!place){res.status(404).json({error:'Reload this area before reporting this place.'});return;}
    if(input.type==='not-drinkable' && place.kind!=='water'){res.status(400).json({error:'Choose a report type for a toilet.'});return;}
    const result=store.report(input);
    res.status(result.duplicate?200:201).json({id:result.id,status:'pending',message:'Saved for review. This has not changed the public listing.'});
  });
  app.use('/api',(_req,res)=>res.status(404).json({error:'API route not found.'}));
  app.use((error:unknown,_req:express.Request,res:express.Response,next:express.NextFunction)=>{
    if(res.headersSent){next(error);return;}
    const status=error instanceof ProviderError ? error.status : error instanceof SyntaxError ? 400 : typeof error==='object' && error!==null && 'status' in error && error.status===413 ? 413 : 500;
    res.status(status).json({error:error instanceof ProviderError ? error.message : status===400 ? 'Invalid JSON.' : status===413 ? 'Report is too large.' : 'Something went wrong. Please try again.'});
  });
  return app;
}
