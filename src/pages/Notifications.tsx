import { useEffect,useState } from 'react';
import { Bell,CheckCheck,RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { friendlyError } from '../lib/requests';

export default function Notifications(){
 const n=useNavigate();const[rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 async function load(){setLoading(true);setError('');const r=await supabase.from('notifications').select('id,title_ar,body_ar,type,action_path,is_read,created_at').order('created_at',{ascending:false}).limit(100);if(r.error)setError(friendlyError(r.error));else setRows(r.data||[]);setLoading(false)}useEffect(()=>{void load()},[]);
 async function read(x:any){
  setError('');
  if(!x.is_read){
   const r=await supabase.from('notifications').update({is_read:true,read_at:new Date().toISOString()}).eq('id',x.id);
   if(r.error){setError(friendlyError(r.error));return}
   setRows(current=>current.map(row=>row.id===x.id?{...row,is_read:true}:row));
  }
  if(x.action_path)n(x.action_path);
 }
 return <main className="module-page"><div className="module-head"><div><span className="eyebrow"><Bell/> مركز الإشعارات</span><h1>الإشعارات</h1><p>تحديثات الطلبات والموافقات والتنبيهات التشغيلية.</p></div><button className="secondary"onClick={load}><RefreshCw/> تحديث</button></div>{error&&<div className="error">{error}</div>}{loading?<div className="loading">جاري تحميل الإشعارات...</div>:!rows.length?<div className="data-card empty"><CheckCheck size={42}/><h2>لا توجد إشعارات</h2></div>:<section className="notification-list">{rows.map(x=><button className={'notification-item '+(!x.is_read?'unread':'')}key={x.id}onClick={()=>read(x)}><span className="notification-icon"><Bell/></span><span><b>{x.title_ar}</b><p>{x.body_ar}</p><small>{new Date(x.created_at).toLocaleString('ar-SA')}</small></span>{!x.is_read&&<i/>}</button>)}</section>}</main>
}
