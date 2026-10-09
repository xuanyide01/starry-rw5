const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),starry=path.basename(root)==='starry-rw5',chunkSize=path.basename(root)==='summer-rw5'?1024:512;
const code=n=>fs.readFileSync(path.join(root,'src/common',n+'.js'),'utf8').replace(/^import[^\n]*\n/gm,'').replace(/export /g,'');
const api=new Function((starry?'':code('catalog'))+code('engine')+';return {newState,readFrame,readChapterSkip,nextChapter,next,choose,previous,checkpoint,restore'+(starry?'':',catalog')+'};')();
const cache=new Map();function story(id){if(!cache.has(id)){const file=starry?path.join(root,'src/common/story',id+'.txt'):path.join(root,'converted-story',id+'.json');cache.set(id,JSON.parse(fs.readFileSync(file,'utf8')));}return cache.get(id);}
const chapter=s=>starry?s.chapter:s.rootChapter;
function step(s,context){const all=story(s.chapter),base=starry?0:Math.floor(s.cursor/chunkSize)*chunkSize;const f=context?api.readChapterSkip(starry?all:all.slice(base,base+chunkSize),s,context,base,all.length):api.readFrame(starry?all:all.slice(base,base+chunkSize),s,base,all.length);if(starry&&f.type==='jump'){s.chapter=f.to[0];s.cursor=f.to[1];}return f;}
function skip(s){const context=api.nextChapter(s);assert.ok(context);for(let n=0;n<4000;n++){const f=step(s,context);if(!['jump','yield'].includes(f.type))return f;}throw Error('skip budget '+s.chapter+':'+s.cursor);}
function ordinary(s,initial){for(let n=0;n<150000;n++){const f=step(s);if(['jump','yield'].includes(f.type))continue;if(f.type!=='text'||chapter(s)!==initial)return f;api.next(s);}throw Error('ordinary budget');}
test('every chapter skip preserves the original first decision, variables and call stack',()=>{
 const ids=starry?Array.from({length:17},(_,i)=>i+1):api.catalog.chapters.map(x=>x.id);let decisions=0;
 for(const id of ids){const a=api.newState(id),b=api.restore(api.checkpoint(a)),initial=chapter(a);if(starry){a.chapter=id;b.chapter=id;}
  const expected=ordinary(a,starry?id:initial),actual=skip(b);assert.deepEqual(actual,expected,'frame '+id);assert.deepEqual(api.checkpoint(b),api.checkpoint(a),'VM state '+id);if(['choice','map'].includes(actual.type)){decisions++;const before=api.checkpoint(b);assert.deepEqual(skip(b),actual);assert.deepEqual(api.checkpoint(b),before);}
 }assert.ok(decisions>0);fs.mkdirSync(path.join(root,'reports'),{recursive:true});fs.writeFileSync(path.join(root,'reports/chapter-skip.json'),JSON.stringify({result:'passed',chapters:ids.length,decisionStops:decisions,normalReadingStateMatches:true},null,2));
});
test('skip respects local branch operations and stops before selecting even in the final chapter',()=>{
 const s=api.newState(starry?17:undefined);if(starry)s.chapter=17;const context=api.nextChapter(s);
 const choice=starry?{op:'choice',items:[{text:'pick',to:[17,3]}]}:path.basename(root)==='summer-rw5'?{op:'choice',variable:9,items:[{text:'pick',value:7,condition:1}]}:{op:'choice',target:['v','f',9],items:[{text:'pick',value:7}]};
 const ops=starry?[{op:'text',text:'before',speaker:''},choice]:[{op:'text',text:'before',speaker:''},path.basename(root)==='summer-rw5'?{op:'set',variable:8,value:3}:{op:'set',target:['v','f',8],value:3},choice];
 const f=api.readChapterSkip(ops,s,context,0,ops.length);assert.equal(f.type,'choice');assert.equal(s.cursor,ops.length-1);assert.deepEqual(s.choices,[]);if(!starry){assert.equal(s.variables[path.basename(root)==='summer-rw5'?'8':'f:8'],3);assert.equal(s.variables[path.basename(root)==='summer-rw5'?'9':'f:9'],undefined);}
});
