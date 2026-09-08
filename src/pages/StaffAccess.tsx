import {useEffect,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {Building2,UserPlus} from 'lucide-react';
import {supabase} from '../supabase';
import {friendlyError} from '../lib/requests';
import LogoutButton from '../components/LogoutButton';

export default function StaffAccess(){
 const {search}=useLocation(),params=new URLSearchParams(search);
 const [code,setCode]=useState(params.get('code')||''),[token,setToken]=useState(params.get('invite')||''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[register,setRegister]=useState(false),[sessionEmail,setSessionEmail]=useState<string|null>(null),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{let live=true;supabase.auth.getUser().then(r=>{if(live){setSessionEmail(r.data.user?.email||null);setReady(true)}}).catch(()=>{if(live){setReady(true);setError('تعذر التحقق من الجلسة.')}});return()=>{live=false}},[]);
 async function submit(e:React.FormEvent){e.preventDefault();setError('');setMessage('');setBusy(true);try{
  if(!sessionEmail){
   if(register){const r=await supabase.auth.signUp({email:email.trim(),password,options:{data:{full_name:name.trim()},emailRedirectTo:window.location.origin+'/staff-access'+search}});if(r.error)throw r.error;if(!r.data.session){setMessage('فعّل بريدك الإلكتروني، ثم افتح رابط الدعوة وسجّل الدخول بنفس البريد لإكمال الانضمام.');return}}
   else {const r=await supabase.auth.signInWithPassword({email:email.trim(),password});if(r.error)throw r.error;}
   setSessionEmail(email.trim());
  }
  const r=await supabase.rpc('accept_staff_invitation',{p_token:token.trim(),p_charity_code:code.trim()});if(r.error)throw r.error;
  window.location.replace('/dashboard');
 }catch(e){setError(friendlyError(e))}finally{setBusy(false)}}
 return <main className="auth"><section className="auth-card"><div className="auth-icon"><Building2/></div><h1>الانضمام إلى فريق الجمعية</h1><p>دعوة شخصية مرتبطة ببريدك وجمعية محددة. كود الجمعية للتعريف بها ولا يمنح الدخول بمفرده.</p>{!ready?<p role="status">جاري التحقق من الجلسة…</p>:<form onSubmit={submit}><label>كود الجمعية<input required dir="ltr" value={code} onChange={e=>setCode(e.target.value)} placeholder="JM-100001"/></label><label>رمز الدعوة<input required dir="ltr" value={token} onChange={e=>setToken(e.target.value)} autoComplete="off"/></label>{sessionEmail?<div className="security-note">الحساب الحالي: {sessionEmail}. يجب أن يطابق بريد الدعوة.<LogoutButton destination={'/staff-access'+search}/></div>:<>{register&&<label>اسم الموظف<input required value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/></label>}<label>بريد الدعوة<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username"/></label><label>كلمة المرور<input required type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={register?'new-password':'current-password'}/></label></>}{error&&<p className="error" role="alert">{error}</p>}{message&&<p className="success" role="status">{message}</p>}<button className="primary wide" disabled={busy}><UserPlus size={18}/>{busy?'جاري التحقق…':sessionEmail?'قبول الدعوة والانضمام':register?'إنشاء حساب الموظف':'دخول وقبول الدعوة'}</button>{!sessionEmail&&<button type="button" className="link" onClick={()=>setRegister(v=>!v)}>{register?'لدي حساب بالفعل':'موظف جديد؟ أنشئ حسابك'}</button>}</form>}<Link className="link" to="/forgot-password">نسيت كلمة المرور؟</Link><p><Link to="/charity-login">موظف مسجل بالفعل؟ تسجيل الدخول</Link></p></section></main>;
}
