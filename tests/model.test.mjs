import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {once} from 'node:events';import {mkdtemp,rm,stat} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {ModelService} from '../backend/model-service.mjs';import {handleWorkflow} from '../backend/workflow-http.mjs';
let provider,server,root,base,model,mode='valid',calls=0,requests=[];
const records=[{id:'qa-a',text:'测试用记录：我想通过实习了解产品运营，但没有决定。',createdAt:'2026-10-01',audioId:'qa',position:30},{id:'qa-b',text:'测试用记录：今天模拟面试没讲清楚我的贡献。',createdAt:'2026-10-02',audioId:'qa',position:40}];
const item={kind:'观点',text:'协议测试结果，不代表真实模型理解',evidence:[{recordId:'qa-a',quote:'但没有决定'}]};
test.before(async()=>{
 root=await mkdtemp(path.join(os.tmpdir(),'banting-model-test-'));model=new ModelService(root);
 provider=http.createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;const input=JSON.parse(body);requests.push(input);calls++;if(mode==='failure'){res.writeHead(401).end('secret-provider-error');return;}const payload=JSON.parse(input.messages[1].content),system=input.messages[0].content;let result=system.includes('连接测试')?{ok:true}:system.includes('最多3条')?{links:[{recordId:'qa-b',relation:'补充',reason:'仅验证协议',evidence:[{recordId:'qa-a',quote:'但没有决定'},{recordId:'qa-b',quote:'我的贡献'}]}]}:{items:[{...item,kind:system.includes('回答 question')?'回忆':system.includes('回顾选定')?'观察':'观点'}],gaps:[]};if(mode==='bad-citation')result={items:[{...item,evidence:[{recordId:'made-up',quote:'假的'}]}]};res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(result)}}]}));});provider.listen(0,'127.0.0.1');await once(provider,'listening');
 server=http.createServer((req,res)=>handleWorkflow(req,res,new URL(req.url,'http://localhost'),model,{has:()=>false}));server.listen(0,'127.0.0.1');await once(server,'listening');base='http://127.0.0.1:'+server.address().port;
});
test.after(async()=>{server.closeAllConnections();provider.closeAllConnections();await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>provider.close(r))]);await rm(root,{recursive:true,force:true});});
async function post(route,body,headers={}){const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
test('未配置服务不能假装调用模型，空记忆不发出请求',async()=>{
 const a=await post('/api/workflow/understand',{records,currentId:'qa-a'});assert.equal(a.status,400);assert.match(a.data.error,/配置/);
 const b=await post('/api/workflow/recall',{records:[],question:'我的过去？'});assert.equal(b.status,200);assert.equal(calls,0);
});
test('配置密钥仅写本机0600，接口不读回；跨站不能改配置',async()=>{
 const input={baseUrl:'http://127.0.0.1:'+provider.address().port,apiKey:'qa-secret',model:'test-only',enabled:true,jsonMode:true};
 assert.equal((await post('/api/model/config',input,{Origin:'https://untrusted.invalid'})).status,403);
 const c=await post('/api/model/config',input);assert.equal(c.status,200);assert.equal(c.data.configured,true);assert.ok(!JSON.stringify(c.data).includes('qa-secret'));assert.equal((await stat(model.file)).mode&0o777,0o600);
 assert.equal((await post('/api/model/test',{})).data.ok,true);
});
test('四条工作流真实走HTTP调用与JSON校验，并保留调用范围',async()=>{
 for(const flow of ['understand','relate','recall','review']){const r=await post('/api/workflow/'+flow,{records,currentId:'qa-a',question:'测试问题'});assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.data.meta.model,'test-only');assert.equal(r.data.meta.workflow,flow);}
 assert.ok(requests.every(r=>r.response_format.type==='json_object'));
});
test('拒绝伪造引用和服务错误，不向用户泄露上游响应原文',async()=>{
 mode='bad-citation';const r=await post('/api/workflow/understand',{records,currentId:'qa-a'});assert.equal(r.status,400);assert.match(r.data.error,/引用/);
 mode='failure';const q=await post('/api/model/test',{});assert.match(q.data.error,/401/);assert.ok(!JSON.stringify(q).includes('secret-provider-error'));mode='valid';
});
test('用户否定的关联不会被再次返回',async()=>{
 const r=await post('/api/workflow/relate',{records,currentId:'qa-a',feedback:[{from:'qa-a',to:'qa-b',verdict:'rejected'}]});assert.deepEqual(r.data.links,[]);
});
