export async function api<T>(url:string, options:RequestInit={}):Promise<T>{
  // Link cancellation and a deadline without requiring newer AbortSignal static APIs.
  const controller=new AbortController();
  const cancel=()=>controller.abort(options.signal?.reason);
  if(options.signal?.aborted)cancel();else options.signal?.addEventListener('abort',cancel,{once:true});
  const timer=setTimeout(()=>controller.abort(new DOMException('Request timed out. Please try again.','TimeoutError')),30000);
  try{
    const response=await fetch(url,{...options,signal:controller.signal});
    const body=await response.json().catch((error:unknown)=>{
      if(controller.signal.aborted)throw controller.signal.reason ?? error;
      throw new Error('The server returned an unreadable response. Please try again.');
    });
    if(!response.ok)throw new Error(body.error ?? 'Request failed. Please try again.');
    return body as T;
  }finally{clearTimeout(timer);options.signal?.removeEventListener('abort',cancel);}
}
