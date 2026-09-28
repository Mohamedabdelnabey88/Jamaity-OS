import {ArrowLeft,Building2,CheckCircle2,HeartHandshake,LockKeyhole,ShieldCheck,UserRound} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import BackButton from '../components/BackButton';
import './login-hub.css';

const gateways=[
 {key:'charity',icon:Building2,title:'حساب الجمعية',body:'للمالك والموظفين لإدارة المستفيدين والتبرعات والمحاسبة والحوكمة والفريق.',meta:'تشغيل الجمعية',route:'/charity-login'},
 {key:'beneficiary',icon:UserRound,title:'حساب المستفيد',body:'لتقديم طلب الانضمام ورفع المستندات ومتابعة حالة الطلب والدعم والإشعارات.',meta:'بوابة المستفيد',route:'/beneficiary-login'},
 {key:'platform',icon:ShieldCheck,title:'إدارة المنصة',body:'مخصصة لإدارة اعتماد الجمعيات والاشتراكات ومتابعة تشغيل المنصة.',meta:'إدارة النظام',route:'/platform-login'},
] as const;

export default function LoginHub(){
 const n=useNavigate();
 return <main className="lh-page">
  <div className="lh-back"><BackButton fallback="/"/></div>

  <section className="lh-shell">
   <aside className="lh-brand-panel">
    <div className="lh-brand-top">
     <div className="lh-brand-mark"><HeartHandshake/></div>
     <div><b>جمعيتي</b><span>Jamaity OS</span></div>
    </div>

    <div className="lh-brand-copy">
     <span className="lh-eyebrow"><LockKeyhole/> دخول آمن حسب الدور</span>
     <h1>كل مستخدم يدخل<br/>من <em>مساحته الصحيحة.</em></h1>
     <p>اختر البوابة المناسبة لحسابك. جمعيتي يفصل الصلاحيات والبيانات حسب نوع المستخدم والجمعية.</p>
    </div>

    <div className="lh-proof">
     <div><CheckCircle2/><span><b>عزل بيانات الجمعية</b><small>كل جمعية تعمل داخل نطاق مستقل.</small></span></div>
     <div><ShieldCheck/><span><b>صلاحيات دقيقة</b><small>الوصول حسب الدور والصلاحية فقط.</small></span></div>
    </div>

    <div className="lh-brand-footer">
     <span>منصة تشغيل عربية للقطاع غير الربحي</span>
     <i>2026</i>
    </div>
   </aside>

   <section className="lh-access-panel">
    <div className="lh-access-head">
     <span>بوابات الدخول</span>
     <h2>اختر نوع حسابك</h2>
     <p>سيتم نقلك إلى شاشة الدخول المناسبة مباشرة.</p>
    </div>

    <div className="lh-gateways">
     {gateways.map(({key,icon:Icon,title,body,meta,route},index)=>
      <button className={"lh-gateway lh-gateway-"+key} key={key} onClick={()=>n(route)}>
       <span className="lh-gateway-index">{String(index+1).padStart(2,'0')}</span>
       <span className="lh-gateway-icon"><Icon/></span>
       <span className="lh-gateway-copy">
        <small>{meta}</small>
        <b>{title}</b>
        <p>{body}</p>
       </span>
       <span className="lh-gateway-action"><span>متابعة</span><ArrowLeft/></span>
      </button>
     )}
    </div>

    <div className="lh-register-card">
     <div><span className="lh-register-icon"><HeartHandshake/></span><span><b>جمعية جديدة؟</b><small>أنشئ حساب الجمعية وابدأ فترة التجربة.</small></span></div>
     <button className="lh-register-button" onClick={()=>n('/register')}>إنشاء حساب الجمعية <ArrowLeft/></button>
    </div>

    <div className="lh-security-line"><LockKeyhole/><span>اتصال آمن · صلاحيات حسب الدور · سجل تدقيق للعمليات الحساسة</span></div>
   </section>
  </section>
 </main>
}