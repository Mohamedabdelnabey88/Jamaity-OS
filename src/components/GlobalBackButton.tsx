import { ArrowRight } from 'lucide-react';
import { useLocation,useNavigate } from 'react-router-dom';

export default function GlobalBackButton(){
 const location=useLocation();const navigate=useNavigate();
 if(location.pathname==='/')return null;
 return <button type="button" className="global-back" aria-label="الرجوع إلى الصفحة السابقة" onClick={()=>window.history.length>1?navigate(-1):navigate('/')}><ArrowRight size={18}/> <span>رجوع</span></button>;
}
