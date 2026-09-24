const {app,BrowserWindow}=require('electron');const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'../..');const data=JSON.parse(fs.readFileSync(path.join(root,'src/data/gpnSamples.json')));
app.setPath('userData','/private/tmp/parrot-gpn-full-ui-check');app.disableHardwareAcceleration();
const pause=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,width:1150,height:1100,webPreferences:{contextIsolation:true}});
 win.webContents.on('console-message',(_e,level,message)=>{if(level>=2)console.error('Renderer:',message)});
 const run=code=>win.webContents.executeJavaScript(code);const js=x=>JSON.stringify(x);
 const click=async text=>{await run(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${js(text)});if(!b)throw Error('Missing button '+${js(text)});if(b.disabled)throw Error('Disabled '+${js(text)});b.click()})()`);await pause(160)};
 const contains=async text=>{for(let i=0;i<20;i++){if(await run(`document.body.textContent.includes(${js(text)})`))return;await pause(150)}throw Error('Missing text '+text)};
 const section=async title=>{await run(`[...document.querySelectorAll('button')].find(b=>b.querySelector('h2')?.textContent===${js(title)}).click()`);await pause(150)};
 const question=async n=>{await run(`[...document.querySelectorAll('button')].find(b=>b.firstElementChild?.textContent.replace(' ✓','')===${js('Question '+n)}).click()`);await pause(200)};
 const choice=async answer=>{await run(`[...document.querySelectorAll('button.choice')].find(b=>b.textContent.endsWith(${js(answer)})).click()`);await pause(60)};
 const type=async(selector,value)=>{await run(`(()=>{const e=document.querySelector(${js(selector)});Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e),'value').set.call(e,${js(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))})()`);await pause(50)};
 const quit=async()=>{await click('✕');await click('← GPN sections')};
 const finish=async()=>{await click('See summary');await contains('Done — back to GPN practice');await click('Done — back to GPN practice');await click('← GPN sections')};
 try{
  await win.loadFile(path.join(root,'dist/index.html'));await pause(500);await section('GPN DET Sample');await contains('1,080');
  if(await run(`document.querySelectorAll('h2').length`)!==14)throw Error('Section count');await click('Untimed practice');
  await section('Read and Complete');await contains('A Gentle Touch, A Powerful Impact');await contains('Question 40');
  fs.writeFileSync('/private/tmp/gpn-full-picker.png',(await win.webContents.capturePage()).toPNG());await question(1);
  await contains('1) A Gentle Touch, A Powerful Impact');
  const letters=data.readComplete[0].parts.filter(p=>p.type==='gap').map(p=>p.missing).join('');
  if(await run(`document.querySelectorAll('input.gapbox').length`)!==letters.length)throw Error('RC masks');
  for(let i=0;i<letters.length;i++){await run(`(()=>{const e=document.querySelectorAll('input.gapbox')[${i}];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${js(letters[i])});e.dispatchEvent(new Event('input',{bubbles:true}))})()`)}
  await click('Next');await contains('Nice!');await finish();
  await section('Read and Select');for(let i=0;i<9;i++)await click('Next page');await question(500);await contains(data.readSelect[499].word);await click('Yes 1');await contains('Nice!');await finish();
  await section('Fill in the Blanks');await click('Next page');await question(60);await contains('author’s');await click('Next');await contains('ingenuity');await finish();
  await section('Listen and Type');await question(1);await contains('Original booklet QR recording');await pause(300);
  await run(`(async()=>{const a=document.querySelector('audio');if(!a.src.endsWith('listenType-1.mp3'))throw Error('Wrong original audio');if(a.readyState<1)await new Promise((resolve,reject)=>{a.onloadedmetadata=resolve;a.onerror=reject});if(!(a.duration>0))throw Error('No audio duration');a.currentTime=Math.max(0,a.duration-.05)})()`);await pause(200);
  for(let i=0;i<2;i++){await click('▶ Play recording');await pause(100);await run(`document.querySelector('audio').currentTime=document.querySelector('audio').duration-.05`);await pause(200)}
  await contains('0 plays left');await type('textarea',data.listenType[0].text);await click('Next');await contains('Nice!');await finish();
  await section('Read Aloud');await click('Next page');await question(60);await contains(data.readAloud[59].prompt);await click('Submit');await contains('Your response');await finish();
  await section('Interactive Reading');await question(40);const ir=data.interactiveReading[39];
  for(const b of ir.blanks){await run(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Select a word')).click()`);await pause(50);await click(b.answer)}
  await click('Next');await contains('40.2)');await choice(ir.sentence.answer);await click('Next');
  for(const h of ir.highlight){await run(`(()=>{const p=[...document.querySelectorAll('p')].find(p=>p.textContent===${js(ir.fullPassage)});const target=${js(h.answer.replace(/\.$/,''))};const start=p.textContent.toLowerCase().indexOf(target.toLowerCase());if(start<0)throw Error('Highlight not in passage');const range=document.createRange();range.setStart(p.firstChild,start);range.setEnd(p.firstChild,start+target.length);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);p.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}))})()`);await pause(50);await click('Next')}
  await choice(ir.mainIdea.answer);await click('Next');await choice(ir.title.answer);await click('Submit');await contains('Nice!');await contains('Complete the sentence');await finish();
  await section('Interactive Listening');await question(1);
  for(const t of data.interactiveListening[0].turns){if(t.speaker==='you')await choice(t.answer);await click('Next')}
  await contains('Summarize the Conversation');await type('textarea','We discussed the situation and agreed on a plan.');await click('Submit');await contains('Nice!');await contains('Summary feedback');await contains('Sample model answer');await finish();
  await section('Write About the Photo');await question(40);if(!await run(`document.querySelector('img').complete && document.querySelector('img').naturalWidth>0`))throw Error('Photo not loaded');await type('textarea','A boat is traveling along a river between wooded hills.');await click('Submit');await contains('Your response');await finish();
  await section('Speak About the Photo');await question(40);await click("I'm ready — start now");await click('Submit');await contains('Your response');await finish();
  await section('Interactive Writing');await type('select','2');await question(40);await type('textarea','This is my initial response.');await click('Continue');await contains(data.interactiveWriting[39].followUps[2]);await type('textarea','This is my follow-up response.');await click('Submit');await contains('Part 2 (follow-up)');await finish();
  await section('Read Then Speak');await question(40);await click("I'm ready — start now");await click('Submit');await contains('Your response');await finish();
  await section('Listen Then Speak');await question(40);if(!await run(`document.querySelector('audio').src.endsWith('listenThenSpeak-40.mp3')`))throw Error('LTS audio');await click("I'm ready — start now");if(await run(`!!document.querySelector('audio[src*="listenThenSpeak"]')`))throw Error('Audio not removed for recording');await click('Submit');await contains(data.listenThenSpeak[39].prompt);await finish();
  await section('Writing Sample');await question(40);await contains('Prepare your response');if(await run(`!!document.querySelector('textarea')`))throw Error('Writing before preparation');await click('Start writing');await type('textarea','Integrity and honesty help people build trust.');await click('Submit');await contains('Your response');await finish();
  await section('Speaking Sample');await question(40);await click("I'm ready — start now");await click('Submit');await contains('Your response');await finish();
  await click('Timed practice');await section('Fill in the Blanks');await question(1);await contains('0:20');await pause(20500);await contains('check the correction');await quit();
  await section('Interactive Reading');await click('View instructions and examples in the PDF');if(!await run(`document.querySelector('iframe').src.endsWith('gpn-booklet.pdf#page=25')`))throw Error('PDF page');
  console.log('PASS: 14 workflows, original question numbers/titles, 6 reading tasks, source conversation and summary, 3rd writing follow-up, original audio playback and replay limit, prep stages, timer expiry, grading, review and return.');app.exit(0)
 }catch(e){console.error(e);console.error(await run(`document.body.textContent.slice(-1800)`));fs.writeFileSync('/private/tmp/gpn-full-ui-failure.png',(await win.webContents.capturePage()).toPNG());app.exit(1)}
});
