import { useEffect,useState } from 'react';
import { AlertTriangle,ChevronDown,ChevronUp,Lightbulb,Sparkles } from 'lucide-react';
import { supabase } from '../supabase';

type Insight={level?:string;severity?:string;title?:string;message?:string;body?:string;action_path?:string};
export default function SmartAssistant({page}:{page:string}){
 const[items,setItems]=useState<Insight[]>([]),[open,setOpen]=useState(false),[loading,setLoading]=useState(true);
 useEffect(()=>{let live=true;setLoading(true);supabase.rpc('workspace_smart_insights',{p_page:page}).then(({data,error})=>{if(live){setItems(error?[]:Array.isArray(data)?data:((data as any)?.items||[]));setLoading(false)}});return()=>{live=false}},[page]);
 return <aside className={'smart-assistant '+(open?'is-open':'')}><button className="smart-assistant-head" onClick={()=>setOpen(v=>!v)}><span className="smart-orb"><Sparkles size={19}/></span><span><b>مساعد جمعيتي الذكي</b><small>{loading?'يحلل بيانات الصفحة…':items.length?`${items.length} توصيات تشغيلية الآن`:'لا توجد ملاحظات حرجة'}</small></span>{open?<ChevronUp/>:<ChevronDown/>}</button>{open&&<div className="smart-insights">{items.length?items.map((x,i)=><article key={i} className={`smart-insight ${x.severity||x.level||'info'}`}><span>{['high','medium','warning'].includes(x.severity||x.level||'')?<AlertTriangle/>:<Lightbulb/>}</span><div><b>{x.title||'توصية'}</b><p>{x.body||x.message}</p>{x.action_path&&<a href={x.action_path}>تنفيذ الإجراء</a>}</div></article>):<div className="smart-clear"><Sparkles/> البيانات الحالية لا تتطلب تدخلاً عاجلاً.</div>}<small className="smart-disclaimer">تحليل تشغيلي مباشر مبني على بيانات جمعيتك وصلاحيات حسابك.</small></div>}</aside>;
}
