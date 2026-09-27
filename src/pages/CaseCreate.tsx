import {FormEvent,useEffect,useMemo,useState} from 'react';
import {ArrowRight,BriefcaseBusiness,Search,UserRound} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import {supabase} from '../supabase';
import {friendlyError} from '../lib/requests';
import {getAccessState,can} from '../lib/rbac';

type Beneficiary={id:string;full_name:string;phone:string|null;status:string};
const priorities=[['low','منخفضة'],['normal','عادية'],['high','عالية'],['critical','حرجة']] as const;

export default function CaseCreate(){
 const nav=useNavigate();
 const[beneficiaries,setBeneficiaries]=useState<Beneficiary[]>([]);
 const[q,setQ]=useState('');const[selected,setSelected]=useState('');const[title,setTitle]=useState('');const[priority,setPriority]=useState('normal');
 const[loading,setLoading]=useState(true);const[busy,setBusy]=useState(false);const[error,setError]=useState('');
 useEffect(()=>{void load()},[]);
 async function load(){
  setLoading(true);setError('');
  try{
   const access=await getAccessState(true);
   if(!can(access,'cases.manage'))throw new Error('ليس لديك صلاحية إنشاء حالات جديدة.');
   const r=await supabase.from('beneficiaries').select('id,full_name,phone,status').order('full_name').limit(300);
   if(r.error)throw r.error;
   setBeneficiaries((r.data||[]) as Beneficiary[]);
  }catch(e){setError(friendlyError(e))}finally{setLoading(false)}
 }
 const filtered=useMemo(()=>{const s=q.trim().toLowerCase();return s?beneficiaries.filter(b=>b.full_name.toLowerCase().includes(s)||(b.phone||'').includes(s)):beneficiaries},[q,beneficiaries]);
 async function submit(e:FormEvent){
  e.preventDefault();setError('');
  if(!selected){setError('اختر المستفيد المرتبط بالحالة.');return}
  if(!title.trim()){setError('اكتب عنوانًا واضحًا للحالة.');return}
  setBusy(true);
  const r=await supabase.rpc('create_case',{p_beneficiary_id:selected,p_title:title.trim(),p_priority:priority});
  setBusy(false);
  if(r.error){setError(friendlyError(r.error));return}
  const id=(r.data as any)?.id;
  if(!id){setError('تم الحفظ لكن تعذر فتح الحالة الجديدة.');return}
  nav('/cases/'+id,{replace:true});
 }
 return <main className="module-page case-create-page">
  <button className="back-link" onClick={()=>nav('/cases')}><ArrowRight/> العودة للحالات</button>
  <div className="module-head"><div><span className="eyebrow"><BriefcaseBusiness size={15}/> إنشاء حالة</span><h1>حالة إنسانية جديدة</h1><p>اربط الحالة بمستفيد موجود، وحدد عنوانًا وأولوية واضحة. رقم الحالة يُنشأ تلقائيًا وبشكل آمن.</p></div></div>
  {error&&<div className="error">{error}</div>}
  <form className="case-create-grid" onSubmit={submit}>
   <section className="data-card"><div className="data-card-head"><div><strong>1. اختر المستفيد</strong><span>الحالة يجب أن ترتبط بملف مستفيد داخل نفس الجمعية</span></div></div>
    <div className="case-beneficiary-picker">
     <div className="search-box"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="ابحث بالاسم أو رقم الجوال"/></div>
     {loading?<div className="empty">جاري تحميل المستفيدين...</div>:filtered.length===0?<div className="empty">لا يوجد مستفيد مطابق. أنشئ ملف مستفيد أولًا.</div>:<div className="case-beneficiary-list">{filtered.map(b=><button type="button" key={b.id} className={selected===b.id?'case-beneficiary selected':'case-beneficiary'} onClick={()=>setSelected(b.id)}><span className="person-avatar"><UserRound size={16}/></span><span><b>{b.full_name}</b><small>{b.phone||'بدون رقم جوال'} · {b.status}</small></span><i>{selected===b.id?'تم الاختيار':'اختيار'}</i></button>)}</div>}
    </div>
   </section>
   <section className="data-card"><div className="data-card-head"><div><strong>2. بيانات الحالة</strong><span>سيتم إنشاء الحالة بحالة «جديدة»</span></div></div>
    <div className="case-create-fields">
     <label>عنوان الحالة<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={180} placeholder="مثال: طلب مساعدة إيجار عاجلة" required/></label>
     <label>الأولوية<select value={priority} onChange={e=>setPriority(e.target.value)}>{priorities.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
     <div className="security-note">يتم إنشاء رقم الحالة تلقائيًا، وربطها بالجمعية الحالية فقط، وتسجيل عملية الإنشاء في سجل التدقيق.</div>
     <button className="primary wide" disabled={busy||loading||!selected||!title.trim()}>{busy?'جاري إنشاء الحالة...':'إنشاء الحالة وفتحها'}</button>
    </div>
   </section>
  </form>
 </main>
}
