import { useEffect,useRef,useState } from 'react';
import { CalendarDays,CheckCircle2,FileUp,RefreshCw,ShieldCheck } from 'lucide-react';
import { supabase } from '../supabase';
import { getAccessState } from '../lib/rbac';
import {friendlyError} from '../lib/requests';
import {readWithDeadline} from '../lib/readWithDeadline';

const labels:Record<string,string>={not_started:'غير مبدوء',in_progress:'جاري',ready:'جاهز',not_applicable:'غير منطبق'};
export default function Governance(){
 const[data,setData]=useState<any>(null),[busy,setBusy]=useState(''),[error,setError]=useState(''),[canManage,setCanManage]=useState(false),[signed,setSigned]=useState<{id:string;url:string}|null>(null);
 const locked=useRef(false),generation=useRef(0),controller=useRef<AbortController|null>(null);
 async function load(){
  const g=++generation.current;controller.current?.abort();const abort=new AbortController();controller.current=abort;setError('');setSigned(null);
  try{const [r,access]=await readWithDeadline(()=>Promise.all([supabase.rpc('governance_center'),getAccessState(true)]),abort);if(r.error)throw r.error;if(g===generation.current){setData(r.data);setCanManage(access.permissions.includes('governance.manage'));}}
  catch(e){if(g===generation.current)setError(friendlyError(e));}
 }
 useEffect(()=>{void load();return()=>{generation.current++;controller.current?.abort()}},[]);
 useEffect(()=>{if(!signed)return;const timer=setTimeout(()=>setSigned(null),55000);return()=>clearTimeout(timer)},[signed]);
 async function change(id:string,status:string,due?:string){if(locked.current||!canManage)return;locked.current=true;setBusy(id);setError('');try{const r=await supabase.rpc('set_governance_requirement_status',{p_requirement_id:id,p_status:status,p_due_date:due||null});if(r.error)throw r.error;await load()}catch(e){setError(friendlyError(e))}finally{locked.current=false;setBusy('')}}
 async function view(evidence:any){if(locked.current)return;locked.current=true;setBusy(evidence.id);setError('');setSigned(null);const g=generation.current;try{const r=await supabase.storage.from('governance-evidence').createSignedUrl(evidence.object_path,60);if(r.error)throw r.error;if(g===generation.current)setSigned({id:evidence.id,url:r.data.signedUrl})}catch(e){if(g===generation.current)setError(friendlyError(e))}finally{locked.current=false;setBusy('')}}
 async function upload(item:any,file?:File){
  if(!file||locked.current||!canManage)return;if(file.size>10*1024*1024)return setError('الحد الأقصى للملف 10MB.');if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type))return setError('نوع الملف غير مسموح.');
  locked.current=true;setBusy(item.id);setError('');
  try{const access=await getAccessState(true);if(!access.charityId)throw Error('لا توجد جمعية فعالة.');const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'-');const path=`${access.charityId}/${item.id}/${crypto.randomUUID()}-${safe}`;
   const up=await supabase.storage.from('governance-evidence').upload(path,file,{contentType:file.type,upsert:false});if(up.error)throw up.error;
   const rpc=await supabase.rpc('add_governance_evidence',{p_requirement_id:item.id,p_title_ar:file.name,p_object_path:path,p_expires_at:null,p_notes:null});
   if(rpc.error)throw Error('تم رفع الملف لكن تعذر تأكيد تسجيل الشاهد. حدّث القائمة قبل إعادة الرفع.');
   await load();
  }catch(e){setError(friendlyError(e))}finally{locked.current=false;setBusy('')}
 }
 if(!data)return <main className="module-page"><div className="loading">{error?'تعذر تحميل مركز الحوكمة.':'جاري تحميل مركز الحوكمة...'}</div>{error&&<div className="error" role="alert">{error}<button onClick={()=>void load()}>إعادة المحاولة</button></div>}</main>;
 return <main className="module-page"><div className="module-head"><div><span className="eyebrow"><ShieldCheck/> الحوكمة والامتثال</span><h1>مركز الحوكمة</h1><p>متابعة المتطلبات والشواهد والاستحقاقات من مصدر بيانات واحد.</p></div><button className="secondary"disabled={!!busy} onClick={load}><RefreshCw/> تحديث</button></div>{error&&<div className="error">{error}</div>}<section className="governance-summary"><div className="progress-ring"style={{'--progress':`${data.score}%`}as React.CSSProperties}><strong>{Number(data.score).toLocaleString('ar-SA')}%</strong><span>مؤشر الحوكمة</span></div><div><b>{data.ready} جاهز</b><span>من {data.total} متطلبات</span></div><div><b>{data.overdue} متأخر</b><span>يتطلب معالجة</span></div></section><section className="governance-grid">{(data.items||[]).map((item:any)=><article className="governance-item"key={item.id}><div className="governance-item-head"><span>{item.category}</span><span className={'status '+(item.status==='ready'?'active':'inactive')}>{labels[item.status]||item.status}</span></div><h3>{item.title_ar}</h3><p>{item.description_ar}</p><div className="governance-meta"><span><CalendarDays/> {item.due_date?new Date(item.due_date).toLocaleDateString('ar-SA'):'بلا موعد'}</span><span><FileUp/> {item.evidence_count} شاهد</span></div><div className="action-row"><select value={item.status}aria-label={`حالة ${item.title_ar}`} disabled={!!busy||!canManage}onChange={e=>change(item.id,e.target.value,item.due_date)}><option value="not_started">غير مبدوء</option><option value="in_progress">جاري</option><option value="ready">جاهز</option><option value="not_applicable">غير منطبق</option></select>{canManage&&<label className="secondary file-button"><FileUp/> رفع شاهد<input type="file" disabled={!!busy} accept=".pdf,.jpg,.jpeg,.png,.webp"onChange={e=>{void upload(item,e.target.files?.[0]);e.target.value=''}}/></label>}{item.status==='ready'&&<CheckCircle2/>}</div>{(item.evidence||[]).length>0&&<ul aria-label={`شواهد ${item.title_ar}`}>{item.evidence.map((e:any)=><li key={e.id}><span>{e.title_ar}</span>{e.expires_at&&<small> · ينتهي {new Date(e.expires_at).toLocaleDateString('ar-SA')}</small>} <button className="secondary" disabled={!!busy} onClick={()=>void view(e)}>عرض الشاهد {e.title_ar}</button>{signed&&signed.id===e.id&&<a href={signed.url} target="_blank" rel="noopener noreferrer">فتح الشاهد — رابط مؤقت لمدة دقيقة</a>}</li>)}</ul>}</article>)}</section></main>
}
