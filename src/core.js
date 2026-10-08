export const formatTime = value => { const n=Math.max(0,Math.floor(Number(value)||0));return `${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toString().padStart(2,'0')}`; };
export const escapeHTML = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function getContext(audio,position){
 const end=Math.min(Math.max(0,position),audio.duration||position),start=Math.max(0,end-45);
 const chapters=(audio.chapters||[]).filter(c=>c.start<end&&c.end>start);
 return {start,end,text:chapters.map(c=>c.text).join('\n'),source:chapters.length?'script':'audio-only'};
}
export function interpret(text,context){
 if(!text.trim())return {relation:'待整理',summary:'已保留原始语音。补充文字后，可以生成整理预览。',method:'rule'};
 const relation=/[?？]|怎么|为什么|如何/.test(text)?'疑问':/不同意|不认同|但是|不一定/.test(text)?'反思':/我以前|我之前|经历|实习/.test(text)?'个人经历':/想到|联想/.test(text)?'联想':/认同|同意|确实/.test(text)?'认同':'补充';
 const excerpt=text.trim().split(/[。\n]/).find(Boolean)||text;
 return {relation,summary:`你留下了一条${relation}：${excerpt.slice(0,100)}${excerpt.length>100?'…':'。'}${context.text?'可结合上方音频上下文再次回看。':'已绑定音频时间范围，尚无内容转写。'}`,method:'rule'};
}
export function createThought({audio,position,text='',voiceId=null,sessionId,now=new Date().toISOString(),id=crypto.randomUUID()}){
 const context=getContext(audio,position);
 return {id,audioId:audio.id,sessionId,position,context,rawText:text,text,voiceId,createdAt:now,interpretation:interpret(text,context),demo:false};
}
export function summaryMarkdown(audio,thoughts){
 const lines=[`# ${audio.title} · 我的收听回顾`,'','> 按原话与时间顺序整理，未接入生成式 AI。',''];
 for(const t of [...thoughts].sort((a,b)=>a.position-b.position)){lines.push(`## ${formatTime(t.position)} · ${t.interpretation?.relation||'思考'}`,'',`音频上下文（${formatTime(t.context.start)}–${formatTime(t.context.end)}；示例文稿按相交段落展示，非逐字时间对齐）：`,t.context.text||'尚未转写，可在应用中回听原音频。','',`我的表达：${t.text||'已保存原始语音，尚未转写。'}`,'');}
 if(!thoughts.length)lines.push('这次还没有留下思考。');
 return lines.join('\n');
}
