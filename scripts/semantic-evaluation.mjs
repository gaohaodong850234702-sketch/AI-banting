// Evaluation orchestration only. Semantic judgements are supplied by a human.
import {isDeepStrictEqual} from 'node:util';
export async function collectEvaluation(cases,callWorkflow,onProgress=async()=>{}){
 if(!Array.isArray(cases)||!cases.length||new Set(cases.map(c=>c.id)).size!==cases.length)throw Error('评测案例为空或ID重复。');
 const report={schema:'banting-semantic-eval-v1',notice:'虚构评测输入；调用成功与引用通过不代表语义正确。评分必须由人工填写。',createdAt:new Date().toISOString(),expectedCaseIds:cases.map(c=>c.id),results:[]};
 for(const entry of cases){
  const row={caseId:entry.id,workflow:entry.workflow,input:structuredClone(entry.input),criteria:structuredClone(entry.criteria),assessment:{reviewer:'',reviewedAt:null,scores:Object.fromEntries(entry.criteria.map(c=>[c.id,null])),notes:''}};
  const start=Date.now();
  try{row.result=await callWorkflow(entry.workflow,entry.input);if(!row.result?.meta?.model||!row.result.meta.promptVersion)throw Error('响应缺少模型或提示词版本，不能形成可比较的评测。');}
  catch(error){row.error=error.message||'调用失败';}
  row.elapsedMs=Date.now()-start;report.results.push(row);await onProgress(report);
 }
 return report;
}
export function summarizeEvaluation(report,baseline){
 if(report.schema!=='banting-semantic-eval-v1'||!report.results?.length||!report.expectedCaseIds?.length)throw Error('评测报告格式不正确。');
 if(!Array.isArray(baseline)||!baseline.length)throw Error('需要固定评测基线，不能只依据报告内的标准。');
 const expected=new Map(baseline.map(c=>[c.id,c]));
 if(!isDeepStrictEqual(report.expectedCaseIds,baseline.map(c=>c.id)))throw Error('报告案例清单与固定基线不符。');
 for(const row of report.results){const original=expected.get(row.caseId);if(!original||row.workflow!==original.workflow||!isDeepStrictEqual(row.input,original.input)||!isDeepStrictEqual(row.criteria,original.criteria))throw Error('报告输入或评分标准与固定基线不符。');}
 const rows=report.results,ids=new Set(rows.map(r=>r.caseId));
 const incomplete=rows.length!==report.expectedCaseIds.length||ids.size!==rows.length||report.expectedCaseIds.some(id=>!ids.has(id));
 let pending=incomplete?1:0,failed=0,scored=0,total=0;const dimensions={};
 for(const row of rows){
  if(row.error){failed++;continue;}
  if(!Array.isArray(row.criteria)||!row.criteria.length)throw Error('评测报告缺少评分标准。');
  const a=row.assessment||{};let rowPending=!a.reviewer?.trim()||!a.reviewedAt,rowFailed=false;
  for(const criterion of row.criteria){
   const value=a.scores?.[criterion.id];
   if(value==null){rowPending=true;continue;}
   if(![0,1,2].includes(value))throw Error('评分只能是0、1、2或null（待评）。');
   total+=value;scored++;const d=dimensions[criterion.id]||(dimensions[criterion.id]={count:0,total:0});d.count++;d.total+=value;
   if(value===0||criterion.critical&&value<2)rowFailed=true;
  }
  if(rowPending)pending++;if(rowFailed)failed++;
 }
 const average=scored?total/scored:null;
 const status=failed?'fail':pending?'pending':average!==null&&average>=1.5?'pass':'fail';
 return {status,cases:rows.length,expectedCases:report.expectedCaseIds.length,failed,pending,average,dimensions:Object.fromEntries(Object.entries(dimensions).map(([id,d])=>[id,{count:d.count,average:d.total/d.count}]))};
}
