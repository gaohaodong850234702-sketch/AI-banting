import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const port=14317;
let server;
test.before(async()=>{
 server=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:String(port),BANTING_ASR_PYTHON:'/nonexistent/asr-test-python'},stdio:['ignore','pipe','pipe']});
 let timer;try{await Promise.race([once(server.stdout,'data'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Server did not start')),5000);})]);}finally{clearTimeout(timer);}
});
test.after(()=>server?.kill());
test('ASR 状态明确提供模型就绪或失败状态，不能假装可用',async()=>{
 const response=await fetch(`http://127.0.0.1:${port}/api/asr/status`);
 assert.equal(response.status,200);
 const data=await response.json();assert.equal(typeof data.ready,'boolean');assert.equal(data.provider,'local-whisper');assert.equal(data.ready,false);
});
test('不支持的音频类型被拒绝',async()=>{
 const response=await fetch(`http://127.0.0.1:${port}/api/asr/transcribe`,{method:'POST',headers:{'Content-Type':'text/plain'},body:'not audio'});
 assert.equal(response.status,415);
});
test('空录音不会创建虚构转写',async()=>{
 const response=await fetch(`http://127.0.0.1:${port}/api/asr/transcribe`,{method:'POST',headers:{'Content-Type':'audio/webm'},body:new Uint8Array()});
 assert.equal(response.status,400);
});
test('跨站请求不能触发本机识别',async()=>{
 const response=await fetch(`http://127.0.0.1:${port}/api/asr/transcribe`,{method:'POST',headers:{'Content-Type':'audio/webm',Origin:'https://example.invalid'},body:new Uint8Array([1,2,3])});
 assert.equal(response.status,403);
});
