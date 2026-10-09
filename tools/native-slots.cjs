// Tests only a separate QA package on the local virtual watch.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),fixture=path.join(root,'.native-slots-v022'),pkg='com.codex.starry.qa.v022';
const environment=process.env.STARRY_EMULATOR_HOME||path.join(root,'.emulator'),results=path.join(root,'native-test-results'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const logs=()=>fs.readFileSync(path.join(environment,'emulator.log'),'utf8');
async function click(x,y){assert.ok((await fetch('http://127.0.0.1:43125/click?x='+x+'&y='+y)).ok);await sleep(250);}
async function expected(x,y,re){const start=logs().length;await click(x,y);for(let i=0;i<100;i++){const part=logs().slice(start);if(re.test(part))return part;await sleep(200);}throw Error('Timeout '+re);}
async function shot(name){const r=await fetch('http://127.0.0.1:43125/screen');fs.writeFileSync(path.join(results,name+'.png'),Buffer.from(await r.arrayBuffer()));}
let choiceMode=false;
async function menu(){await expected(216,choiceMode?444:477,/STARRY_RW5 menu/);}
async function slots(role){await expected(216,role==='save'?95:153,new RegExp('STARRY_RW5 slots ready '+role));}
async function select(i,re){for(let p=0;p<Math.floor(i/4);p++)await click(348,474);return expected(216,126+(i%4)*92,re);}
(async()=>{
 fs.mkdirSync(results,{recursive:true});
 if(process.argv.includes('--prepare')){
  fs.mkdirSync(fixture,{recursive:true});fs.cpSync(path.join(root,'src'),path.join(fixture,'src'),{recursive:true});fs.copyFileSync(path.join(root,'package.json'),path.join(fixture,'package.json'));
  if(!fs.existsSync(path.join(fixture,'node_modules')))fs.symlinkSync(path.join(root,'node_modules'),path.join(fixture,'node_modules'),'junction');
  const manifest=JSON.parse(fs.readFileSync(path.join(fixture,'src/manifest.json'),'utf8'));manifest.package=pkg;manifest.name='星空列车30栏位测试';fs.writeFileSync(path.join(fixture,'src/manifest.json'),JSON.stringify(manifest,null,2));
  const ops=JSON.parse(fs.readFileSync(path.join(root,'src/common/story/1.txt'),'utf8')),cursor=ops.findIndex(x=>x.op==='choice'),runId=String(Date.now());assert.ok(cursor>=0);
  const ux=path.join(fixture,'src/pages/index/index.ux');let code=fs.readFileSync(ux,'utf8');
  const seed="const ready=()=>console.log('STARRY_RW5 QA ready');const seed=()=>{let index=0;const advance=()=>{if(index<30){storage.set({complete:()=>{},key:slotKey(index++),value:'',success:()=>advance(),fail:()=>console.log('QA seed failed')});return;}const legacy=newState();legacy.cursor="+cursor+";storage.set({complete:()=>{},key:LEGACY_KEY,value:JSON.stringify(createSave(legacy,'choice',0)),success:()=>storage.set({complete:()=>{},key:'qa_v022_run',value:"+JSON.stringify(runId)+",success:()=>ready(),fail:()=>{}}),fail:()=>{}});};advance();};storage.get({complete:()=>{},key:'qa_v022_run',default:'',success:data=>{if(data==="+JSON.stringify(runId)+")ready();else seed();},fail:()=>seed()});";
  code=code.replace("console.log('STARRY_RW5 title ready');",seed).replace('this.session=newState();this.cachedChapter=0;this.renderFrame();','this.session=newState();this.session.cursor='+cursor+';this.cachedChapter=0;this.renderFrame();');fs.writeFileSync(ux,code);
  const {default:Builder}=require('aiot-toolkit/lib/builder/VelaUxBuilder'),builder=new Builder();try{await builder.build(fixture,{mode:'development'});}finally{builder.dispose();}
  const rpk=path.join(fixture,'dist',pkg+'.debug.0.2.2.rpk');assert.ok(fs.existsSync(rpk));console.log('QA_PREPARED',rpk);return;
 }
 const info=await(await fetch('http://127.0.0.1:43125/info')).json();assert.equal(info.packageName,pkg,'Use the separate QA package, never the main application');
 const start=logs().length,report={version:'0.2.2',testedPackage:pkg,runtime:'official vela-watch-5.0',screen:[432,514],physicalDeviceTested:false};
 if(process.argv.includes('--persist')){
  const prev=JSON.parse(fs.readFileSync(path.join(results,'v022-slots-report.json'),'utf8'));await expected(216,419,/STARRY_RW5 slots ready load/);
  for(let i=29;i>=0;i--){if(i!==29){await menu();await slots('load');}const out=await select(i,new RegExp('STARRY_RW5 slot loaded '+(i+1)+' '+prev.positions[i].join(' ')));choiceMode=/STARRY_RW5 choice/.test(out);if(i===29)await shot('v022-cold-slot-30');}
  assert.ok(choiceMode);report.coldBoot30Slots=true;report.selectionRestored=true;report.result='passed';fs.writeFileSync(path.join(results,'v022-persistence-report.json'),JSON.stringify(report,null,2));console.log('PERSIST_PASSED');return;
 }
 await expected(216,419,/STARRY_RW5 slots ready load/);const legacy=await select(0,/STARRY_RW5 slot loaded 1 1 /);choiceMode=/STARRY_RW5 choice/.test(legacy);assert.ok(choiceMode);await shot('v022-selection');
 const positions=[];
 for(let i=0;i<30;i++){
  if(i){const out=await expected(i===1?216:366,i===1?400:477,/STARRY_RW5 (frame|choice)/);choiceMode=/STARRY_RW5 choice/.test(out);if(choiceMode){await expected(216,400,/STARRY_RW5 frame/);choiceMode=false;}}
  await menu();await slots('save');let out;
  if(i===0){await select(0,/STARRY_RW5 overwrite 1/);await shot('v022-overwrite');await click(216,268);await select(0,/STARRY_RW5 overwrite 1/);out=await expected(216,210,/STARRY_RW5 slot saved 1 /);}
  else out=await select(i,new RegExp('STARRY_RW5 slot saved '+(i+1)+' '));
  const m=new RegExp('STARRY_RW5 slot saved '+(i+1)+' (\\d+) (\\d+)').exec(out);positions.push([Number(m[1]),Number(m[2])]);await sleep(1600);
 }
 assert.equal(new Set(positions.map(x=>x.join(':'))).size,30);
 await menu();await slots('load');for(let p=0;p<7;p++)await click(348,474);await shot('v022-slots-29-30');await click(216,474);await click(216,385);
 for(let i=29;i>=0;i--){await menu();await slots('load');const out=await select(i,new RegExp('STARRY_RW5 slot loaded '+(i+1)+' '+positions[i].join(' ')));choiceMode=/STARRY_RW5 choice/.test(out);}
 assert.ok(choiceMode);await expected(216,400,/STARRY_RW5 frame/);choiceMode=false;
 for(let chapter=2;chapter<=17;chapter++){await menu();await expected(216,211,new RegExp('STARRY_RW5 frame '+chapter+' '));}
 await menu();const before=logs().length;await click(216,211);assert.ok(!logs().slice(before).includes('STARRY_RW5 chapter skipped'));await shot('v022-last-chapter-guard');await click(216,385);await expected(56,477,/STARRY_RW5 frame 16 /);
 assert.ok(!/STARRY_RW5 error|ASSERTION FAILED|PANIC!!!/.test(logs().slice(start)));Object.assign(report,{slots:30,positions,selectionRestored:true,overwriteCancel:true,overwriteConfirm:true,chaptersChecked:17,lastChapterGuard:true,back:true,result:'passed'});fs.writeFileSync(path.join(results,'v022-slots-report.json'),JSON.stringify(report,null,2));console.log('STARRY_30_SLOTS_PASSED',JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
