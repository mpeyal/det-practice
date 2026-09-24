const {app,BrowserWindow,session}=require('electron');const fs=require('fs');const path=require('path');const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..'),dist=process.env.TEST_DIST||path.join(root,'dist');
app.setPath('userData',fs.mkdtempSync('/private/tmp/parrot-voice-ui-'));app.disableHardwareAcceleration();
const pause=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
 const {startServer}=await import(pathToFileURL(path.join(root,'server/server.mjs')));const {server,port}=await startServer({port:0,distDir:dist});
 const handler=server.listeners('request')[0];server.removeAllListeners('request');server.on('request',(req,res)=>{
  if(req.url==='/api/health'){res.setHeader('Content-Type','application/json');return res.end('{"backend":"none"}')}
  handler(req,res)
 });
 session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(details,cb)=>cb({cancel:!details.url.startsWith(`http://localhost:${port}/`)}));
 const win=new BrowserWindow({show:false,width:1100,height:1000,webPreferences:{contextIsolation:true,backgroundThrottling:false}});
 const run=code=>win.webContents.executeJavaScript(code);const js=JSON.stringify;const errors=[];
 win.webContents.on('console-message',(_e,level,msg)=>{if(level>=3)errors.push(msg)});
 const wait=async(code,note,timeout=10000)=>{const end=Date.now()+timeout;while(Date.now()<end){if(await run(code))return;await pause(30)}throw Error(note)};
 const click=async text=>{await run(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${js(text)});if(!b||b.disabled)throw Error('Unavailable '+${js(text)});b.click()})()`);await pause(50)};
 try{
  await win.loadURL(`http://localhost:${port}`);await wait(`document.body.textContent.includes('GPN DET Sample')`,'App did not load');
  await run(`window.voiceClips=[];window.Audio=class extends Audio{constructor(src){super(src);window.voiceClips.push(this)}};undefined`);
  await click('⚙️ Settings');
  for(const [gender,key] of [['female','4d69cc00'],['male','28654f5f']]){
   if(gender==='male')await click('0.75×');
   await click('🔊 Test '+gender);
   await wait(`(()=>{const a=window.voiceClips.at(-1);return a?.src.endsWith('/voices-natural/${key}.m4a')&&a.readyState>=2&&!a.paused&&a.currentTime>0})()`,'Preview did not play '+gender);
   if(!await run(`window.voiceClips.at(-1).playbackRate===${gender==='male'?.75:1} && window.voiceClips.at(-1).preservesPitch`))throw Error('Preview rate or pitch incorrect');
   await run(`window.voiceClips.at(-1).currentTime=window.voiceClips.at(-1).duration-.03`);
   await wait(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='🔊 Test ${gender}');return b&&!b.disabled})()`,'Preview button stuck');
  }
  await click('1×');
  await click('🔊 Test female');await click('← Back');
  await wait(`window.voiceClips.every(a=>a.paused)`,'Navigation left speech playing');
  await click('⚙️ Settings');await click('🔊 Test male');
  await wait(`!window.voiceClips.at(-1).paused`,'Preview did not recover after navigation');
  await click('← Back');
  const section=async title=>{await run(`[...document.querySelectorAll('button')].find(b=>b.querySelector('h2')?.textContent===${js(title)}).click()`);await pause(70)};
  const finishAudio=async()=>{
   await wait(`(()=>{const a=window.voiceClips.at(-1);return a?.src.includes('/voices-natural/')&&a.readyState>=2&&!a.paused&&a.currentTime>0})()`,'Natural question audio did not play');
   const duration=await run('window.voiceClips.at(-1).duration');
   if(!Number.isFinite(duration)||duration<=0)throw Error('Invalid audio duration');
   await wait(`window.voiceClips.at(-1).ended`,'Audio did not end',Math.ceil((duration+8)*1000));await pause(100);
  };
  // Exercise the three generated listening entry points through real app controls.
  await section('Section Practice');await click('⏱ Timed — real exam clocks');await click('Listen and Type');await click('1');
  await finishAudio();await wait(`document.body.textContent.includes('2 plays left')`,'Dictation replay counter');
  for(let n=0;n<2;n++){await run(`document.querySelector('button[title="Play"]').click()`);await finishAudio()}
  await wait(`document.querySelector('button[title="No plays left"]')?.disabled`,'Dictation three-play limit');
  await click('✕');await click('Interactive Listening');await click('1');await click('Start');await click('Play scenario');await finishAudio();
  const scenarioSrc=await run('window.voiceClips.at(-1).src');
  await click('Continue to conversation');await run(`[...document.querySelectorAll('button')].find(b=>b.textContent.startsWith('Listen to ')).click()`);await finishAudio();
  await wait(`document.body.textContent.includes('Audio played')`,'Conversation turn did not unlock');
  const partnerSrc=await run('window.voiceClips.at(-1).src');
  if(scenarioSrc===partnerSrc)throw Error('Scenario and partner used same clip');
  const clipGender=src=>JSON.parse(fs.readFileSync(path.join(root,'public/voices-natural',path.basename(new URL(src).pathname).replace('.m4a','.json')))).gender;
  if(clipGender(scenarioSrc)!=='male'||clipGender(partnerSrc)!=='female')throw Error('Conversation speaker pair incorrect');
  await wait(`!![...document.querySelectorAll('button')].find(b=>b.textContent==='Audio played'&&b.disabled)`,'Conversation replay not limited');
  await click('✕');await click('← Back');await section('GPN DET Sample');await click('Untimed practice');await section('Interactive Listening');
  await run(`[...document.querySelectorAll('button')].find(b=>b.firstElementChild?.textContent==='Question 1').click()`);await pause(70);
  await run(`document.querySelector('button.choice').click()`);await pause(40);await click('Next');await finishAudio();
  await wait(`document.body.textContent.includes('0 plays left')`,'GPN one-play limit');await click('✕');
  await click('← GPN sections');await section('Listen and Type');
  await run(`[...document.querySelectorAll('button')].find(b=>b.firstElementChild?.textContent==='Question 1').click()`);
  await wait(`(()=>{const a=document.querySelector('audio');return a?.src.endsWith('/gpn/audio/listenType-1.mp3')&&a.readyState>=2})()`,'Original GPN QR recording changed or failed');
  await click('✕');
  await click('← GPN sections');await click('← Home');await click('⚙️ Settings');
  await run(`window.Audio=class{play(){return Promise.reject(Error('controlled media failure'))}pause(){}};window.speechSynthesis.getVoices=()=>[];window.speechSynthesis.onvoiceschanged?.();undefined`);
  await click('🔊 Test female');
  await wait(`document.querySelector('[role="alert"]')?.textContent.includes('could not finish')`,'Failed preview did not explain retry');
  await wait(`![...document.querySelectorAll('button')].find(b=>b.textContent==='🔊 Test female')?.disabled`,'Failed preview remained disabled');
  const report={date:new Date().toISOString(),ok:true,dist,checks:['Actual female and male AAC playback in Settings','correct natural pack URLs','preview speed applies immediately and preserves pitch','preview controls recover after end','navigation stops sound','preview restarts after remount','normal dictation audio and replay count','normal conversation scenario and partner playback','GPN conversation generated audio and one-play limit','GPN original QR recording retained','failed preview explains retry and unlocks controls','all network requests outside localhost blocked'],errors};
  if(errors.length)throw Error(errors.join('\n'));
  fs.mkdirSync(path.join(root,'docs/voices'),{recursive:true});fs.writeFileSync(path.join(root,'docs/voices/ui-report.json'),JSON.stringify(report,null,2)+'\n');console.log('PASS',report);app.exit(0)
 }catch(e){console.error(e);console.error(await run('document.body.textContent.slice(-1500)'));console.error(await run('window.voiceClips?.slice(-2).map(a=>({src:a.src,duration:a.duration,currentTime:a.currentTime,ended:a.ended,paused:a.paused,error:a.error?.message}))'));app.exit(1)}
});
