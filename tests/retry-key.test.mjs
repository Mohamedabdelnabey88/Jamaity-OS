import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/lib/retryKey.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createRetryKey}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

test('lost response and manual retry reuse one operation reference',()=>{
 let sequence=0;
 const attempt=createRetryKey(()=>String(++sequence));
 const records=new Map();
 const payload={beneficiary:'synthetic',amount:125,type:'cash'};
 // The server persisted the first call, but its response never reached the UI.
 records.set(attempt.forPayload(payload),payload);
 records.set(attempt.forPayload({...payload}),payload);
 assert.equal(records.size,1);
 attempt.reset(); // A confirmed success permits a genuinely new operation.
 records.set(attempt.forPayload(payload),payload);
 assert.equal(records.size,2);
});
test('edited payload uses a different reference',()=>{
 let sequence=0;
 const attempt=createRetryKey(()=>String(++sequence));
 const first=attempt.forPayload({beneficiary:'A',amount:125});
 assert.notEqual(attempt.forPayload({beneficiary:'A',amount:150}),first);
 const second=attempt.forPayload({beneficiary:'A',amount:150});
 assert.notEqual(attempt.forPayload({beneficiary:'B',amount:150}),second);
});
