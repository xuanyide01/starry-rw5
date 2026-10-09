// Upgrade regression on the final package; does not overwrite occupied slots.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),dest=path.join(root,'native-test-results');
const log=path.join(process.env.STARRY_EMULATOR_HOME,'emulator.log'),logs=()=>fs.readFileSync(log,'utf8'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function click(x,y){assert.ok((await fetch('http://127.0.0.1:43125/click?x='+x+'&y='+y)).ok);await sleep(450);}
async function expectedClick(x,y,re){const n=logs().length;await click(x,y);for(let i=0;i<100;i++){const s=logs().slice(n);if(re.test(s))return s;if(/STARRY_RW5 error/.test(s))throw Error(s.slice(-2000));await sleep(150);}throw Error('Timeout '+re);}
async function capture(name){const r=await fetch('http://127.0.0.1:43125/screen');assert.ok(r.ok);fs.writeFileSync(path.join(dest,'v024-'+name+'.png'),Buffer.from(await r.arrayBuffer()));}
(async()=>{
 fs.mkdirSync(dest,{recursive:true});const start=logs().length,manifest=JSON.parse(fs.readFileSync(path.join(root,'src/manifest.json'),'utf8'));
 await capture('title');await expectedClick(216,375,/STARRY_RW5 frame 1 /);await capture('first-chapter');
 const chapters=[1];for(let chapter=2;chapter<=17;chapter++){await expectedClick(216,477,/STARRY_RW5 menu/);await expectedClick(216,211,new RegExp('STARRY_RW5 frame '+chapter+' '));chapters.push(chapter);}
 await capture('chapter17');await expectedClick(216,477,/STARRY_RW5 menu/);await click(216,443);
 const gallery=await require('./gallery-native-checks.cjs')({click,expectedClick,capture,logs});
 await expectedClick(216,419,/STARRY_RW5 slots ready load/);await capture('existing-slots');
 const old=await expectedClick(216,126,/STARRY_RW5 slot loaded 1 /),m=/STARRY_RW5 slot loaded 1 (\d+) (\d+)/.exec(old);assert.ok(m);
 await capture('existing-save-loaded');
 assert.ok(!/STARRY_RW5 error|STARRY_RW5 background failed|PANIC!!!|ASSERTION FAILED/.test(logs().slice(start)));
 const report={version:manifest.versionName,packageSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'dist',manifest.package+'.debug.'+manifest.versionName+'.rpk'))).digest('hex'),compiler:'aiot-toolkit 1.1.0',runtime:'official vela-watch-5.0',screen:[432,514],chaptersRead:chapters,gallery,previousSaveLoaded:m.slice(1).map(Number),resourceFailures:0,physicalFixVerified:false,result:'passed'};
 fs.writeFileSync(path.join(dest,'v024-resource-report.json'),JSON.stringify(report,null,2)+'\n');console.log('RESOURCE_COMPAT_PASSED',JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
