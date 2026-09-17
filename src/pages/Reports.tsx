import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, Download, FileText, Printer, RefreshCw } from 'lucide-react';
import { supabase } from '../supabase';
import { friendlyError } from '../lib/requests';
import { reportPeriod, saudiToday } from '../lib/reportPeriod';
import { reportSections, reportDateTime } from '../lib/reportExport';
import './reports.css';

export default function Reports(){
 const today=saudiToday();
 const [from,setFrom]=useState(today.slice(0,7)+'-01'),[to,setTo]=useState(today);
 const [applied,setApplied]=useState({from:today.slice(0,7)+'-01',to:today});
 const [data,setData]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [exporting,setExporting]=useState(false),[exportError,setExportError]=useState('');
 const request=useRef(0);
 const load=useCallback(async()=>{
  const id=++request.current;setLoading(true);setError('');setData(null);setExportError('');
  try{const args=reportPeriod(applied.from,applied.to);const r=await supabase.rpc('monthly_management_report',args);if(r.error)throw r.error;if(!r.data)throw new Error('لم ترجع الخدمة بيانات التقرير.');if(id===request.current)setData(r.data);}
  catch(e){if(id===request.current)setError(friendlyError(e));}
  finally{if(id===request.current)setLoading(false);}
 },[applied]);
 useEffect(()=>{void load();return()=>{request.current++;};},[load]);
 function submit(e:React.FormEvent){e.preventDefault();if(exporting)return;try{reportPeriod(from,to);setApplied({from,to});}catch(e){request.current++;setLoading(false);setData(null);setError(friendlyError(e));}}
 async function excel(){if(!data||exporting||loading)return;setExporting(true);setExportError('');try{const {downloadReportExcel}=await import('../lib/reportExport');await downloadReportExcel(data,applied);}catch{setExportError('تعذر إنشاء ملف Excel. أعد المحاولة.');}finally{setExporting(false);}}
 return <main className="module-page reports-center"><div className="module-head"><div><span className="eyebrow"><FileText/> التقارير الإدارية</span><h1>مركز التقارير</h1><p>حركة الفترة، والوضع الحالي، وتصدير النتائج حسب صلاحياتك.</p></div><button className="secondary" disabled={loading||exporting} onClick={()=>void load()}><RefreshCw/> تحديث</button></div>
 <form className="data-card report-filter" onSubmit={submit}><CalendarDays/><label>من<input required type="date" disabled={exporting} value={from} onChange={e=>setFrom(e.target.value)}/></label><label>إلى<input required type="date" disabled={exporting} value={to} onChange={e=>setTo(e.target.value)}/></label><button className="primary small" disabled={exporting}>إنشاء التقرير</button></form>
 {error&&<div className="error" role="alert">{error}<button className="secondary" onClick={()=>void load()}>إعادة المحاولة</button></div>}
 {loading?<div className="loading" role="status">جاري إنشاء التقرير...</div>:data&&<>
 <div className="report-actions"><button className="primary" disabled={exporting} onClick={()=>void excel()}><Download/>{exporting?'جاري إنشاء Excel…':'تنزيل Excel'}</button><button className="secondary" disabled={exporting} onClick={()=>window.print()}><Printer/> طباعة / حفظ PDF</button><span className="muted">التصدير يطابق التقرير المعروض، وليس التواريخ غير المطبقة.</span></div>
 {exportError&&<div role="alert" className="error">{exportError}</div>}
 <article className="report-document" aria-label="التقرير الإداري والمالي"><header><span className="eyebrow">جمعيتي · التقرير الإداري والمالي</span><h2>{data.charity?.name||'تقرير الجمعية'}</h2><p>الفترة: {applied.from} — {applied.to} (توقيت السعودية)</p><p className="scope-note">وقت إنشاء البيانات: {reportDateTime(data.generated_at)} (السعودية). الأرقام المالية بالريال السعودي.</p></header>
 {reportSections(data).map(section=><section className="panel" key={section.title}><h2>{section.title}</h2><p className="scope-note">{section.scope}</p>{section.unavailable?<p className="report-unavailable">هذا القسم غير متاح لصلاحيات حسابك.</p>:<div className="table-wrap"><table><thead><tr>{section.headers.map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{section.rows.map((row,i)=><tr key={i}>{row.map((v,j)=><td key={j}>{v==null?'غير متاح':typeof v==='number'?v.toLocaleString('ar-SA',{maximumFractionDigits:2}):v}</td>)}</tr>)}</tbody></table>{!section.rows.length&&<div className="empty">لا توجد بيانات ضمن النطاق.</div>}</div>}</section>)}
 <footer className="scope-note">«غير متاح» يعني أن البيانات محجوبة أو غير متوفرة، وليس أن القيمة صفر. مؤشرات الوضع الحالي لا تمثل رصيد نهاية الفترة التاريخية.</footer></article>
 </>}
 </main>;
}
