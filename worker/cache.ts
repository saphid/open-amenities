import type { SqlStorage } from '@cloudflare/workers-types';
import type { SourceStore } from '../shared/source-store.ts';

/** Read-only public pilot: cache source data, never accept or retain reports. */
export class SourceCache implements SourceStore {
  constructor(private sql:SqlStorage) {
    sql.exec('CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, created INTEGER NOT NULL)');
    sql.exec('CREATE INDEX IF NOT EXISTS cache_created ON cache(created)');
    sql.exec('CREATE TABLE IF NOT EXISTS gates (key TEXT PRIMARY KEY, next INTEGER NOT NULL)');
  }
  cached<T>(key:string,maxAge:number):{value:T;created:number}|null {
    const row=this.sql.exec<{value:string;created:number}>('SELECT value,created FROM cache WHERE key=? AND created>?',key,Date.now()-maxAge).toArray()[0];
    return row ? {value:JSON.parse(row.value),created:row.created} : null;
  }
  cache(key:string,value:unknown):void {
    const json=JSON.stringify(value);
    // Stay below SQLite's 2 MB row limit, even in dense areas. Large responses
    // still work, but are not cached; the provider retains its 2,000-result cap.
    if(new TextEncoder().encode(json).byteLength>1_500_000)return;
    this.sql.exec('INSERT OR REPLACE INTO cache VALUES (?,?,?)',key,json,Date.now());
    this.sql.exec('DELETE FROM cache WHERE created<?',Date.now()-7*86400000);
    this.sql.exec('DELETE FROM cache WHERE key IN (SELECT key FROM cache ORDER BY created DESC LIMIT -1 OFFSET 300)');
  }
  // No moderation data exists on the hosted read-only pilot.
  remember():void {}
  evidence():ReturnType<SourceStore['evidence']> {return {};}
  /** Synchronous SQL keeps the public-geocoder limit across object restarts. */
  claimGeocode():boolean {
    const row=this.sql.exec<{next:number}>("SELECT next FROM gates WHERE key='geocode'").toArray()[0];
    if(row && row.next>Date.now())return false;
    this.sql.exec("INSERT OR REPLACE INTO gates VALUES ('geocode',?)",Date.now()+1100);
    return true;
  }
}
