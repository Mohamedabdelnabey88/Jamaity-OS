import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import ExcelJS from 'exceljs';
const require=createRequire(import.meta.url);
const source=await readFile(new URL('../src/lib/reportExport.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace("import('exceljs')",`import(${JSON.stringify(pathToFileURL(require.resolve('exceljs')).href)})`);
const {reportSections,buildReportWorkbook}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const fixture={generated_at:'2026-09-17T10:00:00Z',charity:{name:'جمعية الاختبار'},financial:{revenue:0,expense:'75.25',surplus:-75.25},period_activity:{cases_created:null,support_executed:0,donations_received:null},trial_balance:[{code:'0010',name_ar:'=HYPERLINK("https://example.invalid")',debit:75.25,credit:0,balance:75.25}],scope:{operational:false,governance:false,inventory:false},operational:{beneficiaries_total:999},inventory_balances:[{item_name:'hidden item',on_hand:999}],beneficiary:{name:'private name'}};
test('report sections preserve zero, decimals, missing values and permission restrictions',()=>{
 const sections=reportSections(fixture);
 assert.equal(sections[0].rows[0][1],0);
 assert.equal(sections[0].rows[1][1],75.25);
 assert.equal(sections[1].rows[0][1],null);
 assert.equal(sections[3].unavailable,true);
 assert.equal(JSON.stringify(sections).includes('private name'),false);
});
test('Excel round trip preserves RTL, numeric values, leading zero codes and treats formula text as text',async()=>{
 const workbook=await buildReportWorkbook(fixture,{from:'2026-09-02',to:'2026-09-02'});
 const bytes=await workbook.xlsx.writeBuffer();
 const reopened=new ExcelJS.Workbook();await reopened.xlsx.load(bytes);
 assert.equal(reopened.worksheets.length,6);
 assert.equal(reopened.worksheets[0].getCell('B7').value,0);
 assert.equal(reopened.worksheets[0].getCell('B8').value,75.25);
 assert.equal(reopened.worksheets[1].getCell('B7').value,'غير متاح');
 assert.equal(reopened.worksheets[2].getCell('A7').value,'0010');
 assert.equal(reopened.worksheets[2].getCell('B7').type,ExcelJS.ValueType.String);
 assert.equal(reopened.worksheets[2].getCell('B7').value,fixture.trial_balance[0].name_ar);
 for(const sheet of reopened.worksheets){assert.equal(sheet.views[0].rightToLeft,true);assert.match(sheet.getCell('A2').value,/2026-09-02/);}
 for(const sheet of reopened.worksheets.slice(3)){assert.equal(sheet.rowCount,6);assert.match(sheet.getCell('A5').value,/غير متاح/);}
});

test('detail exports use server totals, keep applied filters and state their page boundary',async()=>{
 const detail={kind:'donations',page:2,page_size:50,total_rows:54,cash_amount_total:530,status:'pending',search:'REPORT',generated_at:'2026-09-18T10:00:00Z',charity:{name:'اختبار'},rows:[{reference:'0010',event_at:'2026-09-01T21:00:00Z',type:'in_kind',status:'pending',amount:null,quantity:1.125,unit:'كجم'}]};
 const sections=reportSections(detail);
 assert.equal(sections[0].rows[0][1],54);
 assert.equal(sections[0].rows[1][1],1);
 assert.equal(sections[0].rows[2][1],530);
 assert.match(sections[1].scope,/صفحة 2/);assert.match(sections[1].scope,/REPORT/);assert.match(sections[1].scope,/الصفحة المعروضة فقط/);
 assert.equal(sections[1].rows[0][0],'0010');assert.equal(sections[1].rows[0][4],null);assert.equal(sections[1].rows[0][5],1.125);
 const workbook=await buildReportWorkbook(detail,{from:'2026-09-02',to:'2026-09-02'});
 const bytes=await workbook.xlsx.writeBuffer();const restored=new ExcelJS.Workbook();await restored.xlsx.load(bytes);
 assert.equal(restored.worksheets.length,2);assert.equal(restored.worksheets[1].getCell('F7').value,1.125);
 assert.match(restored.worksheets[1].getCell('A5').value,/الصفحة المعروضة فقط/);
});
