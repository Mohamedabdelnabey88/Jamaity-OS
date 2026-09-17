import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/lib/readWithDeadline.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {readWithDeadline}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('a read stalled before fetch times out and cancels without retry',async()=>{
 const controller=new AbortController();let calls=0;
 await assert.rejects(readWithDeadline(()=>{calls++;return new Promise(()=>{});},controller,10),{name:'TimeoutError'});
 assert.equal(controller.signal.aborted,true);assert.equal(calls,1);
});
test('successful reads and rejected reads settle without later cancellation',async()=>{
 const success=new AbortController();assert.equal(await readWithDeadline(()=>Promise.resolve(42),success,10),42);
 const failure=new AbortController();const error=new Error('network failed');
 await assert.rejects(readWithDeadline(()=>{throw error;},failure,10),e=>e===error);
 await new Promise(r=>setTimeout(r,20));
 assert.equal(success.signal.aborted,false);assert.equal(failure.signal.aborted,false);
});
test('unmount cancellation settles a read even when the transport ignores abort',async()=>{
 const controller=new AbortController();
 const pending=readWithDeadline(()=>new Promise(()=>{}),controller);
 controller.abort();
 await assert.rejects(pending,{name:'AbortError'});
});
test('already cancelled reads never start transport',async()=>{
 const controller=new AbortController();controller.abort();let calls=0;
 await assert.rejects(readWithDeadline(()=>{calls++;return Promise.resolve(1);},controller),{name:'AbortError'});
 assert.equal(calls,0);
});
