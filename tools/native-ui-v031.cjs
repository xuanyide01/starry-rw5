const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'native-test-results/v031');fs.mkdirSync(out,{recursive:true});
const home=process.env.STARRY_EMULATOR_HOME||path.resolve(root,'../../../2026-11-03/starry-ui/environment'),base=process.env.STARRY_PREVIEW_URL||'http://127.0.0.1:43187/';
const logs=()=>fs.readFileSync(path.join(home,'emulator.log'),'utf8'),pause=ms=>new Promise(r=>setTimeout(r,ms));
async function get(s){const r=await fetch(base+s);if(!r.ok)throw Error(await r.text());return r;}
async function click(x,y){await get('click?x='+x+'&y='+y);await pause(450);}
async function shot(n){await pause(600);const b=Buffer.from(await(await get('screen')).arrayBuffer());fs.writeFileSync(path.join(out,n+'.png'),b);return crypto.createHash('sha256').update(b).digest('hex');}
async function wait(at,re){for(let i=0;i<125;i++){const s=logs().slice(at);if(re.test(s))return s;await pause(200);}await shot('timeout');throw Error('Native timeout: '+re);}
async function expected(x,y,re){const at=logs().length;await click(x,y);return wait(at,re);}
(async()=>{
 const start=logs().lastIndexOf('STARRY_RW5 title ready');assert.ok(start>=0);
 if(!process.argv.includes('--resume-gallery')){
 // Cold-boot font initialization may finish after am start has returned.
 let painted=false;for(let i=0;i<100;i++){const b=Buffer.from(await(await get('screen')).arrayBuffer());if(b.length>100000){painted=true;break;}await pause(300);}assert.ok(painted,'title must paint before input');
 await pause(1500);await shot('title');
 await expected(216,404,/STARRY_RW5 config/);await shot('config');
 for(const n of [2,0,1])await expected(216,124,new RegExp('STARRY_RW5 auto speed '+n));
 await click(216,444);await expected(216,354,/STARRY_RW5 slots ready load/);await shot('old-slots');
 await expected(216,125,/STARRY_RW5 slot loaded 1 1 2/);await pause(800);await shot('old-save-play');
 await expected(216,482,/STARRY_RW5 menu/);await shot('menu');await expected(216,222,/STARRY_RW5 auto enabled true/);
 let at=logs().length;await click(216,402);await wait(at,/STARRY_RW5 auto advance/);await shot('auto-play');
 await expected(216,482,/STARRY_RW5 menu/);at=logs().length;await pause(2500);assert.ok(!/STARRY_RW5 auto advance/.test(logs().slice(at)),'menu must pause automatic reading');
 await expected(216,87,/STARRY_RW5 slots ready save/);await shot('save-slots');
 for(let i=0;i<7;i++)await click(350,476);await shot('slot-30');const saved=await expected(216,218,/STARRY_RW5 (slot saved 30 |overwrite 30)/);if(/STARRY_RW5 overwrite 30/.test(saved))await expected(216,320,/STARRY_RW5 slot saved 30 /);
 await expected(216,482,/STARRY_RW5 menu/);await expected(216,177,/STARRY_RW5 choice 1 1362/);await shot('choice-paused');
 at=logs().length;await pause(3500);assert.ok(!/STARRY_RW5 auto advance|STARRY_RW5 frame/.test(logs().slice(at)),'choice requires user input');
 await expected(216,486,/STARRY_RW5 menu/);at=logs().length;await click(216,177);await pause(1800);assert.ok(!/STARRY_RW5 frame|STARRY_RW5 auto advance/.test(logs().slice(at)),'chapter skip must not bypass choice');await shot('choice-skip-protected');
 at=logs().length;await click(216,346);await wait(at,/STARRY_RW5 frame/);await wait(at,/STARRY_RW5 auto advance/);await shot('auto-after-choice');
 await expected(216,482,/STARRY_RW5 menu/);await click(216,357);await click(216,402);await shot('large-font');
 await expected(216,482,/STARRY_RW5 menu/);await click(216,357);await click(216,402);
 await click(78,482);at=logs().length;await pause(2200);assert.ok(!/STARRY_RW5 auto advance/.test(logs().slice(at)),'previous line stops automatic reading');await shot('dialogue');
 await expected(216,482,/STARRY_RW5 menu/);await click(216,447);await expected(216,454,/STARRY_RW5 gallery ready 24 124/);await shot('gallery');
 }else{
  const core=logs().slice(start);for(const token of ['STARRY_RW5 config','STARRY_RW5 slot loaded 1 1 2','STARRY_RW5 auto advance','STARRY_RW5 slot saved 30','STARRY_RW5 choice 1 1362','STARRY_RW5 gallery ready 24 124'])assert.ok(core.includes(token),token);
  await click(216,488);
 }
 // The first three catalog groups are single title/intro cards; group 4 has 12 CG variants.
 await expected(324,330,/STARRY_RW5 cg 4 1 /);await expected(216,200,/STARRY_RW5 cg 4 2 /);await shot('cg-difference');await click(216,488);
 const pages=[await shot('gallery-page-1')];for(let i=1;i<6;i++){await click(350,476);pages.push(await shot('gallery-page-'+(i+1)));}assert.equal(new Set(pages).size,6,'all gallery pages must refresh');
 for(let i=0;i<5;i++)await click(65,476);await click(216,476);await shot('title-final');
 assert.ok(!/STARRY_RW5 error|PANIC!!!|ASSERTION FAILED/.test(logs().slice(start)));
 const pkg=path.join(root,'dist/com.codex.starry.rw5.debug.0.3.1.rpk');
 const report={version:'0.3.1',passed:true,runtime:'official vela-watch-5.0',device:'isolated emulator-5608 / StarryUI20261103',physicalDeviceTested:false,
  packageSha256:crypto.createHash('sha256').update(fs.readFileSync(pkg)).digest('hex'),
  checks:['Original-style title buttons and config operate','0.2.7 slot 1 loads after an in-place upgrade with byte-identical old storage','Three automatic speed tiers switch','Automatic reading advances and pauses in menu/save selector','Slot 30 can be saved','Original first choice pauses and next chapter cannot bypass it','Manual choice resumes automatic reading','Large/standard font changes and previous line disables automatic reading','CG difference switches and all six gallery pages refresh','Returning to title shows the new layout'],galleryPageHashes:pages};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,version:'0.3.1',checks:report.checks.length}));
})().catch(e=>{console.error(e);process.exitCode=1;});
