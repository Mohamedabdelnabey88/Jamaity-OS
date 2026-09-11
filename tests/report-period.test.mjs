import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/lib/reportPeriod.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {reportPeriod}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('Saudi reporting dates include the complete final day and do not use browser timezone',()=>{
 const p=reportPeriod('2026-09-01','2026-09-30');
 assert.equal(new Date(p.p_from).toISOString(),'2026-08-31T21:00:00.000Z');
 assert.equal(p.p_to,'2026-09-30T23:59:59.999999+03:00');
});
test('report periods reject cleared, impossible and reversed dates',()=>{
 for(const [a,b] of [['','2026-09-30'],['2026-02-30','2026-03-01'],['2026-09-02','2026-09-01'],['wrong','wrong']])assert.throws(()=>reportPeriod(a,b));
 assert.doesNotThrow(()=>reportPeriod('2028-02-29','2028-02-29'));
});
