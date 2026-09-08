import {reviewHousehold,reviewSchema,validModelReview} from '../server/household-review.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'طريقة الطلب غير مدعومة.'})}
 const auth=req.headers.authorization;
 if(typeof auth!=='string'||!/^Bearer \S+$/.test(auth))return res.status(401).json({error:'سجل الدخول مجددًا.'});
 let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body}catch{return res.status(400).json({error:'طلب غير صالح.'})}
 if(!body||JSON.stringify(body).length>1000||Boolean(body.applicationId)===Boolean(body.beneficiaryId)||!uuid.test(body.applicationId||body.beneficiaryId))return res.status(400).json({error:'حدد ملفًا واحدًا صالحًا.'});
 const url=process.env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
 if(url!=='https://yagbmbuevtjaqypkujaf.supabase.co'||!key)return res.status(503).json({error:'خدمة التحليل غير مهيأة.'});
 try{
  const r=await fetch(`${url}/rest/v1/rpc/reserve_beneficiary_analysis`,{method:'POST',headers:{apikey:key,Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({p_application_id:body.applicationId||null,p_beneficiary_id:body.beneficiaryId||null}),signal:AbortSignal.timeout(10000)});
  if(!r.ok){const error=await r.json().catch(()=>({}));return res.status(error.message==='analysis_rate_limited'?429:403).json({error:error.message==='analysis_rate_limited'?'وصلت للحد المؤقت للتحليل. حاول لاحقًا.':'تعذر الوصول إلى الملف أو لا تملك صلاحية تحليله.'})}
  const source=await r.json();const deterministic=reviewHousehold(source.household.profile);const result={id:source.request_id,generated_at:new Date().toISOString(),source_updated_at:source.household.profile?.updated_at||null,...deterministic};delete result.numbers;
  if(!process.env.OPENAI_API_KEY)return res.status(200).json({...result,mode:'rules',notice:'المراجعة الحسابية متاحة. التحليل اللغوي غير مفعّل على المنصة.'});
  try{
   const model=process.env.BENEFICIARY_ANALYSIS_MODEL||'gpt-4.1-mini-2025-04-14';
   const ai=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(25000),body:JSON.stringify({model,store:false,max_output_tokens:1400,instructions:'أنت مساعد للباحث الاجتماعي. اكتب بالعربية ملخصًا محايدًا للإفادة وأسئلة استيضاح فقط. المدخل مؤشرات مالية وأعداد مصرح بها وغير متحقق منها. لا تصدر حكم استحقاق أو قبول أو رفض أو درجة أو ترتيب أولوية. لا تستنتج الاحتيال أو صفات شخصية. لا تدع قراءة مستندات. لا تخترع بيانات أو حدود فقر أو نسب ثقة. اربط كل سؤال بمفاتيح مصادره. نقص البيانات يستدعي الاستيضاح ولا يدل على قلة الاحتياج. اذكر حدود المعلومات. أقصى 6 أسئلة و4 حدود. لا تقترح مبلغ دعم.',input:JSON.stringify({reported:deterministic.numbers,calculated:deterministic.facts,missing:deterministic.missing}),text:{format:{type:'json_schema',name:'household_review',strict:true,schema:reviewSchema}}})});
   if(!ai.ok)throw new Error('provider_failed');const output=await ai.json();if(output.status!=='completed')throw new Error('incomplete');const text=(output.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');const review=JSON.parse(text);if(!validModelReview(review))throw new Error('invalid_output');return res.status(200).json({...result,mode:'ai',model,review});
  }catch{return res.status(200).json({...result,mode:'rules',notice:'تعذر إكمال التحليل اللغوي؛ هذه مراجعة حسابية فقط ويمكن إعادة المحاولة.'})}
 }catch{return res.status(503).json({error:'تعذر إكمال التحليل الآن. حاول مجددًا.'})}
}
