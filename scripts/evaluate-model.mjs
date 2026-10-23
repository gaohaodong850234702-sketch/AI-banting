import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {collectEvaluation,summarizeEvaluation} from './semantic-evaluation.mjs';

const [command,file]=process.argv.slice(2);
if(command==='collect'){
 const root=new URL(process.env.BANTING_URL||'http://127.0.0.1:4318');
 if(root.protocol!=='http:'||!['127.0.0.1','localhost'].includes(root.hostname)||root.username||root.password||root.search||root.hash||root.pathname!=='/')throw Error('BANTING_URL需为本机伴听服务根地址。');
 const request=async(route,input)=>{
  const r=await fetch(new URL(route,root),{...(input?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}:{}),signal:AbortSignal.timeout(230000)});
  const data=await r.json();if(!r.ok)throw Error(data.error||`HTTP ${r.status}`);return data;
 };
 const config=await request('/api/model/config');if(!config.configured)throw Error('请先在伴听设置页配置并启用真实模型。');
 const dataset=JSON.parse(await readFile(new URL('../tests/fixtures/semantic-cases.json',import.meta.url),'utf8'));
 const folder=path.resolve('.local/qa/semantic-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8));await mkdir(folder,{recursive:true});
 const target=path.join(folder,'assessment.json');
 console.log(`开始 ${dataset.cases.length} 个虚构案例的真实模型调用，将按已配置服务计费。`);
 const report=await collectEvaluation(dataset.cases,(workflow,input)=>request('/api/workflow/'+workflow,input),async report=>{
  report.datasetVersion=dataset.version;
  await writeFile(target+'.tmp',JSON.stringify(report,null,2));await rename(target+'.tmp',target);
  const last=report.results.at(-1);console.log(`${report.results.length}/${dataset.cases.length} ${last.caseId}: ${last.error?'调用失败':'已收集，待人工评分'}`);
 });
 console.log('待评分文件：'+target);console.log(JSON.stringify(summarizeEvaluation(report,dataset.cases),null,2));
 if(report.results.some(r=>r.error))process.exitCode=1;
}else if(command==='report'&&file){
 const report=JSON.parse(await readFile(file,'utf8'));
 const dataset=JSON.parse(await readFile(new URL('../tests/fixtures/semantic-cases.json',import.meta.url),'utf8'));
 if(report.datasetVersion!==dataset.version)throw Error('报告数据集版本与当前固定基线不符，请使用对应版本重新评分。');
 const result=summarizeEvaluation(report,dataset.cases);
 console.log(JSON.stringify(result,null,2));console.log('这里只评价该版本评测集；不代表所有真实场景的质量。');
 if(result.status!=='pass')process.exitCode=result.status==='pending'?2:1;
}else{
 console.log('收集真实模型结果（会调用已启用的服务）：npm run eval:model -- collect\n人工填写assessment.json中的评分、评审人和日期后：npm run eval:model -- report <assessment.json路径>\n评分：0=违背标准；1=部分满足；2=完整满足；null=待评。详见 docs/模型质量评测.md。');
 if(command&&command!=='--help')process.exitCode=1;
}
