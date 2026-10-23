import test from 'node:test';
import assert from 'node:assert/strict';
import {selectMemories} from '../backend/workflows.mjs';
import * as memory from '../src/memory.js';

const records=n=>Array.from({length:n},(_,i)=>({id:`r-${i}`,text:`第${i}条真实想法`,createdAt:new Date(Date.UTC(2025,0,1+i)).toISOString(),audioId:i%2?'one':'two'}));
test('80条全部纳入，81条仍覆盖首尾，500条无查询回顾覆盖每个时间十分位',()=>{
 assert.equal(selectMemories(records(80)).length,80);
 const boundary=selectMemories(records(81));assert.equal(boundary.length,80);assert.equal(boundary.at(-1).id,'r-80');
 const selected=selectMemories(records(500));assert.equal(selected.length,80);
 assert.equal(new Set(selected.map(r=>Math.floor(Number(r.id.slice(2))/50))).size,10);
 assert.equal(selected[0].id,'r-0');assert.equal(selected.at(-1).id,'r-499');
});
test('没有词项命中的查询同样保留中期记录，相关旧记录仍优先入选',()=>{
 const all=records(501),selected=selectMemories(all,'完全无关的检索词');
 assert.ok(selected.some(r=>r.id==='r-253'||Number(r.id.slice(2))>230&&Number(r.id.slice(2))<270));
 all[0].text='我想练习访谈用户';assert.ok(selectMemories(all,'访谈用户').some(r=>r.id==='r-0'));
});
test('候选上限为1时不会因为近期保底而超出限制，也不修改原数组',()=>{
 const all=records(100).reverse(),before=structuredClone(all);assert.equal(selectMemories(all,'',1).length,1);assert.deepEqual(all,before);
});
test('501条以上的单条理解只发送当前记录，并保留其补充和上下文',()=>{
 const all=records(501);all[500].correction='我还没有决定';all[500].context={text:'外部音频',source:'local-whisper'};
 const request=memory.prepareMemoryRequest(all,{workflow:'understand',currentId:'r-500'});
 assert.deepEqual(request.body.records,[all[500]]);assert.equal(request.coverage.libraryTotal,501);assert.equal(request.coverage.sentTotal,1);
});
test('500和501条关联均有界，范围外的当前记录始终保留，历史上下文不重复发送',()=>{
 for(const n of [500,501]){
  const all=records(n);all.forEach(r=>r.context={text:'嘉宾的话'});
  const request=memory.prepareMemoryRequest(all,{workflow:'relate',currentId:`r-${n-1}`,scope:{from:'2025-01-01',to:'2025-04-30',audioId:'one'}});
  assert.ok(request.body.records.length<=80);assert.ok(request.body.records.some(r=>r.id===`r-${n-1}`));
  assert.ok(request.body.records.filter(r=>r.id!==`r-${n-1}`).every(r=>r.audioId==='one'&&r.createdAt<'2025-05'));
  assert.ok(request.body.records.every(r=>!r.context));
 }
});
test('回忆按北京时间的日期和音频筛选，空范围与反向日期在调用前报错',()=>{
 const all=[{id:'a',text:'跨日记录',createdAt:'2026-10-01T16:00:00Z',audioId:'one'},{id:'b',text:'前一天',createdAt:'2026-10-01T15:59:59Z',audioId:'one'}];
 const request=memory.prepareMemoryRequest(all,{workflow:'recall',question:'我想过什么',scope:{from:'2026-10-02',to:'2026-10-02',audioId:'one'}});
 assert.deepEqual(request.body.records.map(r=>r.id),['a']);assert.equal(request.body.question,'我想过什么');assert.equal(request.coverage.scopeTotal,1);
 assert.throws(()=>memory.prepareMemoryRequest(all,{workflow:'recall',question:'问题',scope:{from:'2026-10-03',to:'2026-10-01'}}),/结束日期/);
 assert.throws(()=>memory.prepareMemoryRequest(all,{workflow:'recall',question:'问题',scope:{audioId:'missing'}}),/没有/);
});
test('阶段回顾独立于上一次提问，501条可抽样且明确标注覆盖范围',()=>{
 const request=memory.prepareMemoryRequest(records(501),{workflow:'review',question:'上一次的问题'});
 assert.equal(request.body.question,undefined);assert.equal(request.body.records.length,80);
 assert.equal(request.coverage.scopeTotal,501);assert.equal(request.coverage.sampled,true);assert.match(request.coverage.method,/时间/);
});
test('发送前按UTF-8字节检查大小，不能把超限请求交给服务端后才失败',()=>{
 const all=records(80).map(r=>({...r,text:'字'.repeat(6000),correction:'补'.repeat(2000)}));
 assert.throws(()=>memory.prepareMemoryRequest(all,{workflow:'review'}),/缩小范围/);
});
test('词项命中与近期记录不重叠时仍为中间时段保留候选',()=>{
 const all=records(500).map((r,i)=>({...r,text:i<60?'访谈用户':'其他问题'}));
 const selected=selectMemories(all,'访谈用户');assert.equal(selected.length,80);
 assert.equal(new Set(selected.map(r=>Math.floor(Number(r.id.slice(2))/50))).size,10);
});
