import type { Facility, Known, Kind } from '../shared/model.ts';
export interface OsmElement { type: 'node' | 'way' | 'relation'; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; timestamp?: string; tags?: Record<string,string> }
const yesNo = (v?: string): Known => v === 'yes' ? 'yes' : v === 'no' ? 'no' : 'unknown';
function checkedDate(v?: string): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === v && d.getTime() <= Date.now() ? v : null;
}
export function normalize(e: OsmElement): Facility[] {
  const t=e.tags ?? {}, point=e.type === 'node' ? e : e.center;
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lon) || Math.abs(point.lat!)>85 || Math.abs(point.lon!)>180) return [];
  if (['yes','construction'].includes(t.disused) || t.abandoned === 'yes' || t.demolished === 'yes' || t.construction === 'yes') return [];
  const kind: Kind | null = t.amenity === 'toilets' ? 'toilet' :
    (t.amenity === 'drinking_water' || t['drinking_water:refill'] === 'yes' ||
      (t.drinking_water === 'yes' && (['water_point','fountain'].includes(t.amenity) || t.man_made === 'water_tap' || t.natural === 'spring'))) ? 'water' : null;
  if (!kind || (kind === 'water' && (['no','conditional'].includes(t.drinking_water) || Boolean(t['drinking_water:conditional'])))) return [];
  const v=(key:string) => kind==='toilet' ? t[`toilets:${key}`] ?? t[key] : t[key];
  const rawAccess=v('access');
  if (['private','no','military'].includes(rawAccess) || ['private','no','military'].includes(t.access)) return [];
  const publicAccess=['yes','public','permissive'].includes(rawAccess);
  const key=t.centralkey ?? t['toilets:centralkey'] ?? (t.locked === 'yes' ? 'Key or code needed' : null);
  const conditional=v('access:conditional') ?? t['access:conditional'];
  const restricted=Boolean(rawAccess && !publicAccess) || Boolean(key) || Boolean(conditional);
  const hours=v('opening_hours') ?? null, feeRaw=v('fee');
  const fee: Known=v('fee:conditional') ? 'unknown' : feeRaw === 'no' ? 'no' : feeRaw === 'yes' ? 'yes' : 'unknown';
  const accessNote=[rawAccess && !publicAccess ? `Access: ${rawAccess}` : publicAccess ? 'Public access mapped' : 'Public access not confirmed', conditional ? `Conditions: ${conditional}` : '', t['access:description'] ?? '', t['toilets:access:description'] ?? ''].filter(Boolean).join(' · ');
  const wheelchair=v('wheelchair:conditional') ? undefined : v('wheelchair');
  return [{ id:`${e.type}/${e.id}:${kind}`, kind, name:t.name ?? (kind === 'toilet' ? 'Public toilet' : t['drinking_water:refill'] === 'yes' ? 'Water refill point' : 'Drinking water'),
    lat:point.lat!,lon:point.lon!,access:restricted ? 'restricted' : publicAccess ? 'public' : 'unknown', accessNote,
    fee,wheelchair:wheelchair === 'limited' ? 'limited' : yesNo(wheelchair),
    changingTable:yesNo(t.changing_table ?? t['toilets:changing_table']),genderNeutral:yesNo(t.unisex ?? t['toilets:unisex']),
    bottle:yesNo(t.bottle),key,hours,aroundTheClock:hours === '24/7' && !restricted && (!t.seasonal || t.seasonal === 'no') && !t['opening_hours:conditional'],
    description:t.description ?? t['toilets:description'] ?? null, operator:t.operator ?? null,
    sourceUrl:`https://www.openstreetmap.org/${e.type}/${e.id}`,
    sourceCheckedAt:checkedDate(t['check_date:opening_hours'] ?? t.check_date ?? t['survey:date']), sourceEditedAt:e.timestamp ?? null }];
}
