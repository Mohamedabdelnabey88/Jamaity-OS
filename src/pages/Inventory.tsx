import{friendlyError}from'../lib/requests';
import{readWithDeadline}from'../lib/readWithDeadline';
import{FormEvent,useEffect,useMemo,useRef,useState,type ReactNode}from'react';
import{ArrowDownToLine,ArrowUpFromLine,Boxes,CheckCircle2,History,Layers3,PackagePlus,Plus,RefreshCw,Search,Warehouse,X}from'lucide-react';
import{supabase}from'../supabase';
import{can,getAccessState,type AccessState}from'../lib/rbac';

type Tab='overview'|'items'|'warehouses'|'movements';
type Modal='warehouse'|'item'|'movement'|null;
const movementLabels:Record<string,string>={receipt:'استلام',issue:'صرف',adjustment:'تسوية'};
const unitOptions=['وحدة','كرتون','صندوق','كيس','حبة','عبوة','كيلو','لتر'];

export default function Inventory(){
 const[access,setAccess]=useState<AccessState|null>(null),[items,setItems]=useState<any[]>([]),[balances,setBalances]=useState<any[]>([]),[moves,setMoves]=useState<any[]>([]),[warehouses,setWarehouses]=useState<any[]>([]);
 const[q,setQ]=useState(''),[tab,setTab]=useState<Tab>('overview'),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[modal,setModal]=useState<Modal>(null),[busy,setBusy]=useState(false);
 const mutationLock=useRef(false),readController=useRef<AbortController|null>(null);
 const manageable=Boolean(access&&can(access,'inventory.manage'));

 async function load(){
  readController.current?.abort();const controller=new AbortController();readController.current=controller;setLoading(true);setError('');
  try{await readWithDeadline(async()=>{
   const a=await getAccessState(true);if(controller.signal.aborted)return;setAccess(a);
   if(!a.charityId){setItems([]);setBalances([]);setMoves([]);setWarehouses([]);return}
   const[i,b,m,w]=await Promise.all([
    supabase.from('inventory_items').select('id,sku,name_ar,name_en,unit,is_active,created_at').eq('charity_id',a.charityId).order('created_at',{ascending:false}).limit(500),
    supabase.rpc('inventory_balances'),
    supabase.from('stock_movements').select('id,warehouse_id,item_id,movement_type,quantity,reference_type,notes,created_at,warehouses(name_ar),inventory_items(name_ar,sku,unit)').eq('charity_id',a.charityId).order('created_at',{ascending:false}).limit(250),
    supabase.from('warehouses').select('id,name_ar,name_en,is_active,created_at').eq('charity_id',a.charityId).order('created_at',{ascending:false}).limit(200)
   ]);
   if(i.error||b.error||m.error||w.error)throw i.error||b.error||m.error||w.error;
   if(controller.signal.aborted)return;
   setItems(i.data||[]);setBalances((b.data||[])as any[]);setMoves(m.data||[]);setWarehouses(w.data||[]);
  },controller)}catch(e){if(readController.current===controller)setError(friendlyError(e))}finally{if(readController.current===controller)setLoading(false)}
 }
 useEffect(()=>{void load();return()=>{readController.current?.abort();readController.current=null}},[]);

 const search=q.trim().toLowerCase();
 const filteredItems=useMemo(()=>items.filter(x=>!search||`${x.name_ar} ${x.name_en||''} ${x.sku||''} ${x.unit||''}`.toLowerCase().includes(search)),[items,search]);
 const filteredWarehouses=useMemo(()=>warehouses.filter(x=>!search||`${x.name_ar} ${x.name_en||''}`.toLowerCase().includes(search)),[warehouses,search]);
 const filteredBalances=useMemo(()=>balances.filter(x=>!search||`${x.item_name} ${x.sku||''} ${x.warehouse_name}`.toLowerCase().includes(search)),[balances,search]);
 const filteredMoves=useMemo(()=>moves.filter(x=>!search||`${x.inventory_items?.name_ar||''} ${x.inventory_items?.sku||''} ${x.warehouses?.name_ar||''} ${x.reference_type||''}`.toLowerCase().includes(search)),[moves,search]);
 const totalUnits=balances.reduce((n,x)=>n+Number(x.on_hand||0),0);
 const lowStock=balances.filter(x=>Number(x.on_hand||0)<=0).length;
 const activeItems=items.filter(x=>x.is_active);
 const activeWarehouses=warehouses.filter(x=>x.is_active);

 async function withMutation(key:string,fn:()=>Promise<void>){
  if(mutationLock.current)return;mutationLock.current=true;setBusy(true);setError('');setNotice('');
  try{await fn()}catch(e){setError(friendlyError(e))}finally{mutationLock.current=false;setBusy(false)}
 }

 async function createMaster(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(modal!=='warehouse'&&modal!=='item')return;
  const form=event.currentTarget;const fd=new FormData(form);
  await withMutation('create',async()=>{
   const nameAr=String(fd.get('nameAr')||'').trim(),nameEn=String(fd.get('nameEn')||'').trim(),sku=String(fd.get('sku')||'').trim(),unit=String(fd.get('unit')||'وحدة').trim();
   if(!nameAr)throw new Error('أدخل الاسم بالعربية.');
   if(modal==='item'&&!unit)throw new Error('حدد وحدة الصنف.');
   const fn=modal==='warehouse'?'create_warehouse':'create_inventory_item';
   const args=modal==='warehouse'?{p_name_ar:nameAr,p_name_en:nameEn||null}:{p_sku:sku||null,p_name_ar:nameAr,p_name_en:nameEn||null,p_unit:unit};
   const{error:rpcError}=await supabase.rpc(fn,args);if(rpcError)throw rpcError;
   const what=modal==='warehouse'?'المستودع':'الصنف';
   setModal(null);form.reset();await load();setNotice(`تم إنشاء ${what} بنجاح وأصبح ظاهرًا في القائمة.`);setTab(modal==='warehouse'?'warehouses':'items');
  });
 }

 async function createMovement(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const form=event.currentTarget;const fd=new FormData(form);
  await withMutation('movement',async()=>{
   const warehouseId=String(fd.get('warehouseId')||''),itemId=String(fd.get('itemId')||''),movementType=String(fd.get('movementType')||''),quantity=Number(fd.get('quantity')||0),notes=String(fd.get('notes')||'').trim();
   if(!warehouseId||!itemId)throw new Error('اختر المستودع والصنف.');
   if(!['receipt','issue'].includes(movementType))throw new Error('اختر نوع الحركة.');
   if(!Number.isFinite(quantity)||quantity<=0)throw new Error('أدخل كمية أكبر من صفر.');
   const r=await supabase.rpc('record_inventory_movement',{p_warehouse_id:warehouseId,p_item_id:itemId,p_movement_type:movementType,p_quantity:quantity,p_notes:notes||null});
   if(r.error)throw r.error;
   setModal(null);form.reset();await load();setNotice(movementType==='receipt'?'تم تسجيل الاستلام وتحديث الرصيد.':'تم تسجيل الصرف وتحديث الرصيد.');setTab('overview');
  });
 }

 function openModal(next:Exclude<Modal,null>){setError('');setNotice('');setModal(next)}

 return <main className="module-page inventory-page">
  <div className="module-head"><div><span className="eyebrow"><Boxes size={15}/> الموارد والمخزون</span><h1>إدارة المخزون</h1><p>الأصناف والمستودعات والأرصدة والحركات في مساحة تشغيل واحدة، مع عزل كامل لبيانات الجمعية وسجل تدقيق لكل حركة.</p></div><div className="hero-actions"><button className="secondary" disabled={busy||!manageable} onClick={()=>openModal('warehouse')}><Warehouse size={17}/> مستودع جديد</button><button className="primary" disabled={busy||!manageable} onClick={()=>openModal('item')}><Plus size={17}/> صنف جديد</button><button className="secondary" disabled={busy||!manageable||!activeItems.length||!activeWarehouses.length} onClick={()=>openModal('movement')}><Layers3 size={17}/> حركة مخزون</button><button className="secondary" disabled={busy} onClick={()=>void load()}><RefreshCw size={17}/> تحديث</button></div></div>

  <section className="stats-grid">
   <Stat label="الأصناف النشطة" value={activeItems.length} hint={items.length!==activeItems.length?`${items.length-activeItems.length} غير نشط`:'جاهزة للاستخدام'}/>
   <Stat label="المستودعات" value={activeWarehouses.length} hint="مواقع التخزين النشطة"/>
   <Stat label="إجمالي الوحدات" value={totalUnits} hint="حسب الحركات المسجلة"/>
   <Stat label="أرصدة تحتاج انتباه" value={lowStock} hint="أرصدة صفرية أو سالبة"/>
  </section>

  <section className="inventory-commandbar">
   <div className="inventory-tabs" role="tablist" aria-label="أقسام المخزون">
    <TabButton active={tab==='overview'} onClick={()=>setTab('overview')} icon={<Boxes size={15}/>} label="الأرصدة"/>
    <TabButton active={tab==='items'} onClick={()=>setTab('items')} icon={<PackagePlus size={15}/>} label="الأصناف" count={items.length}/>
    <TabButton active={tab==='warehouses'} onClick={()=>setTab('warehouses')} icon={<Warehouse size={15}/>} label="المستودعات" count={warehouses.length}/>
    <TabButton active={tab==='movements'} onClick={()=>setTab('movements')} icon={<History size={15}/>} label="الحركات" count={moves.length}/>
   </div>
   <div className="search-box"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="ابحث داخل المخزون..."/></div>
  </section>

  {error&&<div className="error" role="alert">{inventoryError(error)}</div>}
  {notice&&<div className="permission-notice" role="status"><CheckCircle2 size={16}/>{notice}</div>}
  {!manageable&&<div className="security-note">حسابك يملك عرض الصفحة فقط ولا يملك صلاحية إدارة المخزون.</div>}

  {loading?<div className="loading">جاري تحميل بيانات المخزون...</div>:<>
   {tab==='overview'&&<section className="data-card"><div className="data-card-head"><div><strong>الأرصدة المستودعية</strong><span>الرصيد الناتج من حركات الاستلام والصرف</span></div><span><Warehouse size={14}/> {filteredBalances.length.toLocaleString('ar-SA')} رصيد</span></div>
    {!filteredBalances.length?<InventoryEmpty icon={<PackagePlus size={36}/>} title={items.length?'لا توجد أرصدة مسجلة بعد':'ابدأ بإضافة أول صنف'} text={items.length?'الأصناف موجودة، لكن يلزم تسجيل حركة استلام لتكوين رصيد فعلي.':'أنشئ صنفًا ومستودعًا ثم سجل أول حركة استلام.'} action={manageable&&items.length&&warehouses.length?<button className="primary" onClick={()=>openModal('movement')}><ArrowDownToLine size={16}/> تسجيل استلام</button>:undefined}/>:<div className="support-list">{filteredBalances.map(x=><article className="support-row" key={`${x.warehouse_id}-${x.item_id}`}><div className="support-icon"><Boxes/></div><div className="support-main"><b>{x.item_name}</b><span>{x.sku||'بدون SKU'} · {x.warehouse_name}</span><small>وارد {Number(x.receipts||0).toLocaleString('ar-SA')} · منصرف {Number(x.issues||0).toLocaleString('ar-SA')}</small></div><div className="support-value"><strong>{Number(x.on_hand||0).toLocaleString('ar-SA')}</strong> {x.unit||'وحدة'}</div><div className={'workflow '+(Number(x.on_hand||0)>0?'approved':'pending')}>{Number(x.on_hand||0)>0?'رصيد متاح':'يحتاج انتباه'}</div></article>)}</div>}
   </section>}

   {tab==='items'&&<section className="data-card"><div className="data-card-head"><div><strong>دليل الأصناف</strong><span>الصنف يظهر هنا فور إنشائه حتى لو لم يسجل له رصيد بعد</span></div><button className="secondary" disabled={!manageable} onClick={()=>openModal('item')}><Plus size={15}/> صنف جديد</button></div>
    {!filteredItems.length?<InventoryEmpty icon={<PackagePlus size={36}/>} title="لا توجد أصناف" text="أضف أول صنف مخزني وحدد وحدته ورمز SKU إن وجد." action={manageable?<button className="primary" onClick={()=>openModal('item')}><Plus size={16}/> إضافة صنف</button>:undefined}/>:<div className="table-wrap"><table><thead><tr><th>الصنف</th><th>SKU</th><th>الوحدة</th><th>الحالة</th><th>تاريخ الإنشاء</th></tr></thead><tbody>{filteredItems.map(x=><tr key={x.id}><td><b>{x.name_ar}</b>{x.name_en&&<small className="inventory-sub">{x.name_en}</small>}</td><td dir="ltr">{x.sku||'—'}</td><td>{x.unit}</td><td><span className={'status '+(x.is_active?'active':'inactive')}>{x.is_active?'نشط':'غير نشط'}</span></td><td>{new Date(x.created_at).toLocaleDateString('ar-SA')}</td></tr>)}</tbody></table></div>}
   </section>}

   {tab==='warehouses'&&<section className="data-card"><div className="data-card-head"><div><strong>المستودعات</strong><span>مواقع التخزين التابعة للجمعية</span></div><button className="secondary" disabled={!manageable} onClick={()=>openModal('warehouse')}><Warehouse size={15}/> مستودع جديد</button></div>
    {!filteredWarehouses.length?<InventoryEmpty icon={<Warehouse size={36}/>} title="لا توجد مستودعات" text="أنشئ مستودعًا قبل تسجيل أي حركة مخزون." action={manageable?<button className="primary" onClick={()=>openModal('warehouse')}><Plus size={16}/> إضافة مستودع</button>:undefined}/>:<div className="inventory-card-grid">{filteredWarehouses.map(x=><article className="inventory-warehouse-card" key={x.id}><span className="inventory-warehouse-icon"><Warehouse/></span><div><b>{x.name_ar}</b>{x.name_en&&<small>{x.name_en}</small>}<em>{new Date(x.created_at).toLocaleDateString('ar-SA')}</em></div><span className={'status '+(x.is_active?'active':'inactive')}>{x.is_active?'نشط':'غير نشط'}</span></article>)}</div>}
   </section>}

   {tab==='movements'&&<section className="data-card"><div className="data-card-head"><div><strong>سجل حركات المخزون</strong><span>استلام وصرف وتسويات مرتبطة بالعمليات</span></div><button className="secondary" disabled={!manageable||!activeItems.length||!activeWarehouses.length} onClick={()=>openModal('movement')}><Layers3 size={15}/> حركة جديدة</button></div>
    {!filteredMoves.length?<InventoryEmpty icon={<History size={36}/>} title="لا توجد حركات مخزون" text="سجل استلامًا أو صرفًا لبدء حركة الرصيد."/>:<div className="table-wrap"><table><thead><tr><th>الحركة</th><th>الصنف</th><th>المستودع</th><th>الكمية</th><th>المرجع</th><th>التاريخ</th></tr></thead><tbody>{filteredMoves.map(m=><tr key={m.id}><td><span className={'inventory-move '+m.movement_type}>{m.movement_type==='receipt'?<ArrowDownToLine size={14}/>:m.movement_type==='issue'?<ArrowUpFromLine size={14}/>:<Layers3 size={14}/>} {movementLabels[m.movement_type]||m.movement_type}</span></td><td><b>{m.inventory_items?.name_ar||'—'}</b><small className="inventory-sub">{m.inventory_items?.sku||'بدون SKU'}</small></td><td>{m.warehouses?.name_ar||'—'}</td><td>{Number(m.quantity).toLocaleString('ar-SA')} {m.inventory_items?.unit||''}</td><td>{m.reference_type||'—'}</td><td>{new Date(m.created_at).toLocaleString('ar-SA')}</td></tr>)}</tbody></table></div>}
   </section>}
  </>}

  {(modal==='item'||modal==='warehouse')&&<div className="modal-backdrop" onMouseDown={e=>{if(!busy&&e.currentTarget===e.target)setModal(null)}}><form className="modal inventory-modal" role="dialog" aria-modal="true" onSubmit={createMaster}><div className="modal-head"><div><b>{modal==='warehouse'?'إضافة مستودع':'إضافة صنف مخزني'}</b><span>{modal==='warehouse'?'أنشئ موقع تخزين تابعًا للجمعية.':'سيظهر الصنف فور الحفظ في دليل الأصناف حتى لو كان رصيده صفرًا.'}</span></div><button type="button" className="icon" disabled={busy} onClick={()=>setModal(null)} aria-label="إغلاق"><X size={17}/></button></div><fieldset className="inventory-modal-body" disabled={busy}><label>الاسم بالعربية<input name="nameAr" required autoFocus placeholder={modal==='warehouse'?'مثال: المستودع الرئيسي':'مثال: سلة غذائية'}/></label><label>الاسم بالإنجليزية <span className="optional">اختياري</span><input name="nameEn"/></label>{modal==='item'&&<><label>رمز الصنف SKU <span className="optional">اختياري</span><input name="sku" dir="ltr" placeholder="FOOD-001"/></label><label>وحدة القياس<select name="unit" defaultValue="وحدة">{unitOptions.map(x=><option key={x}>{x}</option>)}</select></label></>}<div className="modal-actions"><button type="button" className="secondary" disabled={busy} onClick={()=>setModal(null)}>إلغاء</button><button className="primary" disabled={busy}>{busy?'جاري الحفظ...':modal==='warehouse'?'حفظ المستودع':'حفظ الصنف'}</button></div></fieldset></form></div>}

  {modal==='movement'&&<div className="modal-backdrop" onMouseDown={e=>{if(!busy&&e.currentTarget===e.target)setModal(null)}}><form className="modal inventory-modal" role="dialog" aria-modal="true" onSubmit={createMovement}><div className="modal-head"><div><b>تسجيل حركة مخزون</b><span>الحركة ستحدث الرصيد فورًا وتُسجل في سجل التدقيق.</span></div><button type="button" className="icon" disabled={busy} onClick={()=>setModal(null)} aria-label="إغلاق"><X size={17}/></button></div><fieldset className="inventory-modal-body" disabled={busy}><label>نوع الحركة<select name="movementType" defaultValue="receipt"><option value="receipt">استلام / إضافة رصيد</option><option value="issue">صرف / خصم رصيد</option></select></label><label>المستودع<select name="warehouseId" required defaultValue=""><option value="" disabled>اختر المستودع</option>{activeWarehouses.map(x=><option value={x.id} key={x.id}>{x.name_ar}</option>)}</select></label><label>الصنف<select name="itemId" required defaultValue=""><option value="" disabled>اختر الصنف</option>{activeItems.map(x=><option value={x.id} key={x.id}>{x.name_ar}{x.sku?` — ${x.sku}`:''}</option>)}</select></label><label>الكمية<input name="quantity" type="number" min="0.001" step="0.001" required/></label><label>ملاحظات <span className="optional">اختياري</span><textarea name="notes" rows={3} placeholder="سبب الاستلام أو الصرف"/></label><div className="security-note">لن يسمح النظام بصرف كمية أكبر من الرصيد المتاح للصنف داخل المستودع المحدد.</div><div className="modal-actions"><button type="button" className="secondary" disabled={busy} onClick={()=>setModal(null)}>إلغاء</button><button className="primary" disabled={busy}>{busy?'جاري التسجيل...':'تسجيل الحركة'}</button></div></fieldset></form></div>}
 </main>
}

function TabButton({active,onClick,icon,label,count}:{active:boolean;onClick:()=>void;icon:ReactNode;label:string;count?:number}){return <button type="button" role="tab" aria-selected={active} className={active?'inventory-tab active':'inventory-tab'} onClick={onClick}>{icon}<span>{label}</span>{count!==undefined&&<small>{count.toLocaleString('ar-SA')}</small>}</button>}
function Stat({label,value,hint}:{label:string;value:number;hint:string}){return <article className="stat-card"><span>{label}</span><strong>{value.toLocaleString('ar-SA')}</strong><small>{hint}</small></article>}
function InventoryEmpty({icon,title,text,action}:{icon:ReactNode;title:string;text:string;action?:ReactNode}){return <div className="inventory-empty">{icon}<b>{title}</b><p>{text}</p>{action&&<div>{action}</div>}</div>}
function inventoryError(message:string){if(message.includes('insufficient_stock'))return'لا يمكن تنفيذ الصرف لأن الكمية المطلوبة أكبر من الرصيد المتاح.';if(message.includes('duplicate')||message.includes('unique'))return'يوجد سجل بنفس البيانات بالفعل. راجع رمز الصنف أو الاسم.';if(message.includes('permission'))return'ليس لديك صلاحية لإدارة المخزون.';return message}
