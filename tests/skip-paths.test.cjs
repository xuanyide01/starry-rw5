const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'src/common/engine.js'),'utf8').replace(/export /g,''),e=new Function(source+';return {newState,readFrame,readChapterSkip,next,nextChapter,choose,checkpoint};')();
const chapters=Array.from({length:17},(_,i)=>JSON.parse(fs.readFileSync(path.join(root,'src/common/story',i+1+'.txt'),'utf8')));
function play(p,fast){const s=e.newState();let i=0,context=null;for(let n=0;n<30000;n++){const f=fast?e.readChapterSkip(chapters[s.chapter-1],s,context||(context=e.nextChapter(s))):e.readFrame(chapters[s.chapter-1],s);if(f.type==='jump'){s.chapter=f.to[0];s.cursor=f.to[1];continue;}if(f.type==='yield')continue;context=null;if(f.type==='choice'){assert.ok(i<p.length);e.choose(s,f.items[p[i]],p[i++]);}else if(f.type==='end'){assert.equal(i,p.length);return e.checkpoint(s);}else if(!fast)e.next(s);}throw Error('Path budget');}
test('all 36 reachable selection paths keep their original ending state with menu skip',()=>{
 const paths=JSON.parse(fs.readFileSync(path.join(root,'test-report.json'),'utf8')).choicePaths;assert.equal(paths.length,36);for(const p of paths)assert.deepEqual(play(p,true),play(p,false));
 fs.writeFileSync(path.join(root,'reports/skip-paths.json'),JSON.stringify({result:'passed',choiceGroups:4,paths:36,originalEndStatesMatch:true},null,2));
});
