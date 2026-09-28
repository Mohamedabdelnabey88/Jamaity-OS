import {useEffect,useState} from 'react';
import {AlertTriangle,X} from 'lucide-react';

export type ActionDialogField={
 key:string;
 label:string;
 placeholder?:string;
 type?:'text'|'textarea'|'select';
 required?:boolean;
 maxLength?:number;
 options?:Array<{value:string;label:string}>;
};

export default function ActionDialog({
 open,title,description,fields=[],initialValues={},confirmLabel='تأكيد',cancelLabel='إلغاء',danger=false,busy=false,onCancel,onConfirm
}:{
 open:boolean;
 title:string;
 description?:string;
 fields?:ActionDialogField[];
 initialValues?:Record<string,string>;
 confirmLabel?:string;
 cancelLabel?:string;
 danger?:boolean;
 busy?:boolean;
 onCancel:()=>void;
 onConfirm:(values:Record<string,string>)=>void|Promise<void>;
}){
 const[values,setValues]=useState<Record<string,string>>(initialValues);
 useEffect(()=>{if(open)setValues(initialValues)},[open]);
 if(!open)return null;
 return <div className="modal-backdrop" onMouseDown={e=>{if(!busy&&e.currentTarget===e.target)onCancel()}}>
  <form className="modal action-dialog" role="dialog" aria-modal="true" aria-label={title} onSubmit={e=>{e.preventDefault();void onConfirm(values)}}>
   <div className="modal-head"><div><b>{title}</b>{description&&<span>{description}</span>}</div><button type="button" disabled={busy} onClick={onCancel} aria-label="إغلاق"><X/></button></div>
   <fieldset disabled={busy}>
    {danger&&<div className="action-dialog-warning"><AlertTriangle/><span>راجع البيانات قبل التأكيد. هذا الإجراء يتم تسجيله في سجل التدقيق.</span></div>}
    {fields.map(field=><label key={field.key}>{field.label}
     {field.type==='textarea'?<textarea autoFocus rows={4} required={field.required} maxLength={field.maxLength||1000} placeholder={field.placeholder} value={values[field.key]||''} onChange={e=>setValues(v=>({...v,[field.key]:e.target.value}))}/>
     :field.type==='select'?<select autoFocus required={field.required} value={values[field.key]||''} onChange={e=>setValues(v=>({...v,[field.key]:e.target.value}))}>{field.options?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
     :<input autoFocus required={field.required} maxLength={field.maxLength||250} placeholder={field.placeholder} value={values[field.key]||''} onChange={e=>setValues(v=>({...v,[field.key]:e.target.value}))}/>}
    </label>)}
    <div className="modal-actions"><button type="button" className="secondary" disabled={busy} onClick={onCancel}>{cancelLabel}</button><button className={danger?'danger':'primary'} disabled={busy}>{busy?'جاري التنفيذ…':confirmLabel}</button></div>
   </fieldset>
  </form>
 </div>
}
