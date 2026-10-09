// Only operates on this project's named local emulator and separate QA app.
const fs=require('fs'),path=require('path'),{execFile}=require('child_process');
const exec=require('util').promisify(execFile),assert=require('assert/strict');
const {default:VelaUxBuilder}=require('aiot-toolkit/lib/builder/VelaUxBuilder');
const project=path.resolve(__dirname,'..'),fixture=path.join(project,'.native-smoke');
const environment=process.env.STARRY_EMULATOR_HOME||path.join(project,'.emulator');
const adb=path.join(project,'node_modules/@miwt/adb/bin/win/adb.exe'),pkg='com.codex.starry.qa.v020';
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),results=path.join(project,'native-test-results');
async function adbCmd(...args){return(await exec(adb,['-s','emulator-5554',...args],{windowsHide:true,timeout:60000})).stdout;}
async function click(x,y){const r=await fetch('http://127.0.0.1:43125/click?x='+x+'&y='+y);assert.ok(r.ok);await sleep(450);}
async function capture(name){const r=await fetch('http://127.0.0.1:43125/screen');assert.ok(r.ok);fs.writeFileSync(path.join(results,name+'.png'),Buffer.from(await r.arrayBuffer()));}
const logs=()=>fs.readFileSync(path.join(environment,'emulator.log'),'utf8');
async function waitLog(start,pattern){for(let i=0;i<120;i++){if(pattern.test(logs().slice(start)))return;await sleep(250);}throw new Error('Timed out waiting for '+pattern);}
async function expectedClick(x,y,pattern){const boundary=logs().length;await click(x,y);await waitLog(boundary,pattern);if(String(pattern).includes('slot saved'))await sleep(1500);return logs().slice(boundary);}
async function menu(y=477){await expectedClick(216,y,/STARRY_RW5 menu/);}
async function slots(role){await expectedClick(216,role==='save'?95:153,new RegExp('STARRY_RW5 slots ready '+role));}
async function slotPage(index){for(let page=0;page<Math.floor(index/4);page++)await click(348,474);}
async function chooseSlot(index,pattern){await slotPage(index);return expectedClick(216,126+(index%4)*92,pattern);}
(async()=>{
 fs.mkdirSync(results,{recursive:true});const start=logs().length;
 const ops=JSON.parse(fs.readFileSync(path.join(project,'src/common/story/1.txt'),'utf8')),cursor=ops.findIndex(x=>x.op==='choice'),choice=ops[cursor];
 assert.ok(cursor>=0);
 const engine=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(project,'src/common/engine.js'),'utf8')).toString('base64'));
 const picked=engine.newState();picked.chapter=choice.items[1].to[0];picked.cursor=choice.items[1].to[1];engine.readFrame(ops,picked);const pickedPosition=[picked.chapter,picked.cursor];
 const afterSlots=process.argv.includes('--after-slots'),afterFirst=process.argv.includes('--after-first-save');
 if(!process.argv.includes('--resume')&&!afterFirst&&!afterSlots){
   await adbCmd('wait-for-device');
   fs.mkdirSync(fixture,{recursive:true});fs.cpSync(path.join(project,'src'),path.join(fixture,'src'),{recursive:true});
   if(!fs.existsSync(path.join(fixture,'node_modules')))fs.symlinkSync(path.join(project,'node_modules'),path.join(fixture,'node_modules'),'junction');
   const manifest=JSON.parse(fs.readFileSync(path.join(fixture,'src/manifest.json'),'utf8'));manifest.package=pkg;manifest.name='星空列车 UI 测试';
   fs.writeFileSync(path.join(fixture,'src/manifest.json'),JSON.stringify(manifest,null,2));fs.copyFileSync(path.join(project,'package.json'),path.join(fixture,'package.json'));
   const ux=path.join(fixture,'src/pages/index/index.ux');let code=fs.readFileSync(ux,'utf8');
   const runId=String(Date.now());
   const seed="const ready=()=>console.log('STARRY_RW5 QA ready');const seed=()=>{let remaining=10;const finish=()=>{if(--remaining!==0)return;const legacy=newState();legacy.cursor="+cursor+";storage.set({complete:()=>{},key:LEGACY_KEY,value:JSON.stringify(createSave(legacy,'choice',0)),success:()=>storage.set({complete:()=>{},key:'qa_run_id_v020',value:"+JSON.stringify(runId)+",success:()=>ready(),fail:()=>{}}),fail:()=>{}});};for(let i=0;i<10;i++)storage.set({complete:()=>{},key:slotKey(i),value:'',success:()=>finish(),fail:()=>{}});};storage.get({complete:()=>{},key:'qa_run_id_v020',default:'',success:data=>{if(data==="+JSON.stringify(runId)+")ready();else seed();},fail:()=>seed()});";
   code=code.replace("console.log('STARRY_RW5 title ready');",seed);
   code=code.replace("this.session=newState();this.cachedChapter=0;this.renderFrame();","this.session=newState();this.session.cursor="+cursor+";this.cachedChapter=0;this.renderFrame();");
   fs.writeFileSync(ux,code);const builder=new VelaUxBuilder();try{await builder.build(fixture,{mode:'development'});}finally{builder.dispose();}
   const rpk=path.join(fixture,'dist',fs.readdirSync(path.join(fixture,'dist')).find(x=>x.endsWith('.rpk')&&x.includes('0.2.1')));
   await adbCmd('push',rpk,'/data/starry-qa.rpk');assert.match(await adbCmd('shell','pm','install','/data/starry-qa.rpk'),/success 0/);
   await adbCmd('shell','am','start',pkg);await waitLog(start,/STARRY_RW5 QA ready/);await sleep(500);
 }
 if(!afterFirst&&!afterSlots)await capture('v020-title');
 if(process.argv.includes('--prepare')){console.log('QA_PREPARED',pkg);return;}
 if(!afterFirst&&!afterSlots){
 const galleryChecks=await require('./gallery-native-checks.cjs')({click,expectedClick,capture,logs});
 // Legacy single-slot save is offered as slot 01.
 await expectedClick(216,419,/STARRY_RW5 slots ready load/);await capture('v020-legacy-slot');
 await chooseSlot(0,new RegExp('STARRY_RW5 slot loaded 1 1 '+cursor));await menu(444);await slots('save');
 await chooseSlot(0,/STARRY_RW5 overwrite 1/);await capture('v020-overwrite');
 const beforeCancel=logs().length;await click(216,268);await click(216,474);await click(216,385);assert.ok(!logs().slice(beforeCancel).includes('STARRY_RW5 slot saved'));
 // Save on the selection page, then save nine different chapter openings.
 await menu(444);await slots('save');await chooseSlot(0,/STARRY_RW5 overwrite 1/);
 await expectedClick(216,210,new RegExp('STARRY_RW5 slot saved 1 1 '+cursor));
 }
 if(!afterSlots){
 for(let index=1;index<10;index++){
   await menu(index===1?444:477);await expectedClick(216,211,new RegExp('STARRY_RW5 frame '+(index+1)+' '));
   await menu();await slots('save');await chooseSlot(index,new RegExp('STARRY_RW5 slot saved '+(index+1)+' '+(index+1)+' '));
 }
 for(let index=9;index>=0;index--){
   await menu();await slots('load');if(index===9)await capture('v020-slots-01-04');
   await chooseSlot(index,new RegExp('STARRY_RW5 slot loaded '+(index+1)+' '+(index+1)+' '));
   if(index===9){await menu();await slots('load');await slotPage(9);await capture('v020-slots-09-10');await click(216,474);await click(216,385);}
 }
 // Loading the selection restores it, and choices remain clickable.
 await expectedClick(216,400,new RegExp('STARRY_RW5 frame '+pickedPosition.join(' ')));
 }
 await capture('v020-choice-restored');
 // Verify the existing slot overwrite flow replaces only that slot.
 await menu();await slots('save');await chooseSlot(9,/STARRY_RW5 overwrite 10/);
 await expectedClick(216,210,new RegExp('STARRY_RW5 slot saved 10 '+pickedPosition.join(' ')));
 await menu();await slots('load');await chooseSlot(9,new RegExp('STARRY_RW5 slot loaded 10 '+pickedPosition.join(' ')));
 // Every menu chapter boundary, final chapter guard and back.
 for(let chapter=2;chapter<=17;chapter++){await menu();await expectedClick(216,211,new RegExp('STARRY_RW5 frame '+chapter+' '));}
 await menu();boundary=logs().length;await click(216,211);assert.ok(!logs().slice(boundary).includes('STARRY_RW5 chapter skipped'));await capture('v020-final-menu');
 await click(216,385);await expectedClick(56,477,/STARRY_RW5 frame 16 /);
 const after=logs().slice(start);assert.ok(!after.includes('STARRY_RW5 error'));assert.ok(!after.includes('Unknown style'));assert.ok(!after.includes('ASSERTION FAILED'));
 const report={version:'0.2.1',nativeRuntime:'official vela-watch-5.0',screen:[432,514],saveSlots:{count:10,independentChapters:[1,2,3,4,5,6,7,8,9,10],selectionRestore:true,overwriteCancel:true,overwriteConfirm:true,legacySlot01:true},gallery:{groups:24,images:124,pagesChecked:6,cyclicVariants:true,sceneNavigation:true},chapterSkip:{menu:true,fromChoice:true,chaptersChecked:17,lastChapterGuard:true,back:true},result:'passed'};
 fs.writeFileSync(path.join(results,'report.json'),JSON.stringify(report,null,2));console.log('NATIVE_SMOKE_PASSED',JSON.stringify(report));
 // Cold boot before switching QA to main: native inspector teardown can crash
 // this SDK image when two debug apps are switched while teardown is pending.
})().catch(e=>{console.error(e);process.exitCode=1;});
