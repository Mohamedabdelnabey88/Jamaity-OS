import {useRef,useState} from 'react';
import {Copy,Mail} from 'lucide-react';
import {supabase} from '../supabase';
import {friendlyError} from '../lib/requests';

type Role={id:string;code:string;name_ar:string};
export default function TeamInvitationForm({roles,onCreated,onClose}:{roles:Role[];onCreated:()=>void;onClose:()=>void}){
 const available=roles.filter(r=>r.code!=='owner');
 const[email,setEmail]=useState(''),[role,setRole]=useState(available.find(r=>r.code==='case_manager')?.id||available[0]?.id||''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[link,setLink]=useState(''),[copied,setCopied]=useState(false);
 const lock=useRef(false);
 async function submit(e:React.FormEvent){
  e.preventDefault();if(lock.current||link)return;setError('');
  if(!available.some(r=>r.id===role)){setError('اختر دورًا متاحًا للموظف.');return;}
  lock.current=true;setBusy(true);
  try{const {data,error:failure}=await supabase.rpc('create_team_invitation',{p_email:email.trim(),p_role_id:role});if(failure)throw failure;
   if(!data?.token||!data?.charity_code)throw Error('تعذر تأكيد رابط الدعوة. حدّث قائمة الدعوات قبل المحاولة مجددًا.');
   const url=new URL('/staff-access',window.location.origin);url.searchParams.set('code',data.charity_code);url.searchParams.set('invite',data.token);setLink(url.toString());onCreated();
  }catch(e){setError(friendlyError(e));}finally{lock.current=false;setBusy(false);}
 }
 async function copy(){try{await navigator.clipboard.writeText(link);setCopied(true);}catch{setError('تعذر النسخ التلقائي. يمكنك تحديد الرابط ونسخه يدويًا.');}}
 return <section className="data-card" style={{marginTop:16}} aria-labelledby="invite-title"><div className="data-card-head"><div><strong id="invite-title">دعوة موظف جديد</strong><span>الدعوة صالحة لمدة 7 أيام</span></div><button type="button" className="ghost" disabled={busy} onClick={onClose}>إغلاق</button></div>
 <p>ينشئ الموظف حسابه وكلمة مروره من رابط الدعوة. لا تُرسل رسالة بريد تلقائيًا.</p>
 <form onSubmit={submit}><div className="form-grid"><label>البريد الإلكتروني<input autoFocus type="email" required maxLength={254} disabled={busy||!!link} value={email} onChange={e=>setEmail(e.target.value)} placeholder="employee@example.com"/></label><label>الدور<select required disabled={busy||!!link||available.length===0} value={role} onChange={e=>setRole(e.target.value)}><option value="" disabled>اختر الدور</option>{available.map(r=><option key={r.id} value={r.id}>{r.name_ar}</option>)}</select></label></div>
 {error&&<div className="error" role="alert">{error}</div>}
 {!available.length&&<p role="alert">لا توجد أدوار متاحة للدعوة. راجع صلاحيات إدارة الفريق.</p>}
 {!link&&<button type="submit" className="primary" disabled={busy||!email.trim()||!role}><Mail size={17}/>{busy?'جاري إنشاء الدعوة...':'إنشاء رابط الدعوة'}</button>}
 {link&&<div className="success" role="status"><p>تم إنشاء الدعوة. شارك الرابط مع الموظف صاحب البريد المحدد. لم يُرسل بريد تلقائي.</p><label>رابط الدعوة<input readOnly dir="ltr" value={link} onFocus={e=>e.target.select()}/></label><button type="button" className="ghost" onClick={()=>void copy()}><Copy size={16}/>{copied?'تم نسخ الرابط':'نسخ الرابط'}</button></div>}
 </form></section>
}
