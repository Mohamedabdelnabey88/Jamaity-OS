import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/lib/requests.ts',import.meta.url),'utf8');
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {boundedFetch,friendlyError}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
test('preserves request body and does not retry successful mutations',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(input,init)=>{calls++;assert.equal(init.method,'POST');assert.equal(init.body,'{"x":1}');return new Response('ok');};
 try{assert.equal(await (await boundedFetch('https://example.invalid/rest/v1/rpc/save',{method:'POST',body:'{"x":1}'})).text(),'ok');assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
test('propagates caller cancellation',async()=>{
 const original=globalThis.fetch;const controller=new AbortController();
 globalThis.fetch=async(input,init)=>new Promise((resolve,reject)=>{if(init.signal.aborted)reject(init.signal.reason);else init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true});});
 try{const result=boundedFetch('https://example.invalid/rest/v1/test',{signal:controller.signal});controller.abort();await assert.rejects(result,{name:'AbortError'});}finally{globalThis.fetch=original;}
});
test('times out without automatically retrying writes',async()=>{
 const originals={fetch:globalThis.fetch,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};let calls=0;
 globalThis.setTimeout=(callback)=>{queueMicrotask(callback);return 1;};globalThis.clearTimeout=()=>{};
 globalThis.fetch=async(input,init)=>{calls++;return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true}));};
 try{await assert.rejects(boundedFetch('https://example.invalid/rest/v1/save',{method:'POST'}),{name:'TimeoutError'});assert.equal(calls,1);}finally{Object.assign(globalThis,originals);}
});
test('maps tenant mismatch to an actionable Arabic error',()=>{assert.equal(friendlyError({message:'charity_code_mismatch'}),'كود الجمعية لا يطابق الدعوة.');});
