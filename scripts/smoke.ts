import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const child=spawn(process.execPath,['--import','tsx','server/index.ts'],{env:{...process.env,NODE_ENV:'production',PORT:'0',HOST:'127.0.0.1',DATABASE_PATH:':memory:',PUBLIC_ORIGIN:'https://smoke.example',UPSTREAM_USER_AGENT:'OpenAmenitiesSmoke/0.1 (https://github.com/saphid/open-amenities)',REPORTS_ENABLED:'false'},stdio:['ignore','pipe','pipe']});
let output='';child.stdout.on('data',chunk=>{output+=String(chunk);});child.stderr.on('data',chunk=>{if(!String(chunk).includes('ExperimentalWarning')&&!String(chunk).includes('--trace-warnings'))process.stderr.write(chunk);});
const exited=new Promise<number|null>(resolve=>child.once('exit',resolve));
try{
  const port=await new Promise<number>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Server did not become ready within 15s')),15000);
    child.once('error',e=>{clearTimeout(timer);reject(e);});
    child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Server exited before ready: ${code}`));});
    child.stdout.on('data',()=>{const match=output.match(/listening on port (\d+)/);if(match){clearTimeout(timer);resolve(Number(match[1]));}});
  });
  const base=`http://127.0.0.1:${port}`;
  const health=await fetch(`${base}/api/health`);assert.equal(health.status,200);assert.equal((await health.json()).status,'ok');
  const index=await fetch(base);assert.equal(index.status,200);const html=await index.text();assert.match(html,/<title>Open Amenities/);assert.match(index.headers.get('content-security-policy')??'',/default-src 'self'/);
  const asset=html.match(/src="([^"]+\.js)"/);assert.ok(asset);assert.equal((await fetch(`${base}${asset[1]}`)).status,200);
  const config=await (await fetch(`${base}/api/config`)).json();assert.equal(config.reportsEnabled,false);
  for(const path of ['/offline.html','/offline.js','/offline.css','/sw.js'])assert.equal((await fetch(`${base}${path}`)).status,200);
  const invalid=await fetch(`${base}/api/nearby?lat=bad&lon=0`);assert.equal(invalid.status,400);assert.match(invalid.headers.get('content-type')??'',/json/);
  const disabled=await fetch(`${base}/api/reports`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(disabled.status,503);
  console.log('Production smoke passed: health/database, HTML/JS assets, CSP, config, offline files, validation and disabled reports. No external provider was queried.');
}finally{child.kill('SIGTERM');const timeout=setTimeout(()=>child.kill('SIGKILL'),5000);await exited;clearTimeout(timeout);}
