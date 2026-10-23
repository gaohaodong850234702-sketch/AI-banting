import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {handleWorkflow} from '../backend/workflow-http.mjs';
import {createMemoryUI} from '../src/memory.js';

async function invoke(route,body,model){
 const req=Readable.from([Buffer.from(JSON.stringify(body||{}))]);req.method=body===undefined?'GET':'POST';req.headers={host:'127.0.0.1:4318','content-type':'application/json'};
 const response={writeHead(status){this.status=status;return this;},end(value){this.data=JSON.parse(value);}};
 await handleWorkflow(req,response,new URL(route,'http://127.0.0.1:4318'),model,{has:()=>false});return response;
}
test('阶段回顾在服务端忽略遗留问题，避免按提问偏置时间抽样',async()=>{
 const records=Array.from({length:100},(_,i)=>({id:String(i),text:i<70?'职业方向':'别的想法',createdAt:new Date(Date.UTC(2026,0,i+1)).toISOString()}));let payload;
 const model={status:async()=>({configured:true}),complete:async(_system,input)=>{payload=input;return {result:{items:[],gaps:['记录不足以确认变化']},model:'protocol-test'};}};
 const response=await invoke('/api/workflow/review',{records,question:'职业方向'},model);
 assert.equal(response.status,200);assert.ok(!payload.question);assert.equal(response.data.meta.count,80);assert.match(response.data.meta.retrieval,/时间/);
});
test('501条记忆中的新记录可以完成理解及关联，使用真实处理器校验请求',async t=>{
 const state={thoughts:Array.from({length:501},(_,i)=>({id:String(i),text:'我还没有决定。',createdAt:new Date(Date.UTC(2025,0,i+1)).toISOString()})),revision:0,feedback:[]};const requests=[];
 const model={status:async()=>({configured:true}),complete:async(system,input)=>({model:'protocol-test',result:system.includes('最多3条')?{links:[]}:{items:[{kind:'态度',text:'仍未决定',evidence:[{recordId:input.currentId,quote:'还没有决定'}]}],gaps:[]}})};
 t.mock.method(globalThis,'fetch',async(url,options)=>{const body=options.body?JSON.parse(options.body):undefined;requests.push({url,body});const r=await invoke(url,body,model);return new Response(JSON.stringify(r.data),{status:r.status});});
 const oldDocument=globalThis.document,oldLocation=globalThis.location;
 globalThis.document={activeElement:null,querySelector:()=>null,addEventListener:()=>{}};globalThis.location={hash:'#journey'};
 t.after(()=>{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;if(oldLocation===undefined)delete globalThis.location;else globalThis.location=oldLocation;});
 const ui=createMemoryUI({getState:()=>state,save:()=>{},render:()=>{},toast:()=>{},catalog:[]});await ui.schedule('500');
 assert.equal(state.thoughts[500].workflow.status,'done');assert.equal(state.thoughts[500].ai.items.length,1);
 assert.equal(requests.find(r=>r.url.endsWith('/understand')).body.records.length,1);
 assert.ok(requests.find(r=>r.url.endsWith('/relate')).body.records.length<=80);
});
test('回忆表单的日期和音频限制进入请求，随后回顾不继承问题或筛选',async t=>{
 const state={thoughts:[{id:'a',text:'十月的想法',audioId:'one',createdAt:'2026-10-02T00:00:00Z'},{id:'b',text:'九月的想法',audioId:'two',createdAt:'2026-09-02T00:00:00Z'}],audios:[],revision:0,feedback:[]};const requests=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return new Response(JSON.stringify({items:[],gaps:['还没有足够依据'],meta:{count:1}}));});
 const ui=createMemoryUI({getState:()=>state,save:()=>{},render:()=>{},toast:()=>{},esc:String,catalog:[]});
 const form=(id,fields)=>({id,querySelector:selector=>({value:fields[selector]||''})});
 await ui.submit(form('recall-form',{'textarea':'想起什么','[name="scope-from"]':'2026-10-01','[name="scope-to"]':'2026-10-03','[name="scope-audio"]':'one'}));
 assert.deepEqual(requests[0].body.records.map(r=>r.id),['a']);assert.equal(state.reply.meta.coverage.scopeTotal,1);
 await ui.submit(form('review-form',{}));assert.equal(requests[1].body.question,undefined);assert.equal(requests[1].body.records.length,2);
 assert.match(ui.recall(),/name="scope-from"/);assert.match(ui.review(),/name="scope-audio"/);
});
test('直接调用后端关联也必须在80条内保留当前记录',async()=>{
 const records=Array.from({length:500},(_,i)=>({id:String(i),text:'访谈用户',createdAt:new Date(Date.UTC(2025,0,i+1)).toISOString()}));let seen;
 const model={status:async()=>({configured:true}),complete:async(_s,input)=>{seen=input;return {result:{links:[]},model:'protocol-test'};}};
 const response=await invoke('/api/workflow/relate',{records,currentId:'1'},model);
 assert.equal(response.status,200);assert.equal(seen.candidates.length,80);assert.ok(seen.candidates.some(r=>r.id==='1'));
});
test('纠正、编辑和刷新后的重新分析沿用已保存的关联范围',async t=>{
 const state={thoughts:[{id:'a',text:'当前想法',audioId:'one',createdAt:'2026-10-02',relationScope:{audioId:'one'}},{id:'b',text:'其他音频',audioId:'two',createdAt:'2026-10-01'}],revision:0,feedback:[]};const linked=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  if(url.endsWith('/config'))return new Response(JSON.stringify({configured:true}));
  if(url.endsWith('/relate'))linked.push(JSON.parse(options.body).records);
  return new Response(JSON.stringify({items:[],links:[],meta:{model:'test'}}));
 });
 const oldDocument=globalThis.document,oldLocation=globalThis.location;
 globalThis.document={activeElement:null,querySelector:()=>null,addEventListener:()=>{}};globalThis.location={hash:'#journey'};
 t.after(()=>{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;if(oldLocation===undefined)delete globalThis.location;else globalThis.location=oldLocation;});
 const ui=createMemoryUI({getState:()=>state,save:()=>{},render:()=>{},toast:()=>{},detail:()=>{},closeDialog:()=>{},catalog:[]});
 await ui.schedule('a');ui.changed('a');await ui.schedule('a');
 await ui.submit({id:'correction-form',dataset:{id:'a'},querySelector:()=>({value:'补充说明'})});await ui.schedule('a');
 assert.ok(linked.length>=3);assert.ok(linked.every(list=>list.every(r=>r.audioId==='one')));
});
