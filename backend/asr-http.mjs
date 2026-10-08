import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {AsrError} from './asr-service.mjs';
const MAX_BYTES=12*1024*1024;
const formats={'audio/webm':'.webm','video/webm':'.webm','audio/mp4':'.m4a','audio/x-m4a':'.m4a','audio/mpeg':'.mp3','audio/mp3':'.mp3','audio/wav':'.wav','audio/x-wav':'.wav','audio/ogg':'.ogg'};
export const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
export async function handleAsr(req,res,url,asr){
 if(!url.pathname.startsWith('/api/asr/'))return false;
 try{
  if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host||''))throw new AsrError('只允许通过 localhost 或 127.0.0.1 访问本机识别。',403);
  const expected=`http://${req.headers.host}`;
  if(req.headers.origin&&req.headers.origin!==expected)throw new AsrError('只允许当前伴听页面发起本机识别请求。',403);
  if(url.pathname==='/api/asr/status'&&req.method==='GET'){json(res,200,asr.status());return true;}
  if(url.pathname!=='/api/asr/transcribe'||req.method!=='POST')throw new AsrError('接口不存在或请求方式不正确。',405);
  const type=(req.headers['content-type']||'').split(';')[0].toLowerCase();const extension=formats[type];
  if(!extension)throw new AsrError('暂不支持这种音频格式。',415);
  if(Number(req.headers['content-length'])>MAX_BYTES)throw new AsrError('录音太大，请控制在 12 MB 以内。',413);
  const chunks=[];let total=0;
  for await(const chunk of req){total+=chunk.length;if(total>MAX_BYTES)throw new AsrError('录音太大，请控制在 12 MB 以内。',413);chunks.push(chunk);}
  if(!total)throw new AsrError('没有收到录音，请重新录制。',400);
  const folder=await mkdtemp(path.join(tmpdir(),'banting-asr-'));
  try{
    const file=path.join(folder,'recording'+extension);await writeFile(file,Buffer.concat(chunks),{mode:0o600});
    const result=await asr.transcribe(file);json(res,200,result);
  }finally{await rm(folder,{recursive:true,force:true});}
 }catch(error){if(!res.headersSent)json(res,error.status||500,{error:error.status?error.message:'识别服务暂时不可用，请保留录音后重试。'});}
 return true;
}
