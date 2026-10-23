import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

async function evaluator(){return import('../scripts/semantic-evaluation.mjs');}
const cases=[{id:'qa',workflow:'understand',input:{records:[{id:'a',text:'我还没有决定',createdAt:'2026-10-01'}],currentId:'a'},criteria:[{id:'negation',expectation:'保留未决定',critical:true}]}];
test('收集真实调用结果不自动给语义通过，保存模型和提示词版本',async()=>{
 const {collectEvaluation,summarizeEvaluation}=await evaluator();
 const report=await collectEvaluation(cases,async()=>({items:[],meta:{model:'configured-model',promptVersion:'v-test'}}));
 assert.equal(report.results[0].result.meta.model,'configured-model');assert.equal(report.results[0].assessment.scores.negation,null);
 assert.equal(summarizeEvaluation(report,cases).status,'pending');
});
test('关键项不通过不能被平均分掩盖，未署名或未评完不能宣称通过',async()=>{
 const {collectEvaluation,summarizeEvaluation}=await evaluator();
 const report=await collectEvaluation(cases,async()=>({items:[],meta:{model:'m',promptVersion:'p'}}));
 report.results[0].assessment.scores.negation=2;assert.equal(summarizeEvaluation(report,cases).status,'pending');
 report.results[0].assessment.reviewer='人工评审';report.results[0].assessment.reviewedAt='2026-10-23';
 assert.equal(summarizeEvaluation(report,cases).status,'pass');report.results[0].assessment.scores.negation=0;
 assert.equal(summarizeEvaluation(report,cases).status,'fail');
});
test('请求失败逐例记录且继续收集，协议失败不成为语义成功',async()=>{
 const {collectEvaluation,summarizeEvaluation}=await evaluator();let calls=0;
 const report=await collectEvaluation([...cases,{...cases[0],id:'second'}],async()=>{if(++calls===1)throw Error('连接失败');return {items:[],meta:{model:'m',promptVersion:'p'}};});
 assert.equal(calls,2);assert.equal(report.results[0].error,'连接失败');assert.equal(summarizeEvaluation(report,[...cases,{...cases[0],id:'second'}]).status,'fail');
});
test('空报告、未知评分及删掉评分项都不能通过',async()=>{
 const {collectEvaluation,summarizeEvaluation}=await evaluator();
 assert.throws(()=>summarizeEvaluation({results:[]}),/报告/);
 const report=await collectEvaluation(cases,async()=>({meta:{model:'m',promptVersion:'p'}}));
 report.results[0].assessment={reviewer:'人工',reviewedAt:'2026-10-23',scores:{negation:99}};
 assert.throws(()=>summarizeEvaluation(report,cases),/评分/);
 delete report.results[0].assessment.scores.negation;assert.equal(summarizeEvaluation(report,cases).status,'pending');
});
test('基线覆盖四工作流、说话人、否定条件、无依据、错误关联与变化边界',async()=>{
 const data=JSON.parse(await readFile(new URL('./fixtures/semantic-cases.json',import.meta.url),'utf8'));
 assert.equal(new Set(data.cases.map(c=>c.workflow)).size,4);assert.equal(new Set(data.cases.map(c=>c.id)).size,data.cases.length);
 const dimensions=new Set(data.cases.flatMap(c=>c.criteria.map(k=>k.id)));
 for(const id of ['speaker','negation','conditions','abstention','relation','change'])assert.ok(dimensions.has(id),id);
 assert.ok(data.cases.every(c=>c.criteria.length&&c.input.records.length));
});
test('删除案例、评分标准或修改输入不能让报告自证通过',async()=>{
 const {collectEvaluation,summarizeEvaluation}=await evaluator();
 const baseline=[{...cases[0],criteria:[...cases[0].criteria,{id:'speaker',expectation:'区分说话人',critical:true}]}];
 const report=await collectEvaluation(baseline,async()=>({meta:{model:'m',promptVersion:'p'}}));
 report.results[0].assessment={reviewer:'人工',reviewedAt:'2026-10-23',scores:{negation:0,speaker:2}};
 report.results[0].criteria=report.results[0].criteria.filter(c=>c.id!=='negation');
 assert.throws(()=>summarizeEvaluation(report,baseline),/基线/);
 const changed=await collectEvaluation(baseline,async()=>({meta:{model:'m',promptVersion:'p'}}));
 changed.results[0].input.records[0].text='已经决定';assert.throws(()=>summarizeEvaluation(changed,baseline),/基线/);
});
