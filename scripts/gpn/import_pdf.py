import re,json,unicodedata,fitz,difflib,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
PDF=fitz.open(sys.argv[1] if len(sys.argv)>1 else ROOT/'public/gpn-booklet.pdf')
issues=[]
def norm(s):return ' '.join(unicodedata.normalize('NFKC',s).split())
def page_text(n):
 page=PDF[n-1];chars=[c for b in page.get_text('rawdict')['blocks'] if 'lines'in b for l in b['lines'] for sp in l['spans'] if sp['font']!='Helvetica' for c in sp['chars']]
 lines=[]
 for c in sorted(chars,key=lambda c:c['origin'][1]):
  y=c['origin'][1]
  if not lines or y-lines[-1][0]>2:lines.append([y,[]])
  lines[-1][1].append(c)
 out=[]
 for y,cs in lines:
  if y<60 or y>page.rect.height-25:continue
  txt='';right=0
  for c in sorted(cs,key=lambda c:c['origin'][0]):
   if txt and c['bbox'][0]-right>1.5 and not txt.endswith(' '):txt+=' '
   txt+=c['c'];right=c['bbox'][2]
  if txt.strip() not in ['Sample Questions']:out.append(unicodedata.normalize('NFKC',txt).rstrip())
 return '\n'.join(out)
P={n:page_text(n) if 7<=n<=12 else '\n'.join(line for line in unicodedata.normalize('NFKC',PDF[n-1].get_text(sort=True)).splitlines() if line.strip() not in ['Sample Questions',str(n-4)]) for n in range(1,195)}
def pages(a,b):return '\n'.join(P[n] for n in range(a,b+1))
def numbered(s,count,pattern=r'(?m)^\s*(\d+)\)\s*'):
 matches=list(re.finditer(pattern,s));out={}
 for i,m in enumerate(matches):out[int(m[1])]=s[m.end():matches[i+1].start() if i+1<len(matches) else len(s)].strip()
 assert sorted(out)==list(range(1,count+1)),(count,sorted(out))
 return out
base={'source':'GPN DET Sample Questions - Full.pdf'}
# Extract all small banks afresh; never rely on a prior partial import.
words=numbered(pages(13,16).split('QUESTIONS',1)[1],500,r'(\d+)\)\s*')
rskeys=numbered(pages(164,166).split('READ AND SELECT')[1].split('FILL IN THE BLACK')[0],500,r'(\d+)\)\s*')
base['readSelect']=[{'number':n,'word':norm(v),'isReal':norm(rskeys[n])=='Yes'} for n,v in words.items()]
fbkeys=numbered(pages(166,167).split('FILL IN THE BLACK')[1].split('LISTEN AND TYPE')[0],60,r'(\d+)\)\s*')
fb=numbered(pages(17,19).split('QUESTIONS',1)[1],60,r'(\d+)\)\s*')
base['fillBlanks']=[]
for n,v in fb.items():
 v=norm(v);m=re.search(r'([A-Za-z]+)((?:\s*_)+)',v);word=norm(fbkeys[n]);shown=m[1]
 assert word.startswith(shown),(n,word,shown)
 base['fillBlanks'].append({'number':n,'before':v[:m.start()],'shown':shown,'missing':word[len(shown):],'word':word,'after':v[m.end():].replace(' .','.')})
 if m[2].count('_')!=len(word)-len(shown):issues.append({'location':f'Fill in the Blanks {n}','issue':'Printed underscore count differs from key spelling; boxes follow keyed word.'})
lt=numbered(pages(167,167).split('LISTEN AND TYPE')[1].split('INTERACTIVE READING')[0],60,r'(\d+)\)\s*')
base['listenType']=[{'number':n,'text':norm(v)} for n,v in lt.items()]
# Entire simple sections.
for bank,a,b in [('readAloud',23,24),('readThenSpeak',150,152),('writingSample',155,157),('speakingSample',158,160)]:
 text=pages(a,b).split('QUESTIONS',1)[1]
 text=text.split('RECORDING..')[0]
 rows=numbered(text,60 if bank=='readAloud' else 40,r'(\d+)\)\s*')
 base[bank]=[{'number':n,'prompt':norm(v)} for n,v in rows.items()]
# Interactive Writing: preserve every printed follow-up, even those ending in periods.
rows=numbered(pages(142,149).split('QUESTIONS',1)[1],40)
iw=[]
for n,v in rows.items():
 main,follow=re.split(r'Follow-up [Qq]uestions:',v,maxsplit=1)
 # Follow-ups each start on a new printed line, with predictable starters.
 followups=re.split(r'\n\s*(?=(?:Can |How |What |In your |Do |To what |Why |Should |Are |Is |Would |If |Does ))',follow.strip())
 followups=[norm(x) for x in followups if norm(x)]
 iw.append({'number':n,'prompt':norm(main),'followUps':followups,'followUp':followups[0]})
base['interactiveWriting']=iw
text=pages(192,193).split('LISTEN THEN SPEAK: QUESTIONS')[1].split('LISTEN THEN SPEAK: SCORED')[0]
base['listenThenSpeak']=[{'number':n,'prompt':norm(v)} for n,v in numbered(text,40).items()]
# Read and Complete: restore exactly the printed gaps using the answer text.
questions=numbered(pages(7,12).split('QUESTIONS',1)[1],40)
keys=numbered(pages(161,164).split('READ AND COMPLETE',1)[1].split('READ AND SELECT',1)[0],40)
rc=[]
for n,v in questions.items():
 v=norm(v);v=re.sub(r'^T\s*itle:\s*','',v);title,masked=v.split('. ',1)
 ans=re.sub(r'^T\s*itle:\s*','',norm(keys[n])).split('. ',1)[1]
 if n==10:
  ans += ' infinite density. Black holes can be found at the center of most galaxies, including our own Milky Way.'
  issues.append({'location':'Read and Complete 10','issue':'Printed answer truncates at point of; restored omitted ending from the question (density).'} )
 masked=re.sub(r'([A-Za-z]+)((?:\s*_)+)',lambda m:m[1]+'_'*m[2].count('_'),masked)
 # Align visible words and masks with the supplied complete answer passage.
 original=list(re.finditer(r'[A-Za-z]+_*',masked)); target=list(re.finditer(r'[A-Za-z]+',ans))
 a=[m[0].lower() for m in original];b=[m[0].lower() for m in target]
 def cost(x,y):
  if '_'in x:
   pre=x.rstrip('_');return 0 if len(x)==len(y) and y.startswith(pre) else 4
  return 0 if x==y else 2
 dp=[[0]*(len(b)+1) for _ in range(len(a)+1)]
 for i in range(1,len(a)+1):dp[i][0]=i
 for j in range(1,len(b)+1):dp[0][j]=j
 for i in range(1,len(a)+1):
  for j in range(1,len(b)+1):dp[i][j]=min(dp[i-1][j-1]+cost(a[i-1],b[j-1]),dp[i-1][j]+1,dp[i][j-1]+1)
 mapping={};i=len(a);j=len(b)
 while i or j:
  if i and j and dp[i][j]==dp[i-1][j-1]+cost(a[i-1],b[j-1]):mapping[i-1]=j-1;i-=1;j-=1
  elif i and dp[i][j]==dp[i-1][j]+1:i-=1
  else:j-=1
 parts=[];cursor=0;unmatched=[]
 for i,m in enumerate(original):
  if '_'not in m[0]:continue
  pre=m[0].rstrip('_');word=b[mapping[i]] if i in mapping else None
  if word is None or cost(m[0].lower(),word)!=0:
   # Source key omits some words; record every repair for manual source review.
   candidates={w for w in b if cost(m[0].lower(),w)==0}
   if len(candidates)==1:word=candidates.pop()
   else:word=None
  if not word:unmatched.append((i,m[0],masked[max(0,m.start()-30):m.end()+40]));continue
  parts.append({'type':'text','text':masked[cursor:m.start()]});parts.append({'type':'gap','shown':pre,'missing':word[len(pre):]});cursor=m.end()
 parts.append({'type':'text','text':masked[cursor:]})
 rc.append({'number':n,'topic':title,'parts':parts,'text':ans,'maskedText':masked,'unmatched':unmatched,'gapCount':sum(x['type']=='gap' for x in parts)})
base['readComplete']=rc
print('ReadComplete unresolved:',[(r['number'],r['unmatched']) for r in rc if r['unmatched']])
print('IW follow-up counts:',[(x['number'],len(x['followUps'])) for x in iw if len(x['followUps'])!=3])
for k in ['readAloud','readThenSpeak','writingSample','speakingSample','listenThenSpeak']:print(k,len(base[k]),base[k][-1])
# Interactive Reading: all 40 passages, six linked tasks each.
def question_blocks(text):
 matches=list(re.finditer(r'(?im)^\s*QUESTION\s+(\d+)\s*$',text));out={}
 for i,m in enumerate(matches):out[int(m[1])]=text[m.end():matches[i+1].start() if i+1<len(matches) else len(text)]
 assert sorted(out)==list(range(1,41)),sorted(out)
 return out
def subtasks(text,n):
 matches=list(re.finditer(r'(?m)^\s*'+str(n)+r'\.(\d+)\)\s*',text));return {int(m[1]):text[m.end():matches[i+1].start() if i+1<len(matches) else len(text)].strip() for i,m in enumerate(matches)}
def options(text):
 matches=list(re.finditer(r'(?m)^\s*([a-e])\)\s*',text));return [(m[1],norm(text[m.end():matches[i+1].start() if i+1<len(matches) else len(text)])) for i,m in enumerate(matches)]
def keyed_choice(opts,key,location):
 key=norm(key);letter=re.match(r'^([a-e])\)\s*',key);answer=key[letter.end():] if letter else key
 match=next((text for _,text in opts if norm(text).rstrip('.').casefold()==answer.rstrip('.').casefold()),None)
 if match is None:
  ranked=sorted(opts,key=lambda o:difflib.SequenceMatcher(None,o[1].lower(),answer.lower()).ratio(),reverse=True)
  if not ranked:raise ValueError((location,key,opts))
  ratio=difflib.SequenceMatcher(None,ranked[0][1].lower(),answer.lower()).ratio()
  if ratio<0.65:raise ValueError((location,'low match',key,ranked))
  match=ranked[0][1]
  issues.append({'location':location,'issue':'Key wording differs from source choice; matched closest printed choice.','key':key,'choice':match,'similarity':round(ratio,3)})
 if letter and next(l for l,t in opts if t==match)!=letter[1]:issues.append({'location':location,'issue':'Key letter differs from keyed answer text; matched keyed text.','key':key})
 return {'options':[v for _,v in opts],'answer':match,'sourceKey':key}
sources=question_blocks(pages(28,73)); keysection=pages(167,175).split('INTERACTIVE READING',1)[1].split('INTERACTIVE LISTENING:',1)[0]; keyblocks=question_blocks(keysection)
ir=[]
for n,raw in sources.items():
 q=subtasks(raw,n);k=subtasks(keyblocks[n],n)
 assert sorted(q)==[1,2,3,4,5,6],(n,q.keys())
 assert sorted(k)==[1,2,3,4,5,6],(n,k.keys())
 word_opts=list(re.finditer(r'(?m)^[ \t]*(\d+)\)[ \t]*(?=[^\n]*/)',q[1]))
 passage=norm(q[1][:word_opts[0].start()].split(':',1)[1]);passage=re.sub(r'(\d+)\)',r'{\1}',passage)
 answer_words=list(re.finditer(str(n)+r'\.1\.(\d+)\)\s*',k[1]));answers={int(m[1]):norm(k[1][m.end():answer_words[i+1].start() if i+1<len(answer_words) else len(k[1])]) for i,m in enumerate(answer_words)}
 blanks=[]
 for i,m in enumerate(word_opts):
  opts=[v.strip() for v in norm(q[1][m.end():word_opts[i+1].start() if i+1<len(word_opts) else len(q[1])]).split('/')]
  ans=answers[int(m[1])];match=next((o for o in opts if o.casefold()==ans.casefold()),None)
  if not match:raise ValueError(('IR blank',n,i,opts,ans))
  blanks.append({'options':opts,'answer':match,'sourceKey':ans})
 sentence_part,full=q[2].split('Click and drag to highlight the answer to the questions below:',1)
 full=norm(full)
 sentence=keyed_choice(options(sentence_part),k[2],f'Interactive Reading {n}.2')
 needle=sentence['answer'];pos=full.find(needle)
 if pos<0:
  # Match a sentence with punctuation variants; keep the original full passage.
  fragments=re.split(r'(?<=[.!?])\s+',full)
  best=max(fragments,key=lambda f:difflib.SequenceMatcher(None,f.lower(),needle.lower()).ratio())
  ratio=difflib.SequenceMatcher(None,best.lower(),needle.lower()).ratio()
  if ratio<0.7:raise ValueError(('sentence missing',n,needle,full))
  sentencePassage=full.replace(best,'{sentence}',1);issues.append({'location':f'Interactive Reading {n}.2','issue':'Passage sentence differs slightly from keyed option.','key':needle,'passage':best})
 else:sentencePassage=full[:pos]+'{sentence}'+full[pos+len(needle):]
 highlight=[{'question':norm(q[j]),'answer':re.sub(r'^[a-e]\)\s*','',norm(k[j])),'sourceKey':norm(k[j])} for j in [3,4]]
 ir.append({'number':n,'topic':f'Booklet passage {n}','passage':passage,'fullPassage':full,'sentencePassage':sentencePassage,'blanks':blanks,'sentence':sentence,'highlight':highlight,'mainIdea':keyed_choice(options(q[5]),k[5],f'Interactive Reading {n}.5'),'title':keyed_choice(options(q[6]),k[6],f'Interactive Reading {n}.6')})
base['interactiveReading']=ir
# Interactive Listening: source choices + authoritative full conversations.
sources=question_blocks(pages(76,125));keyblocks=question_blocks(pages(175,189).split('INTERACTIVE LISTENING: FULL CONVERSATIONS',1)[1]);il=[]
for n,raw in sources.items():
 raw=re.sub(r'Conversations with a Professor','',raw)
 # Restore omitted You labels before option groups in the printed source.
 raw=re.sub(r'((?:Classmate|Professor):(?:(?!\n\s*(?:You|Classmate|Professor):)[\s\S])*?)(\n[ \t]*a\))',r'\1\nYou:\2',raw)
 scenario=norm(raw.split('Scenario:',1)[1].split('You:',1)[0].split('Classmate:',1)[0].split('Professor:',1)[0])
 tokens=list(re.finditer(r'(?m)^\s*(You|Classmate|Professor):\s*',raw));keyraw=keyblocks[n];keyraw,sep,summary=keyraw.partition('Sample summary:');ktokens=list(re.finditer(r'(?m)^\s*(You|Classmate|Professor):\s*',keyraw))
 keyturns=[{'speaker':'you' if m[1]=='You' else 'partner','text':norm(keyraw[m.end():ktokens[i+1].start() if i+1<len(ktokens) else len(keyraw)])} for i,m in enumerate(ktokens)]
 userkeys=[t['text'] for t in keyturns if t['speaker']=='you'];turns=[];idx=0
 for i,m in enumerate(tokens):
  content=raw[m.end():tokens[i+1].start() if i+1<len(tokens) else len(raw)]
  if m[1]=='You':
   choice=keyed_choice(options(content),userkeys[idx],f'Interactive Listening {n} response {idx+1}');idx+=1;turns.append({'speaker':'you',**choice})
  else:turns.append({'speaker':'partner','text':norm(content)})
 assert idx==len(userkeys),(n,idx,len(userkeys))
 dialogue=[{'speaker':t['speaker'],'text':re.sub(r'^[a-e]\)\s*','',t['text'])} for t in keyturns]
 il.append({'number':n,'gpnConversation':True,'scenario':scenario,'you':'You','partner':'Classmate' if n<=20 else 'Professor','turns':turns,'dialogue':dialogue,'summaryModel':norm(summary) if sep else None})
base['interactiveListening']=il

# Key text is retained for feedback; these alternatives are exact selectable spans.
highlight_alts={10:(0,'She loved birds so much'),20:(0,"Polar bears' thick, white fur and a layer of fat help"),36:(1,'the internet has provided a platform for innovation, from groundbreaking medical research shared across continents to the rise of global online communities')}
for n,(_,alt) in highlight_alts.items():
 entry=base['interactiveReading'][n-1]
 # Choose the keyed span with greatest lexical overlap with the source correction.
 h=max(entry['highlight'],key=lambda h:difflib.SequenceMatcher(None,h['answer'].lower(),alt.lower()).ratio())
 assert alt.lower() in entry['fullPassage'].lower(),(n,alt)
 h['alts']=[alt]
 issues.append({'location':f'Interactive Reading {n} highlight','issue':'Printed answer is not a selectable span; retain key and also accept matching source span.','key':h['answer'],'acceptedSpan':alt})

base['speakingSample'][1]['prompt']=base['speakingSample'][1]['prompt'].replace('s pecial','special')
for n in [12,17]:issues.append({'location':f'Read and Complete {n}','issue':'Question and answer passage have minor differences in intact words; question wording and all keyed gaps preserved.'})
assert all(not q['unmatched'] and q['gapCount'] for q in base['readComplete'])
assert all(len(q['followUps'])==3 for q in base['interactiveWriting'])
assert all(norm(v) in ['Yes','No'] for v in rskeys.values())
(ROOT/'src/data/gpnSamples.json').write_text(json.dumps(base,ensure_ascii=False,indent=2)+'\n')
(ROOT/'docs/gpn/source-issues.json').write_text(json.dumps(issues,ensure_ascii=False,indent=2)+'\n')
print('Validated all text banks and wrote source data and discrepancy log.')
