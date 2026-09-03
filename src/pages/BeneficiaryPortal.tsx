import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, FileText, HeartHandshake, ShieldCheck, UserRound } from 'lucide-react';
import { supabase } from '../supabase';

type Summary = {
  beneficiary: { id: string; full_name: string; phone: string | null; status: string; created_at: string };
  cases: { id: string; case_number: string; title: string; status: string; priority: string; created_at: string; updated_at: string }[];
  support: { id: string; support_type: string; amount: number | null; quantity: number | null; status: string; approval_status: string; provided_at: string | null; created_at: string; notes: string | null }[];
};

const caseLabel: Record<string,string> = { open:'مفتوحة', in_progress:'قيد المعالجة', approved:'معتمدة', closed:'مغلقة', rejected:'مرفوضة', pending:'قيد المراجعة' };
const supportLabel: Record<string,string> = { cash:'دعم مالي', in_kind:'دعم عيني', 'عينى':'دعم عيني', 'in-kind':'دعم عيني' };
const fmtDate = (v: string | null) => v ? new Intl.DateTimeFormat('ar-SA',{dateStyle:'medium'}).format(new Date(v)) : '—';
const initials = (name: string) => name.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('') || 'م';

export default function BeneficiaryPortal(){
  const [data,setData]=useState<Summary|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  useEffect(()=>{let live=true;(async()=>{setLoading(true);setError('');const r=await supabase.rpc('beneficiary_portal_summary');if(!live)return;if(r.error){setError(r.error.message||'تعذر تحميل ملف المستفيد');setLoading(false);return}setData(r.data as Summary);setLoading(false)})();return()=>{live=false}},[]);
  const counts=useMemo(()=>({cases:data?.cases.length||0,support:data?.support.length||0,executed:data?.support.filter(x=>x.status==='executed').length||0}),[data]);
  if(loading)return <main className="module-page"><div className="loading">جاري تحميل ملفك بأمان…</div></main>;
  if(error)return <main className="module-page"><div className="data-card empty"><AlertCircle size={42}/><h2>تعذر فتح بوابة المستفيد</h2><p>{error}</p></div></main>;
  if(!data)return null;
  return <main className="module-page beneficiary-portal">
    <div className="module-head"><div><div className="eyebrow"><ShieldCheck size={16}/> بوابة المستفيد</div><h1>مرحباً، {data.beneficiary.full_name}</h1><p>تابع طلباتك وقرارات الدعم وسجل ما تم تقديمه لك من مكان واحد.</p></div></div>
    <section className="profile-hero beneficiary-hero"><div className="profile-avatar"><UserRound size={32}/></div><div><h1>{data.beneficiary.full_name}</h1><p><span>{data.beneficiary.phone || 'رقم الجوال غير معروض'}</span></p></div><span className="status-pill">{data.beneficiary.status==='active'?'حساب نشط':'الحساب موقوف'}</span></section>
    <div className="stat-strip"><div><b>{counts.cases}</b><span>الطلبات والحالات</span></div><div><b>{counts.support}</b><span>قرارات الدعم</span></div><div><b>{counts.executed}</b><span>دعم تم تنفيذه</span></div></div>
    <div className="profile-grid">
      <section className="panel"><div className="panel-title"><div><span>رحلة الطلب</span><h2>حالاتي</h2></div><FileText size={22}/></div>{data.cases.length===0?<div className="empty"><Clock3/><span>لا توجد حالات مسجلة حالياً.</span></div>:<div className="detail-list">{data.cases.map(c=><div key={c.id}><div><strong>{c.title}</strong><span>{c.case_number} · {fmtDate(c.updated_at)}</span></div><span className={`status ${c.status==='closed'||c.status==='approved'?'active':c.status==='rejected'?'blocked':'inactive'}`}>{caseLabel[c.status]||c.status}</span></div>)}</div>}</section>
      <section className="panel"><div className="panel-title"><div><span>سجل الاستحقاق</span><h2>الدعم المقدم</h2></div><HeartHandshake size={22}/></div>{data.support.length===0?<div className="empty"><HeartHandshake/><span>لم يتم تسجيل دعم معتمد حتى الآن.</span></div>:<div>{data.support.map(s=><div className="list-row" key={s.id}><div className="row-icon"><CheckCircle2 size={20}/></div><div><strong>{supportLabel[s.support_type]||s.support_type}</strong><p>{s.amount!=null?`${Number(s.amount).toLocaleString('ar-SA')} ر.س`:s.quantity!=null?`الكمية: ${s.quantity}`:'دعم مسجل'} · {fmtDate(s.provided_at||s.created_at)}</p>{s.notes&&<p>{s.notes}</p>}</div><span className="status active">{s.status==='executed'?'تم التنفيذ':'معتمد'}</span></div>)}</div>}</section>
    </div>
    <div className="privacy-note"><ShieldCheck size={22}/><div><strong>خصوصيتك أولاً</strong><p>لا نعرض رقم الهوية الوطنية داخل البوابة. الوصول إلى بياناتك مرتبط بحساب المستفيد الموثق من المنصة.</p></div></div>
  </main>;
}
