/* Exhaustive real DOM interaction; AI replies are controlled fixtures here.
 * Real provider and audio capture checks are separate, explicitly reported. */
const {app,BrowserWindow}=require('electron');const fs=require('fs');const path=require('path');const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'../..');const data=JSON.parse(fs.readFileSync(path.join(root,'src/data/gpnSamples.json')));
const installed='/Applications/ParrotReady.app/Contents/Resources/app';const dist=process.env.TEST_DIST||path.join(installed,'dist');
app.setPath('userData',fs.mkdtempSync('/private/tmp/parrot-all-samples-'));app.disableHardwareAcceleration();
const pause=ms=>new Promise(r=>setTimeout(r,ms));const report={started:new Date().toISOString(),dist,passed:[],failures:[],grading:'controlled replies; separate live-provider check',grades:0};
app.whenReady().then(async()=>{
 const {startServer}=await import(pathToFileURL(path.join(installed,'server/server.mjs')));const {server,port}=await startServer({port:0,distDir:dist});
 const handler=server.listeners('request')[0];server.removeAllListeners('request');
 server.on('request',(req,res)=>{
  if(req.url==='/api/health'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({ok:true,backend:'openai-cli'}))}
  if(req.url==='/api/grade'){let body='';req.on('data',b=>body+=b);req.on('end',()=>{const value=JSON.parse(body);if(!value.prompt)throw Error('Missing grading prompt');report.grades++;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,text:JSON.stringify({score:120,cefr:'B2',task_fulfillment:'Fixture: response received.',coherence:'Fixture: coherent.',vocabulary:'Fixture: appropriate.',grammar:'Fixture: clear.',summary:'Automated integration test feedback.',improved_version:'An improved test response.'})}))});return}
  handler(req,res)
 });
 const win=new BrowserWindow({show:false,width:1150,height:1000,webPreferences:{contextIsolation:true,backgroundThrottling:false}});
 const run=code=>win.webContents.executeJavaScript(code);const js=x=>JSON.stringify(x);let current='startup';let rendererErrors=[];
 win.webContents.on('console-message',(_e,level,msg)=>{if(level>=3)rendererErrors.push(msg)});
 const wait=async(code,message,timeout=6000)=>{const until=Date.now()+timeout;while(Date.now()<until){if(await run(code))return;await pause(20)}throw Error(message)};
 const contains=text=>wait(`document.body.textContent.includes(${js(text)})`,'Missing text '+text);
 const click=async text=>{await run(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${js(text)});if(!b||b.disabled)throw Error('Unavailable button '+${js(text)});b.click()})()`);await pause(12)};
 const type=async(selector,value)=>{await run(`(()=>{const e=document.querySelector(${js(selector)});if(!e)throw Error('Missing input');Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e),'value').set.call(e,${js(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))})()`);await pause(12)};
 const section=async title=>{await run(`[...document.querySelectorAll('button')].find(b=>b.querySelector('h2')?.textContent===${js(title)}).click()`);await pause(15)};
 const choice=async answer=>{await run(`(()=>{const b=[...document.querySelectorAll('button.choice')].find(b=>b.textContent.endsWith(${js(answer)}));if(!b)throw Error('Choice absent');b.click()})()`);await pause(10)};
 const letters=async text=>run(`(async()=>{const nodes=[...document.querySelectorAll('input.gapbox')];const letters=${js(text)};if(nodes.length!==letters.length)throw Error('Missing letter boxes '+nodes.length+' expected '+letters.length);for(let i=0;i<nodes.length;i++){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(nodes[i],letters[i]);nodes[i].dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,0))}})()`);
 const checkAudio=async src=>{
  await wait(`(()=>{const a=document.querySelector('audio');return a && a.readyState>=2 && a.duration>0})()`,'Audio failed '+src,10000);
  await run(`(async()=>{const a=document.querySelector('audio');if(!a.src.endsWith(${js(src)}))throw Error('Wrong audio');await a.play();if(a.paused)throw Error('Playback failed');a.pause()})()`);
 };
 const checkPhoto=async src=>{await wait(`(()=>{const p=document.querySelector('img');return p&&p.complete&&p.naturalWidth>0&&p.src.endsWith(${js(src)})})()`,'Photo failed '+src)};
 const response='I believe this is important because it helps people learn and work together. For example, a clear plan lets everyone understand their responsibilities and make progress.';
 const finish=async(subjective=false,summary=false)=>{
  if(subjective||summary)await contains('Estimated practice grade');
  if(!subjective)await contains('Nice!');
  if(summary)await contains('Summary feedback');
  await click('See summary');await contains('Done — back to GPN practice');
  const h=await run(`JSON.parse(localStorage.getItem('det.history')||'[]')[0]`);if(!h?.title?.startsWith('GPN ·'))throw Error('History not saved');
  await click('Done — back to GPN practice');
 };
 const banks=[['readComplete','Read and Complete'],['readSelect','Read and Select'],['fillBlanks','Fill in the Blanks'],['listenType','Listen and Type'],['readAloud','Read Aloud'],['interactiveReading','Interactive Reading'],['interactiveListening','Interactive Listening'],['photos','Write About the Photo'],['speakingPhotos','Speak About the Photo'],['interactiveWriting','Interactive Writing'],['readThenSpeak','Read Then Speak'],['listenThenSpeak','Listen Then Speak'],['writingSample','Writing Sample'],['speakingSample','Speaking Sample']];
 try{
  await win.loadURL(`http://localhost:${port}`);await contains('GPN DET Sample');await section('GPN DET Sample');await click('Untimed practice');
  for(const [bank,title] of banks){
   await section(title);
   for(const p of data[bank])for(let f=0;f<(bank==='interactiveWriting'?3:1);f++){
    current=`${title} ${p.number}${bank==='interactiveWriting'?` follow-up ${f+1}`:''}`;
    await type('input[aria-label="Find question number or title"]',String(p.number));if(bank==='interactiveWriting')await type('select',String(f));
    await run(`[...document.querySelectorAll('button')].find(b=>b.firstElementChild?.textContent.replace(' ✓','')===${js('Question '+p.number)}).click()`);await pause(15);
    await contains(`Question ${p.number}`);
    let subjective=false,summary=false;
    if(bank==='readComplete'){await contains(p.topic);await letters(p.parts.filter(x=>x.type==='gap').map(x=>x.missing).join(''));await click('Next')}
    else if(bank==='readSelect'){await contains(p.word);await click(p.isReal?'Yes 1':'No 2')}
    else if(bank==='fillBlanks'){await letters(p.missing);await click('Next')}
    else if(bank==='listenType'){await checkAudio(p.audio);await type('textarea',p.text);await click('Next')}
    else if(bank==='interactiveReading'){
     for(const b of p.blanks){await run(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Select a word')).click()`);await pause(10);await click(b.answer)}
     await click('Next');await contains(`${p.number}.2)`);await choice(p.sentence.answer);await click('Next');
     for(const h of p.highlight){const target=h.alts?.[0]||h.answer;
      await run(`(()=>{const p=[...document.querySelectorAll('p')].find(p=>p.textContent===${js(p.fullPassage)});const words=${js(target)}.match(/[a-z0-9]+/gi);const re=new RegExp(words.join('[^a-z0-9]+'),'i');const m=re.exec(p.textContent);if(!m)throw Error('Unselectable key '+${js(target)});const r=document.createRange();r.setStart(p.firstChild,m.index);r.setEnd(p.firstChild,m.index+m[0].length);const s=window.getSelection();s.removeAllRanges();s.addRange(r);p.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}))})()`);await pause(10);await click('Next')}
     await choice(p.mainIdea.answer);await click('Next');await choice(p.title.answer);await click('Submit');await contains('Complete the sentence');
    }else if(bank==='interactiveListening'){
     for(const t of p.turns){if(t.speaker==='you')await choice(t.answer);await click('Next')}
     await contains('Summarize the Conversation');await type('textarea',response);await click('Submit');summary=true;
    }else if(bank==='photos'){await checkPhoto(p.img);await type('textarea',response);await click('Submit');subjective=true}
    else if(bank==='interactiveWriting'){await type('textarea',response);await click('Continue');await contains(p.followUps[f]);await type('textarea',response);await click('Submit');subjective=true}
    else if(bank==='writingSample'){await contains('Prepare your response');await click('Start writing');await type('textarea',response);await click('Submit');subjective=true}
    else{
     if(bank==='speakingPhotos')await checkPhoto(p.img);
     if(bank==='listenThenSpeak')await checkAudio(p.audio);
     else if(p.prompt)await contains(p.prompt);
     if(bank!=='readAloud')await click("I'm ready — start now");
     if(bank==='listenThenSpeak'&&await run(`!!document.querySelector('audio[src*="listenThenSpeak"]')`))throw Error('Question audio remains during speaking');
     await type('textarea',bank==='readAloud'?p.prompt:response);await click('Submit');subjective=true;
    }
    await finish(subjective,summary);report.passed.push(current);
    if(report.passed.length%40===0)console.log('PASS',report.passed.length,current);
   }
   console.log('SECTION COMPLETE',title);await click('← GPN sections');
  }
  report.rendererErrors=rendererErrors;report.finished=new Date().toISOString();fs.writeFileSync(path.join(root,'docs/gpn/all-samples-report.json'),JSON.stringify(report,null,2)+'\n');
  console.log('PASS ALL',report.passed.length,'attempts; fixture grades',report.grades);app.exit(0);
 }catch(e){report.failures.push({sample:current,error:String(e),body:await run(`document.body.textContent.slice(-3000)`)});fs.writeFileSync(path.join(root,'docs/gpn/all-samples-report.json'),JSON.stringify(report,null,2)+'\n');fs.writeFileSync('/private/tmp/parrot-all-samples-failure.png',(await win.webContents.capturePage()).toPNG());console.error('FAIL',current,e,report.failures);app.exit(1)}
});
