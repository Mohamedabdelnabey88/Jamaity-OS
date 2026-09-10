import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, CalendarDays, FileText, RefreshCw } from 'lucide-react';
import { supabase } from '../supabase';
import { friendlyError } from '../lib/requests';
import { reportPeriod, saudiToday } from '../lib/reportPeriod';

const money=(v:unknown)=>v==null?'غير متاح':Number(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س';
const score=(v:unknown)=>v==null?'غير متاح':Number(v).toLocaleString('ar-SA')+'%';
export default function Reports(){
 const today=saudiToday();
 const [from,setFrom]=useState(today.slice(0,7)+'-01'),[to,setTo]=useState(today);
 const [applied,setApplied]=useState({from:today.slice(0,7)+'-01',to:today});
 const [data,setData]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const request=useRef(0);
 const load=useCallback(async()=>{
  const id=++request.current;setLoading(true);setError('');setData(null);
  try{const args=reportPeriod(applied.from,applied.to);const r=await supabase.rpc('monthly_management_report',args);if(r.error)throw r.error;if(!r.data)throw new Error('لم ترجع الخدمة بيانات التقرير.');if(id===request.current)setData(r.data);}
  catch(e){if(id===request.current)setError(friendlyError(e));}
  finally{if(id===request.current)setLoading(false);}
 },[applied]);
 useEffect(()=>{void load();return()=>{request.current++;};},[load]);
 function submit(e:React.FormEvent){e.preventDefault();try{reportPeriod(from,to);setApplied({from,to});}catch(e){request.current++;setLoading(false);setData(null);setError(friendlyError(e));}}
 return <main className="module-page"><div className="module-head"><div><span className="eyebrow"><FileText/> التقارير الإدارية</span><h1>مركز التقارير</h1><p>حركة الفترة المالية والتشغيلية، مع فصل واضح عن الأرصدة والمؤشرات الحالية.</p></div><button className="secondary" disabled={loading} onClick={()=>void load()}><RefreshCw/> تحديث</button></div>
 <form className="data-card report-filter" onSubmit={submit}><CalendarDays/><label>من<input required type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>إلى<input required type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><button className="primary small">إنشاء التقرير</button></form>
 {error&&<div className="error" role="alert">{error}<button className="secondary" onClick={()=>void load()}>إعادة المحاولة</button></div>}
 {loading?<div className="loading" role="status">جاري إنشاء التقرير...</div>:data&&<>
 <h2>حركة الفترة: {applied.from} — {applied.to}</h2><p className="muted">التواريخ بتوقيت السعودية. عدّ التبرعات يعتمد على تاريخ التبرع المسجل؛ والدعم على وقت التنفيذ.</p>
 <div className="kpis"><Metric t="الإيرادات" v={money(data.financial?.revenue)}/><Metric t="المصروفات" v={money(data.financial?.expense)}/><Metric t="الفائض / العجز" v={money(data.financial?.surplus)}/></div>
 <section className="panel"><h2>النشاط خلال الفترة</h2><Rows data={{'الحالات المنشأة':data.period_activity?.cases_created,'عمليات الدعم المنفذة':data.period_activity?.support_executed,'التبرعات المستلمة حسب تاريخ التبرع':data.period_activity?.donations_received}}/></section>
 <section className="panel"><h2>ميزان حركة الحسابات خلال الفترة</h2><div className="table-wrap"><table><thead><tr><th>الكود</th><th>الحساب</th><th>مدين</th><th>دائن</th><th>صافي الحركة</th></tr></thead><tbody>{(data.trial_balance||[]).map((x:any)=><tr key={x.account_id||x.code}><td>{x.code}</td><td>{x.name_ar}</td><td>{money(x.debit)}</td><td>{money(x.credit)}</td><td>{money(x.balance)}</td></tr>)}</tbody></table>{!data.trial_balance?.length&&<div className="empty">لا توجد حسابات معروضة للفترة.</div>}</div></section>
 <h2>الوضع الحالي عند إنشاء التقرير</h2><p className="muted">هذه المؤشرات والأرصدة لا تتغير بفلتر الفترة، ولا تمثل أرصدة تاريخية عند نهايتها.</p>
 <div className="report-grid"><section className="panel"><h2>المؤشرات التشغيلية الحالية</h2><Rows data={{'إجمالي المستفيدين':data.operational?.beneficiaries_total,'الحالات المفتوحة':data.operational?.cases_open,'الدعم المعلق':data.operational?.support_pending,'طلبات المستفيدين المعلقة':data.operational?.beneficiary_requests_pending,'أعضاء الفريق النشطون':data.operational?.team_active,'قيمة التبرعات المستلمة التراكمية':money(data.operational?.donations_received_value),'قيمة الدعم المنفذ التراكمية':money(data.operational?.support_value_executed)}}/></section><section className="panel"><h2>الحوكمة الحالية</h2><Rows data={{'المتطلبات':data.governance?.total,'الجاهز':data.governance?.ready,'المتأخر':data.governance?.overdue,'المؤشر':score(data.governance?.score)}}/></section></div>
 <section className="panel"><h2>أرصدة المخزون الحالية</h2><div className="table-wrap"><table><thead><tr><th>المستودع</th><th>الصنف</th><th>الوحدة</th><th>الرصيد الحالي</th></tr></thead><tbody>{(data.inventory_balances||[]).map((x:any,i:number)=><tr key={i}><td>{x.warehouse_name}</td><td>{x.item_name}</td><td>{x.unit}</td><td>{x.on_hand??'غير متاح'}</td></tr>)}</tbody></table>{!data.inventory_balances?.length&&<div className="empty">لا توجد أرصدة مخزون معروضة.</div>}</div></section>
 <p className="muted">وقت الإنشاء: {data.generated_at?new Date(data.generated_at).toLocaleString('ar-SA',{timeZone:'Asia/Riyadh'}):'غير متاح'} (السعودية)</p>
 </>}
 </main>;
}
function Metric({t,v}:{t:string;v:string}){return <div className="kpi"><div className="kpi-icon"><BarChart3/></div><span>{t}</span><strong>{v}</strong><small>للفترة المعتمدة أعلاه</small></div>;}
function Rows({data}:{data:Record<string,unknown>}){return <div className="detail-list">{Object.entries(data).map(([k,v])=><div key={k}><span>{k}</span><strong>{v==null?'غير متاح':String(v)}</strong></div>)}</div>;}
