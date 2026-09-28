import {ArrowLeft,Building2,CheckCircle2,HeartHandshake,LockKeyhole,ShieldCheck,Sparkles,UserRound} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import BackButton from '../components/BackButton';

const gateways=[
 {key:'charity',icon:Building2,title:'حساب الجمعية',body:'للمالك والموظفين لإدارة المستفيدين والتبرعات والمحاسبة والحوكمة والفريق.',meta:'لوحة تشغيل الجمعية',route:'/charity-login',accent:'primary'},
 {key:'beneficiary',icon:UserRound,title:'حساب المستفيد',body:'لتقديم طلب الانضمام، رفع المستندات، متابعة حالة الطلب والدعم والإشعارات.',meta:'بوابة المستفيد',route:'/beneficiary-login',accent:'secondary'},
 {key:'platform',icon:ShieldCheck,title:'إدارة المنصة',body:'لإدارة اعتماد الجمعيات والاشتراكات ومتابعة التشغيل على مستوى المنصة.',meta:'صلاحيات المنصة',route:'/platform-login',accent:'dark'},
] as const;

export default function LoginHub(){
 const n=useNavigate();
 return <main className="login-hub login-hub-premium">
  <div className="login-hub-back"><BackButton fallback="/"/></div>
  <div className="login-hub-ambient ambient-one"/><div className="login-hub-ambient ambient-two"/><div className="login-hub-grid"/>

  <section className="login-hub-intro">
   <div className="login-hub-brand"><span><HeartHandshake/></span><div><b>جمعيتي</b><small>Jamaity OS</small></div></div>
   <span className="login-security-pill"><LockKeyhole/> بوابات دخول منفصلة وآمنة</span>
   <h1>ادخل من المساحة<br/><em>المناسبة لدورك.</em></h1>
   <p>كل بوابة في جمعيتي لها صلاحيات وتجربة مستقلة، حتى يكون الوصول واضحًا وآمنًا من أول لحظة.</p>

   <div className="login-proof-list">
    <div><span><CheckCircle2/></span><div><b>عزل بيانات كل جمعية</b><small>كل جمعية تعمل داخل نطاقها الخاص.</small></div></div>
    <div><span><ShieldCheck/></span><div><b>صلاحيات حسب الدور</b><small>المستخدم يرى فقط ما يحتاجه فعليًا.</small></div></div>
    <div><span><Sparkles/></span><div><b>تجربة عربية متكاملة</b><small>واجهة RTL مصممة للقطاع غير الربحي.</small></div></div>
   </div>

   <div className="login-hub-register login-hub-register-premium"><div><HeartHandshake/><span><b>جمعية جديدة؟</b><small>ابدأ إعداد مساحة جمعيتك خلال دقائق.</small></span></div><button className="primary" onClick={()=>n('/register')}>إنشاء حساب الجمعية <ArrowLeft/></button></div>
  </section>

  <section className="login-gateway-panel">
   <div className="login-gateway-head"><span>اختيار البوابة</span><h2>كيف تستخدم جمعيتي؟</h2><p>اختر نوع حسابك للانتقال إلى شاشة الدخول المناسبة.</p></div>
   <div className="login-options login-options-premium">
    {gateways.map(({key,icon:Icon,title,body,meta,route,accent},index)=><button className={`login-gateway-card ${accent}`} key={key} onClick={()=>n(route)}>
      <div className="gateway-card-top"><span className="login-option-icon"><Icon/></span><i>{String(index+1).padStart(2,'0')}</i></div>
      <div><small>{meta}</small><b>{title}</b><p>{body}</p></div>
      <div className="gateway-card-cta"><span>متابعة إلى تسجيل الدخول</span><ArrowLeft/></div>
    </button>)}
   </div>
   <div className="login-hub-trust"><LockKeyhole/><span>اتصال آمن · صلاحيات دقيقة · سجل تدقيق للعمليات الحساسة</span></div>
  </section>
 </main>
}