import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { supabase } from '../supabase';

export default function LogoutButton({destination='/login'}:{destination?:string}) {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function logout() {
    setBusy(true);setError('');
    try {
      const result=await supabase.auth.signOut({scope:'local'});
      if(result.error) throw result.error;
      // Discard all in-memory tenant data after the session has been removed.
      window.location.replace(destination);
    } catch {
      setError('تعذر تسجيل الخروج. تحقق من الاتصال وأعد المحاولة.');
      setBusy(false);
    }
  }
  return <div className="logout-control"><button type="button" className="logout-button" disabled={busy} onClick={logout}><LogOut size={18}/><span>{busy?'جاري الخروج…':'تسجيل الخروج'}</span></button>{error&&<p className="logout-error" role="alert">{error}</p>}</div>;
}
