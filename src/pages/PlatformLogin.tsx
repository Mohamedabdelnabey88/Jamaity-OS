import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function PlatformLogin(){
  const navigate=useNavigate();
  const[email,setEmail]=useState('');
  const[password,setPassword]=useState('');
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState('');
  async function submit(e:any){
    e.preventDefault(); setBusy(true); setError('');
    try{
      const r=await supabase.auth.signInWithPassword({email:email.trim(),password});
      if(r.error)throw r.error;
      const a=await supabase.rpc('current_platform_access');
      if(a.error)throw a.error;
      if(!(a.data as any)?.is_platform_admin){await supabase.auth.signOut();throw new Error('هذا الحساب غير مخول لإدارة المنصة.');}
      navigate('/admin',{replace:true});
    }catch(x:any){setError(x.message||'تعذر تسجيل الدخول');}finally{setBusy(false);}
  }
  return <main className="auth"><div className="auth-card"><div className="auth-icon"><ShieldCheck/></div><h1>إدارة منصة جمعيتي</h1><p>دخول مخصص لمالك المنصة وإدارة اعتماد الجمعيات والاشتراكات.</p><form onSubmit={submit}><label>البريد الإلكتروني<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>كلمة المرور<input type="password" required minLength={8} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<div className="error">{error}</div>}<button className="primary wide" disabled={busy}>{busy?'جاري التحقق...':'دخول إدارة المنصة'}</button></form><button className="link" onClick={()=>navigate('/forgot-password?portal=platform')}>نسيت كلمة المرور؟</button></div></main>;
}
