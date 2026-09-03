import { useEffect, useState } from 'react';
import { HeartHandshake, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import './beneficiary.css';

export default function BeneficiaryRegister(){
 const n=useNavigate();const token=new URLSearchParams(window.location.search).get('invite')||localStorage.getItem('jamaity_beneficiary_invite')||'';const[f,setF]=useState({email:'',password:''});const[e,setE]=useState('');const[ok,setOk]=useState('');const[busy,setBusy]=useState(false);
 useEffect(()=>{if(token)localStorage.setItem('jamaity_beneficiary_invite',token)},[token]);
 async function accept(t:string){const r=await supabase.rpc('accept_beneficiary_invitation',{p_token:t});if(r.error)throw r.error;localStorage.removeItem('jamaity_beneficiary_invite');n('/beneficiary',{replace:true})}
 async function go(x:React.FormEvent){x.preventDefault();setBusy(true);setE('');setOk('');try{const r=await supabase.auth.signUp({email:f.email.trim(),password:f.password});if(r.error)throw r.error;if(r.data.session){if(token)await accept(token);else n('/beneficiary-apply',{replace:true});return}setOk('تم إنشاء الحساب. فعّل بريدك الإلكتروني ثم سجل الدخول لاستكمال طلب الانضمام.')}catch(x:any){setE(x.message||'تعذر إنشاء الحساب')}finally{setBusy(false)}}
 return <main className="auth beneficiary-auth"><div className="auth-card"><div className="auth-icon"><HeartHandshake/></div><h1>{token?'تفعيل بوابة المستفيد':'إنشاء حساب مستفيد'}</h1><p>{token?'أنشئ حسابك لربطه بملفك لدى الجمعية.':'ابدأ حسابك ثم ابحث عن جمعية معتمدة في منطقتك.'}</p><div className="success"><ShieldCheck/> بياناتك منفصلة وآمنة، ولا يظهر رقم الهوية في الواجهة التشغيلية.</div><form onSubmit={go}><label>البريد الإلكتروني<input type="email"required autoComplete="email"value={f.email}onChange={x=>setF({...f,email:x.target.value})}/></label><label>كلمة المرور<input type="password"required minLength={8}autoComplete="new-password"value={f.password}onChange={x=>setF({...f,password:x.target.value})}/></label>{e&&<div className="error">{e}</div>}{ok&&<div className="success">{ok}</div>}<button className="primary wide"disabled={busy}>{busy?'جاري إنشاء الحساب...':'إنشاء حساب المستفيد'}</button></form><button className="link"onClick={()=>n('/beneficiary-login')}>لدي حساب بالفعل</button></div></main>
}
