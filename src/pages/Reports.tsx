import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, Download, FileText, Printer, RefreshCw } from 'lucide-react';
import { supabase } from '../supabase';
import { friendlyError } from '../lib/requests';
import { readWithDeadline } from '../lib/readWithDeadline';
import { reportPeriod, saudiToday } from '../lib/reportPeriod';
import { reportSections, reportDateTime, reportLabels, downloadReportExcel } from '../lib/reportExport';
import './reports.css';

type Kind='summary'|'donations'|'support';
export default function Reports(){
 const today=saudiToday();
 const [from,setFrom]=useState(today.slice(0,7)+'-01'),[to,setTo]=useState(today);
 const [kind,setKind]=useState<Kind>('summary'),[status,setStatus]=useState(''),[search,setSearch]=useState('');
 const [applied,setApplied]=useState({from:today.slice(0,7)+'-01',to:today,kind:'summary' as Kind,status:'',search:'',page:1});
 const [data,setData]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [exporting,setExporting]=useState(false),[exportError,setExportError]=useState('');
 const request=useRef(0),active=useRef<AbortController|null>(null);
 const load=useCallback(async()=>{
  const id=++request.current;active.current?.abort();const controller=new AbortController();active.current=controller;
  setLoading(true);setError('');setData(null);setExportError('');
  try{
   const dates=reportPeriod(applied.from,applied.to);
   const r=await readWithDeadline(()=>applied.kind==='summary'
    ?supabase.rpc('monthly_management_report',dates).abortSignal(controller.signal)
    :supabase.rpc('operational_report_page',{...dates,p_kind:applied.kind,p_status:applied.status||null,p_search:applied.search,p_page:applied.page,p_page_size:50}).abortSignal(controller.signal),controller);
   if(r.error)throw r.error;if(!r.data)throw new Error('لم ترجع الخدمة بيانات التقرير.');if(id===request.current)setData(r.data);
  }catch(e){if(id===request.current)setError(friendlyError(e));}
  finally{if(id===request.current){setLoading(false);active.current=null;}}
 },[applied]);
 useEffect(()=>{void load();return()=>{request.current++;active.current?.abort();};},[load]);
 function submit(e:React.FormEvent){e.preventDefault();if(exporting)return;try{reportPeriod(from,to);setApplied({from,to,kind,status,search:search.trim(),page:1});}catch(e){request.current++;active.current?.abort();setLoading(false);setData(null);setError(friendlyError(e));}}
 async function excel(){if(!data||exporting||loading)return;setExporting(true);setExportError('');try{await downloadReportExcel(data,applied);}catch{setExportError('تعذر إنشاء ملف Excel. أعد المحاولة.');}finally{setExporting(false);}}
 const statuses=kind==='donations'?['pledged','pending','approved','received','rejected','cancelled']:['requested','pending','approved','provided','rejected','cancelled'];
 const detail=applied.kind!=='summary';
 const pages=data?Math.max(1,Math.ceil(Number(data.total_rows||0)/50)):1;
 return <main className="module-page reports-center">
 <div className="module-head"><div><span className="eyebrow"><FileText/> التقارير الإدارية</span><h1>مركز التقارير</h1><p>تقارير ملخصة وتفصيلية حسب الفترة والصلاحيات.</p></div><button className="secondary" disabled={loading||exporting} onClick={()=>void load()}><RefreshCw/> تحديث</button></div>
 <form className="data-card report-filter" onSubmit={submit}>
  <CalendarDays/><label>التقرير<select disabled={exporting} value={kind} onChange={e=>{setKind(e.target.value as Kind);setStatus('');setSearch('');}}><option value="summary">الملخص الإداري والمالي</option><option value="donations">التبرعات التفصيلية</option><option value="support">الدعم التفصيلي</option></select></label>
  <label>من<input required type="date" disabled={exporting} value={from} onChange={e=>setFrom(e.target.value)}/></label><label>إلى<input required type="date" disabled={exporting} value={to} onChange={e=>setTo(e.target.value)}/></label>
  {kind!=='summary'&&<><label>الحالة<select disabled={exporting} value={status} onChange={e=>setStatus(e.target.value)}><option value="">كل الحالات</option>{statuses.map(s=><option key={s} value={s}>{reportLabels[s]}</option>)}</select></label><label>بحث بالمرجع أو معرف العملية<input disabled={exporting} maxLength={120} value={search} onChange={e=>setSearch(e.target.value)} placeholder="جزء من المرجع أو المعرف"/></label></>}
  <button className="primary small" disabled={exporting}>إنشاء التقرير</button>
 </form>
 {error&&<div className="error" role="alert">{error}<button className="secondary" onClick={()=>void load()}>إعادة المحاولة</button></div>}
 {loading?<div className="loading" role="status">جاري إنشاء التقرير...</div>:data&&<>
  <div className="report-actions"><button className="primary" disabled={exporting} onClick={()=>void excel()}><Download/>{exporting?'جاري إنشاء Excel…':detail?'Excel للصفحة المعروضة':'تنزيل Excel'}</button><button className="secondary" disabled={exporting} onClick={()=>window.print()}><Printer/> طباعة / حفظ PDF{detail?' للصفحة المعروضة':''}</button><span className="muted">التصدير يطابق التقرير المعروض، وليس الفلاتر غير المطبقة.</span></div>
  {detail&&<nav className="report-pagination" aria-label="صفحات التقرير"><button className="secondary" disabled={exporting||applied.page<=1} onClick={()=>setApplied(p=>({...p,page:p.page-1}))}>السابق</button><span>الصفحة {applied.page} من {pages} · {Number(data.total_rows).toLocaleString('ar-SA')} سجل مطابق</span><button className="secondary" disabled={exporting||applied.page>=pages} onClick={()=>setApplied(p=>({...p,page:p.page+1}))}>التالي</button></nav>}
  {exportError&&<div role="alert" className="error">{exportError}</div>}
  <article className="report-document" aria-label="التقرير الإداري والمالي"><header><span className="eyebrow">جمعيتي · {detail?reportLabels[applied.kind]:'التقرير الإداري والمالي'}</span><h2>{data.charity?.name||'تقرير الجمعية'}</h2><p>الفترة: {applied.from} — {applied.to} (توقيت السعودية)</p><p className="scope-note">وقت إنشاء البيانات: {reportDateTime(data.generated_at)} (السعودية). الأرقام المالية بالريال السعودي.</p></header>
   {reportSections(data).map(section=><section className="panel" key={section.title}><h2>{section.title}</h2><p className="scope-note">{section.scope}</p>{section.unavailable?<p className="report-unavailable">هذا القسم غير متاح لصلاحيات حسابك.</p>:<div className="table-wrap"><table><thead><tr>{section.headers.map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{section.rows.map((row,i)=><tr key={i}>{row.map((v,j)=><td key={j}>{v==null?'غير متاح':typeof v==='number'?v.toLocaleString('ar-SA',{maximumFractionDigits:3}):v}</td>)}</tr>)}</tbody></table>{!section.rows.length&&<div className="empty">لا توجد بيانات ضمن النطاق.</div>}</div>}</section>)}
   <footer className="scope-note">{detail?'التفاصيل تشمل الصفحة المعروضة فقط. الإجماليات تشمل كل النتائج المطابقة. تقرير الدعم يعتمد تاريخ الإنشاء، وتاريخ التنفيذ معروض مستقلًا.':'«غير متاح» يعني أن البيانات محجوبة أو غير متوفرة، وليس أن القيمة صفر. مؤشرات الوضع الحالي لا تمثل رصيد نهاية الفترة التاريخية.'}</footer>
  </article>
 </>}
 </main>;
}
