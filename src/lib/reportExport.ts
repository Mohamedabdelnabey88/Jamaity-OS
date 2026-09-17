export type ReportCell = string | number | null;
export type ReportSection = { title: string; scope: string; headers: string[]; rows: ReportCell[][]; unavailable?: boolean };
const numeric = (value: unknown): ReportCell => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const text = (value: unknown) => value == null ? '' : String(value);

/** One snapshot feeds both the screen/print view and the exported workbook. */
export function reportSections(data: any): ReportSection[] {
 const scopes=data.scope||{};
 return [
  {title:'الملخص المالي',scope:'حركة الفترة · ر.س',headers:['المؤشر','القيمة'],rows:[['الإيرادات',numeric(data.financial?.revenue)],['المصروفات',numeric(data.financial?.expense)],['الفائض / العجز',numeric(data.financial?.surplus)]]},
  {title:'النشاط خلال الفترة',scope:'حسب صلاحيات الوحدات · التبرعات حسب تاريخ التبرع، والدعم حسب التنفيذ',headers:['المؤشر','العدد'],rows:[['الحالات المنشأة',numeric(data.period_activity?.cases_created)],['عمليات الدعم المنفذة',numeric(data.period_activity?.support_executed)],['التبرعات المستلمة',numeric(data.period_activity?.donations_received)]]},
  {title:'ميزان حركة الحسابات',scope:'حركة الفترة · ر.س · لا يتضمن الرصيد الافتتاحي',headers:['الكود','الحساب','مدين','دائن','صافي الحركة'],rows:(data.trial_balance||[]).map((x:any)=>[text(x.code),text(x.name_ar),numeric(x.debit),numeric(x.credit),numeric(x.balance)])},
  {title:'المؤشرات التشغيلية',scope:'الوضع الحالي عند إنشاء التقرير · لا يخضع لفلتر الفترة',headers:['المؤشر','القيمة'],unavailable:scopes.operational===false,rows:[['إجمالي المستفيدين',numeric(data.operational?.beneficiaries_total)],['الحالات المفتوحة',numeric(data.operational?.cases_open)],['الدعم المعلق',numeric(data.operational?.support_pending)],['طلبات المستفيدين المعلقة',numeric(data.operational?.beneficiary_requests_pending)],['أعضاء الفريق النشطون',numeric(data.operational?.team_active)],['التبرعات المستلمة التراكمية (ر.س)',numeric(data.operational?.donations_received_value)],['الدعم المنفذ التراكمي (ر.س)',numeric(data.operational?.support_value_executed)]]},
  {title:'الحوكمة الحالية',scope:'الوضع الحالي عند إنشاء التقرير · لا يخضع لفلتر الفترة',headers:['المؤشر','القيمة'],unavailable:scopes.governance===false,rows:[['المتطلبات',numeric(data.governance?.total)],['الجاهز',numeric(data.governance?.ready)],['المتأخر',numeric(data.governance?.overdue)],['المؤشر (%)',numeric(data.governance?.score)]]},
  {title:'أرصدة المخزون الحالية',scope:'الوضع الحالي عند إنشاء التقرير · لا يمثل رصيد نهاية الفترة',headers:['المستودع','الصنف','الوحدة','الرصيد الحالي'],unavailable:scopes.inventory===false,rows:(data.inventory_balances||[]).map((x:any)=>[text(x.warehouse_name),text(x.item_name),text(x.unit),numeric(x.on_hand)])},
 ];
}
export function reportDateTime(value: string) {
 return new Date(value).toLocaleString('ar-SA',{timeZone:'Asia/Riyadh',calendar:'gregory'});
}
export async function buildReportWorkbook(data: any, period: {from:string;to:string}) {
 const ExcelJS=(await import('exceljs')).default;
 const workbook=new ExcelJS.Workbook();
 workbook.creator='جمعيتي | Jamaity OS';
 workbook.created=new Date(data.generated_at);
 workbook.title='التقرير الإداري والمالي';
 for(const section of reportSections(data)) {
  const sheet=workbook.addWorksheet(section.title,{views:[{state:'frozen',ySplit:6,rightToLeft:true}],pageSetup:{paperSize:9,orientation:section.headers.length>3?'landscape':'portrait',fitToPage:true,fitToWidth:1,fitToHeight:0}});
  const columns=section.headers.length;
  sheet.columns=section.headers.map((_,i)=>({width:i===0?36:i===1?48:24}));
  const title=sheet.addRow([`${text(data.charity?.name)||'جمعيتي'} — ${section.title}`]);
  sheet.mergeCells(1,1,1,columns);title.height=34;title.font={name:'Arial',size:16,bold:true,color:{argb:'FFFFFFFF'}};title.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF14544B'}};
  sheet.addRow([`الفترة: ${period.from} إلى ${period.to} · توقيت السعودية`]);sheet.mergeCells(2,1,2,columns);
  sheet.addRow([`وقت إنشاء البيانات: ${reportDateTime(data.generated_at)} (السعودية)`]);sheet.mergeCells(3,1,3,columns);
  sheet.addRow([section.scope]);sheet.mergeCells(4,1,4,columns);sheet.getRow(4).height=36;
  sheet.addRow([section.unavailable?'هذا القسم غير متاح لصلاحيات حسابك.':'غير متاح = بيانات محجوبة أو غير متوفرة، وليس صفرًا.']);sheet.mergeCells(5,1,5,columns);sheet.getRow(5).height=32;
  const heading=sheet.addRow(section.headers);heading.font={name:'Arial',bold:true,color:{argb:'FFFFFFFF'}};heading.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF226B60'}};heading.height=28;
  if(!section.unavailable) {
   for(const values of section.rows) {
    const row=sheet.addRow(values.map(v=>v??'غير متاح'));row.height=32;
    row.eachCell(cell=>{cell.font={name:'Arial',size:11};cell.alignment={horizontal:typeof cell.value==='number'?'left':'right',vertical:'middle',wrapText:true,readingOrder:'rtl'};if(typeof cell.value==='number')cell.numFmt='#,##0.00;[Red](#,##0.00);0.00';});
    if(row.number%2)row.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF0F6F4'}};
   }
   if(!section.rows.length){sheet.addRow(['لا توجد بيانات ضمن النطاق.']);sheet.mergeCells(7,1,7,columns);}
  }
  for(let r=2;r<=5;r++){sheet.getRow(r).font={name:'Arial',size:11,color:{argb:'FF42534D'}};sheet.getRow(r).alignment={horizontal:'right',vertical:'middle',wrapText:true};}
  if(section.rows.length&&!section.unavailable)sheet.autoFilter={from:{row:6,column:1},to:{row:sheet.rowCount,column:columns}};
  sheet.pageSetup.printTitlesRow='1:6';
  sheet.headerFooter.oddFooter='&Rجمعيتي&C&P / &N';
 }
 return workbook;
}
export async function downloadReportExcel(data: any,period: {from:string;to:string}) {
 const workbook=await buildReportWorkbook(data,period);
 const bytes=await workbook.xlsx.writeBuffer();
 const blob=new Blob([new Uint8Array(bytes)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');link.href=url;link.download=`jamaity-report-${period.from}-${period.to}.xlsx`;
 document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
