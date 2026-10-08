// Isolated transport fixture for browser regression checks. Never a production fallback.
import http from 'node:http';import {mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {once} from 'node:events';import {ModelService} from '../backend/model-service.mjs';
const root=await mkdtemp(path.join(os.tmpdir(),'banting-browser-contract-'));
const fixture=http.createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;const input=JSON.parse(body),p=JSON.parse(input.messages[1].content),sys=input.messages[0].content;let result;
if(sys.includes('连接测试'))result={ok:true};else {const current=p.candidates.find(r=>r.id===p.currentId)||p.candidates[0],other=p.candidates.find(r=>r.id!==current.id),evidence=[{recordId:current.id,quote:current.text.slice(0,22)}];
if(sys.includes('最多3条'))result={links:other?[{recordId:other.id,relation:'补充',reason:'【自动化协议测试】仅验证关联展示与引用回跳',evidence:[...evidence,{recordId:other.id,quote:other.text.slice(0,22)}]}]:[]};
else result={items:[{kind:sys.includes('回答 question')?'回忆':sys.includes('回顾选定')?'观察':'观点',text:'【自动化协议测试】此结果只验证界面链路，不代表真实 AI 理解。',evidence}],gaps:[]};}
res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(result)}}]}));});
fixture.listen(14319,'127.0.0.1');await once(fixture,'listening');await new ModelService(root).configure({baseUrl:'http://127.0.0.1:14319',apiKey:'isolated-test-key',model:'browser-contract-fixture',enabled:true,jsonMode:true});
process.env.PORT='14318';process.env.BANTING_MODEL_CONFIG_DIR=root;await import('../server.mjs');
for(const signal of ['SIGINT','SIGTERM'])process.prependListener(signal,()=>{fixture.close();rm(root,{recursive:true,force:true});});
