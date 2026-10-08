import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const run=promisify(execFile);
export class ContextService{
 constructor(root,catalog,asr){this.root=root;this.catalog=catalog;this.asr=asr;this.cache=new Map();this.queue=Promise.resolve();}
 has(id){return this.catalog.some(a=>a.id===id&&a.remote);}
 async get(id,position){
  const a=this.catalog.find(a=>a.id===id);if(!a?.remote)throw Error('此音频尚无上下文转写。');
  const end=Math.min(a.duration,Math.max(0,Math.floor(position))),start=Math.max(0,end-90);if(end<1)return {start,end,text:'',source:'audio-only'};
  const key=id+':'+end;if(this.cache.has(key))return this.cache.get(key);
  const task=this.queue.catch(()=>{}).then(async()=>{
   const dir=await mkdtemp(path.join(os.tmpdir(),'banting-context-'));
   try{const file=path.join(dir,'clip.wav');await run(process.env.BANTING_FFMPEG||'ffmpeg',['-v','error','-ss',String(start),'-i',path.join(this.root,'.local/podcasts',id+'.m4a'),'-t',String(end-start),'-vn','-ac','1','-ar','16000',file],{timeout:45000});const r=await this.asr.transcribe(file);return {start,end,text:r.text,source:'local-whisper',segments:r.segments.map(s=>({...s,start:s.start+start,end:s.end+start})),warning:'本机机器转写，可能有错字；如指代不明确可补充上下文。'};}finally{await rm(dir,{recursive:true,force:true});}
  });this.queue=task;this.cache.set(key,task);if(this.cache.size>100)this.cache.delete(this.cache.keys().next().value);try{return await task;}catch(e){this.cache.delete(key);throw e;}
 }
}
