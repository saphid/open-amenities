import type { Evidence, Facility } from './model.ts';

/** Storage needed by source lookup, independent of the hosting runtime. */
export interface SourceStore {
  cached<T>(key:string,maxAge:number):{value:T;created:number}|null;
  cache(key:string,value:unknown):void;
  remember(places:Facility[]):void;
  evidence(ids:string[]):Record<string,Evidence[]>;
}
