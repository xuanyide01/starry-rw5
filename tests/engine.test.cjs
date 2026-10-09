const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const chapters=Array.from({length:17},(_,i)=>JSON.parse(fs.readFileSync(path.join(root,'src/common/story',`${i+1}.txt`),'utf8')));
const engine=import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(root,'src/common/engine.js'))).toString('base64'));
const assetPaths=JSON.parse(/const paths=(.*);\r?\n/.exec(fs.readFileSync(path.join(root,'src/common/assets.js'),'utf8'))[1]);

test('every extracted image and jump target exists',()=>{
 for(const ops of chapters)for(const op of ops){
  if(op.image)assert.ok(assetPaths[op.image]&&fs.existsSync(path.join(root,'src/common/images',assetPaths[op.image])),op.image);
  const targets=op.op==='choice'?op.items.map(x=>x.to):op.op==='jump'?[op.to]:[];
  for(const [chapter,cursor]of targets){assert.ok(chapter>=1&&chapter<=17);assert.ok(cursor>=0&&cursor<chapters[chapter-1].length);}
 }
});
test('all reachable branches finish without losing save/restore state',async()=>{
 const e=await engine, pending=[e.newState()], ends=[],visitedChoices=new Set();let total=0;
 while(pending.length){
  let s=pending.pop(),seen=new Set();
  for(let n=0;n<30000;n++){
   const key=s.chapter+':'+s.cursor;assert.ok(!seen.has(key),'loop at '+key);seen.add(key);
   const f=e.readFrame(chapters[s.chapter-1],s);
   if(f.type==='text'){
    total++;assert.ok(f.text.length>0);
    if(n%97===0){const restored=e.restore(JSON.parse(JSON.stringify(e.checkpoint(s))));assert.deepEqual(e.checkpoint(restored),e.checkpoint(s));}
    e.next(s);
   }else if(f.type==='jump'){s.chapter=f.to[0];s.cursor=f.to[1];}
   else if(f.type==='choice'){
    visitedChoices.add(s.chapter+':'+s.cursor);
    f.items.forEach((item,index)=>{const branch=e.restore(e.checkpoint(s));e.choose(branch,item,index);pending.push(branch);});break;
   }else{assert.equal(s.chapter,17);ends.push(s.choices);break;}
   assert.ok(n<29999,'path did not finish');
  }
 }
 assert.equal(visitedChoices.size,4);assert.equal(ends.length,36);
 fs.writeFileSync(path.join(root,'test-report.json'),JSON.stringify({choiceGroups:visitedChoices.size,completedPaths:ends.length,framesChecked:total,choicePaths:ends},null,2));
});
test('back restores visuals and previous selection; history is bounded',async()=>{
 const e=await engine,s=e.newState();s.background='bg_01';s.body='character';
 e.next(s);s.background='bg_02';s.body='';assert.ok(e.previous(s));assert.equal(s.cursor,0);assert.equal(s.background,'bg_01');assert.equal(s.body,'character');
 e.choose(s,{to:[2,5]},1);assert.deepEqual(s.choices,[1]);assert.ok(e.previous(s));assert.deepEqual(s.choices,[]);assert.equal(s.chapter,1);
 for(let i=0;i<40;i++)e.next(s);assert.equal(s.history.length,30);
 assert.throws(()=>e.restore({chapter:99,cursor:0}));assert.throws(()=>e.restore({chapter:1,cursor:-1}));
});
test('closing an event picture restores the regular scene background',async()=>{
 const e=await engine,s=e.newState();
 const ops=[{op:'background',image:'station'},{op:'background',image:'event',event:true},{op:'text',text:'event',speaker:''},{op:'restoreBackground'},{op:'text',text:'scene',speaker:''}];
 e.readFrame(ops,s);assert.equal(s.background,'event');e.next(s);e.readFrame(ops,s);assert.equal(s.background,'station');
 assert.equal(e.restore(e.checkpoint(s)).regularBackground,'station');
});
test('chapter skip preserves choices, reads the next opening and can be undone',async()=>{
 const e=await engine,s=e.newState();
 s.cursor=chapters[0].findIndex(x=>x.op==='choice');const selection=e.readFrame(chapters[0],s);
 e.choose(s,selection.items[1],1);e.readFrame(chapters[0],s);const before=e.checkpoint(s);
 assert.ok(e.nextChapter(s));const opening=e.readFrame(chapters[1],s);
 assert.equal(s.chapter,2);assert.equal(opening.type,'text');assert.deepEqual(s.choices,[1]);assert.equal(s.body,'');
 const saved=e.restore(JSON.parse(JSON.stringify(e.checkpoint(s))));assert.deepEqual(e.readFrame(chapters[1],saved),opening);
 assert.ok(e.previous(s));assert.deepEqual(e.checkpoint(s),before);
});
test('skipping an unchosen selection and all chapter boundaries stays valid',async()=>{
 const e=await engine,s=e.newState();s.cursor=chapters[0].findIndex(x=>x.op==='choice');e.readFrame(chapters[0],s);
 for(let ch=2;ch<=17;ch++){assert.ok(e.nextChapter(s));const f=e.readFrame(chapters[ch-1],s);assert.equal(s.chapter,ch);assert.equal(f.type,'text');assert.deepEqual(s.choices,[]);}
 const last=e.checkpoint(s),historyLength=s.history.length;assert.equal(e.nextChapter(s),false);assert.deepEqual(e.checkpoint(s),last);assert.equal(s.history.length,historyLength);
});
