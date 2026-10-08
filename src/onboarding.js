import {RibbonWave} from './wave.js';
import {initialGuide,advanceGuide,restoreGuide} from './onboarding-state.js';
const KEY='banting-guide-v1';

export function createOnboarding({snapshot,navigate,startListening,record,text,openThought}){
 const first=snapshot();let raw;try{raw=localStorage.getItem(KEY);}catch{}
 let state=restoreGuide(raw,first.thoughts.length>0,first.thoughts),lastKey='',target=null,targetSelector='',micStream=null,busy=false,notice='';
 const panel=document.createElement('aside');panel.id='banting-guide';panel.setAttribute('aria-label','伴听使用引导');
 panel.innerHTML='<div class="guide-visual"><canvas aria-hidden="true"></canvas></div><div class="guide-content"></div>';
 const visual=panel.querySelector('.guide-visual'),content=panel.querySelector('.guide-content');
 const wave=new RibbonWave(visual.querySelector('canvas'));
 const launcher=document.createElement('button');launcher.type='button';launcher.className='guide-launcher';launcher.setAttribute('aria-label','打开伴听使用帮助');
 launcher.innerHTML='<canvas aria-hidden="true"></canvas><span>使用帮助</span>';
 const idle=new RibbonWave(launcher.querySelector('canvas'));
 const welcome=document.createElement('dialog');welcome.id='guide-welcome';welcome.setAttribute('aria-labelledby','guide-welcome-title');
 welcome.innerHTML='<div class="welcome-wave"></div><div class="guide-eyebrow">听见世界，也记住自己</div><h2 id="guide-welcome-title">从一个想法开始。</h2><p>听一小段，留一句自己的想法。<br>让这条声波陪你走完第一次伴听。</p><div class="welcome-path"><span>听一段</span><i>→</i><span>留想法</span><i>→</i><span>找回来</span></div><button type="button" class="button dark full" data-guide-do="start">带我开始</button><button type="button" class="text-button welcome-skip" data-guide-do="dismiss">我自己逛逛</button>';
 document.body.append(panel,launcher,welcome);
 function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{/* Guide storage failure never blocks listening. */}}
 function event(type,extra={}){const next=advanceGuide(state,{type,...extra});if(next!==state){state=next;persist();}sync();}
 function setTarget(selector){
  targetSelector=selector;
  const next=selector?[...document.querySelectorAll(selector)].find(el=>el.getClientRects().length):null;
  if(target!==next){target?.classList.remove('guide-target');target=next;}target?.classList.add('guide-target');
  place();
 }
 function place(){
  if(panel.hidden||panel.classList.contains('guide-embedded'))return;
  const mobile=window.innerWidth<=760;
  panel.style.removeProperty('left');panel.style.removeProperty('top');panel.classList.toggle('guide-mobile',mobile);
  if(mobile||!target)return;
  const r=target.getBoundingClientRect(),box=panel.getBoundingClientRect();
  const player=document.querySelector('.mini-player')?.getBoundingClientRect();
  const bottom=player?.top||innerHeight;
  if(r.bottom<0||r.top>bottom)return;
  let x=r.right+18,y=r.top-25;
  if(x+box.width>innerWidth-16)x=r.left-box.width-18;
  if(x<16){x=Math.max(16,Math.min(r.left,innerWidth-box.width-16));y=r.top-box.height-18;}
  y=Math.max(12,Math.min(y,bottom-box.height-12));
  panel.style.left=x+'px';panel.style.top=y+'px';
 }
 function sync(){
  const s=snapshot(),inVoice=s.capture?.mode==='voice',inText=s.capture?.mode==='text';
  if(['saved','find'].includes(state.step)&&!s.thoughts.some(t=>t.id===state.recordId)){state={...state,step:'listen',recordId:null};persist();}
  const recordItem=s.thoughts.find(t=>t.id===state.recordId);
  const dialog=s.dialog;
  const embedded=dialog.open&&(inVoice||inText||s.capture?.mode==='processing'||dialog.dataset.kind==='detail');
  const active=!['idle','dismissed'].includes(state.step);
  const showWelcome=state.step==='welcome'&&!dialog.open;
  if(showWelcome){if(visual.parentElement!==welcome.querySelector('.welcome-wave'))welcome.querySelector('.welcome-wave').append(visual);if(!welcome.open)welcome.showModal();}
  else{if(welcome.open)welcome.close();if(visual.parentElement!==panel)panel.prepend(visual);}
  const parent=embedded?dialog:document.body;
  if(panel.parentElement!==parent)parent.prepend(panel);
  panel.classList.toggle('guide-embedded',embedded);panel.classList.toggle('guide-recording',inVoice);
  // The listening visual remains available even when the tutorial was dismissed.
  panel.hidden=showWelcome||(!active&&!inVoice)||(dialog.open&&!embedded);
  launcher.hidden=!panel.hidden||welcome.open||dialog.open;
  if(micStream&&!inVoice){micStream=null;wave.rest();}
  const key=JSON.stringify([state.step,state.recordId,s.view,s.capture?.mode,s.capture?.pending,s.capture?.error,embedded,recordItem?.workflow?.status,recordItem?.transcription?.status,!!recordItem?.ai,busy,notice,s.audios.length]);
  if(key!==lastKey){
   lastKey=key;
   let title='',description='',buttons='',anchor='';
   const button=(doWhat,label,secondary=false)=>`<button type="button" class="${secondary?'text-button':'button dark'}" data-guide-do="${doWhat}" ${busy?'disabled':''}>${label}</button>`;
   if(inVoice){
    title=s.capture.pending?'准备倾听':s.capture.error?'也可以先用文字':'正在听你说';
    description=s.capture.pending?'允许麦克风后，声波会跟随你的声音。':s.capture.error?'麦克风没有开启，文字记录同样有效。':'说完后，点击下方按钮保存。';
   }else if(inText){title='把此刻想到的，先留下。';description='一句话也可以。保存后会关联当时的音频。';}
   else if(s.capture?.mode==='processing'){title='录音已保存';description='正在本机转成文字，可以继续听。';}
   else if(state.step==='choose'){
    title='先听一小段。';description=s.audios.length?'从推荐片段开始，想到什么就随时记下。':'先导入一段音频，就能开始伴听。';
    buttons=s.audios.length?button('listen',busy?'正在打开…':'开始听一段'):button('import','导入音频');
    anchor=s.view==='journey'?'[data-action="journey-listen"]':'[data-action="continue"], [data-action="open-audio"]';
   }else if(['listen','capture'].includes(state.step)){
    title='刚才那句话，让你想到了什么？';description='点一下开始说，说完再点完成。也可以打字。';
    buttons=button('record','说说我的想法')+button('text','打字记下',true);anchor='[data-thought]';
   }else if(state.step==='saved'){
    const processing=recordItem?.transcription?.status==='processing';
    title=processing?'录音已保存，正在转文字。':'你的想法，已经收好了。';
    description=recordItem?.ai?'原话和 AI 理解分开展示。不准确的地方，你可以纠正。':recordItem?.workflow?.status==='failed'?'原话还在，AI 暂时没完成。可以稍后在记录里重试。':recordItem?.workflow?.status==='unconfigured'?'原话和音频位置都在。连接 AI 后，还能帮你理解。':'原话和当时的音频位置一起保留，可以随时回听。';
    buttons=button('find','去「我的思考」找找');
   }else if(state.step==='find'){
    title='以后，从这里找回来。';description='打开刚才的记录，看看原话和对应的音频。';buttons=button('open','打开刚才的想法');anchor='[data-nav="thoughts"]';
   }else if(state.step==='complete'){
    title='你已经会用了。';description='继续听吧。需要帮助时，再点一下声波。';buttons=button('dismiss','继续听');
   }else{title='让每个想法，都有迹可循。';description='听一段，留想法，再从「我的思考」里找回来。';buttons=button('start','重新体验引导');}
   content.innerHTML=`<div class="guide-top"><span class="guide-eyebrow">${inVoice?'正在记录':state.step==='complete'?'第一次伴听 · 已完成':'伴听 · 使用引导'}</span>${!inVoice&&!inText?'<button type="button" class="guide-close" data-guide-do="dismiss" aria-label="收起引导">×</button>':''}</div><div role="status" aria-live="polite"><h3>${title}</h3><p>${description}</p></div>${notice?'<p class="guide-notice" role="alert"></p>':''}${buttons?`<div class="guide-actions">${buttons}</div>`:''}`;
   if(notice)content.querySelector('.guide-notice').textContent=notice;
   setTarget(embedded?'':anchor);
  }else setTarget(embedded?'':targetSelector);
  if(panel.hidden)target?.classList.remove('guide-target');
  wave.draw();idle.draw();
 }
 async function handle(e){
  const action=e.target.closest('[data-guide-do]')?.dataset.guideDo;if(!action)return;
  e.stopPropagation();notice='';
  try{
   if(action==='dismiss'){event('dismiss');welcome.close();return;}
   if(action==='start'){state=initialGuide(false);event('start');welcome.close();navigate('journey');}
   if(action==='listen'){busy=true;sync();await startListening();}
   if(action==='import')document.querySelector('[data-action="import"]')?.click();
   if(action==='record')record();
   if(action==='text')text();
   if(action==='find'){event('find');if(snapshot().dialog.open)snapshot().dialog.close();navigate('thoughts');}
   if(action==='open')await openThought(state.recordId);
  }catch(error){notice=error.message||'暂时没有完成，请再试一次。';}
  finally{busy=false;sync();}
 }
 panel.addEventListener('click',handle);welcome.addEventListener('click',handle);
 welcome.addEventListener('cancel',e=>{e.preventDefault();event('dismiss');});
 launcher.addEventListener('click',()=>{state=initialGuide(false);lastKey='';persist();sync();});
 // Dialog close/open changes can happen without a page render (including Escape).
 const observer=new MutationObserver(()=>sync());observer.observe(first.dialog,{attributes:true,attributeFilter:['open']});
 window.addEventListener('resize',place);window.addEventListener('scroll',place,{passive:true,capture:true});
 window.visualViewport?.addEventListener('resize',place);
 window.addEventListener('pagehide',e=>{wave.rest();if(!e.persisted){wave.destroy();idle.destroy();observer.disconnect();}});
 window.addEventListener('pageshow',e=>{if(e.persisted){wave.visibility();idle.visibility();sync();}});
 persist();
 return {sync,event,async listen(stream){micStream=stream;const attached=await wave.listen(stream);if(!attached&&micStream===stream){notice='录音仍在进行，当前浏览器暂不支持实时声波。';lastKey='';sync();}},stop(){micStream=null;wave.rest();},getState:()=>({...state})};
}
