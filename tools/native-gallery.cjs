// Uses only the final app on the named local virtual watch; keeps its saves.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),checkGallery=require('./gallery-native-checks.cjs');
const root=path.resolve(__dirname,'..'),environment=process.env.STARRY_EMULATOR_HOME||path.join(root,'.emulator'),results=path.join(root,'native-test-results');
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),logs=()=>fs.readFileSync(path.join(environment,'emulator.log'),'utf8');
async function waitLog(start,pattern){for(let i=0;i<120;i++){if(pattern.test(logs().slice(start)))return;await sleep(250);}throw Error('Timeout '+pattern);}
async function click(x,y){assert.ok((await fetch('http://127.0.0.1:43125/click?x='+x+'&y='+y)).ok);await sleep(450);}
async function expectedClick(x,y,pattern){const start=logs().length;await click(x,y);await waitLog(start,pattern);return logs().slice(start);}
async function capture(name){const r=await fetch('http://127.0.0.1:43125/screen');assert.ok(r.ok);fs.writeFileSync(path.join(results,name+'.png'),Buffer.from(await r.arrayBuffer()));}
(async()=>{
 fs.mkdirSync(results,{recursive:true});const start=logs().length;await capture('v022-title');
 const gallery=await checkGallery({click,expectedClick,capture,logs});
 // Verify the update still lists and loads the previous app's legacy save.
 await expectedClick(216,419,/STARRY_RW5 slots ready load/);await capture('v022-existing-slots');
 const restored=await expectedClick(216,126,/STARRY_RW5 slot loaded 1 /),m=restored.match(/STARRY_RW5 slot loaded 1 (\d+) (\d+)/);assert.ok(m);
 await expectedClick(216,restored.includes('STARRY_RW5 choice')?444:477,/STARRY_RW5 menu/);await click(216,443);
 const after=logs().slice(start);assert.ok(!after.includes('STARRY_RW5 error'));assert.ok(!after.includes('Unknown style'));assert.ok(!after.includes('ASSERTION FAILED'));
 const report={version:'0.2.2',testedPackage:'com.codex.starry.rw5',nativeRuntime:'official vela-watch-5.0',screen:[432,514],gallery,previousSaveLoaded:m.slice(1).map(Number),result:'passed'};
 fs.writeFileSync(path.join(results,'gallery-report.json'),JSON.stringify(report,null,2)+'\n');console.log('NATIVE_GALLERY_PASSED',JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
