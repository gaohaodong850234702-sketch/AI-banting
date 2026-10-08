import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import path from 'node:path';

export class AsrError extends Error {
  constructor(message,status=503){super(message);this.status=status;}
}
export class AsrService {
  constructor(root){this.root=root;this.pending=new Map();this.waiters=new Set();this.state='loading';this.message='正在加载本地语音识别模型…';this.start();}
  status(){return {provider:'local-whisper',model:'Whisper small',ready:this.state==='ready',state:this.state,message:this.message,offline:true};}
  start(){
    const python=process.env.BANTING_ASR_PYTHON||path.join(this.root,'.venv-asr','bin','python');
    this.worker=spawn(python,['-u',path.join(this.root,'backend','asr_worker.py')],{cwd:this.root,env:{...process.env,HF_HUB_OFFLINE:'1',HF_HUB_DISABLE_TELEMETRY:'1'},stdio:['pipe','pipe','pipe']});
    this.worker.on('error',()=>this.fail('本地 ASR 未安装或无法启动，请按项目说明安装后重启预览。'));
    this.worker.stdin.on('error',()=>this.fail('本地语音识别进程已停止，请重启预览。'));
    this.worker.on('exit',()=>{if(!['closed','failed'].includes(this.state))this.fail('本地语音识别进程已停止，请重启预览。');});
    this.worker.stderr.on('data',chunk=>console.error('[ASR]',chunk.toString().trim().slice(0,600)));
    createInterface({input:this.worker.stdout}).on('line',line=>{
      let data;try{data=JSON.parse(line);}catch{return;}
      if(data.type==='ready'){this.state='ready';this.message='本机识别已就绪 · 无需 API Key';for(const item of this.waiters){clearTimeout(item.timer);item.resolve();}this.waiters.clear();return;}
      if(data.type==='failed'){this.fail(data.error);return;}
      const request=this.pending.get(data.id);if(!request)return;
      clearTimeout(request.timer);this.pending.delete(data.id);
      if(data.error)request.reject(new AsrError(data.error,data.code==='too_long'?422:400));else request.resolve(data);
    });
  }
  fail(message){this.state='failed';this.message=message;for(const item of this.waiters){clearTimeout(item.timer);item.reject(new AsrError(message));}this.waiters.clear();for(const item of this.pending.values()){clearTimeout(item.timer);item.reject(new AsrError(message));}this.pending.clear();}
  async ready(){
    if(this.state==='ready')return;
    if(this.state!=='loading')throw new AsrError(this.message);
    return new Promise((resolve,reject)=>{const item={resolve,reject};item.timer=setTimeout(()=>{this.waiters.delete(item);reject(new AsrError('本地模型仍在加载，请稍后再试。'));},30000);this.waiters.add(item);});
  }
  async transcribe(file){
    await this.ready();if(this.pending.size>=2)throw new AsrError('本地识别正在处理其他录音，请稍后重试。',429);
    const id=crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.fail('识别超时，原始录音仍可保留。请重启预览后重试。');this.worker.kill();},120000);
      this.pending.set(id,{resolve,reject,timer});
      this.worker.stdin.write(JSON.stringify({id,path:file})+'\n');
    });
  }
  close(){this.state='closed';this.worker?.kill();for(const item of this.pending.values()){clearTimeout(item.timer);item.reject(new AsrError('预览服务已关闭。'));}this.pending.clear();for(const item of this.waiters){clearTimeout(item.timer);item.reject(new AsrError('预览服务已关闭。'));}this.waiters.clear();}
}
