const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),uri=text=>'data:text/javascript;base64,'+Buffer.from(text).toString('base64');
const engineUri=uri(fs.readFileSync(path.join(root,'src/common/engine.js'),'utf8'));
const saves=import(uri(fs.readFileSync(path.join(root,'src/common/saves.js'),'utf8').replace("'./engine.js'",JSON.stringify(engineUri))));
const gallery=import(uri(fs.readFileSync(path.join(root,'src/common/gallery.js'),'utf8')));
const assetPaths=JSON.parse(/const paths=(.*);\r?\n/.exec(fs.readFileSync(path.join(root,'src/common/assets.js'),'utf8'))[1]);
test('thirty slots keep independent positions, choices and save metadata',async()=>{
 const s=await saves,e=await import(engineUri),storage=new Map(),keys=[];
 for(let i=0;i<s.SLOT_COUNT;i++){const state=e.newState();state.chapter=i%17+1;state.cursor=i*10;state.text='场景 '+i;state.choices=[i%3];const key=s.slotKey(i);keys.push(key);storage.set(key,JSON.stringify(s.createSave(state,i===0?'choice':'play',1000+i)));state.choices.push(99);}
 assert.equal(s.SLOT_COUNT,30);assert.equal(new Set(keys).size,30);
 for(let i=0;i<30;i++){const saved=s.decodeSave(storage.get(keys[i]));assert.equal(saved.state.chapter,i%17+1);assert.equal(saved.state.cursor,i*10);assert.deepEqual(saved.state.choices,[i%3]);assert.equal(saved.savedAt,1000+i);assert.equal(saved.sceneMode,i===0?'choice':'play');}
 const original=storage.get(keys[0]);storage.set(keys[9],JSON.stringify(s.createSave(e.newState(),'play',2000)));assert.equal(storage.get(keys[0]),original);
 assert.throws(()=>s.slotKey(-1));assert.throws(()=>s.slotKey(30));assert.throws(()=>s.slotKey(1.5));
});
test('empty, damaged and legacy saves have useful slot labels',async()=>{
 const s=await saves,e=await import(engineUri);
 assert.equal(s.decodeSave(''),null);assert.equal(s.slotRow(9,null).title,'存档 10');assert.equal(s.slotRow(9,null).occupied,false);
 assert.throws(()=>s.decodeSave('invalid'));assert.throws(()=>s.decodeSave({version:2,state:e.newState()}));assert.throws(()=>s.decodeSave({version:1,state:{chapter:18,cursor:0}}));
 const old=s.decodeSave(JSON.stringify({version:1,state:e.checkpoint(e.newState())}));old.legacy=true;
 assert.match(s.slotRow(0,old).meta,/旧版存档/);assert.equal(old.savedAt,0);
 const selection=s.createSave(e.newState(),'choice',Date.now());assert.equal(s.slotRow(0,selection).preview,'正在选择下一步');
 assert.match(s.slotRow(0,{invalid:true}).meta,/无法读取/);
});
test('all CG variants have usable images and a complete distinct catalog',()=>{
 const catalog=JSON.parse(fs.readFileSync(path.join(root,'src/common/gallery.txt'),'utf8'));
 assert.equal(catalog.length,124);assert.equal(new Set(catalog.map(x=>x.image)).size,124);
 for(const item of catalog){assert.ok(item.label);const p=path.join(root,'src/common/images',assetPaths[item.image]);assert.ok(fs.existsSync(p),item.image);const b=fs.readFileSync(p);assert.ok((b[0]===255&&b[1]===216)||(b[0]===137&&b[1]===80));assert.ok(!/^evcg\d+$/.test(item.image));}
 assert.deepEqual(catalog.filter(x=>x.source==='additional-texture').map(x=>x.image).sort(),['evcg04c','evcg04d','large_evcg02e']);
 assert.equal(catalog.filter(x=>x.source==='event-table').length,121);
});
test('scene grouping keeps every image exactly once, including closeups and extra variants',async()=>{
 const g=await gallery,catalog=JSON.parse(fs.readFileSync(path.join(root,'src/common/gallery.txt'),'utf8')),groups=g.groupGallery(catalog);
 assert.equal(groups.length,24);assert.equal(new Set(groups.map(x=>x.id)).size,24);
 const variants=groups.flatMap(x=>x.variants);assert.deepEqual(variants,catalog);assert.equal(new Set(variants.map(x=>x.image)).size,124);
 for(let i=1;i<=21;i++){
   const id='evcg'+String(i).padStart(2,'0'),group=groups.find(x=>x.id===id);assert.ok(group,id);
   assert.ok(group.variants.every(x=>x.image.replace(/^large_/,'').startsWith(id)));
   assert.equal(group.image,group.variants[0].image);
 }
 assert.equal(groups.find(x=>x.id==='evcg01').variants.length,12);
 assert.equal(groups.find(x=>x.id==='evcg10').variants.length,21);
 assert.deepEqual(groups.find(x=>x.id==='evcg04').variants.map(x=>x.image),['evcg04a','evcg04b','evcg04c','evcg04d']);
 assert.equal(groups.find(x=>x.id==='evcg15').variants.length,1);
});
test('tapping cycles every variant within its own scene and wraps at both ends',async()=>{
 const g=await gallery,groups=g.groupGallery(JSON.parse(fs.readFileSync(path.join(root,'src/common/gallery.txt'),'utf8')));
 for(const group of groups){
   let index=0;const seen=[];
   for(let i=0;i<group.variants.length;i++){seen.push(group.variants[index].image);index=g.stepVariant(index,1,group.variants.length);}
   assert.deepEqual(seen,group.variants.map(x=>x.image));assert.equal(index,0);
   assert.equal(g.stepVariant(0,-1,group.variants.length),group.variants.length-1);
 }
});
