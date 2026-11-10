export function publicOrigin(value:string|undefined,production:boolean):string|undefined {
  if(!value){if(production)throw new Error('Set PUBLIC_ORIGIN to the HTTPS site origin.');return undefined;}
  let url:URL;try{url=new URL(value);}catch{throw new Error('PUBLIC_ORIGIN must be a valid site origin.');}
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('PUBLIC_ORIGIN must contain only a scheme and host, with no path, credentials, query or fragment.');
  if(production&&url.protocol!=='https:')throw new Error('Production requires HTTPS at PUBLIC_ORIGIN.');
  return url.origin;
}
