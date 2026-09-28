import {useEffect,useMemo,useRef,useState} from 'react';
import {Download,Eye,FileMinus2,FilePlus2,FileText,FileUp,Paperclip,Plus,Printer,ReceiptText,RotateCcw,ShoppingCart,X} from 'lucide-react';
import {supabase} from '../supabase';
import {friendlyError} from '../lib/requests';
import {getAccessState} from '../lib/rbac';
import {buildVoucherPdf,voucherFileName} from '../lib/voucherDocument';

const names:Record<string,string>={receipt:'سند قبض',payment:'سند صرف',expense:'مصروف',purchase:'مشتريات'};
const icons:Record<string,React.ReactNode>={receipt:<FilePlus2/>,payment:<FileMinus2/>,expense:<ReceiptText/>,purchase:<ShoppingCart/>};
const money=(v:any)=>Number(v||0).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س';
const allowedMime=['application/pdf','image/jpeg','image/png','image/webp'];

export default function AccountingVouchers({type,accounts,onChanged,canManage=true}:{type?:string;accounts:any[];onChanged:()=>void;canManage?:boolean}){
 const[rows,setRows]=useState<any[]>([]),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const[profile,setProfile]=useState<any>(null),[charityId,setCharityId]=useState('');
 const[pendingFiles,setPendingFiles]=useState<File[]>([]);
 const[attachmentVoucher,setAttachmentVoucher]=useState<any>(null),[attachments,setAttachments]=useState<any[]>([]),[attachmentLoading,setAttachmentLoading]=useState(false);
 const[fileBusy,setFileBusy]=useState('');
 const fileInput=useRef<HTMLInputElement|null>(null);
 const[form,setForm]=useState({type:type||'receipt',date:new Date().toISOString().slice(0,10),amount:'',party:'',description:'',method:'bank',debit:'',credit:'',external:''});

 const load=async()=>{
  setError('');
  const access=await getAccessState();
  if(!access.charityId)return setError('تعذر تحديد الجمعية الحالية.');
  setCharityId(access.charityId);
  const[v,p]=await Promise.all([supabase.rpc('accounting_vouchers',{p_type:type||null}),supabase.rpc('charity_profile')]);
  if(v.error)setError(friendlyError(v.error));else setRows(((v.data||[])as any[]).map(x=>({...x,voucher_date:x.transaction_date})));
  if(!p.error)setProfile(p.data);
 };
 useEffect(()=>{setForm(v=>({...v,type:type||'receipt'}));setPendingFiles([]);void load()},[type]);

 const active=useMemo(()=>accounts.filter(x=>x.is_active),[accounts]);
 function preset(next:string){
  const byCode=(code:string)=>active.find(x=>x.code===code)?.id||'';
  const map:Record<string,[string,string]>={receipt:[byCode('1100'),byCode('4300')],payment:[byCode('2200')||byCode('5400'),byCode('1100')],expense:[byCode('5400'),byCode('1100')],purchase:[byCode('1400')||byCode('1200'),byCode('2100')||byCode('1100')]};
  setForm(v=>({...v,type:next,debit:map[next]?.[0]||'',credit:map[next]?.[1]||''}));
  if(!['expense','purchase'].includes(next))setPendingFiles([]);
 }

 function validateFile(file:File){
  if(!allowedMime.includes(file.type))throw new Error('المرفقات المدعومة PDF أو JPG أو PNG أو WebP.');
  if(file.size>15*1024*1024)throw new Error('حجم كل مستند يجب ألا يتجاوز 15MB.');
 }

 async function attachFile(voucherId:string,file:File,kind='invoice'){
  validateFile(file);
  if(!charityId)throw new Error('تعذر تحديد الجمعية الحالية.');
  const ext=(file.name.split('.').pop()||'file').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
  const safe=(file.name.replace(/[^a-zA-Z0-9._-]/g,'-').slice(-100)||('document.'+ext));
  const path=`${charityId}/vouchers/${voucherId}/${crypto.randomUUID()}-${safe}`;
  const up=await supabase.storage.from('accounting-documents').upload(path,file,{contentType:file.type,cacheControl:'3600',upsert:false});
  if(up.error)throw up.error;
  const reg=await supabase.rpc('add_accounting_voucher_attachment',{
   p_voucher_id:voucherId,p_document_kind:kind,p_title:file.name,p_object_path:path,p_mime_type:file.type,p_file_size:file.size
  });
  if(reg.error){await supabase.storage.from('accounting-documents').remove([path]);throw reg.error}
 }

 async function uploadFiles(voucherId:string,files:File[]){
  for(const file of files)await attachFile(voucherId,file,'invoice');
 }

 async function create(e:React.FormEvent){
  e.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');
  try{
   const r=await supabase.rpc('accounting_create_voucher',{
    p_voucher_type:form.type,p_transaction_date:form.date,p_amount:Number(form.amount),p_party_name:form.party.trim()||null,
    p_description:form.description.trim(),p_payment_method:form.method,p_debit_account_id:form.debit,p_credit_account_id:form.credit,
    p_external_reference:form.external.trim()||null
   });
   if(r.error)throw r.error;
   const voucherId=(r.data as any)?.id;
   let attachmentWarning='';
   if(voucherId&&pendingFiles.length){
    try{await uploadFiles(voucherId,pendingFiles)}catch(err){attachmentWarning=' تم ترحيل السند لكن تعذر رفع بعض المرفقات؛ يمكنك رفعها من سجل السند.';console.error(err)}
   }
   setOpen(false);setPendingFiles([]);setForm({...form,amount:'',party:'',description:'',external:''});
   await load();await onChanged();setNotice('تم ترحيل السند بنجاح.'+attachmentWarning);
  }catch(e){setError(friendlyError(e))}finally{setBusy(false)}
 }

 async function voidVoucher(id:string){
  if(busy)return;const reason=prompt('سبب إلغاء السند وعكس القيد:')?.trim();if(!reason)return;setBusy(true);setError('');setNotice('');
  try{const r=await supabase.rpc('accounting_void_voucher',{p_voucher_id:id,p_reason:reason});if(r.error)throw r.error;await load();await onChanged();setNotice('تم إلغاء السند وعكس القيد مع الاحتفاظ بمرفقاته.')}
  catch(e){setError(friendlyError(e))}finally{setBusy(false)}
 }

 async function generatePdf(row:any,mode:'download'|'print'){
  if(!profile)return setError('تعذر تحميل بيانات الجمعية للطباعة.');
  setFileBusy(row.id+mode);setError('');
  const popup=mode==='print'?window.open('about:blank','_blank'):null;
  try{
   const blob=await buildVoucherPdf(row,profile);
   const url=URL.createObjectURL(blob);
   if(mode==='download'){
    const a=document.createElement('a');a.href=url;a.download=voucherFileName(row);document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
   }else{
    if(popup){popup.location.href=url}else window.open(url,'_blank','noopener,noreferrer');
    setTimeout(()=>URL.revokeObjectURL(url),120000);
   }
  }catch(e){popup?.close();setError(friendlyError(e))}finally{setFileBusy('')}
 }

 async function openAttachments(row:any){
  setAttachmentVoucher(row);setAttachments([]);setAttachmentLoading(true);setError('');
  const r=await supabase.rpc('accounting_voucher_attachments',{p_voucher_id:row.id});
  setAttachmentLoading(false);
  if(r.error){setError(friendlyError(r.error));return}
  setAttachments((r.data||[]) as any[]);
 }

 async function viewAttachment(a:any){
  setFileBusy(a.id);setError('');
  const w=window.open('about:blank','_blank');
  try{
   const r=await supabase.storage.from('accounting-documents').createSignedUrl(a.object_path,600);
   if(r.error)throw r.error;
   if(w)w.location.href=r.data.signedUrl;else window.open(r.data.signedUrl,'_blank','noopener,noreferrer');
  }catch(e){w?.close();setError(friendlyError(e))}finally{setFileBusy('')}
 }

 async function addFilesToExisting(row:any,files:File[]){
  if(!files.length)return;setFileBusy(row.id+'upload');setError('');setNotice('');
  try{
   await uploadFiles(row.id,files);await load();
   if(attachmentVoucher?.id===row.id)await openAttachments(row);
   setNotice('تم حفظ الفاتورة/المستند وربطه بالسند المحاسبي.');
  }catch(e){setError(friendlyError(e))}finally{setFileBusy('')}
 }

 return <section className="voucher-center">
  <div className="voucher-hero"><div><span>{icons[type||'receipt']}</span><div><h2>{type?names[type]:'السندات والحركات المالية'}</h2><p>كل سند يُنشئ قيدًا مزدوجًا متوازنًا، ويمكن حفظ المستندات المؤيدة وإصدار نسخة PDF رسمية.</p></div></div><button className="primary" disabled={!canManage} onClick={()=>{preset(type||'receipt');setOpen(true);setError('');setNotice('')}}><Plus/> سند جديد</button></div>
  {!type&&canManage&&<div className="voucher-types">{Object.entries(names).map(([k,v])=><button key={k} onClick={()=>{preset(k);setOpen(true)}}>{icons[k]}<b>{v}</b><small>إنشاء وترحيل</small></button>)}</div>}
  {error&&<div className="error">{error}</div>}{notice&&<div className="permission-notice">{notice}</div>}
  <div className="data-card"><div className="data-card-head"><strong>سجل السندات</strong><span>{rows.length.toLocaleString('ar-SA')} حركة</span></div><div className="table-wrap"><table><thead><tr><th>الرقم</th><th>التاريخ</th><th>النوع</th><th>البيان / الجهة</th><th>طريقة السداد</th><th>المبلغ</th><th>المرفقات</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td><b>{x.voucher_no}</b></td><td>{new Date(x.voucher_date).toLocaleDateString('ar-SA')}</td><td>{names[x.voucher_type]}</td><td>{x.description}<small className="table-sub">{x.party_name}</small></td><td>{x.payment_method==='cash'?'نقدي':x.payment_method==='credit'?'آجل':x.payment_method==='transfer'?'تحويل':'بنك'}</td><td>{money(x.amount)}</td><td><button className="document-count" onClick={()=>void openAttachments(x)}><Paperclip/>{Number(x.attachment_count||0).toLocaleString('ar-SA')}</button></td><td><span className={`status-pill ${x.status}`}>{x.status==='posted'?'مرحّل':'ملغي'}</span></td><td><div className="voucher-row-actions">
   <button className="icon" disabled={!!fileBusy} title="تنزيل PDF" onClick={()=>void generatePdf(x,'download')}><Download/></button>
   <button className="icon" disabled={!!fileBusy} title="فتح نسخة للطباعة" onClick={()=>void generatePdf(x,'print')}><Printer/></button>
   {canManage&&['expense','purchase'].includes(x.voucher_type)&&<label className="icon file-icon" title="رفع فاتورة"><FileUp/><input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e=>{const files=Array.from(e.target.files||[]);e.currentTarget.value='';void addFilesToExisting(x,files)}}/></label>}
   {canManage&&x.status==='posted'&&<button className="icon" disabled={busy} title="إلغاء وعكس القيد" onClick={()=>void voidVoucher(x.id)}><RotateCcw/></button>}
  </div></td></tr>)}</tbody></table>{!rows.length&&<div className="empty">لا توجد سندات في هذا القسم بعد.</div>}</div></div>

  {open&&<div className="modal-backdrop" onMouseDown={e=>{if(!busy&&e.currentTarget===e.target)setOpen(false)}}><form className="modal voucher-modal" onSubmit={create}><div className="modal-head"><div><b>إنشاء {names[form.type]}</b><span>سيتم التحقق من الفترة وترحيل قيد متوازن تلقائيًا.</span></div><button type="button" disabled={busy} onClick={()=>setOpen(false)}><X/></button></div><fieldset disabled={busy}>
   <div className="form-grid"><label>نوع الحركة<select value={form.type} onChange={e=>preset(e.target.value)}>{Object.entries(names).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label><label>التاريخ<input type="date" required value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label></div>
   <div className="form-grid"><label>المبلغ<input type="number" min="0.01" step="0.01" required value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label><label>طريقة السداد<select value={form.method} onChange={e=>setForm({...form,method:e.target.value})}><option value="bank">بنك</option><option value="cash">نقدي</option><option value="transfer">تحويل</option><option value="credit">آجل</option></select></label></div>
   <label>الجهة / المستفيد / المورد<input value={form.party} onChange={e=>setForm({...form,party:e.target.value})}/></label>
   <label>البيان المحاسبي<input required minLength={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
   <div className="form-grid"><label>الحساب المدين<select required value={form.debit} onChange={e=>setForm({...form,debit:e.target.value})}><option value="">اختر الحساب</option>{active.map(x=><option value={x.id} key={x.id}>{x.code} — {x.name_ar}</option>)}</select></label><label>الحساب الدائن<select required value={form.credit} onChange={e=>setForm({...form,credit:e.target.value})}><option value="">اختر الحساب</option>{active.map(x=><option value={x.id} key={x.id}>{x.code} — {x.name_ar}</option>)}</select></label></div>
   <label>مرجع خارجي (اختياري)<input value={form.external} onChange={e=>setForm({...form,external:e.target.value})}/></label>
   {['expense','purchase'].includes(form.type)&&<section className="voucher-attachment-picker"><div><FileText/><span><b>فاتورة / مستند مؤيد</b><small>PDF أو صورة — حتى 15MB لكل ملف. يمكن إضافة أكثر من فاتورة.</small></span></div><input ref={fileInput} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e=>{try{const files=Array.from(e.target.files||[]);files.forEach(validateFile);setPendingFiles(files);setError('')}catch(err){setError(friendlyError(err));e.currentTarget.value='';setPendingFiles([])}}}/>{pendingFiles.length>0&&<p>{pendingFiles.length.toLocaleString('ar-SA')} ملف جاهز للرفع بعد ترحيل السند.</p>}</section>}
   {error&&<div className="error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={()=>setOpen(false)}>إلغاء</button><button className="primary" disabled={busy}>{busy?'جاري الترحيل…':`ترحيل ${names[form.type]}`}</button></div>
  </fieldset></form></div>}

  {attachmentVoucher&&<div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setAttachmentVoucher(null)}}><section className="modal voucher-documents-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><b>مستندات {attachmentVoucher.voucher_no}</b><span>الفواتير والمستندات المؤيدة المرتبطة بهذا السند.</span></div><button onClick={()=>setAttachmentVoucher(null)}><X/></button></div><div className="voucher-documents-body">
   {attachmentLoading?<div className="loading">جاري تحميل المرفقات...</div>:!attachments.length?<div className="empty"><Paperclip/>لا توجد مرفقات لهذا السند.</div>:attachments.map(a=><article className="voucher-document-row" key={a.id}><FileText/><div><b>{a.title}</b><span>{a.document_kind==='invoice'?'فاتورة':'مستند مؤيد'} · {(Number(a.file_size)/1024/1024).toLocaleString('ar-SA',{maximumFractionDigits:2})} MB · {new Date(a.created_at).toLocaleDateString('ar-SA')}</span></div><button className="secondary" disabled={fileBusy===a.id} onClick={()=>void viewAttachment(a)}><Eye/> فتح</button></article>)}
   {canManage&&['expense','purchase'].includes(attachmentVoucher.voucher_type)&&<label className="voucher-upload-more"><FileUp/><span><b>إضافة فاتورة أخرى</b><small>ترتبط بالسند نفسه وتظل محفوظة مع السجل المحاسبي.</small></span><input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e=>{const files=Array.from(e.target.files||[]);e.currentTarget.value='';void addFilesToExisting(attachmentVoucher,files)}}/></label>}
  </div></section></div>}
 </section>
}
