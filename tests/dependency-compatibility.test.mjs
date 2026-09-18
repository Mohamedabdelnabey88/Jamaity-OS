import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter,Link,useLocation} from 'react-router-dom';
import ExcelJS from 'exceljs';
import BrowserExcelJS from 'exceljs/dist/exceljs.min.js';

function Location(){const location=useLocation();return React.createElement('span',null,location.pathname+location.search+location.hash);}
test('router retains Arabic query strings, beneficiary routes and campaign anchors',()=>{
 for(const path of ['/beneficiary/application?charity=fixture','/reports?from=2026-09-01','/charity/fixture#campaign-fixture']){
  const markup=renderToStaticMarkup(React.createElement(MemoryRouter,{initialEntries:[path]},React.createElement(Location)));
  assert.equal(markup,`<span>${path}</span>`);
 }
 const markup=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Link,{to:'/directory?city=أبها'},'الجمعيات')));
 assert.match(markup,/href="\/directory\?city=أبها"/);
});
test('ExcelJS source remains compatible with patched UUID for conditional formatting',async()=>{
 const workbook=new ExcelJS.Workbook();const sheet=workbook.addWorksheet('اختبار');sheet.addRow([75]);
 sheet.addConditionalFormatting({ref:'A1',rules:[{type:'dataBar',cfvo:[{type:'min'},{type:'max'}],color:{argb:'FF14544B'}}]});
 const bytes=await workbook.xlsx.writeBuffer();
 const restored=new ExcelJS.Workbook();await restored.xlsx.load(bytes);
 assert.equal(restored.worksheets[0].getCell('A1').value,75);
});
test('distributed browser ExcelJS serializes RTL Arabic sheets and numeric cells',async()=>{
 const workbook=new BrowserExcelJS.Workbook();const sheet=workbook.addWorksheet('التقرير',{views:[{rightToLeft:true}]});
 sheet.addRow(['المبلغ',75.25]);
 const bytes=await workbook.xlsx.writeBuffer();const restored=new ExcelJS.Workbook();await restored.xlsx.load(bytes);
 assert.equal(restored.worksheets[0].views[0].rightToLeft,true);
 assert.equal(restored.worksheets[0].getCell('A1').value,'المبلغ');assert.equal(restored.worksheets[0].getCell('B1').value,75.25);
});
