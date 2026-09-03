import { useEffect,useMemo,useState } from 'react';
import { ArrowLeft,Building2,MapPin,Search,ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import './portal.css';

export default function Directory(){
 const[rows,setRows]=useState<any[]>([]),[region,setRegion]=useState(''),[city,setCity]=useState(''),[q,setQ]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState('');const n=useNavigate();
 async function load(){setLoading(true);setError('');const r=await supabase.rpc('approved_charities_directory',{p_region:region.trim()||null,p_city:city.trim()||null});if(r.error)setError(r.error.message);else setRows((r.data||[])as any[]);setLoading(false)}
 useEffect(()=>{void load()},[]);
 const shown=useMemo(()=>rows.filter(x=>`${x.name_ar||''} ${x.name_en||''} ${x.city||''} ${x.region||''}`.toLowerCase().includes(q.toLowerCase())),[rows,q]);
 return <main className="directory-page"><section className="directory-hero"><div><span className="eyebrow"><ShieldCheck size={15}/> جمعيات معتمدة وفعالة</span><h1>ابحث عن جمعية<br/><em>في منطقتك.</em></h1><p>اختر المنطقة والمدينة، ثم قدّم طلب انضمامك للجمعية المناسبة عبر مسار آمن وواضح.</p></div><div className="directory-stat"><Building2 size={28}/><strong>{shown.length.toLocaleString('ar-SA')}</strong><span>جمعية متاحة</span></div></section>
 <div className="directory-toolbar directory-filters"><div className="search-box"><Search size={18}/><input value={q}onChange={e=>setQ(e.target.value)}placeholder="ابحث باسم الجمعية..."/></div><input value={region}onChange={e=>setRegion(e.target.value)}placeholder="المنطقة"/><input value={city}onChange={e=>setCity(e.target.value)}placeholder="المدينة"/><button className="primary small"onClick={load}>بحث</button></div>{error&&<div className="error">{error}</div>}
 {loading?<div className="empty">جاري البحث عن الجمعيات المتاحة...</div>:!shown.length?<div className="empty"><Building2 size={40}/>لا توجد جمعية فعالة مطابقة للبحث.</div>:<section className="directory-grid">{shown.map(x=><article className="charity-card"key={x.id}>{x.logo_url?<img src={x.logo_url}alt=""/>:<div className="charity-logo"><Building2/></div>}<div className="charity-card-body"><div className="verified"><ShieldCheck size={14}/> معتمدة ومتاحة</div><h2>{x.name_ar}</h2><span className="location"><MapPin size={14}/>{x.city||'السعودية'}{x.region&&` · ${x.region}`}</span><p>{x.description_ar||'جمعية أهلية معتمدة ومتاحة لاستقبال طلبات المستفيدين.'}</p><div className="card-actions"><button className="secondary"onClick={()=>n(`/charity/${x.id}`)}>زيارة الصفحة</button><button className="primary small"onClick={()=>n(`/beneficiary-apply?charity=${x.id}`)}>تقديم طلب انضمام <ArrowLeft size={16}/></button></div></div></article>)}</section>}</main>
}
