// Run after native-smoke, with the same virtual disk cold booted and no app open.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),exec=require('util').promisify(require('child_process').execFile);
const root=path.resolve(__dirname,'..'),environment=process.env.STARRY_EMULATOR_HOME||path.join(root,'.emulator');
const adb=path.join(root,'node_modules/@miwt/adb/bin/win/adb.exe'),results=path.join(root,'native-test-results');
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),logs=()=>fs.readFileSync(path.join(environment,'emulator.log'),'utf8');
async function waitLog(start,pattern){for(let i=0;i<120;i++){if(pattern.test(logs().slice(start)))return;await sleep(250);}throw Error('Timeout '+pattern);}
async function click(x,y,pattern){const start=logs().length;assert.ok((await fetch('http://127.0.0.1:43125/click?x='+x+'&y='+y)).ok);await sleep(500);if(pattern)await waitLog(start,pattern);}
async function capture(name){const r=await fetch('http://127.0.0.1:43125/screen');assert.ok(r.ok);fs.writeFileSync(path.join(results,name+'.png'),Buffer.from(await r.arrayBuffer()));}
(async()=>{
 const report=JSON.parse(fs.readFileSync(path.join(results,'report.json'),'utf8'));assert.equal(report.result,'passed');assert.equal(report.version,'0.2.1');
 const start=logs().length;
 if(!process.argv.includes('--resume')){
   await exec(adb,['-s','emulator-5554','wait-for-device'],{windowsHide:true,timeout:60000});
   // ADB is available before Vela finishes registering its app services.
   await sleep(15000);
   await exec(adb,['-s','emulator-5554','shell','am','start','com.codex.starry.qa.v020'],{windowsHide:true,timeout:60000});
   await waitLog(start,/STARRY_RW5 QA ready/);await sleep(500);
 }
 const positions=[];
 for(let index=9;index>=0;index--){
   if(index===9)await click(216,419,/STARRY_RW5 slots ready load/);
   else{await click(216,477,/STARRY_RW5 menu/);await click(216,153,/STARRY_RW5 slots ready load/);}
   for(let page=0;page<Math.floor(index/4);page++)await click(348,474);
   if(index===9)await capture('v020-slots-after-cold-boot');
   const boundary=logs().length,expectedChapter=index===9?1:index+1;
   await click(216,126+(index%4)*92,new RegExp('STARRY_RW5 slot loaded '+(index+1)+' '+expectedChapter+' '));
   const match=logs().slice(boundary).match(/STARRY_RW5 slot loaded (\d+) (\d+) (\d+)/);positions.push(match.slice(1).map(Number));
 }
 await capture('v020-choice-after-cold-boot');assert.ok(!logs().slice(start).includes('STARRY_RW5 error'));
 report.saveSlots.coldRestart=true;report.saveSlots.positionsAfterColdRestart=positions;fs.writeFileSync(path.join(results,'report.json'),JSON.stringify(report,null,2));console.log('NATIVE_PERSISTENCE_PASSED',JSON.stringify(positions));
})().catch(e=>{console.error(e);process.exitCode=1;});
