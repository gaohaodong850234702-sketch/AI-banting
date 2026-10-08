from pathlib import Path
import json
root=Path(__file__).resolve().parent.parent
p=root/'package.json';d=json.loads(p.read_text());d['name']='ai-banting-v02';d['version']='0.2.0';d['scripts']['prepare:podcasts']='.venv-asr/bin/python scripts/prepare-podcasts.py';d['scripts']['check']='node scripts/check.mjs';p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
p=root/'src/storage.js';p.write_text(p.read_text().replace('banting-media-v1','banting-media-v2'))
p=root/'index.html';p.write_text(p.read_text().replace('AI伴听 · 听见世界，也记住自己','AI伴听 V0.2 · 全真模拟版').replace('</head>','  <link rel="stylesheet" href="/src/memory.css">\n</head>'))
p=root/'server.mjs';s=p.read_text().replace("import {stat}","import {readFile,stat}");s=s.replace("const asr=new AsrService(root);", """const asr=new AsrService(root);
const catalog=JSON.parse(await readFile(path.join(root,'src/catalog.json'),'utf8'));
const model=new ModelService(root);
const contextService=new ContextService(root,catalog,asr);""");s=s.replace("const root=", "import {ModelService} from './backend/model-service.mjs';\nimport {ContextService} from './backend/context-service.mjs';\nimport {handleWorkflow,localRequest,json,readJson} from './backend/workflow-http.mjs';\nconst root=")
s=s.replace("if(await handleAsr(req,res,url,asr))return;", """if(await handleAsr(req,res,url,asr))return;
    if(await handleWorkflow(req,res,url,model,contextService))return;
    if(url.pathname==='/api/context'){
      if(!localRequest(req)){json(res,403,{error:'仅允许本机请求'});return;}
      if(req.method!=='POST'){json(res,405,{error:'Method not allowed'});return;}
      try{const input=await readJson(req);json(res,200,await contextService.get(input.audioId,Number(input.position)||0));}catch(e){json(res,400,{error:e.message});}return;
    }
    if(url.pathname.startsWith('/api/media/')){
      const id=url.pathname.split('/').at(-1);if(!localRequest(req)||!catalog.some(a=>a.id===id&&a.remote)){res.writeHead(404).end();return;}
      const file=path.join(root,'.local/podcasts',id+'.m4a');const info=await stat(file);
      const headers={'Content-Type':'audio/mp4','Accept-Ranges':'bytes','Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'};
      let start=0,end=info.size-1,status=200;
      if(req.headers.range){const m=/^bytes=(\\d+)-(\\d*)$/.exec(req.headers.range);if(!m||Number(m[1])>=info.size||(m[2]&&Number(m[2])<Number(m[1]))){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return;}start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),end):end;status=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;}
      res.writeHead(status,{...headers,'Content-Length':end-start+1});if(req.method==='HEAD')res.end();else createReadStream(file,{start,end}).pipe(res);return;
    }""")
s=s.replace('process.env.PORT||4317','process.env.PORT||4318').replace("console.log('AI伴听 →", "console.log('AI伴听 V0.2 →");p.write_text(s)
p=root/'src/app.js';s=p.read_text();s=s.replace("const KEY='banting-demo-v1';","const KEY='banting-demo-v2';")
start=s.index('const seed=');end=s.index('let state;',start);s=s[:start]+"const seed=()=>({version:2,audios:structuredClone(catalog),selected:catalog[0]?.id,positions:{},recognition:false,sessions:[],thoughts:[],revision:0,feedback:[]});\n"+s[end:];s=s.replace('state.version!==1','state.version!==2').replace('version:1,audios:[]','version:2,audios:[]')
s=s.replace("'player','settings'","'player','settings','journey','recall','review'")
s=s.replace("'V0.1 体验版'","'V0.2 全真模拟版'").replace('V0.1 体验版','V0.2 全真模拟版').replace('class="version">0.1','class="version">0.2')
s=s.replace("['home','home','此刻']", "['journey','leaf','求职体验路线'],['home','home','此刻']")
s=s.replace("['summary','summary','收听回顾']", "['recall','spark','问问过去的我'],['review','summary','阶段回顾'],['summary','summary','单次回顾']")
s=s.replace("settings:'设置与数据'","settings:'设置与数据',journey:'求职体验路线',recall:'问问过去的我',review:'阶段回顾'")
s=s.replace("settings:settings}[view]", "settings:settings,journey:()=>memory.journey(),recall:()=>memory.recall(),review:()=>memory.review()}[view]")
s=s.replace("import {icon}","import {createMemoryUI} from './memory.js';\nimport {icon}")
s=s.replace("const selected=", "const memory=createMemoryUI({getState:()=>state,save,render,navigate,toast,showDialog,closeDialog,detail,esc,time,catalog});\nconst selected=")
s=s.replace("if(!a.demo){const blob", "if(!a.demo&&!a.remote){const blob")
s=s.replace("a.demo?'示例音频':'本地音频'", "a.remote?'真实播客':a.demo?'示例音频':'本地音频'")
s=s.replace("a.demo?'伴听原创 · 合成语音示例':'本地音频 · 仅保存在当前浏览器'", "a.remote?'真实播客 · '+esc(a.author):a.demo?'伴听原创 · 合成语音示例':'本地音频 · 仅保存在当前浏览器'")
s=s.replace("${a.chapters?.length?", "${a.remote?memory.podcastNotes(a):a.chapters?.length?")
s=s.replace("${btn('delete-audio','移除此音频'", "${btn('delete-audio','移除此音频'")
s=s.replace("<div class=\"settings-list\">", "${memory.settings()}<div class=\"settings-list\">")
s=s.replace('关系标签与思考提要仍为本地规则整理，明确标注为「非 AI」。示例音频的内容摘要仍是预置内容。','启用大模型后，记录理解、历史关联、问题回忆和阶段回顾将使用真实 API。转写原始录音仍在本机进行。')
s=s.replace('音频与原始录音保存在浏览器，文字也保存在当前浏览器。本机 ASR 只在这台 Mac 上处理录音，识别后的临时文件自动删除。清除浏览器数据会移除记录。','原始录音与个人记录保存在本版浏览器空间；真实播客缓存在本机。启用大模型后，文字和相关音频转写会发送到你配置的模型服务。清除浏览器数据会移除个人记录。')
s=s.replace('恢复三段原创音频与两条示例思考。','恢复五期真实播客，个人思考从空白开始。').replace('恢复示例','恢复真实音频').replace('示例已恢复。','真实音频已恢复。')
s=s.replace("${state.thoughts.filter(t=>!t.demo).length} 条属于你的记录 · ${state.thoughts.filter(t=>t.demo).length} 条示例，陪你开始", "${state.thoughts.length} 条真实记录 · V0.2 独立空间")
s=s.replace("return `<section class=\"greeting\">", "return `${memory.banner()}<section class=\"greeting\">")
s=s.replace("if(capture&&!['stop-record'", "if(capture&&!['stop-record'")
s=s.replace(" switch(name){", " if(await memory.action(name,el))return;\n switch(name){")
s=s.replace("const form=e.target;try{", "const form=e.target;try{if(await memory.submit(form))return;")
s=s.replace("state.thoughts.push(createThought({audio:c.audio,position:c.position,text,sessionId:c.sessionId}));save();", "const thought=createThought({audio:c.audio,position:c.position,text,sessionId:c.sessionId});state.thoughts.push(thought);memory.changed(thought.id);save();memory.schedule(thought.id);")
s=s.replace("t.text=text;t.interpretation=interpret(text,t.context);save();render();detail(t.id);", "t.text=text;t.interpretation=null;memory.changed(t.id);save();memory.schedule(t.id);render();detail(t.id);")
s=s.replace("t.interpretation=interpret(result.text,t.context);", "t.interpretation=null;memory.changed(t.id);memory.schedule(t.id);")
s=s.replace("case'regenerate':{const t=state.thoughts.find(t=>t.id===id);t.interpretation=interpret(t.text,t.context);save();render();await detail(id);toast('已按本地规则重新整理，原话未改动。');break;}","case'regenerate':memory.schedule(id);break;")
s=s.replace("state.thoughts=state.thoughts.filter(t=>t.id!==id);save();", "state.thoughts=state.thoughts.filter(t=>t.id!==id);memory.changed(id);save();")
s=s.replace("state.thoughts=state.thoughts.filter(t=>t.audioId!==id);", "for(const t of thoughtsFor(id))memory.changed(t.id);state.thoughts=state.thoughts.filter(t=>t.audioId!==id);")
s=s.replace("state={version:2,audios:[],thoughts:[],sessions:[],positions:{},selected:null,recognition:false};", "state={version:2,audios:[],thoughts:[],sessions:[],positions:{},selected:null,recognition:false,revision:(state.revision||0)+1,feedback:[]};")
# Replace only interpretation panel inside detail; preserve original recording and editing controls.
start=s.index('<section class="interpretation">',s.index('async function detail'));end=s.index('<div class="modal-actions">',start);s=s[:start]+'${memory.thoughtPanel(t)}'+s[end:]
s=s.replace('前 45 秒上下文','前 90 秒上下文').replace('前 45 秒涉及的示例段落，未做逐字时间对齐。','上下文为机器转写或手动补充，可回听原音频核对。')
s=s.replace("t.interpretation?.relation||'思考'", "t.ai?.items?.[0]?.kind||'思考'")
s=s.replace('演示版未接入大模型，不对你的认知或成长打分。','跨音频的 AI 总结请进入「阶段回顾」。这里保留本次收听的原始表达。')
s=s.replace('尚未接入音频转写与内容摘要服务。可从下方记录回听对应音频。','每条思考保留当时的真实音频上下文。可从下方记录回听对应片段。')
s=s.replace('render();await loadAudio(selected());refreshAsrStatus();','render();await loadAudio(selected());refreshAsrStatus();memory.refresh();')
p.write_text(s)
p=root/'src/core.js';s=p.read_text().replace('end-45','end-90').replace('interpretation:interpret(text,context)','interpretation:null');p.write_text(s)
