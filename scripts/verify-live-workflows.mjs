// Explicit synthetic QA inputs; never inserted into the user's browser memory.
import {mkdir,writeFile} from 'node:fs/promises';
const root=process.env.BANTING_URL||'http://127.0.0.1:4318';
const records=[
{id:'qa-live-a',text:'【功能验证的虚构场景】我以前觉得必须先确定职业方向才能找实习，但现在也许可以先做一个小项目。我还没有决定。',audioId:'68008da7cdd692da15e2b2f1',position:850,createdAt:'2026-10-01T08:00:00.000Z'},
{id:'qa-live-b',text:'【功能验证的虚构场景】我今天试做了一个小项目，发现我喜欢访谈用户，但还不能据此认定自己适合产品经理。',audioId:'69c510ee852cf1b8bb01bb7f',position:900,createdAt:'2026-10-02T08:00:00.000Z'},
{id:'qa-live-c',text:'【功能验证的虚构场景】我还是担心自己没有对口实习，不过准备面试时，我想先把项目中自己的实际贡献说清楚。',audioId:'6a9441c7f03e74ee6b023666',position:2704,createdAt:'2026-10-03T08:00:00.000Z'}
];
const results=[];
for(const workflow of ['understand','relate','recall','review']){
 const start=Date.now();const response=await fetch(root+'/api/workflow/'+workflow,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({records,currentId:workflow==='understand'?'qa-live-a':'qa-live-b',question:'我以前对于先选方向还是先尝试的想法是什么？现在有什么新反馈，哪些仍不确定？'}),signal:AbortSignal.timeout(230000)});const result=await response.json();if(!response.ok)throw Error(workflow+': '+result.error);
 results.push({workflow,result});console.log(JSON.stringify({workflow,status:response.status,model:result.meta?.model,elapsedMs:Date.now()-start,items:result.items?.length,links:result.links?.length,observations:result.items?.map(i=>i.text),relations:result.links?.map(l=>l.reason)}));
}
await mkdir('.local/qa',{recursive:true});await writeFile('.local/qa/live-workflows.json',JSON.stringify({notice:'Synthetic QA input, real API and real podcast ASR, not user memories',results},null,2));
