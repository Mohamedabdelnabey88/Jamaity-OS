import{useEffect,useMemo,useState}from'react';
import{FileText,Image,Save,ShieldCheck,UploadCloud}from'lucide-react';
import{supabase}from'../supabase';
import{getAccessState}from'../lib/rbac';
import{friendlyError}from'../lib/requests';

const DEFAULT_BODY=`السلام عليكم ورحمة الله وبركاته،

الأستاذ/ة {{donor_name}} المحترم/ة،

تتقدم {{charity_name}} بخالص الشكر والتقدير لكم على {{donation_summary}} بتاريخ {{donation_date}}.

إن مساهمتكم الكريمة تعكس روح العطاء والتكافل، وتسهم بإذن الله في دعم أعمال الجمعية وخدمة المستفيدين.

نسأل الله أن يجزيكم خير الجزاء، وأن يبارك لكم في مالكم وأهلكم، ويجعل ما قدمتموه في ميزان حسناتكم.

مع خالص الشكر والامتنان،
{{charity_name}}`;

type Template={
 id?:string;
 background_object_path:string;
 source_object_path:string|null;
 body_template:string;
 content_top_mm:number;
 content_side_mm:number;
 font_size_pt:number;
};

export default function DonorLetterTemplateEditor(){
 const[charityId,setCharityId]=useState('');
 const[template,setTemplate]=useState<Template>({background_object_path:'',source_object_path:null,body_template:DEFAULT_BODY,content_top_mm:62,content_side_mm:22,font_size_pt:13});
 const[previewUrl,setPreviewUrl]=useState('');
 const[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');

 useEffect(()=>{void load()},[]);
 async function load(){
  setLoading(true);setError('');
  try{
   const access=await getAccessState(true);
   if(!access.charityId)throw new Error('تعذر تحديد الجمعية الحالية.');
   setCharityId(access.charityId);
   const r=await supabase.rpc('donor_thank_you_template');
   if(r.error)throw r.error;
   if(r.data){
    const t=r.data as any;
    setTemplate({
     id:t.id,
     background_object_path:t.background_object_path||'',
     source_object_path:t.source_object_path||null,
     body_template:t.body_template||DEFAULT_BODY,
     content_top_mm:Number(t.content_top_mm||62),
     content_side_mm:Number(t.content_side_mm||22),
     font_size_pt:Number(t.font_size_pt||13)
    });
    if(t.background_object_path)await refreshPreview(t.background_object_path);
   }
  }catch(e){setError(friendlyError(e))}finally{setLoading(false)}
 }

 async function refreshPreview(path:string){
  const r=await supabase.storage.from('charity-letterheads').createSignedUrl(path,3600);
  if(r.error)throw r.error;
  setPreviewUrl(r.data.signedUrl);
 }

 async function uploadBackground(file:File){
  if(!charityId)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)){setError('نسخة التوليد يجب أن تكون PNG أو JPG أو WebP بدقة A4.');return}
  if(file.size>10*1024*1024){setError('حجم الورقة الرسمية يجب ألا يتجاوز 10MB.');return}
  setBusy(true);setError('');setNotice('');
  try{
   const ext=file.name.split('.').pop()?.toLowerCase()||'png';
   const path=`${charityId}/templates/donor-thank-you/background-${crypto.randomUUID()}.${ext}`;
   const r=await supabase.storage.from('charity-letterheads').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
   if(r.error)throw r.error;
   setTemplate(t=>({...t,background_object_path:path}));
   await refreshPreview(path);
   setNotice('تم رفع الورقة الرسمية. اضبط موضع النص ثم احفظ القالب.');
  }catch(e){setError(friendlyError(e))}finally{setBusy(false)}
 }

 async function uploadSource(file:File){
  if(!charityId)return;
  const allowed=['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if(!allowed.includes(file.type)){setError('الملف الأصلي المدعوم هو PDF أو Word بصيغة DOCX.');return}
  if(file.size>10*1024*1024){setError('حجم الملف الأصلي يجب ألا يتجاوز 10MB.');return}
  setBusy(true);setError('');setNotice('');
  try{
   const ext=file.type==='application/pdf'?'pdf':'docx';
   const path=`${charityId}/templates/donor-thank-you/source-${crypto.randomUUID()}.${ext}`;
   const r=await supabase.storage.from('charity-letterheads').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
   if(r.error)throw r.error;
   setTemplate(t=>({...t,source_object_path:path}));
   setNotice('تم حفظ الملف الأصلي للقالب بأمان.');
  }catch(e){setError(friendlyError(e))}finally{setBusy(false)}
 }

 async function save(){
  if(!template.background_object_path){setError('ارفع نسخة A4 من الورقة الرسمية بصيغة PNG أو JPG أولًا.');return}
  setBusy(true);setError('');setNotice('');
  try{
   const r=await supabase.rpc('save_donor_thank_you_template',{
    p_background_object_path:template.background_object_path,
    p_source_object_path:template.source_object_path,
    p_body_template:template.body_template,
    p_content_top_mm:template.content_top_mm,
    p_content_side_mm:template.content_side_mm,
    p_font_size_pt:template.font_size_pt
   });
   if(r.error)throw r.error;
   setTemplate(t=>({...t,id:(r.data as any)?.id||t.id}));
   setNotice('تم اعتماد قالب خطاب الشكر الرسمي لهذه الجمعية.');
  }catch(e){setError(friendlyError(e))}finally{setBusy(false)}
 }

 const sample=useMemo(()=>template.body_template
  .replaceAll('{{donor_name}}','أحمد محمد')
  .replaceAll('{{charity_name}}','اسم الجمعية')
  .replaceAll('{{donation_summary}}','تبرعكم الكريم بمبلغ 5,000 ريال سعودي')
  .replaceAll('{{donation_date}}',new Date().toLocaleDateString('ar-SA'))
  .replaceAll('{{reference_no}}','DON-2026-001'),[template.body_template]);

 return <section id="donor-letterhead" className="data-card letter-template-editor">
  <div className="data-card-head"><div><strong>قالب خطاب شكر المتبرعين</strong><span>ورقة رسمية مستقلة لكل جمعية، تُستخدم تلقائيًا عند إنشاء خطاب الشكر.</span></div><ShieldCheck/></div>
  {loading?<div className="loading">جاري تحميل إعدادات الخطاب الرسمي...</div>:<div className="letter-template-layout">
   <div className="letter-template-controls">
    <div className="template-info"><FileText/><div><b>كيف يعمل القالب؟</b><p>ارفع نسخة A4 من الورقة الرسمية كصورة عالية الجودة للتوليد، ويمكنك أيضًا حفظ ملف PDF أو Word الأصلي معها. النظام يضع بيانات المتبرع والتبرع فوق الورقة ثم يصدر PDF ثابتًا.</p></div></div>
    <label className="template-upload"><Image/><span><b>ورقة التوليد A4</b><small>PNG / JPG / WebP — يفضل 2480×3508 أو أعلى</small></span><input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void uploadBackground(f)}}/></label>
    <label className="template-upload secondary-upload"><UploadCloud/><span><b>الملف الأصلي للقالب</b><small>PDF أو Word (DOCX) — للحفظ والمرجعية</small></span><input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void uploadSource(f)}}/></label>

    <label>نص الخطاب الرسمي<textarea rows={13} value={template.body_template} onChange={e=>setTemplate({...template,body_template:e.target.value})}/></label>
    <div className="template-variables"><span>الحقول المتاحة:</span><code>{'{{donor_name}}'}</code><code>{'{{charity_name}}'}</code><code>{'{{donation_summary}}'}</code><code>{'{{donation_date}}'}</code><code>{'{{reference_no}}'}</code></div>
    <div className="form-grid">
     <label>بداية النص من أعلى الصفحة <strong>{template.content_top_mm} مم</strong><input type="range" min="30" max="120" step="1" value={template.content_top_mm} onChange={e=>setTemplate({...template,content_top_mm:Number(e.target.value)})}/></label>
     <label>الهامش الجانبي <strong>{template.content_side_mm} مم</strong><input type="range" min="10" max="45" step="1" value={template.content_side_mm} onChange={e=>setTemplate({...template,content_side_mm:Number(e.target.value)})}/></label>
    </div>
    <label>حجم خط الخطاب <strong>{template.font_size_pt} pt</strong><input type="range" min="10" max="20" step=".5" value={template.font_size_pt} onChange={e=>setTemplate({...template,font_size_pt:Number(e.target.value)})}/></label>
    {template.source_object_path&&<div className="template-source-saved"><ShieldCheck/> الملف الأصلي محفوظ داخل مساحة الجمعية الخاصة.</div>}
    {error&&<div className="error">{error}</div>}{notice&&<div className="success">{notice}</div>}
    <button type="button" className="primary" disabled={busy||!template.background_object_path} onClick={()=>void save()}><Save/>{busy?'جاري الحفظ...':'اعتماد القالب الرسمي'}</button>
   </div>
   <div className="letter-preview-wrap"><div className="letter-preview-label"><span>معاينة مباشرة</span><small>مثال ببيانات تجريبية</small></div><div className="letter-page-preview">{previewUrl?<img src={previewUrl} alt="الورقة الرسمية"/>:<div className="letter-preview-empty"><Image/><b>ارفع الورقة الرسمية</b><span>ستظهر المعاينة هنا قبل اعتماد القالب.</span></div>}{previewUrl&&<div className="letter-preview-text" style={{top:`${(template.content_top_mm/297)*100}%`,right:`${(template.content_side_mm/210)*100}%`,left:`${(template.content_side_mm/210)*100}%`,fontSize:`${Math.max(8,template.font_size_pt*.58)}px`}}>{sample}</div>}</div></div>
  </div>}
 </section>
}
