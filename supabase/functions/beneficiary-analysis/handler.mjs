import {reviewHousehold} from './household-review.mjs';
import {nvidiaReview} from './provider.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createAnalysisHandler(env,fetcher=fetch){return async function handle(req){
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const send=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return send({error:'طريقة الطلب غير مدعومة.'},405);
 const auth=req.headers.get('authorization');if(!auth||!/^Bearer \S+$/.test(auth))return send({error:'سجل الدخول مجددًا.'},401);
 let body;try{const raw=await req.text();if(raw.length>1000)return send({error:'طلب كبير جدًا.'},400);body=JSON.parse(raw)}catch{return send({error:'طلب غير صالح.'},400)}
 if(!body||Boolean(body.applicationId)===Boolean(body.beneficiaryId)||!uuid.test(body.applicationId||body.beneficiaryId))return send({error:'حدد ملفًا واحدًا صالحًا.'},400);
 const {url,anonKey,serviceKey}=env;
 if(url!=='https://yagbmbuevtjaqypkujaf.supabase.co'||!anonKey||!serviceKey)return send({error:'خدمة التحليل غير مهيأة.'},503);
 try{
  // Caller JWT is verified by PostgREST. Staff permission, tenant and quota are enforced inside the RPC.
  const response=await fetcher(`${url}/rest/v1/rpc/reserve_beneficiary_analysis`,{method:'POST',headers:{apikey:anonKey,Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({p_application_id:body.applicationId||null,p_beneficiary_id:body.beneficiaryId||null}),signal:AbortSignal.timeout(8000)});
  if(!response.ok){const error=await response.json().catch(()=>({}));return send({error:error.message==='analysis_rate_limited'?'وصلت للحد المؤقت للتحليل. حاول لاحقًا.':'تعذر الوصول إلى الملف أو لا تملك صلاحية تحليله.'},error.message==='analysis_rate_limited'?429:403)}
  const source=await response.json();const computed=reviewHousehold(source.household.profile);const result={id:source.request_id,generated_at:new Date().toISOString(),source_updated_at:source.household.profile?.updated_at||null,...computed};delete result.numbers;
  try{
   // Service-only RPC reads one named Vault secret; never exposed to callers or logs.
   const secretResponse=await fetcher(`${url}/rest/v1/rpc/beneficiary_analysis_provider_secret`,{method:'POST',headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(5000)});
   if(!secretResponse.ok)throw new Error('configuration');const key=await secretResponse.json();if(typeof key!=='string'||!key.startsWith('nvapi-'))throw new Error('configuration');
   const ai=await nvidiaReview(key,computed,fetcher);return send({...result,mode:'ai',...ai});
  }catch{return send({...result,mode:'rules',notice:'تعذر إكمال تحليل NVIDIA الآن؛ هذه مراجعة حسابية فقط ويمكن إعادة المحاولة.'})}
 }catch{return send({error:'تعذر إكمال التحليل الآن. حاول مجددًا.'},503)}
}}
