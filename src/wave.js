// The visual consumes energy only. Microphone ownership stays with the recorder.
export function voiceLevel(samples){
 if(!samples?.length)return 0;
 let mean=0;for(const x of samples)mean+=x;mean/=samples.length;
 let power=0;for(const x of samples)power+=(x-mean)**2;
 const rms=Math.sqrt(power/samples.length);
 return Math.min(1,Math.max(0,(rms-.006)/.16)**.65);
}
export class VoiceMeter{
 detach(){
  this.source?.disconnect();this.analyser?.disconnect();
  if(this.context)this.context.close().catch(()=>{});
  this.source=this.analyser=this.context=this.samples=null;
 }
 async attach(stream,Context=globalThis.AudioContext||globalThis.webkitAudioContext){
  this.detach();if(!Context)return false;
  let context;
  try{
   context=this.context=new Context();this.analyser=context.createAnalyser();this.analyser.fftSize=512;
   this.samples=new Float32Array(this.analyser.fftSize);
   this.source=context.createMediaStreamSource(stream);this.source.connect(this.analyser);
   // No connection to destination: never play the microphone through speakers.
   if(context.state==='suspended')await context.resume();
   return this.context===context;
  }catch{if(this.context===context)this.detach();return false;}
 }
 sample(){if(!this.analyser)return 0;this.analyser.getFloatTimeDomainData(this.samples);return voiceLevel(this.samples);}
}

export class RibbonWave{
 constructor(canvas){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.meter=new VoiceMeter();
  this.mode='idle';this.energy=0;this.phase=0;this.last=0;this.frame=0;this.disposed=false;
  this.motion=matchMedia('(prefers-reduced-motion: reduce)');
  this.resize=new ResizeObserver(()=>this.draw());this.resize.observe(canvas);
  this.visibility=()=>{cancelAnimationFrame(this.frame);this.last=0;if(!document.hidden)this.tick(performance.now());};
  document.addEventListener('visibilitychange',this.visibility);
  this.motionChange=()=>this.visibility();this.motion.addEventListener('change',this.motionChange);
  this.tick(performance.now());
 }
 async listen(stream){this.mode='listening';return this.meter.attach(stream);}
 rest(mode='idle'){this.meter.detach();this.mode=mode;}
 tick(now){
  if(this.disposed||document.hidden)return;
  this.frame=requestAnimationFrame(t=>this.tick(t));
  if(now-this.last<32)return;
  const dt=this.last?Math.min((now-this.last)/1000,.08):.032;this.last=now;
  if(!this.canvas.isConnected||!this.canvas.getClientRects().length)return;
  const input=this.mode==='listening'?this.meter.sample():0;
  this.energy+=(input-this.energy)*(1-Math.exp(-dt*(input>this.energy?18:6)));
  this.phase+=dt*(this.mode==='listening'?.35+this.energy*6:.32);
  // Static, lower-cost fallback under reduced motion; no continuous redraw.
  if(!this.motion.matches)this.draw();
 }
 draw(){
  const {canvas,ctx}=this;if(!ctx)return;
  const {width:w,height:h}=canvas.getBoundingClientRect();if(!w||!h)return;
  const dpr=Math.min(devicePixelRatio||1,2);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const reduced=this.motion.matches,p=reduced?1.2:this.phase;
  const energy=reduced?0:this.energy;
  const amplitude=h*(this.mode==='listening'?.075+energy*.42:.28);
  // Translucent ribbon surfaces, fine illuminated edges, no equalizer bars.
  const palette=[[215,104,66],[234,163,105],[154,174,133],[101,161,154],[211,142,105],[223,183,126],[116,143,110]];
  const points=Math.max(75,Math.round(w/3));
  for(let layer=0;layer<palette.length;layer++){
   const [r,g,b]=palette[layer],offset=layer*.68;
   const path=(reverse=false)=>{
    for(let i=0;i<=points;i++){
     const u=(reverse?points-i:i)/points;
     const envelope=Math.sin(Math.PI*u)**1.9;
     const wave=Math.sin(u*Math.PI*(3.3+energy*1.2)+p+offset)*.68+Math.sin(u*Math.PI*5-p*.65+offset)*.32;
     const thickness=(2+amplitude*.45)*envelope*(.55+.45*Math.sin(u*5+p+offset)**2);
     const x=w*u,y=h*.50+wave*amplitude*envelope+(reverse?thickness:-thickness)*.5;
     if(i===0&&!reverse)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
   };
   const fill=ctx.createLinearGradient(0,h*.25,w,h*.7);
   fill.addColorStop(0,`rgba(${r},${g},${b},0)`);fill.addColorStop(.3,`rgba(${r},${g},${b},.14)`);fill.addColorStop(.53,`rgba(${r},${g},${b},.38)`);fill.addColorStop(.76,`rgba(${r},${g},${b},.17)`);fill.addColorStop(1,`rgba(${r},${g},${b},0)`);
   ctx.beginPath();path();path(true);ctx.closePath();ctx.fillStyle=fill;
   ctx.shadowColor=`rgba(${r},${g},${b},.23)`;ctx.shadowBlur=9;ctx.fill();ctx.shadowBlur=0;
   const edge=ctx.createLinearGradient(0,0,w,0);
   edge.addColorStop(0,`rgba(${r},${g},${b},0)`);edge.addColorStop(.32,`rgba(${r},${g},${b},.65)`);edge.addColorStop(.55,'rgba(255,230,197,.9)');edge.addColorStop(.76,`rgba(${r},${g},${b},.52)`);edge.addColorStop(1,`rgba(${r},${g},${b},0)`);
   ctx.strokeStyle=edge;ctx.lineWidth=.85;ctx.beginPath();path();ctx.stroke();
  }
 }
 destroy(){this.disposed=true;cancelAnimationFrame(this.frame);this.meter.detach();this.resize.disconnect();document.removeEventListener('visibilitychange',this.visibility);this.motion.removeEventListener('change',this.motionChange);}
}
