import {afterEach,expect,it,vi} from 'vitest';
import {api} from '../src/api';
afterEach(()=>vi.unstubAllGlobals());
it('combines caller cancellation with a deadline and works without AbortSignal.any/timeout',async()=>{
  const caller=new AbortController();let combined:AbortSignal|undefined;
  vi.stubGlobal('AbortSignal',{});
  vi.stubGlobal('fetch',vi.fn(async(_url:string,opts:RequestInit)=>{combined=opts.signal as AbortSignal;caller.abort();expect(combined.aborted).toBe(true);return {ok:true,json:async()=>({ok:true})};}));
  await api('/api/test',{signal:caller.signal});expect(combined).not.toBe(caller.signal);expect(combined?.aborted).toBe(true);
});
it('rejects unreadable HTTP-200 responses instead of treating an error object as data',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>{throw new SyntaxError('HTML captive portal');}})));
  await expect(api('/api/nearby')).rejects.toThrow('unreadable response');
});
it('rejects a body-read timeout as a timeout, rather than returning fake result data',async()=>{
  vi.useFakeTimers();
  try{
    vi.stubGlobal('fetch',vi.fn(async(_url:string,opts:RequestInit)=>({ok:true,json:()=>new Promise((_resolve,reject)=>opts.signal?.addEventListener('abort',()=>reject(new DOMException('Body aborted','AbortError')),{once:true}))})));
    const check=expect(api('/api/nearby')).rejects.toMatchObject({name:'TimeoutError'});
    await vi.advanceTimersByTimeAsync(30001);await check;
  }finally{vi.useRealTimers();}
});
