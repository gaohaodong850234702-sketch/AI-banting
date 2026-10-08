import {BASE_PROMPT,TASK_PROMPTS,PROMPT_VERSION,selectMemories,validateResult} from './workflows.mjs';
export const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
export function localRequest(req){
 const host=req.headers.host;if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host||''))return false;
 return !req.headers.origin||req.headers.origin==='http://'+host;
}
export async function readJson(req){if(!String(req.headers['content-type']).startsWith('application/json'))throw Error('请发送 JSON 数据。');const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1500000)throw Error('记录过多，请缩小范围。');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString());}
function cleanRecord(r){if(!r||typeof r.id!=='string'||r.id.length>100||typeof r.text!=='string'||r.text.length>6000)throw Error('记录格式不正确。');return {id:r.id,text:r.text,correction:String(r.correction||'').slice(0,2000),createdAt:String(r.createdAt||'').slice(0,40),audioId:String(r.audioId||'').slice(0,100),position:Number(r.position)||0,demo:!!r.demo,context:r.context?{source:String(r.context.source||''),text:String(r.context.text||'').slice(0,12000)}:null};}
export async function handleWorkflow(req,res,url,model,contextService){
 if(!url.pathname.startsWith('/api/model/')&&!url.pathname.startsWith('/api/workflow/'))return false;
 if(!localRequest(req)){json(res,403,{error:'仅允许本机同源请求。'});return true;}
 try{
  if(url.pathname==='/api/model/config'){
   if(req.method==='GET')json(res,200,await model.status());else if(req.method==='POST')json(res,200,await model.configure(await readJson(req)));else json(res,405,{error:'Method not allowed'});return true;
  }
  if(req.method!=='POST'){json(res,405,{error:'Method not allowed'});return true;}
  if(url.pathname==='/api/model/test'){
   json(res,200,await model.test());return true;
  }
  const workflow=url.pathname.split('/').at(-1);if(!TASK_PROMPTS[workflow]){json(res,404,{error:'未知工作流'});return true;}
  const input=await readJson(req);if(!Array.isArray(input.records)||input.records.length>500)throw Error('最多处理 500 条记录，请缩小范围。');
  const records=input.records.map(cleanRecord).filter(r=>!r.demo&&r.text.trim());if(new Set(records.map(r=>r.id)).size!==records.length)throw Error('记录 ID 重复。');
  if(!records.length){json(res,200,{items:[],links:[],gaps:['目前没有可使用的真实文字记录，请先留下自己的想法。'],meta:{workflow,count:0,total:0,promptVersion:PROMPT_VERSION}});return true;}
  const current=records.find(r=>r.id===input.currentId);if(['understand','relate'].includes(workflow)&&!current)throw Error('找不到当前记录。');
  if(!(await model.status()).configured)throw Error('请先在「设置与数据」配置并启用大模型 API。');
  let sourceContext=current?.context;
  if(workflow==='understand'&&contextService.has(current.audioId))sourceContext=await contextService.get(current.audioId,current.position);
  const candidates=workflow==='understand'?[current]:selectMemories(records,String(input.question||current?.text||''));
  if(current&&!candidates.some(r=>r.id===current.id))candidates.unshift(current);
  const feedback=Array.isArray(input.feedback)?input.feedback.slice(-150).map(f=>({from:String(f.from),to:String(f.to),verdict:f.verdict==='rejected'?'rejected':'confirmed'})):[];
  const started=Date.now();const response=await model.complete(BASE_PROMPT+'\n'+TASK_PROMPTS[workflow],{currentId:current?.id,question:String(input.question||'').slice(0,2000),sourceContext:sourceContext?{speakerRole:'external_audio_not_user',...sourceContext}:null,candidates:candidates.map(({context,...r})=>r),currentUserRecord:current?{id:current.id,text:current.text,correction:current.correction}:null,feedback});
  const result=validateResult(workflow,response.result,candidates,current?.id);
  if(result.links)result.links=result.links.filter(l=>!feedback.some(f=>f.verdict==='rejected'&&((f.from===current.id&&f.to===l.recordId)||(f.to===current.id&&f.from===l.recordId))));
  json(res,200,{...result,...(workflow==='understand'?{context:sourceContext}:{}),meta:{workflow,model:response.model,promptVersion:PROMPT_VERSION,createdAt:new Date().toISOString(),elapsedMs:Date.now()-started,count:candidates.length,total:records.length,recordIds:candidates.map(r=>r.id),retrieval:records.length<=80?'全部真实记录':'词项匹配与最近记录候选'}});
 }catch(error){json(res,400,{error:error.message||'工作流未完成，请重试。'});}return true;
}
