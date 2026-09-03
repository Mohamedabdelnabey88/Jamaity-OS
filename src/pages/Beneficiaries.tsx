import { useEffect, useState } from 'react'
import { Eye, Plus, Search, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getBeneficiaries, getMyCharity, type Beneficiary } from '../lib/jamaity'

export default function Beneficiaries() {
  const [rows, setRows] = useState<Beneficiary[]>([])
  const [search, setSearch] = useState('')
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

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
      <button className="primary"><Plus size={18}/> مستفيد جديد</button>
    </div>
    <div className="module-toolbar">
      <div className="search-box"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()} placeholder="ابحث بالاسم أو رقم الجوال..."/></div>
      <div className="security-note"><ShieldCheck size={17}/> البيانات محمية بصلاحيات الجمعية</div>
    </div>
    {error && <div className="error">{error}</div>}
    <section className="data-card">
      <div className="data-card-head"><strong>{total.toLocaleString('ar-SA')} مستفيد</strong><span>آخر 50 سجل</span></div>
      {loading ? <div className="empty">جاري تحميل البيانات...</div> : rows.length === 0 ? <div className="empty"><UserRound size={32}/><div>لا يوجد مستفيدون حتى الآن.</div></div> : <div className="table-wrap"><table><thead><tr><th>المستفيد</th><th>الجوال</th><th>الحالة</th><th>تاريخ التسجيل</th><th></th></tr></thead><tbody>{rows.map(row=><tr key={row.id} onClick={()=>navigate(`/beneficiaries/${row.id}`)} className="clickable-row"><td><div className="person"><div className="person-avatar">{row.full_name.slice(0,1)}</div><div><b>{row.full_name}</b><small>ملف مستفيد</small></div></div></td><td>{row.phone || '—'}</td><td><span className={`status ${row.status}`}>{row.status==='active'?'نشط':row.status==='blocked'?'موقوف':'غير نشط'}</span></td><td>{new Date(row.created_at).toLocaleDateString('ar-SA')}</td><td><button className="icon" onClick={e=>{e.stopPropagation();navigate(`/beneficiaries/${row.id}`)}}><Eye size={17}/></button></td></tr>)}</tbody></table></div>}
    </section>
  </main>
}
