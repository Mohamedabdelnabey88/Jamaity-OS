import { useEffect, useState } from 'react';
import { HeartHandshake, LogIn, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import './beneficiary.css';

export default function BeneficiaryLogin(){
  const navigate=useNavigate();
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [invite,setInvite]=useState('');
  useEffect(()=>{const t=new URLSearchParams(window.location.search).get('invite')||localStorage.getItem('jamaity_beneficiary_invite')||'';if(t){localStorage.setItem('jamaity_beneficiary_invite',t);setInvite(t)}},[]);
  async function go(e:any){e.preventDefault();setBusy(true);setError('');try{const r=await supabase.auth.signInWithPassword({email:email.trim(),password});if(r.error)throw r.error;const token=localStorage.getItem('jamaity_beneficiary_invite')||invite;if(token){const a=await supabase.rpc('accept_beneficiary_invitation',{p_token:token});if(a.error)throw a.error;localStorage.removeItem('jamaity_beneficiary_invite')}navigate('/beneficiary-portal',{replace:true})}catch(x:any){setError(x.message||'تعذر تسجيل الدخول')}finally{setBusy(false)}}
  return <main className="auth beneficiary-auth"><div className="auth-card"><div className="auth-icon"><HeartHandshake/></div><h1>دخول المستفيد</h1><p>ادخل إلى حسابك لمتابعة طلباتك والدعم والإشعارات.</p><div className="success"><ShieldCheck/> بيانات حساب المستفيد منفصلة عن حسابات موظفي الجمعية.</div><form onSubmit={go}><label>البريد الإلكتروني<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>كلمة المرور<input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<div className="error">{error}</div>}<button className="primary wide" disabled={busy}><LogIn size={18}/>{busy?'جاري الدخول...':'دخول إلى بوابتي'}</button></form><button className="link" onClick={()=>navigate(invite?'/beneficiary-register?invite='+encodeURIComponent(invite):'/beneficiary-register')}>إنشاء حساب مستفيد</button></div></main>;
}