import { useEffect,useRef,useState } from 'react';
import { ArrowLeft,ArrowUpRight,Copy,Flag,ExternalLink,Accessibility,Droplets,Baby,Clock,KeyRound } from 'lucide-react';
import type { Evidence,Facility } from '../../shared/model';
import { activeEvidence,historicalWaterWarning,reportLabels,safeDate } from '../../shared/model';
function known(value:string){return value==='yes'?'Mapped as available':value==='no'?'Mapped as unavailable':value==='limited'?'Limited — check on site':'Not recorded';}
export function Details({place,evidence,onClose,onReport,reportsEnabled,stale}:{place:Facility;evidence:Evidence[];onClose:()=>void;onReport:()=>void;reportsEnabled:boolean;stale:boolean}){
  const heading=useRef<HTMLHeadingElement>(null);const [copied,setCopied]=useState('');
  useEffect(()=>{heading.current?.focus();heading.current?.scrollIntoView({block:'nearest'});setCopied('');},[place.id]);
  async function share(){
    const url=new URL(location.href);url.hash=new URLSearchParams({lat:String(place.lat),lon:String(place.lon),place:place.id}).toString();
    try{await navigator.clipboard.writeText(url.toString());setCopied('Link copied.');}catch{setCopied(url.toString());}
  }
  const observations=activeEvidence(evidence);
  const historical=historicalWaterWarning(evidence,stale);
  return <section className="detail-panel" aria-labelledby="detail-title">
    <button className="back-button" onClick={onClose}><ArrowLeft size={18}/>All results</button>
    <p className={`eyebrow ${place.kind}`}>{place.kind==='toilet'?'Public toilet':'Mapped drinking water'}</p>
    <h2 ref={heading} id="detail-title" tabIndex={-1}>{place.name}</h2>
    <p className="muted">{place.lat.toFixed(5)}, {place.lon.toFixed(5)}{place.operator?` · ${place.operator}`:''}</p>
    {observations.some(o=>o.type!=='working'&&o.type!=='details')&&<p className="notice" role="status"><strong>{observations.some(o=>o.type==='not-drinkable')?'Do not drink: recent unsafe-water report.':'Recent access or closure report.'}</strong> See the dated observations below. A working report does not remove this caution.</p>}
    {historical&&!observations.some(o=>o.type==='not-drinkable')&&<p className="notice" role="status"><strong>Previously reported unsafe water; current water safety is unknown.</strong> Saved unsafe-water observation from {safeDate(historical.observedOn)} has expired.</p>}
    <div className="detail-actions"><a className="primary" href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}&travelmode=walking`} target="_blank" rel="noreferrer">Get directions<ArrowUpRight size={18}/></a><button className="secondary" onClick={share}><Copy size={17}/>Share</button></div>
    <p className="small muted">Directions open Google Maps and share the destination. Routes may include steps or barriers.</p><p role="status" className="small share-status">{copied}</p>
    <div className="access-box"><h3>Before you go</h3><p>{place.accessNote}</p>{place.key&&<p><KeyRound size={16}/> Key / scheme: {place.key}</p>}<p>{place.fee==='no'?'No fee mapped':place.fee==='yes'?'A fee is mapped':'Fee not recorded'}{place.hours?` · Hours: ${place.hours}`:' · Hours not recorded'}</p><p className="small">Conditions can change. Opening hours are source text, not a live open/closed check.</p></div>
    {place.description&&<p className="source-description">{place.description}</p>}
    <h3>Access & facilities</h3><dl className="facilities">
      <div><dt><Accessibility size={17}/>Wheelchair access</dt><dd>{known(place.wheelchair)}</dd></div>
      {place.kind==='toilet'?<><div><dt><Baby size={17}/>Baby changing</dt><dd>{known(place.changingTable)}</dd></div><div><dt>Gender-neutral facility</dt><dd>{known(place.genderNeutral)}</dd></div></>:<div><dt><Droplets size={17}/>Bottle filling</dt><dd>{known(place.bottle)}</dd></div>}
      <div><dt><Clock size={17}/>24-hour access</dt><dd>{place.aroundTheClock?'24/7 mapped; check local conditions':'Not confirmed'}</dd></div>
    </dl>
    <p className="small muted">A wheelchair tag does not establish entrance width, transfer space, hoist, adult changing, or an accessible route. “Gender-neutral” describes the mapped facility, not a guarantee of personal safety.</p>
    {place.kind==='water'&&<p className="notice">Mapped as drinkable, not tested by us. Follow local signs and water advisories. Do not drink if a source is marked unsafe.</p>}
    <h3>What has been checked?</h3>
    {observations.length>0?<ul className="observations">{observations.map((o,i)=><li key={i}><strong>{reportLabels[o.type]}</strong><span>Visited {safeDate(o.observedOn)} · moderator reviewed</span></li>)}</ul>:<p className="muted">No recent, reviewed community observations.</p>}
    <p className="small muted">Community observations expire after 14 days. Conflicting observations stay visible; a working report does not cancel a warning.</p>
    <dl className="provenance"><div><dt>Source survey / check date</dt><dd>{safeDate(place.sourceCheckedAt)}</dd></div><div><dt>Last OpenStreetMap edit</dt><dd>{safeDate(place.sourceEditedAt)}</dd></div></dl>
    <p className="small muted">An edit is not an on-site visit. A source check date may relate to only part of this record.</p>
    <div className="correction-actions">{reportsEnabled?<button className="secondary" onClick={onReport}><Flag size={16}/>Report what you found</button>:<p className="small muted">In-app reports are not open yet. You can suggest a correction at the source.</p>}
      <a href={place.sourceUrl} target="_blank" rel="noreferrer">View or correct on OpenStreetMap<ExternalLink size={14}/></a></div>
  </section>;
}
