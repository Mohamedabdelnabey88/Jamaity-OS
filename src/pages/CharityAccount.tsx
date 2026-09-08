import { useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2,ExternalLink,Settings,ShieldCheck } from 'lucide-react';
import { supabase } from '../supabase';
import type { AccessState } from '../lib/rbac';
import LogoutButton from '../components/LogoutButton';

type Profile={id:string;charity_code:string;name_ar:string;name_en:string|null;region:string|null;city:string|null;description_ar:string|null;logo_url:string|null;status:string};
const statuses:Record<string,string>={approved:'معتمدة',pending:'بانتظار الاعتماد',trial:'فترة تجريبية',active:'فعال',expired:'منتهي',suspended:'موقوف',paused:'متوقف مؤقتًا',cancelled:'ملغي'};
export default function CharityAccount({access}:{access:AccessState}) {
  const [profile,setProfile]=useState<Profile|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();let live=true;
    const timer=window.setTimeout(()=>controller.abort(),15000);
    setError('');setProfile(null);
    (async()=>{try {
      const r=await supabase.rpc('charity_profile').abortSignal(controller.signal);
      if(r.error||!r.data) throw new Error('profile_unavailable');
      if(live)setProfile(r.data as Profile);
    }catch{if(live)setError('تعذر تحميل حساب الجمعية. تحقق من الاتصال ثم أعد المحاولة.');}
    finally{window.clearTimeout(timer);}})();
    return()=>{live=false;controller.abort();window.clearTimeout(timer);};
  },[access.workspaceCharityId,attempt]);
  return <main className="module-page charity-account-page"><div className="module-head"><div><span className="eyebrow"><Building2/> مساحة جمعيتك</span><h1>حساب الجمعية</h1><p>هوية الجمعية واشتراكها وروابط إدارة حسابها في مكان واحد.</p></div><LogoutButton/></div>
    {error?<section className="panel" role="alert"><p>{error}</p><button className="secondary" onClick={()=>setAttempt(x=>x+1)}>إعادة المحاولة</button></section>:!profile?<p role="status">جاري تحميل حساب الجمعية…</p>:<>
    <section className="account-hero"><div className="charity-logo-large">{profile.logo_url?<img src={profile.logo_url} alt={`شعار ${profile.name_ar}`}/>:<Building2 size={40}/>}</div><div><h2>{profile.name_ar}</h2><p>كود الجمعية: <b dir="ltr">{profile.charity_code}</b></p>{profile.name_en&&<p lang="en">{profile.name_en}</p>}<p>{[profile.region,profile.city].filter(Boolean).join(' · ')}</p><span><ShieldCheck size={18}/> {statuses[profile.status]||profile.status}</span></div></section>
    <div className="account-grid"><section className="panel"><h2>عن الجمعية</h2><p className="account-description">{profile.description_ar||'لم تُضف نبذة الجمعية بعد.'}</p><Link className="secondary" to={`/charity/${profile.id}`}><ExternalLink size={18}/> عرض الموقع العام</Link><p className="muted">ظهور الموقع العام يتطلب تفعيل النشر من إعدادات الجمعية.</p></section>
    <section className="panel"><h2>الاشتراك</h2><dl className="account-details"><dt>الحالة</dt><dd>{statuses[access.subscriptionStatus||'']||'غير محددة'}</dd><dt>بداية الاشتراك</dt><dd>{access.subscriptionStartsAt?new Date(access.subscriptionStartsAt).toLocaleDateString('ar-SA'):'—'}</dd><dt>نهاية الاشتراك</dt><dd>{access.subscriptionEndsAt?new Date(access.subscriptionEndsAt).toLocaleDateString('ar-SA'):'غير محددة'}</dd></dl><p>تواصل مع إدارة المنصة لتمديد الاشتراك أو تعديل الفترة التجريبية.</p></section></div>
    <section className="panel"><h2>إدارة الحساب</h2><div className="account-links">{access.permissions.includes('onboarding.manage')&&<Link className="primary" to="/settings"><Settings size={18}/> تعديل البيانات والموقع العام</Link>}{access.permissions.some(p=>['team.manage','members.manage','roles.manage'].includes(p))&&<Link className="secondary" to="/team">الفريق والصلاحيات</Link>}<Link className="secondary" to="/forgot-password">استعادة كلمة المرور</Link><Link className="secondary" to="/dashboard">لوحة التحكم</Link></div></section>
    </>}
  </main>;
}
