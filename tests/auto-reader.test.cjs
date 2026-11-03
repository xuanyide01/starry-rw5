const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),code=n=>fs.readFileSync(path.join(root,'src/common',n+'.js'),'utf8').replace(/^import[^\n]*\n/gm,'').replace(/export /g,'');
const api=new Function(['engine','saves','gallery','assets','auto-reader','text-format','portrait-layout'].map(code).join('\n')+';return {newState,checkpoint,restore,readFrame,readChapterSkip,next,nextChapter,choose,previous,SLOT_COUNT,LEGACY_KEY,slotKey,decodeSave,createSave,slotRow,imagePath,groupGallery,stepVariant,autoSpeeds,autoWait,normalizeText,portraitRect};')();
const source=fs.readFileSync(path.join(root,'src/pages/index/index.ux'),'utf8').split('<script>')[1].split('</script>')[0].replace(/^import[^\n]*\n/gm,'').replace('export default','globalThis.page=');
function model(settings={}){
 let now=0,id=0;const timers=new Map(),saved=new Map([['starry_rw5_settings_v1',JSON.stringify(settings)]]),messages=[];
 class ClockDate extends Date{static now(){return now;}}
 const context=vm.createContext({...api,Date:ClockDate,
  setTimeout(fn,ms){const key=++id;timers.set(key,{fn,at:now+Number(ms||0)});return key;},clearTimeout(key){timers.delete(key);},
  file:{readText(o){context.setTimeout(()=>o.success({text:fs.readFileSync(path.join(root,'src',o.uri),'utf8')}),2);}},
  storage:{get(o){context.setTimeout(()=>o.success(saved.get(o.key)||''),1);},set(o){saved.set(o.key,o.value);context.setTimeout(()=>o.success&&o.success(),1);}},
  prompt:{showToast(){}},console:{log:(...args)=>messages.push(args.join(' ')),error(){}}});
 vm.runInContext(source,context);const p=context.page;Object.assign(p,JSON.parse(JSON.stringify(p.private)));p.$element=()=>({scrollTo(){}});p.onInit();
 function tick(ms){const end=now+ms;let n=0;while(true){const e=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!e)break;assert(++n<20000,'timer loop');now=e[1].at;timers.delete(e[0]);e[1].fn();}now=end;}
 tick(2);
 function start(){p.textSpeed=0;p.startNew();tick(10);assert.equal(p.mode,'play');assert.equal(p.displayText,p.fullText);}
 function enable(){p.showMenu();p.toggleAuto();p.resume();assert.equal(p.autoEnabled,true);}
 const position=()=>p.session.chapter+':'+p.session.cursor;
 return {p,tick,timers,saved,messages,start,enable,position};
}
test('three automatic speeds use bounded waits after final glyph',()=>{
 assert.equal(api.autoWait(0,20),2600);assert.equal(api.autoWait(1,20),1500);assert.equal(api.autoWait(2,20),800);assert.equal(api.autoWait(1,61),1555);assert.equal(api.autoWait(1,10000),6500);
});
test('automatic mode starts off; old font/speed settings work and only the speed tier persists',()=>{
 const m=model({fontSize:28,textSpeed:0,autoSpeed:2,autoEnabled:true});assert.equal(m.p.autoEnabled,false);assert.equal(m.p.autoSpeed,2);m.start();m.p.showMenu();m.p.cycleAutoSpeed();const s=JSON.parse(m.saved.get('starry_rw5_settings_v1'));assert.equal(s.autoSpeed,0);assert.equal(s.textSpeed,0);assert.equal(s.fontSize,28);assert.ok(!('autoEnabled' in s));assert.equal(model({}).p.autoSpeed,1);
});
test('automatic reading waits then types at 30ms without changing manual speed',()=>{
 const m=model();m.start();m.enable();const before=m.position();m.tick(1499);assert.equal(m.position(),before);m.tick(1);assert.notEqual(m.position(),before);const current=m.position();assert.equal(m.p.textSpeed,0);assert.ok(m.p.displayText.length<m.p.fullText.length);
 const remaining=(m.p.fullText.length-m.p.displayText.length)*30;m.tick(remaining-1);assert.equal(m.position(),current);assert.ok(m.p.displayText.length<m.p.fullText.length);m.tick(1);assert.equal(m.p.displayText,m.p.fullText);m.tick(api.autoWait(m.p.autoSpeed,m.p.fullText.length)-1);assert.equal(m.position(),current);m.tick(1);assert.notEqual(m.position(),current);
});
test('manual completion of a typing line restarts a full reading delay',()=>{
 const m=model();m.start();m.enable();m.tick(1500);const before=m.position();m.p.advance();assert.equal(m.p.displayText,m.p.fullText);m.tick(api.autoWait(m.p.autoSpeed,m.p.fullText.length)-1);assert.equal(m.position(),before);m.tick(1);assert.notEqual(m.position(),before);
});
test('menu and 30-slot selectors pause automatic reading; return waits afresh',()=>{
 const m=model();m.start();m.enable();const before=m.position();m.tick(400);m.p.showMenu();m.tick(60000);assert.equal(m.position(),before);m.p.openSlots('load');m.tick(1000);assert.equal(m.p.mode,'slots');assert.equal(m.p._slotData.length,30);m.tick(60000);assert.equal(m.position(),before);m.p.closeSlots();m.p.resume();m.tick(1499);assert.equal(m.position(),before);m.tick(1);assert.notEqual(m.position(),before);
});
test('every original choice pauses automatic reading until a manual choice',()=>{
 let count=0;
 for(let chapter=1;chapter<=17;chapter++){
  const ops=JSON.parse(fs.readFileSync(path.join(root,'src/common/story',chapter+'.txt'),'utf8'));
  for(let cursor=0;cursor<ops.length;cursor++)if(ops[cursor].op==='choice'){
   const m=model(),p=m.p;m.start();p.clearTyping();p.autoEnabled=true;p.session=api.newState();p.session.chapter=chapter;p.session.cursor=cursor;p.cachedChapter=0;p.renderFrame();m.tick(10);assert.equal(p.mode,'choice');const before=JSON.stringify(p.session);m.tick(60000);assert.equal(JSON.stringify(p.session),before);assert.equal(p.autoEnabled,true);
   p.showMenu();p.goNextChapter();assert.equal(p.mode,'choice');assert.equal(JSON.stringify(p.session),before);
   p.pick(0);m.tick(20);assert.equal(p.mode,'play');m.tick(p.fullText.length*30+api.autoWait(p.autoSpeed,p.fullText.length)+30);assert.ok(m.messages.some(s=>s.startsWith('STARRY_RW5 auto advance')));count++;
  }
 }
 assert.equal(count,4);
});
test('dragging dialogue pauses the wait and never acts as a tap',()=>{
 const m=model();m.start();m.enable();const before=m.position();m.p.dialogueTouchStart({touches:[{clientX:250,clientY:420}]});m.tick(60000);assert.equal(m.position(),before);m.p.dialogueTouchMove({touches:[{clientX:250,clientY:350}]});m.p.dialogueTouchEnd();m.p.dialogueTap();assert.equal(m.position(),before);m.tick(500);m.p.dialogueScrolled();m.tick(1499);assert.equal(m.position(),before);m.tick(1);assert.notEqual(m.position(),before);
});
test('background suspension freezes story and restarts waiting on return',()=>{
 const m=model();m.start();m.enable();const before=m.position();m.tick(300);m.p.onHide();m.tick(60000);assert.equal(m.position(),before);m.p.onShow();m.tick(1499);assert.equal(m.position(),before);m.tick(1);assert.notEqual(m.position(),before);
});
test('chapter read that finishes in background renders only when shown',()=>{
 const m=model(),p=m.p;p.textSpeed=0;p.startNew();p.onHide();m.tick(100);assert.equal(p._pendingFrame,true);const before=m.position();m.tick(60000);assert.equal(m.position(),before);p.onShow();m.tick(20);assert.equal(p.mode,'play');assert.equal(p.displayText,p.fullText);assert.equal(p._pendingFrame,false);
});
test('previous, title, error, end and destruction cancel automatic reading',()=>{
 for(const action of ['goBack','toTitle','fail','onDestroy','ending']){
  const m=model(),p=m.p;m.start();m.enable();if(action==='ending'){p.clearTyping();p.session=api.newState();p.session.chapter=17;p.session.cursor=JSON.parse(fs.readFileSync(path.join(root,'src/common/story/17.txt'),'utf8')).length;p.cachedChapter=0;p.renderFrame();m.tick(20);assert.equal(p.mode,'end');}else p[action]('test');
  const before=m.position();m.tick(60000);assert.equal(p.autoEnabled,false,action);assert.equal(m.position(),before,action);assert.equal(m.timers.size,0,action);
 }
});
test('late cancelled callbacks cannot erase a newer wait or advance a changed scene',()=>{
 const m=model();m.start();m.enable();const old=m.timers.get(m.p._autoTimer).fn,before=m.position();m.p.showMenu();m.p.resume();const current=m.p._autoTimer;old();assert.equal(m.position(),before);assert.equal(m.p._autoTimer,current);m.p.loading=true;m.tick(2000);assert.equal(m.position(),before);
});
test('save from automatic reading preserves the original save format and continues after success',()=>{
 const m=model(),p=m.p;m.start();m.enable();p.showMenu();p.openSlots('save');m.tick(100);p.selectSlot(9);m.tick(10);assert.equal(p.mode,'play');assert.equal(p.autoEnabled,true);const old=JSON.parse(m.saved.get(api.slotKey(9)));assert.equal(old.version,1);assert.deepEqual(Object.keys(old).sort(),['savedAt','sceneMode','state','version']);assert.ok(!('autoEnabled' in old.state));const before=m.position();m.tick(1500);assert.notEqual(m.position(),before);
});
test('title config retains speed settings and stale title/gallery callbacks do not change story',()=>{
 const m=model(),p=m.p;p.openConfig();assert.equal(p.mode,'config');p.cycleAutoSpeed();assert.equal(p.autoSpeed,2);p.toTitle();m.start();const before=m.position();p.startNew();p.continueGame();p.openConfig();p.openGallery();p.viewCg(0);assert.equal(p.mode,'play');assert.equal(m.position(),before);
});
