import http from 'node:http';
import {VERSION} from './src/version.js';
import {createReadStream} from 'node:fs';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {AsrService} from './backend/asr-service.mjs';
import {handleAsr} from './backend/asr-http.mjs';
import {ModelService} from './backend/model-service.mjs';
import {ContextService} from './backend/context-service.mjs';
import {handleWorkflow,localRequest,json,readJson} from './backend/workflow-http.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const asr=new AsrService(root);
const catalog=JSON.parse(await readFile(path.join(root,'src/catalog.json'),'utf8'));
const model=new ModelService(process.env.BANTING_MODEL_CONFIG_DIR||root);
const contextService=new ContextService(root,catalog,asr);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.wav':'audio/wav','.mp3':'audio/mpeg','.md':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(await handleAsr(req,res,url,asr))return;
    if(await handleWorkflow(req,res,url,model,contextService))return;
    if(url.pathname==='/api/context'){
      if(!localRequest(req)){json(res,403,{error:'仅允许本机请求'});return;}
      if(req.method!=='POST'){json(res,405,{error:'Method not allowed'});return;}
      try{const input=await readJson(req);json(res,200,await contextService.get(input.audioId,Number(input.position)||0));}catch(e){json(res,400,{error:e.message});}return;
    }
    if(url.pathname.startsWith('/api/media/')){
      const id=url.pathname.split('/').at(-1);if(!localRequest(req)||!catalog.some(a=>a.id===id&&a.remote)){res.writeHead(404).end();return;}
      const file=path.join(root,'.local/podcasts',id+'.m4a');const info=await stat(file);
      const headers={'Content-Type':'audio/mp4','Accept-Ranges':'bytes','Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'};
      let start=0,end=info.size-1,status=200;
      if(req.headers.range){const m=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!m||Number(m[1])>=info.size||(m[2]&&Number(m[2])<Number(m[1]))){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return;}start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),end):end;status=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;}
      res.writeHead(status,{...headers,'Content-Length':end-start+1});if(req.method==='HEAD')res.end();else createReadStream(file,{start,end}).pipe(res);return;
    }
    const name=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
    if(!['/index.html','/src/','/public/'].some(p=>name===p||p.endsWith('/')&&name.startsWith(p))){res.writeHead(404).end();return;}
    const file=path.resolve(root,'.'+name);
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    const info=await stat(file);if(!info.isFile())throw Error('Not a file');
    const headers={'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};
    if(req.headers.range){
      const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
      const start=match?Number(match[1]):NaN;const end=match&&match[2]?Math.min(Number(match[2]),info.size-1):info.size-1;
      if(!Number.isFinite(start)||start>end){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return;}
      res.writeHead(206,{...headers,'Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${info.size}`});
      createReadStream(file,{start,end}).pipe(res);
    }else{res.writeHead(200,{...headers,'Content-Length':info.size});if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);}
  }catch{res.writeHead(404).end('Not found');}
});
server.listen(Number(process.env.PORT||4318),'127.0.0.1',()=>console.log('AI伴听 '+VERSION+' → http://127.0.0.1:'+server.address().port));
server.on('close',()=>asr.close());
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{asr.close();server.close(()=>process.exit(0));});
