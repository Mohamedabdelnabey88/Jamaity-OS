import { useEffect,useRef,useState } from 'react';
import { Download,FileText,Trash2,UploadCloud } from 'lucide-react';
import { supabase } from '../supabase';
import { getAccessState } from '../lib/rbac';
import { friendlyError } from '../lib/requests';

type DocumentRow={id:string;bucket_id:string;object_path:string;document_type:string;original_name:string;size_bytes:number|null;created_at:string;source:string;review_status:string|null;can_delete:boolean};
const allowed=['application/pdf','image/jpeg','image/png','image/webp'];
const labels:Record<string,string>={national_id:'الهوية',address:'العنوان',income:'إثبات الدخل',family_card:'بطاقة العائلة',iban:'الحساب البنكي',medical:'تقرير طبي',accepted:'تمت مراجعته وقبوله',pending:'بانتظار المراجعة',rejected:'مرفوض'};
export default function BeneficiaryDocuments({beneficiaryId}:{beneficiaryId:string}){
 const input=useRef<HTMLInputElement>(null),generation=useRef(0),locked=useRef(false);
 const[rows,setRows]=useState<DocumentRow[]>([]),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[canUpload,setCanUpload]=useState(false),[signed,setSigned]=useState<{url:string;name:string}|null>(null);
 async function load(){
  const g=++generation.current;setLoading(true);setError('');setSigned(null);
  try{const [r,access]=await Promise.all([supabase.rpc('charity_beneficiary_documents',{p_beneficiary_id:beneficiaryId}),getAccessState(true)]);if(r.error)throw r.error;if(g!==generation.current)return;setRows(r.data||[]);setCanUpload(access.permissions.includes('documents.manage')||access.permissions.includes('beneficiaries.manage'));}
  catch(e){if(g===generation.current){setRows([]);setCanUpload(false);setError(friendlyError(e));}}
  finally{if(g===generation.current)setLoading(false);}
 }
 useEffect(()=>{void load();return()=>{generation.current++}},[beneficiaryId]);
 async function upload(file?:File){
  if(!file||locked.current||!canUpload)return;
  if(file.size>10*1024*1024)return setError('الحد الأقصى 10MB.');if(!allowed.includes(file.type))return setError('يُسمح بملفات PDF وJPG وPNG وWEBP فقط.');
  locked.current=true;setBusy(true);setError('');
  try{const access=await getAccessState(true);if(!access.charityId)throw Error('لا توجد جمعية فعالة.');
   const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'-'),path=`${access.charityId}/${beneficiaryId}/${crypto.randomUUID()}-${safe}`;
   const up=await supabase.storage.from('beneficiary-documents').upload(path,file,{contentType:file.type,upsert:false});if(up.error)throw up.error;
   const meta=await supabase.rpc('register_beneficiary_document',{p_beneficiary_id:beneficiaryId,p_object_path:path,p_document_type:file.type==='application/pdf'?'document':'image',p_original_name:file.name,p_mime_type:file.type,p_size_bytes:file.size});
   if(meta.error)throw Error('تم رفع الملف لكن تعذر تأكيد تسجيله. حدّث القائمة قبل إعادة المحاولة.');
   await load();
  }catch(e){setError(friendlyError(e));}finally{locked.current=false;setBusy(false);if(input.current)input.current.value='';}
 }
 async function download(row:DocumentRow){
  if(locked.current)return;locked.current=true;setBusy(true);setError('');setSigned(null);
  try{const r=await supabase.storage.from(row.bucket_id).createSignedUrl(row.object_path,60);if(r.error)throw r.error;setSigned({url:r.data.signedUrl,name:row.original_name});}
  catch(e){setError(friendlyError(e));}finally{locked.current=false;setBusy(false);}
 }
 async function remove(row:DocumentRow){
  if(locked.current||!row.can_delete||!confirm('هل تريد حذف المستند نهائيًا؟'))return;
  locked.current=true;setBusy(true);setError('');
  try{const rpc=await supabase.rpc('remove_beneficiary_document',{p_document_id:row.id});if(rpc.error)throw rpc.error;
   const removed=await supabase.storage.from(row.bucket_id).remove([row.object_path]);await load();if(removed.error)throw Error('حُذف المستند من القائمة لكن تعذر حذف الملف المخزن. تواصل مع الإدارة.');
  }catch(e){setError(friendlyError(e));}finally{locked.current=false;setBusy(false);}
 }
 return <section id="beneficiary-documents" className="panel beneficiary-documents"><div className="panel-title"><div><span>ملفات محمية</span><h2>مستندات المستفيد</h2></div><FileText/></div>
  <p>تشمل مستندات طلب الانضمام المقبول والمستندات المضافة للملف. مستندات الطلب محفوظة للرجوع إلى المراجعة.</p>
  {canUpload&&<div className="document-drop" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void upload(e.dataTransfer.files[0])}}><UploadCloud/><button type="button" className="secondary" disabled={busy} onClick={()=>input.current?.click()}>{busy?'جاري تنفيذ الإجراء...':'اختيار مستند أو سحبه هنا'}</button><span>PDF / JPG / PNG / WEBP — حتى 10MB</span><input ref={input} type="file" hidden disabled={busy} accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e=>void upload(e.target.files?.[0])}/></div>}
  {error&&<div role="alert" className="error">{error}<button type="button" disabled={busy} onClick={()=>void load()}>تحديث القائمة</button></div>}
  {signed&&<p><a href={signed.url} target="_blank" rel="noopener noreferrer">فتح {signed.name}</a> — رابط محمي صالح لدقيقة؛ أعد طلب العرض عند انتهائه.</p>}
  {loading?<div className="empty">جاري تحميل المستندات...</div>:!error&&rows.length===0?<div className="empty">لا توجد مستندات مرتبطة بهذا الملف حتى الآن.</div>:<div className="document-list">{rows.map(row=><div key={`${row.source}-${row.id}`}><span className="document-icon"><FileText/></span><div><b>{row.original_name}</b><small>{row.source==='application'?'طلب الانضمام':'ملف المستفيد'} · {labels[row.document_type]||'مستند'}{row.review_status?` · ${labels[row.review_status]||row.review_status}`:''}</small><small>{(Number(row.size_bytes||0)/1024).toLocaleString('ar-SA',{maximumFractionDigits:0})} KB · {new Date(row.created_at).toLocaleDateString('ar-SA')}</small></div><button className="icon" disabled={busy} onClick={()=>void download(row)} title="عرض أو تنزيل" aria-label={`عرض ${row.original_name}`}><Download/></button>{row.can_delete&&<button className="icon danger-icon" disabled={busy} onClick={()=>void remove(row)} aria-label={`حذف ${row.original_name}`}><Trash2/></button>}</div>)}</div>}
 </section>
}
