import test from 'node:test';
import assert from 'node:assert/strict';
import {initialGuide,advanceGuide,restoreGuide} from '../src/onboarding-state.js';
import {voiceLevel,VoiceMeter} from '../src/wave.js';

test('首次邀请、跳过和老用户互不混淆，刷新不会重复邀请',()=>{
 assert.equal(initialGuide(false).step,'welcome');
 assert.equal(initialGuide(true).step,'idle');
 const skipped=advanceGuide(initialGuide(false),{type:'dismiss'});
 assert.equal(restoreGuide(JSON.stringify(skipped),false,[]).step,'dismissed');
 assert.equal(restoreGuide('broken',true,[]).step,'idle');
});
test('只用真实播放和持久化成功推进，空操作不能完成引导',()=>{
 let s=advanceGuide(initialGuide(false),{type:'start'});
 assert.equal(s.step,'choose');
 s=advanceGuide(s,{type:'clicked-play'});assert.equal(s.step,'choose');
 s=advanceGuide(s,{type:'played'});assert.equal(s.step,'listen');
 s=advanceGuide(s,{type:'saved',persisted:false,id:'a'});assert.equal(s.step,'listen');
 s=advanceGuide(s,{type:'saved',persisted:true,id:'a'});assert.equal(s.step,'saved');
 s=advanceGuide(s,{type:'opened',id:'a'});assert.equal(s.step,'saved');
 s=advanceGuide(s,{type:'find'});assert.equal(s.step,'find');
 s=advanceGuide(s,{type:'opened',id:'other'});assert.equal(s.step,'find');
 s=advanceGuide(s,{type:'opened',id:'a'});assert.equal(s.step,'complete');
});
test('删除引导记录、刷新中断录音、未知版本有可恢复路径',()=>{
 const s={version:1,step:'saved',recordId:'gone'};
 assert.equal(restoreGuide(JSON.stringify(s),true,[]).step,'listen');
 assert.equal(restoreGuide(JSON.stringify({...s,step:'capture'}),true,[]).step,'listen');
 assert.equal(restoreGuide(JSON.stringify({...s,version:999}),true,[]).step,'idle');
});
test('麦克风能量随实际输入变化，静音和直流偏移不伪装成说话',()=>{
 const tone=a=>Float32Array.from({length:512},(_,i)=>Math.sin(i*.25)*a);
 assert.equal(voiceLevel(new Float32Array(512)),0);
 assert.equal(voiceLevel(new Float32Array(512).fill(.3)),0);
 assert(voiceLevel(tone(.1))>voiceLevel(tone(.015)));
 assert(voiceLevel(tone(1))<=1);
});
test('分析器只复用传入音轨，不停止录音；结束后释放节点和上下文',async()=>{
 let disconnected=0,closed=0,stopped=0;
 const stream={getTracks:()=>[{stop(){stopped++;}}]};
 class Context{state='running';createMediaStreamSource(value){assert.equal(value,stream);return {connect(){},disconnect(){disconnected++;}};}createAnalyser(){return {fftSize:512,disconnect(){disconnected++;},getFloatTimeDomainData(out){out.forEach((_,i)=>out[i]=Math.sin(i)*.1);}};}async close(){closed++;}}
 const meter=new VoiceMeter();await meter.attach(stream,Context);assert(meter.sample()>0);meter.detach();assert.equal(meter.sample(),0);assert.equal(stopped,0);assert.equal(disconnected,2);assert.equal(closed,1);
});
