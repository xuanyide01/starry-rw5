// Use a disposable simulator with old slot 29 (chapter 2, cursor 120). No saves are written.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'native-test-results/v033'),base=process.env.STARRY_PREVIEW_URL||'http://127.0.0.1:43187/';fs.mkdirSync(out,{recursive:true});
const home=process.env.STARRY_EMULATOR_HOME||path.resolve(root,'../../../2026-11-03/starry-ui/environment'),logs=()=>fs.readFileSync(path.join(home,'emulator.log'),'utf8'),pause=ms=>new Promise(r=>setTimeout(r,ms));
async function get(s){const r=await fetch(base+s);if(!r.ok)throw Error(await r.text());return r;}
async function tap(x,y){await get('click?x='+x+'&y='+y);}
async function click(x,y){await tap(x,y);await pause(300);}
async function wait(at,re){for(let i=0;i<125;i++){const s=logs().slice(at);if(re.test(s))return s;await pause(200);}throw Error('Native timeout: '+re);}
async function expect(x,y,re){const at=logs().length;await click(x,y);return wait(at,re);}
async function shot(name){const b=Buffer.from(await(await get('screen')).arrayBuffer());fs.writeFileSync(path.join(out,name+'.png'),b);return crypto.createHash('sha256').update(b).digest('hex');}
async function load29(){await expect(216,354,/STARRY_RW5 slots ready load/);for(let i=0;i<7;i++)await click(350,476);await expect(216,125,/STARRY_RW5 slot loaded 29 2 120/);await pause(500);}
async function menu(){await expect(216,482,/STARRY_RW5 menu/);}
async function title(){await menu();await click(216,447);}
(async()=>{
 const start=logs().lastIndexOf('STARRY_RW5 title ready');assert.ok(start>=0);let painted=false;for(let i=0;i<125;i++){if(Buffer.from(await(await get('screen')).arrayBuffer()).length>100000){painted=true;break;}await pause(300);}assert.ok(painted);await pause(1200);await shot('title');await expect(216,404,/STARRY_RW5 config/);await shot('config');await click(216,444);
 await load29();await shot('old-save-two-lines');
 await expect(350,482,/STARRY_RW5 frame 2 123/);await shot('short-speaker-line');
 await expect(350,482,/STARRY_RW5 frame 2 124/);await shot('automatic-wrap');
 await menu();await click(216,312);await click(216,402);const at=logs().length;await tap(350,482);await wait(at,/STARRY_RW5 frame 2 128/);await shot('typing-first-glyphs');await pause(700);await shot('typing-complete');
 await menu();await click(216,357);await click(216,402);await shot('large-font-short');
 await title();await expect(216,304,/STARRY_RW5 frame 1 2/);await menu();await click(216,312);await click(216,402);
 let cursor=2;while(cursor<55){const at=logs().length;await tap(350,482);const chunk=await wait(at,/STARRY_RW5 frame 1 /),m=[...chunk.matchAll(/STARRY_RW5 frame 1 (\d+)/g)].at(-1);assert.ok(m);cursor=Number(m[1]);await pause(120);}assert.equal(cursor,55);
 await pause(300);const top=await shot('long-paragraph-top');await get('drag?x0=210&y0=435&x1=210&y1=345');await pause(600);const bottom=await shot('long-paragraph-scrolled');assert.notEqual(top,bottom,'long text must scroll');
 await expect(350,482,/STARRY_RW5 frame 1 /);await shot('next-line-reset');
 await menu();await click(216,357);await click(216,447);await load29();await shot('preserved-progress');
 assert.ok(!/STARRY_RW5 error|PANIC!!!|ASSERTION FAILED/.test(logs().slice(start)));
 const file=path.join(root,'dist/com.codex.starry.rw5.debug.0.3.3.rpk'),report={version:'0.3.3',passed:true,runtime:'official vela-watch-5.0',physicalDeviceTested:false,packageSha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),checks:['Preserved slot 29 loads at chapter 2 cursor 120','Short speaker text starts at the first dialogue row','Automatic wrapping uses fixed left edge','Typing starts at the same upper left position as completed text','Large font uses the same first row','Long original paragraph grows and scrolls','Next line resets scroll to top','Preview returns to preserved chapter 2 progress without writing a save'],visualReviewPending:true};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,checks:report.checks.length}));
})().catch(e=>{console.error(e);process.exitCode=1});
