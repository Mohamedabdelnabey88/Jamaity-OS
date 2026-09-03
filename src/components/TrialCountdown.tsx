import { useEffect, useMemo, useState } from 'react';
import { Clock3 } from 'lucide-react';
import type { AccessState } from '../lib/rbac';

export default function TrialCountdown({ access }: { access: AccessState }) {
  const initial = Math.max(0, access.subscriptionRemainingSeconds ?? 0);
  const [remaining, setRemaining] = useState(initial);
  useEffect(() => {
    setRemaining(initial);
    if (access.subscriptionStatus !== 'trial' || initial <= 0) return;
    const timer = window.setInterval(() => setRemaining(value => {
      if (value <= 1) { window.clearInterval(timer); window.location.reload(); return 0; }
      return value - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [access.subscriptionStatus, initial]);
  const time = useMemo(() => ({
    days: Math.floor(remaining / 86400),
    hours: Math.floor((remaining % 86400) / 3600),
    minutes: Math.floor((remaining % 3600) / 60),
  }), [remaining]);
  if (access.subscriptionStatus !== 'trial') return null;
  return <section className="trial-banner"><div className="trial-copy"><span className="trial-icon"><Clock3/></span><div><b>متبقي من الفترة التجريبية</b><small>بدأت التجربة عند التسجيل ولا تُعاد عند اعتماد الجمعية.</small></div></div><div className="trial-clock" aria-label="الوقت المتبقي من الفترة التجريبية"><Time value={time.days} label="يوم"/><Time value={time.hours} label="ساعة"/><Time value={time.minutes} label="دقيقة"/></div></section>;
}
function Time({ value, label }: { value: number; label: string }) { return <div><strong>{value.toLocaleString('ar-SA')}</strong><span>{label}</span></div>; }
