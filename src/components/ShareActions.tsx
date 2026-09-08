import {useState} from 'react';
import {Copy,Share2,Printer} from 'lucide-react';
export default function ShareActions({title,text,url,print=false}:{title:string;text:string;url:string;print?:boolean}){
 const[notice,setNotice]=useState(''),[manual,setManual]=useState('');
 async function copy(value:string){try{await navigator.clipboard.writeText(value);setNotice('تم النسخ.');setManual('')}catch{setManual(value);setNotice('يمكنك نسخ النص من الحقل أدناه.')}}
 async function share(){if(!navigator.share){await copy(text);return}try{await navigator.share({title,text,url});setNotice('')}catch(e){if((e as Error).name!=='AbortError')await copy(text)}}
 return <div className="share-tools"><div className="account-links"><button className="secondary" onClick={()=>void share()}><Share2 size={17}/> مشاركة</button><button className="secondary" onClick={()=>void copy(url)}><Copy size={17}/> نسخ الرابط</button><button className="secondary" onClick={()=>void copy(text)}>نسخ النص الترويجي</button>{print&&<button className="secondary" onClick={()=>window.print()}><Printer size={17}/> طباعة بطاقة الحملة</button>}</div>{notice&&<p role="status">{notice}</p>}{manual&&<textarea aria-label="نص المشاركة للنسخ" readOnly value={manual} onFocus={e=>e.target.select()}/>}</div>;
}
