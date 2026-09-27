import {readWithDeadline} from '../lib/readWithDeadline';
import {useEffect,useMemo,useRef,useState} from 'react';
import {CheckCircle2,Clock3,Copy,Download,FileCheck2,Heart,Mail,MessageCircle,Plus,RefreshCw,Search,Send,ShieldCheck,XCircle} from 'lucide-react';
import {supabase} from '../supabase';
import {getAccessState} from '../lib/rbac';
import {friendlyError} from '../lib/requests';
import {applyTemplate,renderOfficialLetter} from '../lib/officialLetter';

const labels:Record<string,string>={pledged:'متعهد به',pending:'قيد المراجعة',approved:'معتمد',received:'تم الاستلام',rejected:'مرفوض',cancelled:'ملغي'};

export default function Donations(){
 const[rows,setRows]=useState<any[]>([]),[donors,setDonors]=useState<any[]>([]),[warehouses,setWarehouses]=useState<any[]>([]),[items,setItems]=useState<any[]>([]);
 const[q,setQ]=useState(''),[filter,setFilter]=useState('all'),[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const[open,setOpen]=useState(false),[receiveOpen,setReceiveOpen]=useState<any>(null);
 const[form,setForm]=useState({donor:'',type:'cash',amount:'',reference:'',description:'',quantity:'',unit:'سلة'});
 const[receiveForm,setReceiveForm]=useState({warehouse:'',item:'',quantity:''});
 const[charityName,setCharityName]=useState('الجمعية'),[charityId,setCharityId]=useState('');
 const[letterTemplate,setLetterTemplate]=useState<any>(null),[officialDoc,setOfficialDoc]=useState<{donationId:string;url:string;path:string}|null>(null);
 const[thankOpen,setThankOpen]=useState<any>(null),[thankMessage,setThankMessage]=useState(''),[thankChannel,setThankChannel]=useState<'whatsapp'|'email'|'copy'|'other'>('whatsapp');
 const[thankStatus,setThankStatus]=useState<Record<string,{last_sent_at:string;send_count:number}>>({});
 const mutationLock=useRef(false),readController=useRef<AbortController|null>(null);

 async function load(){
  readController.current?.abort();const controller=new AbortController();readController.current=controller;setLoading(true);setError('');
  try{await readWithDeadline(async()=>{
   const a=await getAccessState(true);if(controller.signal.aborted)return;
   if(!a.charityId){setRows([]);return}setCharityId(a.charityId);
   const[d,r,w,i,p,t]=await Promise.all([
    supabase.from('donors').select('id,full_name').eq('charity_id',a.charityId).order('full_name').limit(500),
    (()=>{let x=supabase.from('donations').select('*,donors(full_name,phone,email)').eq('charity_id',a.charityId!).order('donated_at',{ascending:false}).limit(100);return filter!=='all'?x.eq('status',filter):x})(),
    supabase.from('warehouses').select('id,name_ar').eq('charity_id',a.charityId).eq('is_active',true).order('name_ar'),
    supabase.from('inventory_items').select('id,name_ar,unit,sku').eq('charity_id',a.charityId).eq('is_active',true).order('name_ar'),
    supabase.rpc('charity_profile'),
    supabase.rpc('donor_thank_you_template')
   ]);
   if(d.error||r.error||w.error||i.error)throw d.error||r.error||w.error||i.error;
   if(controller.signal.aborted)return;
   const donationRows=r.data||[];
   setDonors(d.data||[]);setRows(donationRows);setWarehouses(w.data||[]);setItems(i.data||[]);
   if(!p.error&&p.data)setCharityName((p.data as any)?.name_ar||'الجمعية');
   if(!t.error)setLetterTemplate(t.data||null);
   const ids=donationRows.filter((x:any)=>x.status==='received').map((x:any)=>x.id);
   if(ids.length){
    const s=await supabase.rpc('donation_thank_you_status',{p_donation_ids:ids});
    if(!s.error&&!controller.signal.aborted){
     const map:Record<string,{last_sent_at:string;send_count:number}>={};
     for(const row of (s.data||[]) as any[])map[row.donation_id]={last_sent_at:row.last_sent_at,send_count:Number(row.send_count||0)};
     setThankStatus(map);
    }
   }else setThankStatus({});
  },controller)}catch(e){if(readController.current===controller)setError(friendlyError(e))}finally{if(readController.current===controller)setLoading(false)}
 }
 useEffect(()=>{void load();return()=>{readController.current?.abort();readController.current=null}},[filter]);

 const shown=useMemo(()=>rows.filter(x=>`${x.donors?.full_name||''} ${x.reference_no||''} ${x.donation_type||''}`.toLowerCase().includes(q.toLowerCase())),[rows,q]);

 async function review(id:string,status:'approved'|'rejected'){
  if(mutationLock.current)return;mutationLock.current=true;setBusy(id+status);setError('');setNotice('');
  try{let r;if(status==='approved')r=await supabase.rpc('approve_donation',{p_donation_id:id});else r=await supabase.rpc('reject_donation',{p_donation_id:id,p_reason:null});if(r.error)throw r.error;await load()}
  catch(e:any){setError(friendlyError(e))}finally{mutationLock.current=false;setBusy('')}
 }
 async function receive(id:string){
  if(mutationLock.current)return;mutationLock.current=true;setBusy(id);setError('');setNotice('');
  try{const{error:e}=await supabase.rpc('receive_donation',{p_donation_id:id});if(e)throw e;await load()}
  catch(e){setError(friendlyError(e))}finally{mutationLock.current=false;setBusy('')}
 }
 async function receiveInKind(e:any){
  e.preventDefault();if(mutationLock.current)return;mutationLock.current=true;setBusy('in-kind');setError('');setNotice('');
  try{
   if(!receiveForm.warehouse||!receiveForm.item||!Number.isFinite(Number(receiveForm.quantity))||Number(receiveForm.quantity)<=0)throw new Error('اختر المستودع والصنف وأدخل كمية صحيحة');
   const{error:e}=await supabase.rpc('receive_in_kind_donation',{p_donation_id:receiveOpen.id,p_warehouse_id:receiveForm.warehouse,p_item_id:receiveForm.item,p_quantity:Number(receiveForm.quantity)});
   if(e)throw e;setReceiveOpen(null);setReceiveForm({warehouse:'',item:'',quantity:''});await load()
  }catch(e:any){setError(friendlyError(e))}finally{mutationLock.current=false;setBusy('')}
 }
 async function create(e:any){
  e.preventDefault();if(mutationLock.current)return;mutationLock.current=true;setBusy('create');setError('');setNotice('');
  try{
   if(!form.donor)throw new Error('اختر المتبرع');
   if(!Number.isFinite(Number(form.amount))||Number(form.amount)<=0)throw new Error(form.type==='cash'?'أدخل مبلغًا صحيحًا':'أدخل القيمة التقديرية للتبرع العيني');
   if(form.type==='in_kind'&&(!form.description.trim()||!form.unit.trim()||!Number.isFinite(Number(form.quantity))||Number(form.quantity)<=0))throw new Error('أدخل وصف التبرع العيني والكمية والوحدة');
   const{error:e}=await supabase.rpc('create_donation_v2',{p_donor_id:form.donor,p_donation_type:form.type,p_amount:Number(form.amount),p_reference_no:form.reference||null,p_donated_at:new Date().toISOString(),p_in_kind_description:form.type==='in_kind'?(form.description.trim()||'تبرع عيني — يُحدد الصنف عند الاستلام'):null,p_planned_quantity:form.type==='in_kind'?Number(form.quantity||1):null,p_unit:form.type==='in_kind'?form.unit.trim()||'وحدة':null});
   if(e)throw e;setOpen(false);setForm({donor:'',type:'cash',amount:'',reference:'',description:'',quantity:'',unit:'سلة'});await load()
  }catch(e:any){setError(friendlyError(e))}finally{mutationLock.current=false;setBusy('')}
 }

 function openThank(donation:any){
  setError('');setNotice('');setThankOpen(donation);
  const preferred=donation.donors?.phone?'whatsapp':donation.donors?.email?'email':'copy';
  setThankChannel(preferred);setOfficialDoc(null);
  setThankMessage(buildThankYouMessage(donation,charityName));
 }
 async function copyThank(){
  await navigator.clipboard.writeText(thankMessage);
  setThankChannel('copy');setNotice('تم نسخ رسالة الشكر. بعد إرسالها للمتبرع اضغط «تأكيد تم الإرسال».');
 }
 async function ensureOfficialLetter(){
  if(!thankOpen)throw new Error('لم يتم تحديد التبرع.');
  if(!letterTemplate?.background_object_path)throw new Error('لم يتم إعداد الورقة الرسمية للجمعية بعد. انتقل إلى الإعدادات ← خطابات الشكر.');
  if(officialDoc?.donationId===thankOpen.id)return officialDoc.url;
  setBusy('letter');setError('');
  try{
   const bg=await supabase.storage.from('charity-letterheads').createSignedUrl(letterTemplate.background_object_path,600);
   if(bg.error)throw bg.error;
   const content=applyTemplate(letterTemplate.body_template,letterValues(thankOpen,charityName));
   const rendered=await renderOfficialLetter(bg.data.signedUrl,content,{
    contentTopMm:Number(letterTemplate.content_top_mm||62),
    contentSideMm:Number(letterTemplate.content_side_mm||22),
    fontSizePt:Number(letterTemplate.font_size_pt||13)
   });
   const path=`${charityId}/generated/donor-thank-you/${thankOpen.id}/thank-you-${Date.now()}.pdf`;
   const uploaded=await supabase.storage.from('charity-letterheads').upload(path,rendered.pdfBlob,{contentType:'application/pdf',cacheControl:'3600',upsert:false});
   if(uploaded.error)throw uploaded.error;
   const registered=await supabase.rpc('register_donation_thank_you_document',{p_donation_id:thankOpen.id,p_template_id:letterTemplate.id,p_object_path:path});
   if(registered.error)throw registered.error;
   const signed=await supabase.storage.from('charity-letterheads').createSignedUrl(path,604800);
   if(signed.error)throw signed.error;
   const doc={donationId:thankOpen.id,url:signed.data.signedUrl,path};setOfficialDoc(doc);
   setNotice('تم إنشاء خطاب الشكر الرسمي PDF وحفظه في سجل التبرع.');
   return doc.url;
  }finally{setBusy('')}
 }
 async function downloadOfficialLetter(){
  try{
   const url=await ensureOfficialLetter();
   const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.click();
  }catch(e){setError(friendlyError(e))}
 }
 async function openWhatsApp(){
  if(!thankOpen?.donors?.phone)return;
  const phone=normalizeWhatsAppNumber(thankOpen.donors.phone);
  if(!phone){setError('رقم جوال المتبرع غير صالح لفتح واتساب.');return}
  const popup=window.open('about:blank','_blank');
  try{
   const documentUrl=await ensureOfficialLetter();setThankChannel('whatsapp');
   const body=`${thankMessage}\n\nخطاب الشكر الرسمي (رابط آمن لمدة 7 أيام):\n${documentUrl}`;
   const target=`https://wa.me/${phone}?text=${encodeURIComponent(body)}`;
   if(popup)popup.location.href=target;else window.location.href=target;
  }catch(e){popup?.close();setError(friendlyError(e))}
 }
 async function openEmail(){
  if(!thankOpen?.donors?.email)return;
  try{
   const documentUrl=await ensureOfficialLetter();setThankChannel('email');
   const subject=encodeURIComponent(`شكر وتقدير من ${charityName}`);
   const body=encodeURIComponent(`${thankMessage}\n\nخطاب الشكر الرسمي PDF (رابط آمن لمدة 7 أيام):\n${documentUrl}`);
   window.location.href=`mailto:${encodeURIComponent(thankOpen.donors.email)}?subject=${subject}&body=${body}`;
  }catch(e){setError(friendlyError(e))}
 }
 async function confirmThank(){
  if(!thankOpen||mutationLock.current)return;
  mutationLock.current=true;setBusy('thank');setError('');
  try{
   const r=await supabase.rpc('record_donation_thank_you',{p_donation_id:thankOpen.id,p_channel:thankChannel,p_message:thankMessage.trim()});
   if(r.error)throw r.error;
   setThankStatus(prev=>({...prev,[thankOpen.id]:{last_sent_at:new Date().toISOString(),send_count:(prev[thankOpen.id]?.send_count||0)+1}}));
   setThankOpen(null);setNotice('تم تسجيل إرسال رسالة الشكر في سجل التبرع.');
  }catch(e){setError(friendlyError(e))}finally{mutationLock.current=false;setBusy('')}
 }

 return <main className="module-page">
  <div className="module-head"><div><span className="eyebrow"><Heart size={15}/> الموارد المالية</span><h1>التبرعات</h1><p>سجل التبرعات النقدية والعينية مع الاعتماد والاستلام والترحيل المحاسبي.</p></div><div className="hero-actions"><button className="secondary"disabled={!!busy} onClick={()=>void load()}><RefreshCw size={17}/> تحديث</button><button className="primary"disabled={!!busy} onClick={()=>{setError('');setNotice('');setOpen(true)}}><Plus size={18}/> تسجيل تبرع</button></div></div>

  <div className="module-toolbar"><div className="search-box"><Search size={18}/><input value={q}onChange={e=>setQ(e.target.value)}placeholder="ابحث باسم المتبرع أو رقم المرجع..."/></div><div className="support-filters">{['all','pledged','pending','approved','received','rejected','cancelled'].map(x=><button className={filter===x?'filter active':'filter'}disabled={!!busy} onClick={()=>setFilter(x)}key={x}>{x==='all'?'الكل':labels[x]}</button>)}</div></div>
  {error&&<div className="error">{error}</div>}
  {notice&&<div className="permission-notice"><CheckCircle2 size={16}/>{notice}</div>}

  <section className="data-card"><div className="data-card-head"><strong>{shown.length.toLocaleString('ar-SA')} تبرع</strong><span><ShieldCheck size={14}/> آخر ١٠٠ سجل حسب التصفية · البحث ضمن المعروض</span></div>
   {loading?<div className="empty">جاري تحميل سجل التبرعات...</div>:!shown.length?<div className="empty"><Heart size={34}/>لا توجد تبرعات مطابقة.</div>:<div className="support-list">{shown.map(x=><article className="support-row"key={x.id}>
    <div className="support-icon"><Heart/></div>
    <div className="support-main"><b>{x.donors?.full_name||'متبرع غير مسجل'}</b><span>{x.donation_type==='in_kind'?'تبرع عيني':'تبرع نقدي'} · {x.reference_no||'بدون مرجع'}</span><small>{x.donated_at?new Date(x.donated_at).toLocaleDateString('ar-SA'):''}</small></div>
    <div className="support-value">{x.amount!=null?`${Number(x.amount).toLocaleString('ar-SA')} ر.س`:'تبرع عيني'}</div>
    <div className={'workflow '+(x.status||'pending')}>{x.status==='received'||x.status==='approved'?<CheckCircle2/>:x.status==='rejected'?<XCircle/>:<Clock3/>}{labels[x.status]||x.status}</div>
    <div className="row-actions">
     {(x.status==='pending'||x.status==='pledged')&&<><button className="success"disabled={!!busy}onClick={()=>void review(x.id,'approved')}>اعتماد</button><button className="danger"disabled={!!busy}onClick={()=>void review(x.id,'rejected')}>رفض</button></>}
     {x.status==='approved'&&x.donation_type==='cash'&&<button className="secondary"disabled={!!busy}onClick={()=>receive(x.id)}>{busy===x.id?'جاري الترحيل...':'استلام وترحيل'}</button>}
     {x.status==='approved'&&x.donation_type==='in_kind'&&<button className="secondary"disabled={!!busy} onClick={()=>{setError('');setReceiveForm({warehouse:'',item:'',quantity:String(x.planned_quantity||'')});setReceiveOpen(x)}}>استلام عيني</button>}
     {x.status==='received'&&<button className={thankStatus[x.id]?'thank-button sent':'thank-button'} disabled={!!busy} onClick={()=>openThank(x)}><MessageCircle size={15}/>{thankStatus[x.id]?'شكر المتبرع ✓':'شكر المتبرع'}</button>}
    </div>
   </article>)}</div>}
  </section>

  {open&&<div className="modal-backdrop"onMouseDown={e=>{if(!mutationLock.current&&e.currentTarget===e.target)setOpen(false)}}><form className="modal" role="dialog" aria-modal="true" aria-label="تسجيل تبرع" onSubmit={create}><div className="modal-head"><div><b>تسجيل تبرع</b><span>سيُسجل التبرع قيد المراجعة قبل الاستلام.</span></div><button type="button"disabled={!!busy} onClick={()=>setOpen(false)}>×</button></div>{error&&<div className="error" role="alert">{error}</div>}<fieldset disabled={!!busy} style={{border:0,padding:0,margin:0}}><label>المتبرع<select required value={form.donor}onChange={e=>setForm({...form,donor:e.target.value})}><option value="">اختر المتبرع</option>{donors.map(d=><option value={d.id}key={d.id}>{d.full_name}</option>)}</select></label><label>نوع التبرع<select value={form.type}onChange={e=>setForm({...form,type:e.target.value})}><option value="cash">نقدي</option><option value="in_kind">عيني</option></select></label><label>{form.type==='cash'?'المبلغ (ر.س)':'القيمة التقديرية للتبرع العيني (ر.س)'}<input type="number"min="0.01"step="0.01"required value={form.amount}onChange={e=>setForm({...form,amount:e.target.value})}/></label>{form.type==='in_kind'&&<><label>وصف التبرع العيني<input required maxLength={1000} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><div className="form-grid"><label>الكمية المخططة<input type="number" min="0.01" step="0.01" required value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})}/></label><label>الوحدة<input required maxLength={80} value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}/></label></div></>}<label>رقم المرجع<input value={form.reference}onChange={e=>setForm({...form,reference:e.target.value})}/></label><button className="primary wide"disabled={!!busy}>{busy==='create'?'جاري الحفظ...':'حفظ التبرع'}</button></fieldset></form></div>}

  {receiveOpen&&<div className="modal-backdrop"onMouseDown={e=>{if(!mutationLock.current&&e.currentTarget===e.target)setReceiveOpen(null)}}><form className="modal" role="dialog" aria-modal="true" aria-label="استلام تبرع عيني" onSubmit={receiveInKind}><div className="modal-head"><div><b>استلام تبرع عيني</b><span>سيُضاف للمخزون ويُنشأ القيد المحاسبي للقيمة التقديرية.</span></div><button type="button"disabled={!!busy} onClick={()=>setReceiveOpen(null)}>×</button></div>{error&&<div className="error" role="alert">{error}</div>}<fieldset disabled={!!busy} style={{border:0,padding:0,margin:0}}><label>المستودع<select required value={receiveForm.warehouse}onChange={e=>setReceiveForm({...receiveForm,warehouse:e.target.value})}><option value="">اختر المستودع</option>{warehouses.map(w=><option value={w.id}key={w.id}>{w.name_ar}</option>)}</select></label><label>الصنف<select required value={receiveForm.item}onChange={e=>setReceiveForm({...receiveForm,item:e.target.value})}><option value="">اختر الصنف</option>{items.map(i=><option value={i.id}key={i.id}>{i.name_ar} · {i.unit||'وحدة'}</option>)}</select></label><label>الكمية<input type="number"min="0.01"step="0.01"required value={receiveForm.quantity}onChange={e=>setReceiveForm({...receiveForm,quantity:e.target.value})}/></label><button className="primary wide"disabled={!!busy}>{busy==='in-kind'?'جاري الاستلام...':'تأكيد الاستلام'}</button></fieldset></form></div>}

  {thankOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(!mutationLock.current&&e.currentTarget===e.target)setThankOpen(null)}}>
   <section className="modal thank-you-modal" role="dialog" aria-modal="true" aria-label="رسالة شكر للمتبرع">
    <div className="modal-head"><div><b>شكر وتقدير للمتبرع</b><span>راجع النص قبل الإرسال. بيانات التبرع أُضيفت تلقائيًا.</span></div><button type="button" disabled={!!busy} onClick={()=>setThankOpen(null)}>×</button></div>
    <div className="thank-you-body">
     <div className="thank-you-recipient"><Heart size={18}/><div><b>{thankOpen.donors?.full_name||'المتبرع'}</b><span>{thankOpen.donors?.phone||thankOpen.donors?.email||'لا توجد وسيلة تواصل مسجلة'}</span></div></div>
     <label>نص رسالة الشكر<textarea rows={10} value={thankMessage} onChange={e=>setThankMessage(e.target.value)} maxLength={5000}/></label>
     <div className="official-letter-card">
      <div><FileCheck2 size={19}/><span><b>الخطاب الرسمي PDF</b><small>{letterTemplate?.background_object_path?'سيتم توليده من الورقة الرسمية الخاصة بهذه الجمعية.':'لم يتم إعداد ورقة الجمعية الرسمية بعد.'}</small></span></div>
      {letterTemplate?.background_object_path?<button type="button" className="secondary" disabled={busy==='letter'} onClick={()=>void downloadOfficialLetter()}><Download size={16}/>{officialDoc?.donationId===thankOpen.id?'فتح الخطاب':'إنشاء الخطاب PDF'}</button>:<button type="button" className="secondary" onClick={()=>window.location.assign('/settings#donor-letterhead')}>إعداد الورقة الرسمية</button>}
     </div>
     <div className="thank-you-channels">
      {thankOpen.donors?.phone&&<button type="button" className="whatsapp-action" disabled={busy==='letter'} onClick={()=>void openWhatsApp()}><MessageCircle size={17}/> واتساب + الخطاب الرسمي</button>}
      {thankOpen.donors?.email&&<button type="button" className="secondary" disabled={busy==='letter'} onClick={()=>void openEmail()}><Mail size={17}/> البريد + الخطاب الرسمي</button>}
      <button type="button" className="secondary" onClick={()=>void copyThank()}><Copy size={17}/> نسخ النص</button>
     </div>
     <div className="thank-you-template-note"><ShieldCheck size={16}/><div><b>خصوصية الخطاب</b><span>الملف محفوظ بشكل خاص داخل مساحة الجمعية، والرابط المرسل للمتبرع مؤقت وصالح لمدة 7 أيام فقط.</span></div></div>
     <div className="thank-you-confirm"><span>بعد إرسال الرسالة من الوسيلة التي اخترتها، أكد الإرسال لحفظه في سجل التبرع.</span><button type="button" className="primary" disabled={busy==='thank'||!thankMessage.trim()} onClick={()=>void confirmThank()}><Send size={16}/>{busy==='thank'?'جاري الحفظ...':'تأكيد تم الإرسال'}</button></div>
    </div>
   </section>
  </div>}
 </main>
}

function buildThankYouMessage(donation:any,charityName:string){
 const donor=donation.donors?.full_name||'المتبرع الكريم';
 const date=donation.donated_at?new Date(donation.donated_at).toLocaleDateString('ar-SA'):'';
 const gift=donation.donation_type==='in_kind'
  ? `تبرعكم العيني الكريم${donation.in_kind_description?` (${donation.in_kind_description})`:''}${donation.amount!=null?`، بقيمة تقديرية قدرها ${Number(donation.amount).toLocaleString('ar-SA')} ريال سعودي`:''}`
  : `تبرعكم الكريم بمبلغ ${Number(donation.amount||0).toLocaleString('ar-SA')} ريال سعودي`;
 return `السلام عليكم ورحمة الله وبركاته،\n\nالأستاذ/ة ${donor}،\n\nتتقدم ${charityName} بخالص الشكر والتقدير لكم على ${gift}${date?` بتاريخ ${date}`:''}.\n\nمساهمتكم الكريمة تعكس روح العطاء والتكافل، وتسهم بإذن الله في دعم أعمال الجمعية وخدمة المستفيدين.\n\nنسأل الله أن يجزيكم خير الجزاء، وأن يبارك لكم في مالكم وأهلكم، ويجعل ما قدمتموه في ميزان حسناتكم.\n\nمع خالص الشكر والامتنان،\n${charityName}`;
}

function normalizeWhatsAppNumber(phone:string){
 let digits=phone.replace(/\D/g,'');
 if(digits.startsWith('00'))digits=digits.slice(2);
 if(digits.startsWith('0')&&digits.length===10)digits='966'+digits.slice(1);
 else if(digits.startsWith('5')&&digits.length===9)digits='966'+digits;
 return digits;
}


function letterValues(donation:any,charityName:string){
 const date=donation.donated_at?new Date(donation.donated_at).toLocaleDateString('ar-SA'):'';
 const donationSummary=donation.donation_type==='in_kind'
  ? `تبرعكم العيني الكريم${donation.in_kind_description?` (${donation.in_kind_description})`:''}${donation.amount!=null?` بقيمة تقديرية ${Number(donation.amount).toLocaleString('ar-SA')} ريال سعودي`:''}`
  : `تبرعكم الكريم بمبلغ ${Number(donation.amount||0).toLocaleString('ar-SA')} ريال سعودي`;
 return{
  donor_name:donation.donors?.full_name||'المتبرع الكريم',
  charity_name:charityName,
  donation_summary:donationSummary,
  donation_date:date,
  reference_no:donation.reference_no||''
 };
}
