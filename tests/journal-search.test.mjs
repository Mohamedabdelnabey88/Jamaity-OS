import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/lib/journalSearch.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {journalSearchFilter}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('journal search quotes punctuation and embedded quotes as filter values',()=>{
 const query='x",status.eq.posted,(x';
 const filter=journalSearchFilter(query);
 assert.ok(filter.startsWith('description.ilike."%x\\",status.eq.posted,(x%"'));
 assert.ok(filter.endsWith('reference_type.ilike."%x\\",status.eq.posted,(x%"'));
});
test('journal search escapes SQL percent and underscore wildcards',()=>{
 assert.equal(journalSearchFilter('  10%_  '),'description.ilike."%10\\\\%\\\\_%",reference_type.ilike."%10\\\\%\\\\_%"');
});
