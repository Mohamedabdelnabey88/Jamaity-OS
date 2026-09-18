import { useEffect, useRef, useState } from 'react'
import { Eye, Plus, Search, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getBeneficiaries, getMyCharity, type Beneficiary } from '../lib/jamaity'

import { supabase } from '../supabase'
import { getAccessState } from '../lib/rbac'
import { friendlyError } from '../lib/requests'

export default function Beneficiaries() {
  const [rows, setRows] = useState<Beneficiary[]>([])
  const [search, setSearch] = useState('')
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const [canManage,setCanManage]=useState(false),[adding,setAdding]=useState(false),[saving,setSaving]=useState(false),[name,setName]=useState(''),[phone,setPhone]=useState(''),[saveError,setSaveError]=useState('')
  const requestId=useRef(''),savingRef=useRef(false)
  async function create(e:React.FormEvent){
    e.preventDefault();if(savingRef.current)return;savingRef.current=true;setSaving(true);setSaveError('')
    try{const r=await supabase.rpc('create_charity_beneficiary',{p_request_id:requestId.current,p_full_name:name.trim(),p_phone:phone.trim()||null});if(r.error)throw r.error;if(!r.data?.id)throw Error('تعذر تأكيد إنشاء الملف. أعد المحاولة.');navigate(`/beneficiaries/${r.data.id}`)}
    catch(e){setSaveError(friendlyError(e))}finally{savingRef.current=false;setSaving(false)}
  }
  useEffect(()=>{let live=true;getAccessState(true).then(a=>{if(live)setCanManage(a.permissions.includes('beneficiaries.manage'))}).catch(e=>{if(live)setError(friendlyError(e))});return()=>{live=false}},[])

  async function load(value = search) {
    setLoading(true); setError('')
    try {
      const charity = await getMyCharity()
      if (!charity) { setRows([]); setTotal(0); return }
      const result = await getBeneficiaries(charity.id, value)
      setRows(result.data); setTotal(result.count)
    } catch (e: any) { setError(e.message || 'تعذر تحميل المستفيدين') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load('') }, [])

  return <main className="module-page">
    <div className="module-head">
      <div><span className="eyebrow"><UsersRound size={15}/> إدارة المستفيدين</span><h1>المستفيدون</h1><p>ملف موحد وآمن لكل مستفيد، مع حماية البيانات الحساسة.</p></div>
      <button className="primary" disabled={!canManage} onClick={()=>{requestId.current=crypto.randomUUID();setName('');setPhone('');setSaveError('');setAdding(true)}}><Plus size={18}/> مستفيد جديد</button>
    </div>
    {adding&&<section className="panel" aria-labelledby="new-beneficiary-title"><h2 id="new-beneficiary-title">إضافة ملف مستفيد</h2><p>ينشأ الملف غير نشط لحين استكمال المراجعة. لا تعني الإضافة اعتماد الاستحقاق أو إنشاء حساب دخول للمستفيد.</p><form onSubmit={create}><div className="inline-form"><label>الاسم الكامل<input autoFocus required minLength={2} maxLength={160} value={name} disabled={saving} onChange={e=>{setName(e.target.value);requestId.current=crypto.randomUUID()}}/></label><label>الجوال (اختياري)<input type="tel" dir="ltr" value={phone} disabled={saving} onChange={e=>{setPhone(e.target.value);requestId.current=crypto.randomUUID()}}/></label></div>{saveError&&<div className="error" role="alert">{saveError}</div>}<button className="primary" disabled={saving}>{saving?'جاري إنشاء الملف...':'إنشاء الملف'}</button><button type="button" disabled={saving} onClick={()=>setAdding(false)}>إلغاء</button></form></section>}
    <div className="module-toolbar">
      <div className="search-box"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()} placeholder="ابحث بالاسم أو رقم الجوال..."/></div>
      <div className="security-note"><ShieldCheck size={17}/> البيانات محمية بصلاحيات الجمعية</div>
    </div>
    {error && <div className="error">{error}</div>}
    <section className="data-card">
      <div className="data-card-head"><strong>{total.toLocaleString('ar-SA')} مستفيد</strong><span>آخر 50 سجل</span></div>
      {loading ? <div className="empty">جاري تحميل البيانات...</div> : rows.length === 0 ? <div className="empty"><UserRound size={32}/><div>لا يوجد مستفيدون حتى الآن.</div></div> : <div className="table-wrap"><table><thead><tr><th>المستفيد</th><th>الجوال</th><th>الحالة</th><th>تاريخ التسجيل</th><th></th></tr></thead><tbody>{rows.map(row=><tr key={row.id} onClick={()=>navigate(`/beneficiaries/${row.id}`)} className="clickable-row"><td><div className="person"><div className="person-avatar">{row.full_name.slice(0,1)}</div><div><b>{row.full_name}</b><small>ملف مستفيد</small></div></div></td><td>{row.phone || '—'}</td><td><span className={`status ${row.status}`}>{row.status==='active'?'نشط':row.status==='blocked'?'موقوف':'غير نشط'}</span></td><td>{new Date(row.created_at).toLocaleDateString('ar-SA')}</td><td><button className="icon" aria-label={`فتح ملف ومستندات ${row.full_name}`} title="فتح الملف والمستندات" onClick={e=>{e.stopPropagation();navigate(`/beneficiaries/${row.id}`)}}><Eye size={17}/></button></td></tr>)}</tbody></table></div>}
    </section>
  </main>
}
