import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {AsrService} from './backend/asr-service.mjs';
import {handleAsr} from './backend/asr-http.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const asr=new AsrService(root);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.wav':'audio/wav','.mp3':'audio/mpeg','.md':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(await handleAsr(req,res,url,asr))return;
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
server.listen(Number(process.env.PORT||4317),'127.0.0.1',()=>console.log('AI伴听 → http://127.0.0.1:'+server.address().port));
server.on('close',()=>asr.close());
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{asr.close();server.close(()=>process.exit(0));});
