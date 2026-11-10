import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Evidence, Facility, ReportType } from '../shared/model.ts';
export interface Report { id: string; requestId: string; facilityId: string; type: ReportType; observedOn: string; note: string; createdAt: string; status: string }
export class Store {
  db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive:true, mode:0o700 });
    this.db=new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS places (id TEXT PRIMARY KEY, value TEXT NOT NULL, seen INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, requestId TEXT UNIQUE NOT NULL, facilityId TEXT NOT NULL, type TEXT NOT NULL, observedOn TEXT NOT NULL, note TEXT NOT NULL, createdAt TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', reviewedAt TEXT, reason TEXT);
      CREATE INDEX IF NOT EXISTS reports_lookup ON reports(facilityId,status,observedOn);
      CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY, reportId TEXT NOT NULL, action TEXT NOT NULL, reason TEXT NOT NULL, createdAt TEXT NOT NULL);
    `);
  }
  cached<T>(key:string, maxAge:number): {value:T; created:number} | null {
    const row=this.db.prepare('SELECT value,created FROM cache WHERE key=?').get(key) as {value:string;created:number} | undefined;
    return row && Date.now()-row.created<maxAge ? {value:JSON.parse(row.value),created:row.created} : null;
  }
  cache(key:string,value:unknown) {
    this.db.prepare('INSERT OR REPLACE INTO cache VALUES (?,?,?)').run(key,JSON.stringify(value),Date.now());
    this.db.exec('DELETE FROM cache WHERE key NOT IN (SELECT key FROM cache ORDER BY created DESC LIMIT 300)');
  }
  remember(places:Facility[]) {
    const stmt=this.db.prepare('INSERT OR REPLACE INTO places VALUES (?,?,?)');
    this.db.exec('BEGIN');
    try { for (const p of places) stmt.run(p.id,JSON.stringify(p),Date.now()); this.db.exec('COMMIT'); }
    catch(e){this.db.exec('ROLLBACK');throw e;}
    this.db.exec('DELETE FROM places WHERE id NOT IN (SELECT id FROM places ORDER BY seen DESC LIMIT 20000)');
  }
  place(id:string):Facility | null {
    const row=this.db.prepare('SELECT value FROM places WHERE id=?').get(id) as {value:string}|undefined;
    return row ? JSON.parse(row.value) : null;
  }
  report(input:Omit<Report,'id'|'createdAt'|'status'>): { id:string; duplicate:boolean } {
    const old=this.db.prepare('SELECT id FROM reports WHERE requestId=?').get(input.requestId) as {id:string}|undefined;
    if(old) return {id:old.id,duplicate:true};
    const id=crypto.randomUUID();
    this.db.prepare('INSERT INTO reports(id,requestId,facilityId,type,observedOn,note,createdAt) VALUES(?,?,?,?,?,?,?)').run(id,input.requestId,input.facilityId,input.type,input.observedOn,input.note,new Date().toISOString());
    return {id,duplicate:false};
  }
  evidence(ids:string[]):Record<string,Evidence[]> {
    const result:Record<string,Evidence[]>={};
    const stmt=this.db.prepare("SELECT type,observedOn,reviewedAt FROM reports WHERE facilityId=? AND status='approved' AND observedOn>=? ORDER BY CASE WHEN type IN ('closed','not-drinkable','access-changed','missing') THEN 0 ELSE 1 END, observedOn DESC LIMIT 8");
    for(const id of ids){
      const rows=stmt.all(id,new Date(Date.now()-14*86400000).toISOString().slice(0,10)) as unknown as Omit<Evidence,'expiresAt'>[];
      if(rows.length) result[id]=rows.map(r=>({...r,expiresAt:new Date(new Date(r.observedOn).getTime()+14*86400000).toISOString()})).filter(r=>new Date(r.expiresAt).getTime()>Date.now());
    }
    return result;
  }
  pending():unknown[] {return this.db.prepare("SELECT * FROM reports WHERE status='pending' ORDER BY createdAt").all();}
  moderate(id:string,status:'approved'|'rejected',reason:string):void {
    this.db.exec('BEGIN');
    try {
      const at=new Date().toISOString();
      const result=this.db.prepare("UPDATE reports SET status=?,reviewedAt=?,reason=? WHERE id=? AND status='pending'").run(status,at,reason,id);
      if(result.changes!==1) throw new Error('Pending report not found');
      this.db.prepare('INSERT INTO reviews(reportId,action,reason,createdAt) VALUES(?,?,?,?)').run(id,status,reason,at);
      this.db.exec('COMMIT');
    } catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  prune() {
    this.db.prepare('DELETE FROM cache WHERE created < ?').run(Date.now()-7*86400000);
    this.db.prepare('DELETE FROM places WHERE seen < ?').run(Date.now()-30*86400000);
    this.db.prepare('DELETE FROM reports WHERE createdAt < ?').run(new Date(Date.now()-90*86400000).toISOString());
    this.db.prepare('DELETE FROM reviews WHERE createdAt < ?').run(new Date(Date.now()-90*86400000).toISOString());
  }
}
