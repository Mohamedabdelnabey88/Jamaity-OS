import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/lib/publicSite.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {safeHttps,promotionText}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('public media and disclosure links reject executable and insecure schemes',()=>{
 for(const input of ['javascript:alert(1)','data:text/html,hi','http://example.com/x','//example.com/x','not a URL',null])assert.equal(safeHttps(input),undefined);
 assert.equal(safeHttps('https://example.com/report.pdf'),'https://example.com/report.pdf');
});
test('in-kind promotion requests delivery coordination rather than bank transfer',()=>{
 const text=promotionText('جمعية الاختبار','سلال غذائية','https://example.com/campaign',true);
 assert.ok(text.includes('تنسيق التسليم'));assert.ok(!text.includes('الحساب البنكي'));
});
