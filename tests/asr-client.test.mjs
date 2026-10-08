import test from 'node:test';
import assert from 'node:assert/strict';
import {transcribeVoice} from '../src/asr.js';
test('录音原样发送到同源本机接口，并使用真实转写结果',async()=>{
 const blob=new Blob(['recording'],{type:'audio/webm'});
 const result=await transcribeVoice(blob,{fetcher:async(url,options)=>{assert.equal(url,'/api/asr/transcribe');assert.equal(options.body,blob);assert.equal(options.headers['Content-Type'],'audio/webm');return new Response(JSON.stringify({text:'这是识别出来的想法。',provider:'local-whisper'}),{status:200});}});
 assert.equal(result.text,'这是识别出来的想法。');
});
test('识别服务失败会展示原因，不用示例文字填充用户原话',async()=>{
 await assert.rejects(transcribeVoice(new Blob(['x']),{fetcher:async()=>new Response(JSON.stringify({error:'模型尚未加载'}),{status:503})}),/模型尚未加载/);
});
test('安静录音返回空文字，不编造原话',async()=>{
 const result=await transcribeVoice(new Blob(['x']),{fetcher:async()=>new Response(JSON.stringify({text:'',noSpeech:true}),{status:200})});assert.equal(result.text,'');assert.equal(result.noSpeech,true);
});
