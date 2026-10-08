const steps=new Set(['welcome','idle','choose','listen','capture','saved','find','complete','dismissed']);
export const initialGuide=hasRecords=>({version:1,step:hasRecords?'idle':'welcome',recordId:null});
export function restoreGuide(raw,hasRecords,records){
 let value;try{value=JSON.parse(raw);}catch{}
 if(value?.version!==1||!steps.has(value.step))return initialGuide(hasRecords);
 const state={version:1,step:value.step,recordId:typeof value.recordId==='string'?value.recordId:null};
 if(state.step==='capture'||(['saved','find'].includes(state.step)&&!records.some(t=>t.id===state.recordId)))return {...state,step:'listen',recordId:null};
 return state;
}
export function advanceGuide(state,event){
 if(event.type==='dismiss')return {...state,step:'dismissed'};
 if(event.type==='start')return {...initialGuide(false),step:'choose'};
 if(['idle','welcome','dismissed','complete'].includes(state.step))return state;
 if(event.type==='played'&&state.step==='choose')return {...state,step:'listen'};
 if(event.type==='capture'&&['choose','listen'].includes(state.step))return {...state,step:'capture'};
 if(event.type==='cancel'&&state.step==='capture')return {...state,step:'listen'};
 if(event.type==='saved'&&event.persisted&&event.id&&['choose','listen','capture'].includes(state.step))return {...state,step:'saved',recordId:event.id};
 if(event.type==='find'&&state.step==='saved')return {...state,step:'find'};
 if(event.type==='opened'&&state.step==='find'&&state.recordId===event.id)return {...state,step:'complete'};
 return state;
}
