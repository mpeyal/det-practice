// Isolated React integration test: question reuse, replay limits, and engine failures.
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path'), esbuild = require('esbuild');
const root = path.resolve(__dirname, '..'), dir = fs.mkdtempSync('/private/tmp/parrot-audio-bar-');
app.setPath('userData', path.join(dir, 'profile')); app.disableHardwareAcceleration();
const pause = ms => new Promise(r => setTimeout(r, ms));
app.whenReady().then(async () => {
  await esbuild.build({ stdin: { contents: `
    import React, {useState} from 'react'; import {createRoot} from 'react-dom/client';
    import AudioBar from './src/components/AudioBar.jsx';
    window.calls=[]; window.stops=0;
    function Fixture(){ const [props,setProps]=useState({text:'First question',maxPlays:3}); window.setProps=setProps;
      return <AudioBar {...props}/> }
    createRoot(document.getElementById('root')).render(<Fixture/>);
  `, resolveDir: root, loader: 'jsx' }, bundle: true, outfile: path.join(dir, 'fixture.js'), plugins: [{ name: 'controlled-speech', setup(build) {
    build.onResolve({ filter: /lib\/(tts|storage)\.js$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path.includes('tts') ? `
      export const ttsSupported=()=>true; export const stopSpeaking=()=>{window.stops++};
      export function speak(text){if(window.throwSpeech)throw Error('failed engine');return new Promise(resolve=>window.calls.push({text,resolve}))}
    ` : `export const getSettings=()=>({ttsRate:1,ttsEngine:'neural'}); export const saveSettings=()=>{};` }));
  } }] });
  fs.writeFileSync(path.join(dir, 'index.html'), '<div id="root"></div><script src="fixture.js"></script>');
  const win = new BrowserWindow({show:false, webPreferences:{contextIsolation:true,backgroundThrottling:false}});
  const run = code => win.webContents.executeJavaScript(code); const checks = [], errors = [];
  win.webContents.on('console-message', (_e, level, msg) => { if(level>=3)errors.push(msg) });
  const wait = async (code, note) => { const end=Date.now()+4000; while(Date.now()<end){if(await run(code))return;await pause(25)} throw Error(note) };
  const assert = async (code, note) => { if(!await run(code))throw Error(note); checks.push(note) };
  try {
    await win.loadFile(path.join(dir,'index.html'));await wait('!!window.setProps','fixture load');
    await run(`(()=>{const b=document.querySelector('button[title="Play"]');b.click();b.click()})()`);
    await assert('window.calls.length===1', 'Rapid double click starts only one clip');
    await run(`window.setProps({text:'Second question',maxPlays:1,autoPlay:true})`);
    await wait('window.calls.length===2','replacement autoplay');
    await assert('window.stops>0 && window.calls[1].text=== "Second question"','Question change stops old clip and autoplays replacement');
    await run('window.calls[0].resolve(false)');await pause(40);
    await assert(`document.body.textContent.includes('0 plays left') && !document.body.textContent.includes('Couldn’t') && document.querySelector('button[title="No plays left"]').disabled`,'Old completion cannot refund or unlock the new question');
    await run('window.calls[1].resolve(true)');await pause(40);
    await assert(`document.querySelector('button[title="No plays left"]').disabled`,'Successful playback enforces limit');
    await run(`window.setProps({text:'Failure question',maxPlays:3})`);await pause(40);
    await run(`document.querySelector('button[title="Play"]').click()`);await run('window.calls[2].resolve(false)');await pause(40);
    await assert(`document.body.textContent.includes('3 plays left') && document.body.textContent.includes('Couldn’t') && !document.querySelector('button[title="Play"]').disabled`,'Failed playback refunds and permits retry');
    await run(`window.throwSpeech=true;document.querySelector('button[title="Play"]').click()`);await pause(40);
    await assert(`document.body.textContent.includes('3 plays left') && !document.querySelector('button[title="Play"]').disabled`,'Thrown engine error also refunds and unlocks');
    if(errors.length)throw Error(errors.join('\n'));
    fs.writeFileSync(path.join(root,'docs/voices/control-report.json'),JSON.stringify({date:new Date().toISOString(),ok:true,checks,errors},null,2)+'\n');
    console.log('PASS',checks);app.exit(0);
  } catch(e){console.error(e);app.exit(1)}
});
