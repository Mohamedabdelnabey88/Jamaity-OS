import {useState} from 'react';
import {Eye,EyeOff} from 'lucide-react';

type Props=React.InputHTMLAttributes<HTMLInputElement>;

export default function PasswordInput(props:Props){
 const[visible,setVisible]=useState(false);
 return <span className="password-field">
  <input {...props} type={visible?'text':'password'}/>
  <button
   type="button"
   className="password-toggle"
   aria-label={visible?'إخفاء كلمة المرور':'إظهار كلمة المرور'}
   title={visible?'إخفاء كلمة المرور':'إظهار كلمة المرور'}
   onClick={()=>setVisible(v=>!v)}
  >{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button>
 </span>;
}
