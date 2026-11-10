import { useEffect,useRef,useState } from 'react';
import { X,Check } from 'lucide-react';
import type { Facility,ReportType } from '../../shared/model';
import { reportLabels,reportTypes } from '../../shared/model';
import { api } from '../api';
export function ReportDialog({place,onClose}:{place:Facility;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  const [type,setType]=useState<ReportType>('working'),[note,setNote]=useState(''),[date,setDate]=useState(new Date().toISOString().slice(0,10));
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState('');
  const attempt=useRef<{body:string;requestId:string}|null>(null);
  useEffect(()=>{dialog.current?.showModal();return()=>dialog.current?.close();},[]);
  async function submit(e:React.FormEvent){
    e.preventDefault();setBusy(true);setError('');
    const fields={facilityId:place.id,type,observedOn:date,note,website:''};
    const body=JSON.stringify(fields);
    if(attempt.current?.body!==body)attempt.current={body,requestId:crypto.randomUUID()};
    try{const result=await api<{id:string}>('/api/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...fields,requestId:attempt.current.requestId})});setReceipt(result.id);}
    catch(e){setError(e instanceof Error?e.message:'Report not sent. Try again.');}finally{setBusy(false);}
  }
  return <dialog ref={dialog} onCancel={e=>{e.preventDefault();if(!busy)onClose();}} aria-labelledby="report-title" className="report-dialog">
    <button className="icon-button close-dialog" aria-label="Close report" onClick={onClose} disabled={busy}><X size={20}/></button>
    {receipt?<div className="receipt"><Check size={36}/><h2 id="report-title">Thanks for checking.</h2><p>Your report is saved for a moderator. It has not changed the public listing.</p><p className="muted">Reference: <code>{receipt}</code></p><button className="primary" onClick={onClose}>Done</button></div>:<form onSubmit={submit}>
      <p className="eyebrow">Help the next person</p><h2 id="report-title">What did you find?</h2><p>{place.name}</p>
      <label htmlFor="report-type">Your observation</label><select id="report-type" value={type} onChange={e=>setType(e.target.value as ReportType)} disabled={busy} autoFocus>{reportTypes.filter(t=>t!=='not-drinkable'||place.kind==='water').map(t=><option key={t} value={t}>{reportLabels[t]}</option>)}</select>
      <label htmlFor="observed-date">Date you visited (UTC)</label><input id="observed-date" type="date" required value={date} max={new Date().toISOString().slice(0,10)} min={new Date(Date.now()-90*86400000).toISOString().slice(0,10)} onChange={e=>setDate(e.target.value)} disabled={busy}/>
      <label htmlFor="report-note">Details for the moderator <span className="muted">(optional)</span></label><textarea id="report-note" value={note} maxLength={400} onChange={e=>setNote(e.target.value)} rows={3} disabled={busy} aria-describedby="report-privacy"/>
      <p id="report-privacy" className="small muted">Describe access or signs. Leave out names, contact details, and door codes. Notes stay private to moderators and are deleted within 90 days. We do not collect photos.</p>
      {type==='working'&&place.kind==='water'&&<p className="notice">A working tap is not a water-quality test. Please follow posted water notices.</p>}
      {error&&<p className="error" role="alert">{error}</p>}
      <button className="primary" disabled={busy}>{busy?'Saving…':'Send for review'}</button><p className="small muted">No account needed. Reports are reviewed before publication.</p>
    </form>}
  </dialog>;
}
