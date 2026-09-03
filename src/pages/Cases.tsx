import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Eye, Filter, Plus, Search, UserRound, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

type CaseRow = {
  id: string;
  case_number: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  beneficiary?: { full_name: string; phone: string | null } | null;
};

const statusLabels: Record<string,string> = { new:'جديدة', under_review:'قيد المراجعة', approved:'معتمدة', rejected:'مرفوضة', closed:'مغلقة' };
const priorityLabels: Record<string,string> = { low:'منخفضة', medium:'متوسطة', high:'عالية', urgent:'عاجلة' };

export default function Cases(){
  const navigate=useNavigate();
  const [rows,setRows]=useState<CaseRow[]>([]); const [q,setQ]=useState(''); const [status,setStatus]=useState('all');
  const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [count,setCount]=useState(0);
  useEffect(()=>{load();},[status]);
  async function load(){
    setLoading(true);setError('');
    const {data:user}=await supabase.auth.getUser(); if(!user.user){setError('انتهت الجلسة. سجل الدخول مرة أخرى.');setLoading(false);return;}
    const {data:member}=await supabase.from('charity_members').select('charity_id').eq('user_id',user.user.id).eq('status','active').limit(1).maybeSingle();
    if(!member?.charity_id){setError('لا توجد جمعية مرتبطة بهذا الحساب.');setLoading(false);return;}
    let query=supabase.from('cases').select('id,case_number,title,status,priority,created_at,beneficiary:beneficiaries(full_name,phone)',{count:'exact'}).eq('charity_id',member.charity_id).order('created_at',{ascending:false}).limit(100);
    if(status!=='all') query=query.eq('status',status);
    const {data,error,count}=await query; if(error)setError(error.message); else {setRows((data||[]) as unknown as CaseRow[]);setCount(count||0);} setLoading(false);
  }
  const filtered=useMemo(()=>{const s=q.trim().toLowerCase();return s?rows.filter(x=>x.case_number.toLowerCase().includes(s)||x.title.toLowerCase().includes(s)||x.beneficiary?.full_name.toLowerCase().includes(s)):rows;},[rows,q]);
  const stat=(v:string)=>rows.filter(x=>x.status===v).length;
  return <main className="dashboard"><div className="dash-head"><div><div className="eyebrow">إدارة الحالات</div><h1>الحالات الإنسانية</h1><p>تابع الطلبات من الاستقبال حتى القرار والدعم، مع عزل بيانات الجمعية.</p></div><button className="primary" onClick={()=>navigate('/cases/new')}><Plus/> حالة جديدة</button></div>
    <div className="kpis"><div className="kpi"><div className="kpi-icon"><AlertCircle/></div><span>إجمالي الحالات</span><strong>{count}</strong><small>ضمن جمعيتك</small></div><div className="kpi"><div className="kpi-icon"><Clock3/></div><span>قيد المراجعة</span><strong>{stat('under_review')}</strong><small>تحتاج متابعة</small></div><div className="kpi"><div className="kpi-icon"><CheckCircle2/></div><span>معتمدة</span><strong>{stat('approved')}</strong><small>جاهزة للتنفيذ</small></div><div className="kpi"><div className="kpi-icon"><XCircle/></div><span>مرفوضة</span><strong>{stat('rejected')}</strong><small>قرارات مسجلة</small></div></div>
    <section className="panel"><div className="panel-title"><div><span>سجل الحالات</span><h2>كل الطلبات</h2></div><Filter/></div><div className="toolbar"><div className="searchbox"><Search/><input placeholder="ابحث برقم الحالة أو الاسم أو العنوان" value={q} onChange={e=>setQ(e.target.value)}/></div><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">كل الحالات</option>{Object.entries(statusLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
      {loading?<div className="empty">جاري تحميل الحالات...</div>:error?<div className="error">{error}</div>:filtered.length===0?<div className="empty">لا توجد حالات مطابقة.</div>:<div className="table-wrap"><table className="data-table"><thead><tr><th>الحالة</th><th>المستفيد</th><th>الأولوية</th><th>التاريخ</th><th></th></tr></thead><tbody>{filtered.map(x=><tr key={x.id}><td><b>{x.case_number}</b><small>{statusLabels[x.status]||x.status}</small></td><td><div className="person-cell"><UserRound/><span>{x.beneficiary?.full_name||'—'}<small>{x.title}</small></span></div></td><td><span className={`priority ${x.priority}`}>{priorityLabels[x.priority]||x.priority}</span></td><td>{new Date(x.created_at).toLocaleDateString('ar-SA')}</td><td><button className="icon" title="فتح الحالة" onClick={()=>navigate(`/cases/${x.id}`)}><Eye/></button></td></tr>)}</tbody></table></div>}
    </section></main>
}