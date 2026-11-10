import { z } from 'zod';
export type Kind = 'toilet' | 'water';
export type Known = 'yes' | 'no' | 'unknown';
export interface Point { lat: number; lon: number }
export interface Facility extends Point {
  id: string; kind: Kind; name: string;
  access: 'public' | 'restricted' | 'unknown'; accessNote: string;
  fee: Known; wheelchair: Known | 'limited'; changingTable: Known;
  genderNeutral: Known; bottle: Known; key: string | null;
  hours: string | null; aroundTheClock: boolean;
  description: string | null; operator: string | null;
  sourceUrl: string; sourceCheckedAt: string | null; sourceEditedAt: string | null;
}
export interface Evidence { type: ReportType; observedOn: string; reviewedAt: string; expiresAt: string }
export interface SearchResult {
  places: Facility[]; evidence: Record<string, Evidence[]>;
  fetchedAt: string; stale: boolean; center: Point; attribution: string;
}
export interface Filters {
  kind: 'all' | Kind; free: boolean; wheelchair: boolean;
  changing: boolean; neutral: boolean; bottle: boolean; always: boolean; restricted: boolean;
}
export const defaultFilters: Filters = { kind: 'all', free: false, wheelchair: false, changing: false, neutral: false, bottle: false, always: false, restricted: false };
export const reportTypes = ['working', 'closed', 'not-drinkable', 'access-changed', 'missing', 'details'] as const;
export type ReportType = typeof reportTypes[number];
export const reportLabels: Record<ReportType, string> = {
  working: 'I found it working', closed: 'Closed or out of order',
  'not-drinkable': 'Water marked unsafe / do not drink',
  'access-changed': 'Access conditions changed', missing: 'Could not find it', details: 'A detail needs correcting',
};
export const reportSchema = z.object({
  requestId: z.uuid(), facilityId: z.string().regex(/^(node|way|relation)\/[1-9]\d*:(toilet|water)$/),
  type: z.enum(reportTypes), observedOn: z.iso.date(), note: z.string().trim().max(400), website: z.string().max(0),
}).strict();
const coordinate = z.union([z.number(), z.string().trim().min(1).transform(Number)]).pipe(z.number().finite());
export const pointSchema = z.object({ lat: coordinate.pipe(z.number().min(-85).max(85)), lon: coordinate.pipe(z.number().min(-180).max(180)) });
export function distanceMeters(a: Point, b: Point): number {
  const r = Math.PI / 180;
  const h = Math.sin((b.lat-a.lat)*r/2)**2 + Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin((b.lon-a.lon)*r/2)**2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(Math.min(1,h)), Math.sqrt(Math.max(0,1-h)));
}
export function formatDistance(m: number): string { return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`; }
export function matches(p: Facility, f: Filters): boolean {
  return (f.kind === 'all' || p.kind === f.kind) && (f.restricted || p.access !== 'restricted') &&
    (!f.free || p.fee === 'no') && (!f.wheelchair || p.wheelchair === 'yes') &&
    (!f.changing || p.changingTable === 'yes') && (!f.neutral || p.genderNeutral === 'yes') &&
    (!f.bottle || p.bottle === 'yes') && (!f.always || p.aroundTheClock);
}
export function activeEvidence(items: Evidence[] = [], now = Date.now()): Evidence[] { return items.filter(e => new Date(e.expiresAt).getTime() > now); }
export function hasCaution(items: Evidence[] = []): boolean { return activeEvidence(items).some(e => e.type !== 'working' && e.type !== 'details'); }
export function safeDate(s: string | null): string {
  if (!s) return 'Not recorded';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? 'Not recorded' : new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(d);
}
export function historicalWaterWarning(items:Evidence[] = [],stale=false):Evidence|undefined {
  return stale ? items.find(e=>e.type==='not-drinkable' && !(new Date(e.expiresAt).getTime()>Date.now())) : undefined;
}
const knownSchema=z.enum(['yes','no','unknown']);
const facilitySchema:z.ZodType<Facility>=pointSchema.extend({
  id:z.string().regex(/^(node|way|relation)\/[1-9]\d*:(toilet|water)$/),kind:z.enum(['toilet','water']),name:z.string(),
  access:z.enum(['public','restricted','unknown']),accessNote:z.string(),fee:knownSchema,
  wheelchair:z.enum(['yes','no','unknown','limited']),changingTable:knownSchema,genderNeutral:knownSchema,bottle:knownSchema,
  key:z.string().nullable(),hours:z.string().nullable(),aroundTheClock:z.boolean(),description:z.string().nullable(),operator:z.string().nullable(),
  sourceUrl:z.string().regex(/^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/[1-9]\d*$/),sourceCheckedAt:z.string().nullable(),sourceEditedAt:z.string().nullable(),
});
const evidenceSchema=z.object({type:z.enum(reportTypes),observedOn:z.string(),reviewedAt:z.string(),expiresAt:z.string()});
export const searchResultSchema:z.ZodType<SearchResult>=z.object({places:z.array(facilitySchema).max(2000),evidence:z.record(z.string(),z.array(evidenceSchema).max(8)),center:pointSchema,fetchedAt:z.string(),stale:z.boolean(),attribution:z.string()});
export const suggestionsSchema=z.object({results:z.array(pointSchema.extend({name:z.string()})).max(10)});
