export async function localAsrStatus(){
 try{const response=await fetch('/api/asr/status',{cache:'no-store'});if(!response.ok)throw Error('接口不可用');return await response.json();}
 catch{return {ready:false,state:'offline',message:'无法连接本机识别服务，请运行 npm run dev。',provider:'local-whisper'};}
}
export async function transcribeVoice(blob,{fetcher=fetch,timeoutMs=155000}={}){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetcher('/api/asr/transcribe',{method:'POST',headers:{'Content-Type':blob.type||'audio/webm'},body:blob,signal:controller.signal});
  let result;try{result=await response.json();}catch{throw Error('识别服务没有返回有效结果，请保留录音后重试。');}
  if(!response.ok)throw Error(result.error||'语音识别失败，请稍后重试。');
  if(typeof result.text!=='string')throw Error('识别结果不完整，请重试。');
  return result;
 }catch(error){if(error.name==='AbortError')throw Error('识别等待超时，原始录音已保留，可稍后重试。');throw error;}
 finally{clearTimeout(timer);}
}
