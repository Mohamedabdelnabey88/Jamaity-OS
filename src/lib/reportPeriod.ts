/** Inclusive Saudi calendar dates; independent of the browser's timezone. */
export function reportPeriod(from: string, to: string) {
 const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
 if (!valid(from) || !valid(to)) throw new Error('اختر تاريخ بداية ونهاية صحيحين.');
 if (from > to) throw new Error('تاريخ النهاية يجب ألا يسبق تاريخ البداية.');
 return { p_from: `${from}T00:00:00+03:00`, p_to: `${to}T23:59:59.999999+03:00` };
}
export function saudiToday() {
 return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
