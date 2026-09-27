import {useEffect,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {Building2,UserPlus} from 'lucide-react';
import {supabase} from '../supabase';
import {friendlyError} from '../lib/requests';
import LogoutButton from '../components/LogoutButton';
import PasswordInput from '../components/PasswordInput';

export default function StaffAccess(){
 const {search}=useLocation(),params=new URLSearchParams(search);
 const token=params.get('invite')||'';
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState(''),[name,setName]=useState(''),[phone,setPhone]=useState(''),[register,setRegister]=useState(true),[sessionEmail,setSessionEmail]=useState<string|null>(null),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');

 useEffect(()=>{let live=true;supabase.auth.getUser().then(r=>{if(live){setSessionEmail(r.data.user?.email||null);setReady(true)}}).catch(()=>{if(live){setReady(true);setError('تعذر التحقق من الجلسة.')}});return()=>{live=false}},[]);

 async function submit(e:React.FormEvent){
  e.preventDefault();setError('');setMessage('');
  if(!token.trim()){setError('رابط الدعوة غير صالح أو غير مكتمل. اطلب من الجمعية إرسال رابط دعوة جديد.');return}
  if(!sessionEmail&&register){
   if(!name.trim()){setError('أدخل الاسم الكامل.');return}
   if(password.length<8){setError('كلمة المرور يجب ألا تقل عن 8 أحرف.');return}
   if(password!==confirmPassword){setError('كلمتا المرور غير متطابقتين.');return}
  }
  setBusy(true);
  try{
   if(!sessionEmail){
    if(register){
     const r=await supabase.auth.signUp({
      email:email.trim(),
      password,
      options:{
       data:{full_name:name.trim(),phone:phone.trim()||null,account_type:'charity_staff'},
       emailRedirectTo:window.location.origin+'/staff-access'+search,
      },
     });
     if(r.error)throw r.error;
     if(!r.data.user)throw new Error('تعذر إنشاء حساب الموظف.');
     if(!r.data.session){
      setMessage('تم حفظ حسابك وكلمة المرور. فعّل بريدك الإلكتروني ثم افتح نفس رابط الدعوة وسجّل الدخول لإكمال الانضمام.');
      return;
     }
    }else{
     const r=await supabase.auth.signInWithPassword({email:email.trim(),password});
     if(r.error)throw r.error;
    }
    setSessionEmail(email.trim());
   }

   const r=await supabase.rpc('accept_staff_invitation',{p_token:token.trim()});
   if(r.error)throw r.error;
   window.location.replace('/dashboard');
  }catch(e){setError(friendlyError(e))}finally{setBusy(false)}
 }

 return <main className="auth"><section className="auth-card">
  <div className="auth-icon"><Building2/></div>
  <h1>الانضمام إلى فريق الجمعية</h1>
  <p>{sessionEmail?'أكمل قبول الدعوة بالحساب الحالي.':'أنشئ حساب الموظف واختر كلمة مرور خاصة بك، ثم استخدم نفس البريد وكلمة المرور لتسجيل الدخول لاحقًا.'}</p>
  {token&&<div className="success">رابط الدعوة آمن ومربوط من الخادم بالجمعية والبريد والدور المحدد. لا يمكن تغيير الجمعية من هذه الصفحة.</div>}
  {!ready?<p role="status">جاري التحقق من الجلسة…</p>:<form onSubmit={submit}>
   {sessionEmail?
    <div className="security-note">الحساب الحالي: {sessionEmail}. يجب أن يطابق بريد الدعوة.<LogoutButton destination={'/staff-access'+search}/></div>
    :<>
     {register&&<>
      <label>الاسم الكامل<input required value={name} onChange={e=>setName(e.target.value)} autoComplete="name" placeholder="اسم الموظف"/></label>
      <label>رقم الجوال <span style={{fontWeight:400}}>(اختياري)</span><input dir="ltr" inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} autoComplete="tel" placeholder="05xxxxxxxx"/></label>
     </>}
     <label>البريد الإلكتروني<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" placeholder="employee@example.com"/></label>
     <label>{register?'اختر كلمة المرور':'كلمة المرور'}<PasswordInput required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={register?'new-password':'current-password'} placeholder="8 أحرف على الأقل"/></label>
     {register&&<label>تأكيد كلمة المرور<PasswordInput required minLength={8} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password"/></label>}
    </>
   }
   {error&&<p className="error" role="alert">{error}</p>}
   {message&&<p className="success" role="status">{message}</p>}
   <button className="primary wide" disabled={busy||!token}><UserPlus size={18}/>{busy?'جاري المعالجة…':sessionEmail?'قبول الدعوة والدخول':register?'إنشاء الحساب والانضمام':'تسجيل الدخول وقبول الدعوة'}</button>
   {!sessionEmail&&<button type="button" className="link" disabled={busy} onClick={()=>{setRegister(v=>!v);setError('');setMessage('');setPassword('');setConfirmPassword('')}}>{register?'لدي حساب موظف بالفعل':'موظف جديد؟ أنشئ حسابك وكلمة مرورك'}</button>}
  </form>}
  <Link className="link" to="/forgot-password">نسيت كلمة المرور؟</Link>
  <p><Link to="/charity-login">الذهاب إلى تسجيل دخول فريق الجمعية</Link></p>
 </section></main>;
}
