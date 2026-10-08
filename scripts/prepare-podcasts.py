"""Resolve public publisher media; keep originals private to this local experience."""
import concurrent.futures, hashlib, json, re, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
IDS=['68008da7cdd692da15e2b2f1','69c510ee852cf1b8bb01bb7f','6a9441c7f03e74ee6b023666','6a851ca85aeb2a5712e9105c','6ab1093293d5eb3bdc78c5b9']
TOPICS=['先试一次，再认识自己','把经历讲清楚','从焦虑走到准备','AI时代，我能拿出什么','实习中的沟通与反馈']
DIR=ROOT/'.local/podcasts';DIR.mkdir(parents=True,exist_ok=True)
def get_episode(pair):
 i,eid=pair;url='https://www.xiaoyuzhoufm.com/episode/'+eid
 html=subprocess.check_output(['curl','-fLsS','--max-time','45','--retry','2',url]).decode()
 e=json.loads(re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',html,re.S)[1])['props']['pageProps']['episode']
 assert e['media']['source']['mode']=='PUBLIC' and not e.get('isPrivateMedia')
 source=e['media']['source']['url']; file=DIR/(eid+'.m4a')
 # Chapter labels are navigational notes, never claimed as a transcript.
 notes=[]
 for line in e['description'].splitlines():
  m=re.search(r'(?<!\d)(\d{1,2}:\d{2}(?::\d{2})?)\s*(.+)',line)
  if m:
   nums=[int(v) for v in m[1].split(':')]; start=sum(v*60**n for n,v in enumerate(reversed(nums)))
   if 0<=start<e['duration']:notes.append({'start':start,'text':m[2].strip()})
 chosen=notes[:3] if i==1 else [n for n in notes if n['start'] in {776,1043,2514,3374,430,640,2561,2704,2018,2345,2573,1276,1609,1744,2376}][:4]
 if not chosen:chosen=notes[:3]
 if not file.exists():
  tmp=file.with_suffix('.part');subprocess.run(['curl','-fL','--max-time','600','--retry','3','-sS',source,'-o',str(tmp)],check=True);tmp.rename(file)
 assert file.stat().st_size==e['media']['size']
 item={'id':eid,'title':e['title'],'author':e['podcast']['title'],'kind':'播客','theme':['orange','green','purple','green','orange'][i], 'duration':e['duration'],'demo':False,'remote':True,'src':'/api/media/'+eid,'sourceUrl':url,'mediaUrl':source,'publishedAt':e['pubDate'],'imageUrl':e['podcast']['image']['picUrl'],'subtitle':TOPICS[i],'chapterKind':'publisher-notes','chapters':[], 'listeningPoints':chosen,'recommendedStart':chosen[0]['start'] if chosen else 0,'verifiedAt':'2026-10-03','bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}
 print(json.dumps({'id':eid,'title':e['title'],'duration':e['duration'],'points':chosen},ensure_ascii=False),flush=True)
 return item
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:items=list(pool.map(get_episode,enumerate(IDS)))
(ROOT/'src/catalog.json').write_text(json.dumps(items,ensure_ascii=False,indent=2))
(ROOT/'docs/真实音频来源.json').write_text(json.dumps(items,ensure_ascii=False,indent=2))
print('READY: five verified original audio files',flush=True)
