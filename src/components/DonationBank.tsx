import {useState} from 'react';
import {Landmark,Copy} from 'lucide-react';
export type BankSite={iban?:string;bank_name?:string;bank_holder?:string;contact_phone?:string;contact_email?:string;address?:string};
export default function DonationBank({site,charityName}:{site:BankSite;charityName:string}){
 const[notice,setNotice]=useState('');
 async function copy(){try{await navigator.clipboard.writeText(site.iban||'');setNotice('تم نسخ الآيبان.')}catch{setNotice('حدد الآيبان في الحقل وانسخه يدويًا.')}}
 return <section className="donation-bank" id="bank"><Landmark size={30}/><h2>الحساب البنكي لـ{charityName}</h2>{site.iban?<><dl><dt>البنك</dt><dd>{site.bank_name}</dd><dt>اسم صاحب الحساب</dt><dd>{site.bank_holder}</dd></dl><label>رقم الآيبان<input readOnly dir="ltr" value={site.iban} onFocus={e=>e.target.select()}/></label><button className="secondary" onClick={()=>void copy()}><Copy size={17}/> نسخ الآيبان</button>{notice&&<p role="status">{notice}</p>}<ol><li>انسخ الآيبان وافتح تطبيق بنكك.</li><li>طابق اسم المستفيد البنكي مع اسم الجمعية قبل التحويل.</li><li>احتفظ بالإيصال وتواصل مع الجمعية، مع ذكر اسم الحملة إن وُجد.</li></ol><p>لا يُعتبر التحويل مستلمًا أو قيدًا محاسبيًا حتى تتحقق الجمعية من وصوله.</p></>:<p>لم تنشر الجمعية حسابًا بنكيًا بعد. تواصل معها قبل إجراء أي تحويل.</p>}</section>;
}
