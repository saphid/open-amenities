import { useEffect,useRef,useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Facility, Point } from '../../shared/model';
interface Props {places:Facility[];center:Point;selected:string|null;onSelect:(p:Facility)=>void;onSearch:(p:Point)=>void;tileUrl:string;attribution:string}
export default function AmenitiesMap({places,center,selected,onSelect,onSearch,tileUrl,attribution}:Props){
  const root=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),markers=useRef<L.LayerGroup|null>(null);
  const [moved,setMoved]=useState<Point|null>(null),[tileError,setTileError]=useState(false);
  const selectRef=useRef(onSelect);selectRef.current=onSelect;
  useEffect(()=>{
    if(!root.current)return;
    const m=L.map(root.current,{zoomControl:true,scrollWheelZoom:false,minZoom:3,maxZoom:19,worldCopyJump:true}).setView([center.lat,center.lon],15);
    map.current=m;
    const tiles=L.tileLayer(tileUrl,{attribution:'',maxZoom:19,referrerPolicy:'strict-origin-when-cross-origin'}).addTo(m);
    tiles.on('tileerror',()=>setTileError(true));
    markers.current=L.layerGroup().addTo(m);
    m.on('moveend',()=>{const c=m.getCenter();setMoved({lat:c.lat,lon:((c.lng+180)%360+360)%360-180});});
    const observer=new ResizeObserver(()=>m.invalidateSize());observer.observe(root.current);
    return()=>{observer.disconnect();m.remove();map.current=null;};
  },[tileUrl]);
  useEffect(()=>{map.current?.setView([center.lat,center.lon],15,{animate:false});setMoved(null);setTileError(false);},[center.lat,center.lon]);
  useEffect(()=>{
    const layer=markers.current;if(!layer)return;layer.clearLayers();
    for(const p of places){
      const icon=L.divIcon({className:'amenity-pin',html:`<span class="pin ${p.kind} ${p.id===selected?'selected':''}">${p.kind==='toilet'?'WC':'W'}</span>`,iconSize:[36,42],iconAnchor:[18,42]});
      L.marker([p.lat,p.lon],{icon,keyboard:false,alt:p.name,title:p.name}).on('click',()=>selectRef.current(p)).addTo(layer);
    }
  },[places,selected,tileUrl]);
  return <div className="map-surface"><div ref={root} className="map-canvas" role="region" aria-label="Amenity map. All locations and actions are also in the results list."/>
    <div className="map-legend"><span><i className="legend-dot toilet"/>WC · Toilet</span><span><i className="legend-dot water"/>W · Water</span></div>
    {moved && <button className="search-area" onClick={()=>{onSearch(moved);setMoved(null);}}>Search this area · 3 km</button>}
    {tileError && <p className="map-error" role="status">Map tiles unavailable. The results list still works.</p>}
    <div className="map-credit">{attribution} · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">ODbL</a></div>
  </div>;
}
