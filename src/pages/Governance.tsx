import {useEffect,useState} from 'react';
import {CalendarDays,CheckCircle2,FileUp,Plus,RefreshCw,Settings2,ShieldCheck,X} from 'lucide-react';
import {supabase} from '../supabase';
import {getAccessState} from '../lib/rbac';
import {friendlyError} from '../lib/requests';

const labels:Record<string,string>={not_started:'غير مبدوء',in_progress:'جاري',ready:'جاهز',not_applicable:'غير منطبق'};
const evidenceLabels:Record<string,string>={required:'إثبات إلزامي',optional:'إثبات اختياري',none:'لا يتطلب إثباتًا'};

export default function Governance(){
 const[data,setData]=useState<any>(null),[catalog,setCatalog]=useState<any[]>([]),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const[manageOpen,setManageOpen]=useState(false),[edit,setEdit]=useState<any>(null);
 async function load(){
  setError('');
  const r=await supabase.rpc('governance_center');
  if(r.error)setError(friendlyGovernanceError(r.error.message));else setData(r.data);
 }
 useEffect(()=>{void load()},[]);

 async function loadCatalog(){
  setBusy('catalog');setError('');
  const r=await supabase.rpc('governance_requirement_catalog');
  setBusy('');
  if(r.error){setError(friendlyGovernanceError(r.error.message));return}
  setCatalog((r.data||[]) as any[]);setManageOpen(true);
 }

 async function change(id:string,status:string,due?:string){
  setBusy(id);setError('');setNotice('');
  const r=await supabase.rpc('set_governance_requirement_status',{p_requirement_id:id,p_status:status,p_due_date:due||null});
  if(r.error)setError(friendlyGovernanceError(r.error.message));else{setNotice('تم تحديث حالة متطلب الحوكمة.');await load()}
  setBusy('');
 }

 async function upload(item:any,file?:File){
  if(!file)return;
  if(item.evidence_policy==='none')return setError('هذا المتطلب لا يتطلب رفع إثبات حسب دليل الجمعية.');
  if(file.size>10*1024*1024)return setError('الحد الأقصى للملف 10MB.');
  if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type))return setError('نوع الملف غير مسموح.');
  setBusy(item.id);setError('');setNotice('');
  const access=await getAccessState();
  if(!access.charityId){setBusy('');return setError('لا توجد جمعية فعالة.')}
  const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'-');
  const path=`${access.charityId}/${item.id}/${crypto.randomUUID()}-${safe}`;
  const up=await supabase.storage.from('governance-evidence').upload(path,file,{contentType:file.type,upsert:false});
  if(up.error){setBusy('');return setError(friendlyError(up.error))}
  const rpc=await supabase.rpc('add_governance_evidence',{p_requirement_id:item.id,p_title_ar:file.name,p_object_path:path,p_expires_at:null,p_notes:null});
  if(rpc.error){await supabase.storage.from('governance-evidence').remove([path]);setError(friendlyGovernanceError(rpc.error.message))}
  else{setNotice('تم حفظ مستند الإثبات وربطه بمتطلب الحوكمة.');await load()}
  setBusy('');
 }

 async function saveRequirement(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!edit)return;
  setBusy('save-requirement');setError('');setNotice('');
  const r=await supabase.rpc('save_governance_requirement',{
   p_requirement_id:edit.id||null,
   p_category:edit.category,
   p_title_ar:edit.title_ar,
   p_description_ar:edit.description_ar||null,
   p_evidence_policy:edit.evidence_policy,
   p_due_date:edit.due_date||null,
   p_is_active:Boolean(edit.is_active),
   p_sort_order:Number(edit.sort_order||100)
  });
  setBusy('');
  if(r.error){setError(friendlyGovernanceError(r.error.message));return}
  setEdit(null);setNotice(edit.id?'تم تحديث متطلب الحوكمة.':'تمت إضافة متطلب حوكمة جديد.');
  await Promise.all([load(),refreshCatalog()]);
 }
 async function refreshCatalog(){
  const r=await supabase.rpc('governance_requirement_catalog');
  if(!r.error)setCatalog((r.data||[]) as any[]);
 }
 async function toggle(item:any){
  setEdit({...item,is_active:!item.is_active});
  const r=await supabase.rpc('save_governance_requirement',{
   p_requirement_id:item.id,p_category:item.category,p_title_ar:item.title_ar,p_description_ar:item.description_ar||null,
   p_evidence_policy:item.evidence_policy,p_due_date:item.due_date||null,p_is_active:!item.is_active,p_sort_order:Number(item.sort_order||100)
  });
  setEdit(null);
  if(r.error){setError(friendlyGovernanceError(r.error.message));return}
  setNotice(item.is_active?'تم استبعاد المتطلب من دليل الجمعية ومؤشر الحوكمة.':'تم إعادة تفعيل المتطلب.');
  await Promise.all([load(),refreshCatalog()]);
 }

 if(!data)return <main className="module-page"><div className="loading">جاري تحميل مركز الحوكمة...</div>{error&&<div className="error">{error}</div>}</main>;

 return <main className="module-page">
  <div className="module-head"><div><span className="eyebrow"><ShieldCheck/> الحوكمة والامتثال</span><h1>مركز الحوكمة</h1><p>متطلبات الحوكمة والشواهد مبنية على دليل جمعيتك، ويمكن للمالك تخصيصها بما يطابق المطلوب الفعلي.</p></div><div className="hero-actions">{data.can_customize&&<button className="secondary" disabled={!!busy} onClick={()=>void loadCatalog()}><Settings2/> إدارة دليل الحوكمة</button>}<button className="secondary" onClick={()=>void load()}><RefreshCw/> تحديث</button></div></div>
  {error&&<div className="error">{error}</div>}{notice&&<div className="permission-notice"><CheckCircle2/>{notice}</div>}
  <section className="governance-summary"><div className="progress-ring"style={{'--progress':`${data.score}%`}as React.CSSProperties}><strong>{Number(data.score).toLocaleString('ar-SA')}%</strong><span>مؤشر الحوكمة</span></div><div><b>{data.ready} جاهز</b><span>من {data.total} متطلبات نشطة</span></div><div><b>{data.overdue} متأخر</b><span>يتطلب معالجة</span></div>{data.can_customize&&<div><b>{data.inactive||0} مستبعد</b><span>غير مطلوب حسب دليل الجمعية</span></div>}</section>

  <section className="governance-grid">{(data.items||[]).map((item:any)=><article className="governance-item" key={item.id}>
   <div className="governance-item-head"><span>{item.category}</span><span className={'status '+(item.status==='ready'?'active':'inactive')}>{labels[item.status]||item.status}</span></div>
   <h3>{item.title_ar}</h3><p>{item.description_ar||'لا يوجد وصف إضافي.'}</p>
   <div className="governance-policy-row"><span className={'evidence-policy '+item.evidence_policy}>{evidenceLabels[item.evidence_policy]||item.evidence_policy}</span>{item.source_kind==='custom'&&<span className="custom-requirement">مخصص للجمعية</span>}</div>
   <div className="governance-meta"><span><CalendarDays/> {item.due_date?new Date(item.due_date).toLocaleDateString('ar-SA'):'بلا موعد'}</span><span><FileUp/> {item.evidence_count} شاهد</span></div>
   <div className="action-row"><select value={item.status} disabled={busy===item.id} onChange={e=>void change(item.id,e.target.value,item.due_date)}><option value="not_started">غير مبدوء</option><option value="in_progress">جاري</option><option value="ready">جاهز</option><option value="not_applicable">غير منطبق</option></select>{item.evidence_policy!=='none'&&<label className="secondary file-button"><FileUp/> رفع شاهد<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e=>void upload(item,e.target.files?.[0])}/></label>}{item.status==='ready'&&<CheckCircle2/>}</div>
  </article>)}</section>

  {manageOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target&&!edit)setManageOpen(false)}}>
   <section className="modal governance-guide-modal" role="dialog" aria-modal="true" aria-label="إدارة دليل الحوكمة">
    <div className="modal-head"><div><b>إدارة دليل الحوكمة</b><span>عدّل المتطلبات حسب دليل الجمعية. التعطيل يستبعد المتطلب من المؤشر بدون حذف سجله أو شواهده.</span></div><button onClick={()=>setManageOpen(false)} aria-label="إغلاق"><X/></button></div>
    <div className="governance-guide-toolbar"><button className="primary" onClick={()=>setEdit({id:null,category:'',title_ar:'',description_ar:'',evidence_policy:'required',due_date:'',is_active:true,sort_order:(catalog.length+1)*10})}><Plus/> متطلب جديد</button><span>{catalog.filter(x=>x.is_active).length.toLocaleString('ar-SA')} نشط · {catalog.filter(x=>!x.is_active).length.toLocaleString('ar-SA')} مستبعد</span></div>
    <div className="governance-guide-list">{catalog.map(item=><article className={item.is_active?'governance-guide-row':'governance-guide-row disabled'} key={item.id}><div><div className="governance-guide-title"><b>{item.title_ar}</b><span>{item.source_kind==='custom'?'مخصص':'افتراضي'}</span></div><small>{item.category} · {evidenceLabels[item.evidence_policy]}</small>{item.description_ar&&<p>{item.description_ar}</p>}</div><div className="governance-guide-actions"><button className="secondary" onClick={()=>setEdit({...item})}>تعديل</button><button className={item.is_active?'danger':'secondary'} onClick={()=>void toggle(item)}>{item.is_active?'استبعاد':'إعادة تفعيل'}</button></div></article>)}</div>
   </section>
  </div>}

  {edit&&<div className="modal-backdrop"><form className="modal governance-edit-modal" onSubmit={saveRequirement} role="dialog" aria-modal="true"><div className="modal-head"><div><b>{edit.id?'تعديل متطلب الحوكمة':'إضافة متطلب حوكمة'}</b><span>اضبط المتطلب بناءً على دليل الحوكمة المعتمد لدى الجمعية.</span></div><button type="button" onClick={()=>setEdit(null)} aria-label="إغلاق"><X/></button></div><fieldset>
   <label>التصنيف<input required maxLength={120} value={edit.category||''} onChange={e=>setEdit({...edit,category:e.target.value})} placeholder="مثال: مجلس الإدارة"/></label>
   <label>اسم المتطلب<input required maxLength={180} value={edit.title_ar||''} onChange={e=>setEdit({...edit,title_ar:e.target.value})} placeholder="مثال: محاضر اجتماعات مجلس الإدارة"/></label>
   <label>الوصف<textarea rows={4} maxLength={1500} value={edit.description_ar||''} onChange={e=>setEdit({...edit,description_ar:e.target.value})} placeholder="اشرح ما المطلوب من الجمعية لإكمال هذا المتطلب."/></label>
   <div className="form-grid"><label>متطلبات الإثبات<select value={edit.evidence_policy||'required'} onChange={e=>setEdit({...edit,evidence_policy:e.target.value})}><option value="required">إثبات إلزامي</option><option value="optional">إثبات اختياري</option><option value="none">لا يتطلب إثباتًا</option></select></label><label>تاريخ الاستحقاق<input type="date" value={edit.due_date||''} onChange={e=>setEdit({...edit,due_date:e.target.value})}/></label></div>
   <label className="governance-active-toggle"><input type="checkbox" checked={Boolean(edit.is_active)} onChange={e=>setEdit({...edit,is_active:e.target.checked})}/><span><b>متطلب نشط</b><small>يدخل في دليل الجمعية ومؤشر الحوكمة.</small></span></label>
   <div className="modal-actions"><button type="button" className="secondary" onClick={()=>setEdit(null)}>إلغاء</button><button className="primary" disabled={busy==='save-requirement'}>{busy==='save-requirement'?'جاري الحفظ...':'حفظ المتطلب'}</button></div>
  </fieldset></form></div>}
 </main>
}

function friendlyGovernanceError(message:string){
 if(message.includes('evidence_required_before_ready'))return'لا يمكن اعتبار المتطلب جاهزًا قبل رفع مستند إثبات، لأن دليل الجمعية يحدد الإثبات كمتطلب إلزامي.';
 if(message.includes('evidence_not_required'))return'هذا المتطلب لا يحتاج إلى مستند إثبات حسب إعداد دليل الجمعية.';
 if(message.includes('owner_required'))return'تعديل بنود دليل الحوكمة متاح لمالك الجمعية فقط.';
 if(message.includes('permission')||message.includes('forbidden'))return'ليس لديك الصلاحية المطلوبة لتنفيذ هذا الإجراء.';
 return friendlyError({message} as any);
}
