const root=document.getElementById('saved');
function text(tag,value){const el=document.createElement(tag);el.textContent=value;return el;}
function render(){
  root.replaceChildren();
  try{
    const data=JSON.parse(localStorage.getItem('open-amenities:saved:v1')||'null');
    if(!data||!Array.isArray(data.result?.places)||data.result.places.length>2000)throw new Error('No saved area');
    root.append(text('h2',String(data.label)),text('p',`Snapshot fetched: ${String(data.result.fetchedAt).slice(0,10)}. All details below are from this snapshot.`));
    const list=document.createElement('ul');
    for(const p of data.result.places.filter(p=>p.access!=='restricted')){
      const li=document.createElement('li');li.append(text('strong',`${p.kind==='toilet'?'Toilet':'Mapped drinking water'} · ${p.name}`));
      li.append(text('span',`${p.lat}, ${p.lon} · ${p.accessNote}`));
      li.append(text('span',`${p.fee==='no'?'No fee mapped':p.fee==='yes'?'Fee mapped':'Fee unknown'} · Hours: ${p.hours||'not recorded'} · Wheelchair: ${p.wheelchair}`));
      li.append(text('span',`Source check date: ${p.sourceCheckedAt||'not recorded'}.`));
      const observations=Array.isArray(data.result.evidence?.[p.id])?data.result.evidence[p.id]:[];
      const active=observations.filter(e=>new Date(e.expiresAt).getTime()>Date.now());
      for(const e of active){
        const label=e.type==='not-drinkable'?'DO NOT DRINK: saved unsafe-water report':e.type==='working'?'Saved working observation':`Saved caution / correction: ${e.type}`;
        li.append(text('strong',`${label} · visited ${e.observedOn}. Current conditions are unverified.`));
      }
      if(!active.some(e=>e.type==='not-drinkable')){
        const old=observations.find(e=>e.type==='not-drinkable');
        if(old)li.append(text('strong',`Previously reported unsafe water on ${old.observedOn}. This saved report has expired; current water safety is unknown.`));
      }
      const link=document.createElement('a');
      if(/^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/[1-9]\d*$/.test(p.sourceUrl)){link.href=p.sourceUrl;link.textContent='Source record (requires internet)';li.append(link);}
      list.append(li);
    }
    root.append(list);if(!list.children.length)root.append(text('p','No unrestricted facilities are in this saved area.'));
  }catch{root.append(text('p','No readable saved area on this device. Connect to the app and use “Save area” first.'));}
}
document.getElementById('clear').addEventListener('click',()=>{try{localStorage.removeItem('open-amenities:saved:v1');render();}catch{root.append(text('p','Storage is blocked. Clear this site’s data in browser settings.'));}});render();
