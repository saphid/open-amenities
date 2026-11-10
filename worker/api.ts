import { pointSchema } from '../shared/model.ts';
import { ProviderError, type Provider } from '../server/provider.ts';

export function json(value:unknown,status=200,extra:Record<string,string>={}):Response {
  return Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Strict-Transport-Security':'max-age=31536000','Cross-Origin-Resource-Policy':'same-origin',...extra}});
}

/** Same public read API as Node; reports deliberately cannot be enabled here. */
export async function serveApi(request:Request,provider:Provider):Promise<Response> {
  const url=new URL(request.url);
  if(url.pathname==='/api/reports')return json({error:'Community reports are not open yet. You can suggest a correction on OpenStreetMap.'},503);
  if(request.method!=='GET')return json({error:'Use GET for this read-only service.'},405,{Allow:'GET'});
  try {
    if(url.pathname==='/api/health')return json({status:'ok',version:'0.1.0',mode:'read-only'});
    if(url.pathname==='/api/config')return json({reportsEnabled:false,tileUrl:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',tileAttribution:'© OpenStreetMap contributors'});
    if(url.pathname==='/api/nearby'){
      const parsed=pointSchema.safeParse(Object.fromEntries(url.searchParams));
      if(!parsed.success)return json({error:'Enter valid coordinates between 85° south and 85° north.'},400);
      return json(await provider.nearby(parsed.data));
    }
    if(url.pathname==='/api/search'){
      const q=url.searchParams.get('q')?.trim();
      if(!q || q.length<2 || q.length>120)return json({error:'Enter a place name between 2 and 120 characters.'},400);
      return json({results:await provider.search(q)});
    }
    return json({error:'API route not found.'},404);
  }catch(error){
    return json({error:error instanceof ProviderError?error.message:'The map source is unavailable. Please try again later.'},error instanceof ProviderError?error.status:503);
  }
}

/** Short-lived, bounded abuse counters. Raw client addresses never reach SQL. */
export class ClientLimits {
  private clients=new Map<string,{count:number;until:number}>();
  allow(client:string,now=Date.now()):boolean {
    const old=this.clients.get(client);
    if(old && old.until>now){old.count++;return old.count<=60;}
    for(const [key,value] of this.clients)if(value.until<=now)this.clients.delete(key);
    // Fail closed when the bounded table is full, rather than evicting live limits.
    if(this.clients.size>=5000)return false;
    this.clients.set(client,{count:1,until:now+60000});return true;
  }
}
