// Shared by browser request preparation and server-side candidate selection.
export const CANDIDATE_LIMIT=80;
export const MAX_REQUEST_BYTES=1500000;
const chronological=(a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))||String(a.id).localeCompare(String(b.id));
const usable=records=>records.filter(r=>!r.demo&&typeof r.text==='string'&&r.text.trim());
const normalize=value=>String(value).replace(/\s/g,'').toLowerCase();

function spread(records,limit){
 if(records.length<=limit)return records;
 if(limit===1)return records.slice(-1);
 return Array.from({length:limit},(_,i)=>records[Math.round(i*(records.length-1)/(limit-1))]);
}
export function selectMemories(records,query='',limit=CANDIDATE_LIMIT){
 if(!Number.isInteger(limit)||limit<1)throw new RangeError('候选数量必须是正整数。');
 const all=usable(records).sort(chronological);
 if(all.length<=limit)return all;
 const normalized=normalize(query);
 if(!normalized)return spread(all,limit);
 const grams=new Set(normalized.length===1?[normalized]:Array.from({length:normalized.length-1},(_,i)=>normalized.slice(i,i+2)));
 const scored=all.map(r=>{const value=normalize(r.text+' '+(r.correction||''));return {r,score:[...grams].reduce((n,w)=>n+Number(value.includes(w)),0)};})
  .filter(x=>x.score>0).sort((a,b)=>b.score-a.score||chronological(b.r,a.r));
 if(!scored.length)return spread(all,limit);
 const recent=Math.floor(limit/4),temporal=Math.floor(limit/4),chosen=new Map();
 for(const {r} of scored.slice(0,limit-recent-temporal))chosen.set(r.id,r);
 for(const r of recent?all.slice(-recent):[])chosen.set(r.id,r);
 const missing=limit-chosen.size;
 for(const r of spread(all.filter(r=>!chosen.has(r.id)),missing))chosen.set(r.id,r);
 return [...chosen.values()].sort(chronological);
}
export function filterMemories(records,{from='',to='',audioId=''}={}){
 for(const date of [from,to])if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))))throw Error('请选择有效日期。');
 if(from&&to&&from>to)throw Error('结束日期不能早于开始日期。');
 return usable(records).filter(r=>{
  if(audioId&&r.audioId!==audioId)return false;
  if(!from&&!to)return true;
  const timestamp=Date.parse(r.createdAt);if(!Number.isFinite(timestamp))return false;
  const day=new Date(timestamp+8*60*60*1000).toISOString().slice(0,10);
  return (!from||day>=from)&&(!to||day<=to);
 });
}
export function retrievalDescription(count,query='',limit=CANDIDATE_LIMIT){
 return count<=limit?'全部范围内记录':normalize(query)?'词项匹配、近期记录与时间补样':'按时间均匀抽样';
}
export function prepareMemoryRequest(records,{workflow,currentId,question='',scope={},feedback=[]}){
 if(!['understand','relate','recall','review'].includes(workflow))throw Error('未知工作流。');
 const all=usable(records),current=all.find(r=>r.id===currentId);
 if(['understand','relate'].includes(workflow)&&!current)throw Error('找不到当前记录。');
 if(workflow==='recall'&&!question.trim())throw Error('请先写下你的问题。');
 let scoped=workflow==='understand'?[current]:filterMemories(all,scope);
 if(workflow==='relate'&&!scoped.some(r=>r.id===currentId))scoped=[...scoped,current];
 if(!scoped.length)throw Error('这个范围内还没有文字记录，请调整日期或音频范围。');
 const query=workflow==='recall'?question:workflow==='relate'?current.text:'';
 let candidates=selectMemories(scoped,query);
 if(workflow==='relate'&&!candidates.some(r=>r.id===currentId)){
  candidates=selectMemories(scoped.filter(r=>r.id!==currentId),query,CANDIDATE_LIMIT-1).concat(current).sort(chronological);
 }
 const packed=candidates.map(r=>({id:r.id,text:r.text,createdAt:r.createdAt,...(r.audioId!==undefined?{audioId:r.audioId}:{}),...(r.position!==undefined?{position:r.position}:{}),...(r.correction?{correction:r.correction}:{}),...(workflow==='understand'&&r.context?{context:r.context}:{})}));
 const ids=new Set(candidates.map(r=>r.id));
 const body={records:packed,...(['understand','relate'].includes(workflow)?{currentId}:{}),...(workflow==='recall'?{question:question.trim()}:{}),feedback:feedback.filter(f=>ids.has(f.from)&&ids.has(f.to)).slice(-150)};
 if(new TextEncoder().encode(JSON.stringify(body)).length>MAX_REQUEST_BYTES)throw Error('本次记录内容过多，请缩小范围后重试。');
 return {body,coverage:{libraryTotal:all.length,scopeTotal:scoped.length,sentTotal:candidates.length,sampled:candidates.length<scoped.length,method:workflow==='understand'?'当前记录':retrievalDescription(scoped.length,query),scope:{...scope}}};
}
