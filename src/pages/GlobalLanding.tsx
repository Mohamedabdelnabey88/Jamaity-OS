import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent,type ReactNode} from 'react';
import {useNavigate} from 'react-router-dom';
import {
  ArrowLeft,ArrowRight,BarChart3,BellRing,Boxes,Building2,Check,ChevronLeft,
  CircleDollarSign,FileCheck2,Globe2,HeartHandshake,Landmark,LayoutDashboard,
  LockKeyhole,Menu,Network,ReceiptText,ShieldCheck,Sparkles,UsersRound,WalletCards,X,
} from 'lucide-react';
import './global-landing.css';

type Language='ar'|'en';
type ProductKey='beneficiaries'|'finance'|'governance'|'platform';
type Copy={
  nav:string[]; login:string; start:string; eyebrow:string; title:ReactNode; description:string;
  explore:string; beneficiary:string; trust:string[]; productLabel:string; productTitle:string;
  productDescription:string; howLabel:string; howTitle:string; securityLabel:string; securityTitle:string;
  rolesLabel:string; rolesTitle:string; ctaTitle:string; ctaText:string; custom:string; footer:string;
};

const COPY:Record<Language,Copy>={
  ar:{
    nav:['المنتج','الحلول','الأمان','للجمعيات'],login:'تسجيل الدخول',start:'ابدأ التجربة',
    eyebrow:'نظام تشغيل للجمعيات الأهلية السعودية',
    title:<>شغّل جمعيتك بثقة.<br/><em>وأثبت أثرها بوضوح.</em></>,
    description:'من طلب المستفيد إلى القيد المالي وتقرير الحوكمة—جمعيتي يربط التشغيل والمال والأثر في منصة عربية واحدة، آمنة ومصممة للقطاع غير الربحي.',
    explore:'شاهد كيف تعمل',beneficiary:'بوابة المستفيد',
    trust:['عزل كامل للبيانات','صلاحيات دقيقة','سجل تدقيق دائم'],
    productLabel:'منصة واحدة. صورة تشغيل كاملة.',productTitle:'كل فريق يرى ما يحتاجه، وكل قرار يحتفظ بسياقه.',
    productDescription:'استكشف كيف تربط جمعيتي بين الوحدات بدل أن تترك البيانات في جزر منفصلة.',
    howLabel:'من الطلب إلى الأثر',howTitle:'سير عمل واحد، واضح وقابل للمراجعة.',
    securityLabel:'الثقة ليست إضافة',securityTitle:'أمان مؤسسي مبني داخل كل عملية.',
    rolesLabel:'مصممة لطريقة عملكم',rolesTitle:'واجهة مفهومة لكل دور في الجمعية.',
    ctaTitle:'ابدأ من جمعية أكثر تنظيمًا اليوم.',ctaText:'تجربة مرنة، إعداد واضح، وبياناتك تبقى ملكًا لجمعيتك.',
    custom:'استعرض الجمعيات',footer:'نظام تشغيل سعودي للعمل غير الربحي',
  },
  en:{
    nav:['Product','Solutions','Security','For nonprofits'],login:'Sign in',start:'Start free trial',
    eyebrow:'The operating system for Saudi nonprofits',
    title:<>Run with confidence.<br/><em>Prove every impact.</em></>,
    description:'From beneficiary intake to financial entries and governance reporting—Jamaity connects operations, finance and impact in one secure, nonprofit-first platform.',
    explore:'See the platform',beneficiary:'Beneficiary portal',
    trust:['Tenant-isolated data','Granular permissions','Immutable audit trail'],
    productLabel:'One platform. Total clarity.',productTitle:'Every team gets the right view. Every decision keeps its context.',
    productDescription:'Explore how Jamaity connects your work instead of leaving critical data across disconnected tools.',
    howLabel:'From request to impact',howTitle:'One workflow—clear, connected and reviewable.',
    securityLabel:'Trust by design',securityTitle:'Enterprise controls built into every workflow.',
    rolesLabel:'Built around your team',rolesTitle:'A focused workspace for every nonprofit role.',
    ctaTitle:'Build a better-run nonprofit today.',ctaText:'A flexible trial, guided setup, and data that always belongs to your organization.',
    custom:'Explore nonprofits',footer:'A Saudi operating system for the nonprofit sector',
  },
};

const PRODUCT:Record<Language,Record<ProductKey,{label:string;title:string;description:string;items:string[]}>>={
  ar:{
    beneficiaries:{label:'المستفيدون',title:'رحلة تحفظ الكرامة وتختصر الوقت',description:'تسجيل، طلب انضمام، مستندات، مراجعة، حالات ودعم—من دون تكرار البيانات.',items:['طلب رقمي آمن','ملف موحد للمستفيد','متابعة الدعم والإشعارات']},
    finance:{label:'المالية',title:'محاسبة تعرف أصل كل رقم',description:'سندات وقيد مزدوج وفترات وموازنات وأموال مقيدة مرتبطة بالعملية التشغيلية.',items:['سند قبض وصرف','ميزان مراجعة وقوائم','إقفال وعكس معتمد']},
    governance:{label:'الحوكمة',title:'جاهزية يمكن إثباتها لا تخمينها',description:'متطلبات ومواعيد وأدلة خاصة وتنبيهات مبكرة ضمن مؤشر واضح للإدارة.',items:['مؤشر حوكمة مباشر','أدلة ومستندات خاصة','تنبيهات الاستحقاق']},
    platform:{label:'إدارة المنصة',title:'تحكم مركزي بلا خلط للبيانات',description:'اعتماد الجمعيات وإدارة التجارب والاشتراكات ومتابعة صحة المنصة من مساحة مستقلة.',items:['اعتماد وتعليق مرن','تحكم في التجارب','مؤشرات على مستوى المنصة']},
  },
  en:{
    beneficiaries:{label:'Beneficiaries',title:'A dignified journey, without duplicated work',description:'Registration, applications, documents, review, cases and support in one connected record.',items:['Secure digital intake','Unified beneficiary record','Support and notification history']},
    finance:{label:'Finance',title:'Accounting that knows where every number came from',description:'Vouchers, double-entry journals, periods, budgets and restricted funds tied to operations.',items:['Receipt and payment vouchers','Trial balance and statements','Controlled close and reversal']},
    governance:{label:'Governance',title:'Readiness you can prove—not estimate',description:'Requirements, due dates, private evidence and early warnings in one executive view.',items:['Live governance score','Private evidence vault','Due-date intelligence']},
    platform:{label:'Platform admin',title:'Central control without mixing tenant data',description:'Approve nonprofits, manage trials and subscriptions, and oversee the platform independently.',items:['Flexible approval lifecycle','Trial controls','Platform-wide health signals']},
  },
};

const ICONS:Record<ProductKey,ReactNode>={beneficiaries:<UsersRound/>,finance:<Landmark/>,governance:<FileCheck2/>,platform:<Network/>};

export default function GlobalLanding(){
  const navigate=useNavigate();
  const [lang,setLang]=useState<Language>(()=>localStorage.getItem('jamaity-language')==='en'?'en':'ar');
  const [active,setActive]=useState<ProductKey>('beneficiaries');
  const [menuOpen,setMenuOpen]=useState(false);
  const stageRef=useRef<HTMLDivElement>(null);
  const t=COPY[lang],product=PRODUCT[lang][active],rtl=lang==='ar';

  useEffect(()=>{localStorage.setItem('jamaity-language',lang)},[lang]);
  const scrollTo=(id:string)=>{document.getElementById(id)?.scrollIntoView({behavior:'smooth'});setMenuOpen(false)};
  const moveStage=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(event.pointerType==='touch')return;
    const element=stageRef.current;if(!element)return;
    const rect=element.getBoundingClientRect();
    element.style.setProperty('--mx',`${((event.clientX-rect.left)/rect.width-.5)*12}px`);
    element.style.setProperty('--my',`${((event.clientY-rect.top)/rect.height-.5)*12}px`);
  };
  const resetStage=()=>{stageRef.current?.style.setProperty('--mx','0px');stageRef.current?.style.setProperty('--my','0px')};

  return <main className="global-site" dir={rtl?'rtl':'ltr'} lang={lang}>
    <header className="global-nav">
      <button className="global-brand" onClick={()=>scrollTo('top')} aria-label={rtl?'الصفحة الرئيسية':'Home'}>
        <span><HeartHandshake/></span><b>{rtl?'جمعيتي':'Jamaity'}</b><small>OS</small>
      </button>
      <nav className={menuOpen?'open':''} aria-label={rtl?'التنقل الرئيسي':'Primary navigation'}>
        <button onClick={()=>scrollTo('product')}>{t.nav[0]}</button>
        <button onClick={()=>scrollTo('workflow')}>{t.nav[1]}</button>
        <button onClick={()=>scrollTo('security')}>{t.nav[2]}</button>
        <button onClick={()=>scrollTo('roles')}>{t.nav[3]}</button>
      </nav>
      <div className="global-nav-actions">
        <button className="language-switch" onClick={()=>setLang(current=>current==='ar'?'en':'ar')} aria-label={rtl?'Switch to English':'التبديل إلى العربية'}><Globe2/>{rtl?'EN':'ع'}</button>
        <button className="global-login" onClick={()=>navigate('/login')}>{t.login}</button>
        <button className="global-primary compact" onClick={()=>navigate('/register')}>{t.start}{rtl?<ArrowLeft/>:<ArrowRight/>}</button>
        <button className="global-menu" onClick={()=>setMenuOpen(value=>!value)} aria-expanded={menuOpen} aria-label={rtl?'فتح القائمة':'Open menu'}>{menuOpen?<X/>:<Menu/>}</button>
      </div>
    </header>

    <section className="global-hero" id="top">
      <div className="hero-aurora one"/><div className="hero-aurora two"/><div className="global-grid"/>
      <div className="global-hero-copy">
        <span className="global-kicker"><Sparkles/>{t.eyebrow}<i>2026</i></span>
        <h1>{t.title}</h1>
        <p>{t.description}</p>
        <div className="global-actions">
          <button className="global-primary" onClick={()=>navigate('/register')}>{t.start}{rtl?<ArrowLeft/>:<ArrowRight/>}</button>
          <button className="global-secondary" onClick={()=>scrollTo('product')}>{t.explore}<span className="play-dot">▶</span></button>
          <button className="global-text-link" onClick={()=>navigate('/beneficiary-login')}>{t.beneficiary}<ChevronLeft/></button>
        </div>
        <div className="global-trust-row">{t.trust.map((item,index)=><span key={item}>{index===0?<LockKeyhole/>:<Check/>}{item}</span>)}</div>
      </div>

      <div className="product-stage" ref={stageRef} onPointerMove={moveStage} onPointerLeave={resetStage}>
        <div className="stage-glow"/>
        <div className="floating-chip chip-one"><ShieldCheck/> RLS protected</div>
        <div className="floating-chip chip-two"><Sparkles/> AI insights</div>
        <div className="product-window">
          <aside className="preview-sidebar"><span className="preview-logo"><HeartHandshake/></span>{[LayoutDashboard,UsersRound,WalletCards,Boxes,FileCheck2].map((Icon,index)=><span key={index} className={index===0?'active':''}><Icon/></span>)}</aside>
          <div className="preview-main">
            <div className="preview-top"><div><small>{rtl?'مساحة جمعية النور':'Al Noor workspace'}</small><b>{rtl?'صباح الخير، محمد':'Good morning, Mohammed'}</b></div><span><BellRing/></span></div>
            <div className="preview-head"><div><span>{rtl?'لوحة القيادة':'Executive dashboard'}</span><h3>{rtl?'الصورة الكاملة، الآن.':'Clarity, right now.'}</h3></div><i>{rtl?'مباشر':'LIVE'} <b/></i></div>
            <div className="preview-kpis">
              <article><span><UsersRound/></span><small>{rtl?'طلبات تحتاج مراجعة':'Intake review'}</small><strong>{rtl?'جاهزة للقرار':'Decision-ready'}</strong><em>+12%</em></article>
              <article><span><CircleDollarSign/></span><small>{rtl?'الدفاتر المالية':'Financial books'}</small><strong>{rtl?'متوازنة':'Balanced'}</strong><em><Check/></em></article>
              <article><span><FileCheck2/></span><small>{rtl?'ملف الحوكمة':'Governance file'}</small><strong>{rtl?'قابل للتدقيق':'Audit-ready'}</strong><em><ShieldCheck/></em></article>
            </div>
            <div className="preview-body">
              <article className="impact-chart"><div><span>{rtl?'تدفق الأثر':'Impact flow'}</span><b>{rtl?'التشغيل والمال في سياق واحد':'Operations and finance, connected'}</b></div><div className="chart-bars">{[38,53,47,68,60,81,74,92].map((height,index)=><i key={index} style={{height:`${height}%`}}/>)}</div><div className="chart-line"><span/><span/><span/><span/></div></article>
              <article className="attention-card"><div><span><Sparkles/>{rtl?'يتطلب انتباهك':'Needs attention'}</span><b>3</b></div>{[
                [rtl?'طلب دعم ينتظر الموافقة':'Support awaiting approval','finance'],
                [rtl?'مستند حوكمة يقترب من الانتهاء':'Governance evidence expiring','governance'],
                [rtl?'طلب انضمام جديد':'New beneficiary application','beneficiary'],
              ].map(([label,type])=><button key={label}><i className={type}/><span>{label}</span><ChevronLeft/></button>)}</article>
            </div>
          </div>
        </div>
      </div>
      <div className="module-ribbon" aria-label={rtl?'وحدات المنصة':'Platform modules'}><div>{[rtl?'المستفيدون':'Beneficiaries',rtl?'الحالات':'Cases',rtl?'الدعم':'Support',rtl?'المحاسبة':'Accounting',rtl?'المخزون':'Inventory',rtl?'الحوكمة':'Governance',rtl?'الموافقات':'Approvals',rtl?'التقارير':'Reports'].map(item=><span key={item}>{item}<i/></span>)}</div></div>
    </section>

    <section className="global-section product-section" id="product">
      <div className="section-intro"><span>{t.productLabel}</span><h2>{t.productTitle}</h2><p>{t.productDescription}</p></div>
      <div className="product-explorer">
        <div className="product-tabs" role="tablist">{(Object.keys(PRODUCT[lang]) as ProductKey[]).map(key=><button key={key} className={active===key?'active':''} onClick={()=>setActive(key)} role="tab" aria-selected={active===key}>{ICONS[key]}<span>{PRODUCT[lang][key].label}</span></button>)}</div>
        <div className="product-story" role="tabpanel">
          <div className="story-copy"><span className="story-icon">{ICONS[active]}</span><h3>{product.title}</h3><p>{product.description}</p><ul>{product.items.map(item=><li key={item}><Check/>{item}</li>)}</ul><button onClick={()=>navigate('/register')}>{t.start}{rtl?<ArrowLeft/>:<ArrowRight/>}</button></div>
          <div className={`story-ui ${active}`}><div className="story-ui-top"><span/><span/><span/><b>{product.label}</b></div><div className="story-ui-grid"><aside>{[1,2,3,4,5].map(item=><i key={item}/>)}</aside><main><div className="skeleton-title"/><div className="skeleton-kpis">{[1,2,3].map(item=><i key={item}/>)}</div><div className="skeleton-table">{[1,2,3,4].map(item=><span key={item}><i/><b/><em/></span>)}</div></main></div></div>
        </div>
      </div>
    </section>

    <section className="global-section workflow-section" id="workflow">
      <div className="section-intro light"><span>{t.howLabel}</span><h2>{t.howTitle}</h2></div>
      <div className="workflow-track">{(rtl?[
        ['01','يصل الطلب','المستفيد يسجل ويرفع بياناته ومستنداته بأمان.'],['02','تبدأ المراجعة','الفريق يراجع الملف ويتخذ القرار بصلاحيات واضحة.'],['03','تُنفذ الخدمة','الدعم والمخزون والموافقات تتحرك في مسار مترابط.'],['04','يُثبت الأثر','القيد والتقرير والحوكمة تُبنى من نفس مصدر الحقيقة.'],
      ]:[
        ['01','Request arrives','Secure digital intake and document collection.'],['02','Review starts','The team decides with clear ownership and permissions.'],['03','Service is delivered','Support, inventory and approvals move together.'],['04','Impact is proven','Finance, reporting and governance share one source of truth.'],
      ]).map(([number,title,body])=><article key={number}><b>{number}</b><span/><h3>{title}</h3><p>{body}</p></article>)}</div>
    </section>

    <section className="global-section security-section" id="security">
      <div className="section-intro"><span>{t.securityLabel}</span><h2>{t.securityTitle}</h2></div>
      <div className="security-layout">
        <article className="security-feature"><div className="security-orbit"><span><ShieldCheck/></span><i/><i/><i/></div><div><small>Multi-tenant by design</small><h3>{rtl?'بيانات كل جمعية في حدودها دائمًا.':'Every nonprofit stays inside its own boundary.'}</h3><p>{rtl?'عزل على مستوى قاعدة البيانات، وسياسات وصول لا تعتمد على واجهة المستخدم أو بيانات قابلة للتلاعب.':'Database-level isolation with authorization that never trusts client-side metadata.'}</p></div></article>
        <div className="security-points">
          <article><LockKeyhole/><div><h3>{rtl?'صلاحيات حسب الدور والعمل':'Role and action permissions'}</h3><p>{rtl?'كل قراءة أو قرار يمر عبر هوية وصلاحية ونطاق جمعية واضح.':'Every read and decision checks identity, permission and tenant scope.'}</p></div></article>
          <article><ReceiptText/><div><h3>{rtl?'مسار مالي قابل للمراجعة':'Reviewable financial trail'}</h3><p>{rtl?'قيد مزدوج، إقفال فترات، وعكس بدل حذف الأثر.':'Double-entry, period locking and reversal instead of erasure.'}</p></div></article>
          <article><FileCheck2/><div><h3>{rtl?'مستندات خاصة وسجل تدقيق':'Private documents and audit history'}</h3><p>{rtl?'روابط مؤقتة، تخزين خاص، وسياق محفوظ لكل إجراء.':'Private storage, temporary access and preserved action context.'}</p></div></article>
        </div>
      </div>
    </section>

    <section className="global-section roles-section" id="roles">
      <div className="section-intro"><span>{t.rolesLabel}</span><h2>{t.rolesTitle}</h2></div>
      <div className="role-cards">{[
        [BarChart3,rtl?'الإدارة التنفيذية':'Executive leadership',rtl?'قرار مبني على التشغيل والمال والحوكمة.':'Decisions grounded in operations, finance and governance.'],
        [WalletCards,rtl?'الفريق المالي':'Finance team',rtl?'دفاتر منضبطة مرتبطة بالحدث الحقيقي.':'Controlled books tied to the original business event.'],
        [HeartHandshake,rtl?'مدير الحالة':'Case manager',rtl?'صورة إنسانية كاملة دون تشتيت.':'A complete human view without fragmented tools.'],
        [Building2,rtl?'صاحب المنصة':'Platform owner',rtl?'اعتماد واشتراكات وتجارب من مركز مستقل.':'Approvals, subscriptions and trials from a separate command center.'],
      ].map(([Icon,title,body])=>{const RoleIcon=Icon as typeof BarChart3;return <article key={String(title)}><span><RoleIcon/></span><h3>{String(title)}</h3><p>{String(body)}</p><button onClick={()=>scrollTo('product')}>{t.explore}<ChevronLeft/></button></article>})}</div>
    </section>

    <section className="global-cta"><div className="cta-pattern"/><div><span><Sparkles/>{rtl?'جاهز للعمل من اليوم الأول':'Ready from day one'}</span><h2>{t.ctaTitle}</h2><p>{t.ctaText}</p></div><div><button className="global-primary bright" onClick={()=>navigate('/register')}>{t.start}{rtl?<ArrowLeft/>:<ArrowRight/>}</button><button className="global-secondary dark" onClick={()=>navigate('/directory')}>{t.custom}</button></div></section>
    <footer className="global-footer"><div className="global-brand"><span><HeartHandshake/></span><b>{rtl?'جمعيتي':'Jamaity'}</b><small>OS</small></div><p>{t.footer}</p><nav><button onClick={()=>navigate('/directory')}>{rtl?'دليل الجمعيات':'Directory'}</button><button onClick={()=>navigate('/beneficiary-login')}>{t.beneficiary}</button><button onClick={()=>navigate('/platform-login')}>{rtl?'إدارة المنصة':'Platform admin'}</button></nav><small>© 2026 Jamaity OS</small></footer>
  </main>;
}
