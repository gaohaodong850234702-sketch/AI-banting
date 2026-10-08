// Isolated browser contexts and explicit transport fixtures; never real user records or API calls.
// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs BROWSER_EXECUTABLE=/path/to/browser node scripts/verify-onboarding.mjs
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const base=process.env.BANTING_URL||'http://127.0.0.1:4318';
const folder='.local/qa/onboarding';await mkdir(folder,{recursive:true});
const errors=[];let workflowCalls=0;
async function fresh(width=1440,height=1000){
 const context=await browser.newContext({viewport:{width,height}});
 await context.route('**/api/model/**',route=>route.fulfill({json:{configured:false,hasKey:false}}));
 await context.route('**/api/workflow/**',route=>{workflowCalls++;return route.abort();});
 await context.route('**/api/asr/status',route=>route.fulfill({json:{ready:true,message:'自动化测试环境'}}));
 await context.route('**/api/asr/transcribe',route=>route.fulfill({json:{text:'【自动化测试】真实声波链路的测试录音。',provider:'test-fixture',noSpeech:false}}));
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base);await page.locator('#guide-welcome[open]').waitFor();return {context,page};
}
const guideState=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('banting-guide-v1')));
async function waitStep(page,step){await page.waitForFunction(expected=>JSON.parse(localStorage.getItem('banting-guide-v1')).step===expected,step);}
try{
 const {context,page}=await fresh();
 await page.screenshot({path:folder+'/welcome-desktop.png'});
 const wave=page.locator('#guide-welcome canvas');const a=await wave.screenshot();await page.waitForTimeout(450);assert.notDeepEqual(await wave.screenshot(),a,'待机波形应缓慢变化');
 await page.getByRole('button',{name:'带我开始',exact:true}).click();await waitStep(page,'choose');
 await page.locator('[data-guide-do="listen"]').click();await waitStep(page,'listen');
 await page.locator('[data-guide-do="text"]').click();
 await page.locator('#thought-text').fill('【自动化测试】这是一次隔离的引导体验。');
 // Force a durable-storage failure and verify no false success or lost draft.
 await page.evaluate(()=>{window.qaSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='banting-demo-v2')throw new DOMException('Test quota','QuotaExceededError');return window.qaSetItem.call(this,key,value);};});
 await page.locator('#thought-form button[type="submit"]').click();await page.waitForTimeout(100);
 assert.equal((await guideState(page)).step,'capture');assert.equal(await page.locator('#thought-text').inputValue(),'【自动化测试】这是一次隔离的引导体验。');
 await page.evaluate(()=>Storage.prototype.setItem=window.qaSetItem);
 await page.locator('#thought-form button[type="submit"]').click();await waitStep(page,'saved');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('banting-demo-v2')).thoughts.length),1);
 await page.reload();assert.equal(await page.locator('#guide-welcome[open]').count(),0);await waitStep(page,'saved');
 await page.locator('[data-guide-do="find"]').click();await waitStep(page,'find');
 await page.locator('[data-guide-do="open"]').click();await waitStep(page,'complete');
 assert.equal(await page.locator('#dialog #banting-guide').count(),1,'详情提示必须处于 dialog top layer 内');
 await page.screenshot({path:folder+'/complete-desktop.png'});
 await page.locator('#banting-guide [data-guide-do="dismiss"]').first().click();
 await page.locator('[data-action="close"]').first().click();await page.reload();
 assert.equal(await page.locator('#guide-welcome[open]').count(),0);
 // Old users with no guide metadata are not forced into a tutorial.
 await page.evaluate(()=>localStorage.removeItem('banting-guide-v1'));await page.reload();
 assert.equal(await page.locator('#guide-welcome[open]').count(),0);assert.equal((await guideState(page)).step,'idle');
 await context.close();

 const mobile=await fresh(390,844);
 await mobile.page.screenshot({path:folder+'/welcome-mobile.png'});
 await mobile.page.getByRole('button',{name:'带我开始',exact:true}).click();
 await mobile.page.locator('[data-guide-do="listen"]').click();await waitStep(mobile.page,'listen');
 await mobile.page.screenshot({path:folder+'/listening-mobile.png'});
 for(const width of [390,320]){
  await mobile.page.setViewportSize({width,height:844});
  assert.equal(await mobile.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const guideBox=await mobile.page.locator('#banting-guide').boundingBox(),playerBox=await mobile.page.locator('.mini-player').boundingBox();
  assert(guideBox.y+guideBox.height<=playerBox.y,'引导不得覆盖底部播放器');
 }
 await mobile.page.locator('[data-guide-do="record"]').click();
 await mobile.page.locator('#record-title').filter({hasText:'也可以'}).waitFor();
 await mobile.page.locator('[data-action="switch-text"]').first().click();
 await mobile.page.locator('#thought-text').fill('【自动化测试】权限拒绝后改用文字。');
 await mobile.page.locator('#thought-form button[type="submit"]').click();await waitStep(mobile.page,'saved');
 await mobile.context.close();

 const voice=await fresh();await voice.page.getByRole('button',{name:'我自己逛逛',exact:true}).click();
 // A real Web Audio stream with controlled energy; no access to the user's microphone.
 await voice.page.evaluate(()=>{
  window.qaMicCalls=0;Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{
   window.qaMicCalls++;const context=new AudioContext(),osc=context.createOscillator(),gain=context.createGain(),dest=context.createMediaStreamDestination();
   osc.frequency.value=240;gain.gain.value=.02;osc.connect(gain).connect(dest);osc.start();await context.resume();window.qaAudio={context,osc,gain,stream:dest.stream};return dest.stream;
  }});
 });
 await voice.page.locator('[data-thought]').first().click();await voice.page.locator('#record-title').filter({hasText:'正在听'}).waitFor();
 assert.equal(await voice.page.locator('#dialog .guide-recording').count(),1);
 const levels=await voice.page.evaluate(async()=>{
  const {VoiceMeter}=await import('/src/wave.js');const meter=new VoiceMeter();await meter.attach(window.qaAudio.stream);
  const wait=()=>new Promise(resolve=>setTimeout(resolve,180));
  window.qaAudio.gain.gain.value=0;await wait();const quiet=meter.sample();
  window.qaAudio.gain.gain.value=.03;await wait();const soft=meter.sample();
  window.qaAudio.gain.gain.value=.2;await wait();const loud=meter.sample();
  meter.detach();return {quiet,soft,loud};
 });
 assert(levels.quiet<.01&&levels.soft>levels.quiet&&levels.loud>levels.soft+.2,JSON.stringify(levels));
 await voice.page.screenshot({path:folder+'/recording-desktop.png'});
 await voice.page.evaluate(()=>{window.qaSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='banting-demo-v2')throw new DOMException('Test quota','QuotaExceededError');return window.qaSetItem.call(this,key,value);};});
 await voice.page.locator('[data-action="stop-record"]').click();
 await voice.page.getByRole('heading',{name:'录音还在，保存没有完成。'}).waitFor();
 await voice.page.evaluate(()=>Storage.prototype.setItem=window.qaSetItem);
 await voice.page.getByRole('button',{name:'重新保存录音',exact:true}).click();
 await voice.page.locator('.my-words').filter({hasText:'自动化测试'}).waitFor();
 assert.equal(await voice.page.evaluate(()=>JSON.parse(localStorage.getItem('banting-demo-v2')).thoughts.length),1,'重试保存不能重复创建记录');
 assert.equal(await voice.page.evaluate(()=>window.qaMicCalls),1);
 assert.equal(await voice.page.evaluate(()=>window.qaAudio.stream.getTracks().every(t=>t.readyState==='ended')),true);
 await voice.page.evaluate(()=>window.qaAudio.context.close());
 await voice.context.close();

 const reduced=await fresh();await reduced.page.emulateMedia({reducedMotion:'reduce'});
 await reduced.page.waitForTimeout(100);const staticWave=await reduced.page.locator('#guide-welcome canvas').screenshot();
 await reduced.page.waitForTimeout(400);assert.deepEqual(await reduced.page.locator('#guide-welcome canvas').screenshot(),staticWave);
 await reduced.context.close();
 assert.deepEqual(errors,[]);assert.equal(workflowCalls,0);
 console.log(JSON.stringify({passed:true,levels,workflowCalls,checks:['首次弹出与慢速待机','真实播放驱动推进','保存失败保留草稿','文字保存与找回','刷新及旧用户','390/320px 无溢出且不遮播放器','麦克风拒绝转文字','真实 Web Audio 能量响应','麦克风复用与结束释放','减少动态效果'],screenshots:folder},null,2));
}finally{await browser.close();}
