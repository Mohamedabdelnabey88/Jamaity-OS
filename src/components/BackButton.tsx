import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function BackButton({fallback='/dashboard'}:{fallback?:string}){
 const navigate=useNavigate();
 return <button type="button" className="workspace-back" onClick={()=>window.history.length>1?navigate(-1):navigate(fallback)}><ArrowRight size={17}/> رجوع</button>;
}
