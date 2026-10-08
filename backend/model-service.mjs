import {readFile,writeFile,mkdir,rename,chmod} from 'node:fs/promises';
import path from 'node:path';
export class ModelService{
 constructor(root){this.file=path.join(root,'.local/model-config.json');this.config=null;this.loaded=false;}
 async load(){if(!this.loaded){try{this.config=JSON.parse(await readFile(this.file,'utf8'));}catch{}this.loaded=true;}return this.config;}
 async status(){const c=await this.load();return {configured:!!(c?.apiKey&&c?.enabled),baseUrl:c?.baseUrl||'',model:c?.model||'',hasKey:!!c?.apiKey,enabled:!!c?.enabled,jsonMode:c?.jsonMode!==false,verifiedAt:c?.verifiedAt||null};}
 async configure(input){
  const previous=await this.load();let url;try{url=new URL(input.baseUrl);}catch{throw Error('请填写有效的 API Base URL。');}
  if(url.username||url.password||url.search||url.hash||!(url.protocol==='https:'||url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('API 地址需使用 HTTPS；本机地址可使用 HTTP。');
  const model=String(input.model||'').trim(),apiKey=String(input.apiKey||previous?.apiKey||'').trim();
  if(!model||model.length>150||!apiKey||apiKey.length>1000||/[\r\n]/.test(apiKey))throw Error('请填写模型名称与有效的 API Key。');
  if(url.hostname.endsWith('.aliyuncs.com')&&url.pathname.replace(/\/$/,'')==='/api/v1')url.pathname='/compatible-mode/v1';
  const baseUrl=url.href.replace(/\/$/,'').replace(/\/chat\/completions$/,'');
  if(previous&&new URL(baseUrl).origin!==new URL(previous.baseUrl).origin&&!input.apiKey)throw Error('服务地址变更时请重新输入密钥，避免把旧密钥发送给新服务。');
  this.config={baseUrl,model,apiKey,enabled:input.enabled===true,jsonMode:input.jsonMode!==false};
  await mkdir(path.dirname(this.file),{recursive:true,mode:0o700});const temp=this.file+'.tmp';await writeFile(temp,JSON.stringify(this.config),{mode:0o600});await chmod(temp,0o600);await rename(temp,this.file);return this.status();
 }
 async test(){const r=await this.complete('仅输出 JSON 对象 {"ok":true}。这是连接测试，不含个人资料。',{});if(r.result.ok!==true)throw Error('模型未返回有效 JSON。');this.config.verifiedAt=new Date().toISOString();await writeFile(this.file,JSON.stringify(this.config),{mode:0o600});return {ok:true,model:r.model};}
 async complete(system,payload){
  const c=await this.load();if(!c?.enabled||!c?.apiKey)throw Error('请先在「设置与数据」配置并启用大模型 API。');
  let response;try{response=await fetch(c.baseUrl+'/chat/completions',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+c.apiKey,'Content-Type':'application/json'},body:JSON.stringify({model:c.model,messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(payload)}],...(c.jsonMode?{response_format:{type:'json_object'}}:{}),max_tokens:3000,stream:false,...(new URL(c.baseUrl).hostname==='api.deepseek.com'?{thinking:{type:'disabled'}}:{}),...(new URL(c.baseUrl).hostname.endsWith('.aliyuncs.com')&&/^qwen/.test(c.model)?{enable_thinking:false}:{})}),signal:AbortSignal.timeout(120000)});}catch(e){throw Error(e.name==='TimeoutError'?'模型响应超时，请稍后重试。':'无法连接模型服务，请检查 API 地址与网络。');}
  if(!response.ok){
   let failure;try{failure=await response.json();}catch{}
   const code=String(failure?.error?.code||failure?.code||'');
   if(/insufficient_quota|quota_exhausted/i.test(code))throw Error('服务商返回：该模型可用额度不足。请在服务商控制台查看额度；本应用不会自动开启付费。');
   if(response.status===404)throw Error('接口或模型不存在（404）。百炼请复制「OpenAI 兼容地址」，模型填 qwen-plus 等具体 ID。');
   if(response.status===401)throw Error('模型服务返回 HTTP 401：密钥无效或与当前地域、业务空间不匹配。');
   if(response.status===429)throw Error('模型请求过于频繁，请稍后重试。');
   throw Error(`模型服务返回 HTTP ${response.status}。请检查模型权限、额度或 JSON 模式支持情况。`);
  }
  let data;try{data=await response.json();}catch{throw Error('模型服务没有返回有效 JSON 响应。');}
  if(data.choices?.[0]?.finish_reason==='length')throw Error('模型结果被截断，请减少输入或更换模型后重试。');
  let content=data.choices?.[0]?.message?.content;if(typeof content!=='string'||content.length>60000)throw Error('模型未返回可用内容，请重试或检查接口兼容性。');
  content=content.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');try{return {result:JSON.parse(content),model:c.model};}catch{throw Error('模型未按 JSON 格式输出，请开启 JSON 模式或重试。');}
 }
}
