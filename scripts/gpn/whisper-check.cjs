const {app,BrowserWindow,session}=require('electron');const fs=require('fs');const path=require('path');const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'../..');const installed='/Applications/ParrotReady.app/Contents/Resources/app';
app.setPath('userData',fs.mkdtempSync('/private/tmp/parrot-record-check-'));app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox'); // Test process only: allow Chromium to read the generated input WAV.
app.commandLine.appendSwitch('use-fake-device-for-media-stream');app.commandLine.appendSwitch('use-fake-ui-for-media-stream');app.commandLine.appendSwitch('use-file-for-fake-audio-capture','/private/tmp/parrot-test-voice.wav');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
 const {startServer}=await import(pathToFileURL(path.join(installed,'server/server.mjs')));const {server,port}=await startServer({port:0,distDir:process.env.TEST_DIST||path.join(installed,'dist')});
 const handler=server.listeners('request')[0];server.removeAllListeners('request');server.on('request',(req,res)=>{if(req.url==='/api/health'){res.setHeader('Content-Type','application/json');res.end('{"backend":"none"}');return}handler(req,res)});
 session.defaultSession.setPermissionRequestHandler((_w,_p,done)=>done(true));
 const win=new BrowserWindow({show:false,width:1100,height:1000,webPreferences:{contextIsolation:true,backgroundThrottling:false}});const run=x=>win.webContents.executeJavaScript(x);const js=JSON.stringify;
 const click=async text=>{await run(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${js(text)}).click()`);await pause(100)};
 const contains=async(text,timeout=30000)=>{const end=Date.now()+timeout;while(Date.now()<end){if(await run(`document.body.textContent.includes(${js(text)})`))return;await pause(100)}throw Error('Missing '+text)};
 try{
  await win.loadURL(`http://localhost:${port}`);await contains('GPN DET Sample');await run(`[...document.querySelectorAll('button')].find(b=>b.querySelector('h2')?.textContent==='GPN DET Sample').click()`);await pause(100);await click('Untimed practice');await run(`[...document.querySelectorAll('button')].find(b=>b.querySelector('h2')?.textContent==='Read Aloud').click()`);await pause(100);await run(`[...document.querySelectorAll('button')].find(b=>b.firstElementChild?.textContent==='Question 1').click()`);await pause(150);await click('Record');await contains('Stop recording',60000);await contains('live — speak and words appear',60000);await pause(11000);await click('Stop recording');await contains('Transcribe recording');
  const transcript=await run(`document.querySelector('textarea').value`);if(transcript.split(/\s+/).length<4)throw Error('Live transcript empty or too short: '+transcript);
  await run(`(async()=>{const a=document.querySelector('audio');if(!a.src.startsWith('blob:'))throw Error('Recording missing');const b=await(await fetch(a.src)).blob();if(b.size<1000)throw Error('Empty recording');await a.play();a.pause()})()`);
  await click('✨ Transcribe recording');await contains('✨ Transcribe recording',180000);if(await run(`document.body.textContent.includes('Auto-transcription failed')`))throw Error('Whisper fallback failed');const refined=await run(`document.querySelector('textarea').value`);if(refined.split(/\s+/).length<4)throw Error('Empty Whisper transcript');console.log('Whisper transcript',refined);
  await click('Submit');await contains('Your response');await contains(refined);if(!await run(`document.querySelector('audio')?.src.startsWith('blob:')`))throw Error('Recording lost on submit');
  const report={date:new Date().toISOString(),ok:true,input:'generated speech through Chromium simulated microphone; no human microphone captured',liveTranscript: transcript,refinedTranscript: refined,checks:['Whisper fallback transcription','MediaRecorder capture','offline Vosk live transcription','stop and playable blob','submit retains recording and transcript']};fs.writeFileSync(path.join(root,'docs/gpn/whisper-report.json'),JSON.stringify(report,null,2)+'\n');console.log('PASS',report);app.exit(0)
 }catch(e){console.error(e);console.error(await run(`document.body.textContent.slice(-2200)`));app.exit(1)}
});
