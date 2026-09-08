// Compatibility endpoint for the existing frontend. All authorization and provider work lives in Supabase.
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'طريقة الطلب غير مدعومة.'})}
 const authorization=req.headers.authorization;
 if(typeof authorization!=='string'||!/^Bearer \S+$/.test(authorization))return res.status(401).json({error:'سجل الدخول مجددًا.'});
 let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body}catch{return res.status(400).json({error:'طلب غير صالح.'})}
 if(!body||JSON.stringify(body).length>1000)return res.status(400).json({error:'طلب غير صالح.'});
 try{const r=await fetch('https://yagbmbuevtjaqypkujaf.supabase.co/functions/v1/beneficiary-analysis',{method:'POST',headers:{authorization,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(44000)});const result=await r.json();return res.status(r.status).json(result)}catch{return res.status(503).json({error:'تعذر الاتصال بخدمة التحليل. حاول لاحقًا.'})}
}
