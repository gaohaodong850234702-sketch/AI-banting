import {spawnSync} from 'node:child_process';
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
const audios=[
{id:'crossroads',title:'在人生的岔路口，允许自己慢一点',subtitle:'关于选择、试错，与不必着急的人生',kind:'播客',theme:'orange',author:'伴听电台',segments:[
'欢迎来到伴听电台。这是一段为产品演示创作的音频。今天，我们聊一聊人生的选择。有时候，我们急着找到一个正确答案，好像只要选对了方向，往后的路就会一帆风顺。但生活，往往比一张计划表复杂得多。',
'年轻的时候，最重要的可能不是一次做出正确选择，而是降低每一次选择的试错成本。去做一个小项目，去体验一份实习，去和真正从事这份工作的人聊聊。这些小小的行动，会比脑海中反复推演，更接近真实的答案。',
'我们总觉得，应该先想清楚自己适合什么，再开始行动。但也许顺序可以反过来。先做一点点，然后观察自己的感受。那些让你忘记时间的事情，那些遇到困难仍然想继续的事情，都在悄悄告诉你一些关于自己的线索。',
'当然，允许自己探索，并不是永远不做选择。你可以给自己一个时间窗口，记录每一次尝试带来的感受。过一段时间，回头看看，哪些东西仍然重要，哪些担心已经放下。方向，有时就是这样一点点浮现的。',
'如果此刻你也站在人生的岔路口，不妨先问自己：我能做的，最小的一次尝试是什么？不需要立刻回答所有问题。听到这里，你想到了什么？把它留下来吧。也许未来的你，会感谢现在这一刻的自己。'
]},
{id:'learning',title:'学到的东西，怎样才真正属于你？',subtitle:'从信息收藏，到主动思考',kind:'课程',theme:'green',author:'学习的另一面',segments:[
'这是一段关于主动学习的演示课程。收藏一篇文章，听完一期播客，并不等于掌握了其中的知识。我们常常把获得信息的满足感，误以为是学习本身。真正的理解，往往发生在我们开始用自己的话重新表达的时候。',
'下一次遇到一个有启发的观点，可以停下来问问自己：这和我已经知道的事情有什么关系？我有没有不同的经历？我能把它用在哪里？这些问题不一定有标准答案，但提问本身，会让知识和你的经验建立连接。',
'你也可以试试在一天结束时，回顾一条自己的想法。不需要把所有内容重新抄一遍，只要留下那一刻真实的反应。记住别人说了什么很有价值，记住你为什么被打动，同样值得。'
]},
{id:'review',title:'一次项目复盘：比答案更好的问题',subtitle:'把经历，慢慢变成自己的经验',kind:'会议',theme:'purple',author:'工作手记',segments:[
'这是一段虚构的项目复盘录音，供伴听演示使用。项目结束以后，我们通常会讨论目标有没有完成，哪些地方可以改善。今天想多问一个问题：整个过程中，有没有哪个判断，是我们后来才发现需要重新考虑的？',
'团队提出，最初大家忙着完善功能，却没有及时找用户验证。这不意味着之前的努力没有价值，而是提醒我们，下一次可以更早做一个小实验。把最不确定的问题先拿出来讨论，可能比做一份完美计划更有帮助。',
'最后，我们约定在下一轮开始前，各自记录一个最想验证的问题。复盘的目的不是评价谁对谁错，而是让下一次的行动，有一个更清楚的起点。现在再听到这段讨论，你有没有新的发现？'
]}
];
mkdirSync('/tmp/banting-audio',{recursive:true});
const run=(cmd,args)=>{const p=spawnSync(cmd,args,{encoding:'utf8'});if(p.status!==0)throw Error(p.stderr||cmd+' failed');return p.stdout;};
for(const a of audios){
let cursor=0;a.chapters=[];let paths=[];
for(let i=0;i<a.segments.length;i++){
const stem=`/tmp/banting-audio/${a.id}-${i}`;
run('/usr/bin/say',['-v','Tingting','-r','205','-o',stem+'.aiff',a.segments[i]]);
run('ffmpeg',['-y','-v','error','-i',stem+'.aiff','-ar','22050','-ac','1',stem+'.wav']);
const wav=readFileSync(stem+'.wav');let offset=12,byteRate=44100,dataSize=0;
while(offset+8<=wav.length){const type=wav.toString('ascii',offset,offset+4),size=wav.readUInt32LE(offset+4);if(type==='fmt ')byteRate=wav.readUInt32LE(offset+16);if(type==='data')dataSize=size;offset+=8+size+(size%2);}
const duration=dataSize/byteRate;
if(duration<=0)throw Error("macOS 语音合成未产生音频，请检查系统语音服务权限。");
a.chapters.push({start:cursor,end:cursor+duration,text:a.segments[i]});cursor+=duration;paths.push(`file '${stem}.wav'`);
}
writeFileSync(`/tmp/banting-audio/${a.id}.txt`,paths.join('\n'));
run('ffmpeg',['-y','-v','error','-f','concat','-safe','0','-i',`/tmp/banting-audio/${a.id}.txt`,'-c:a','libmp3lame','-b:a','80k',`public/audio/${a.id}.mp3`]);
a.duration=cursor;a.src=`/public/audio/${a.id}.mp3`;a.demo=true;delete a.segments;
console.log(a.id,Math.round(cursor)+'s');
}
writeFileSync('src/catalog.json',JSON.stringify(audios,null,2));
