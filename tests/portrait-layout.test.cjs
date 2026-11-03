const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'src/manifest.json'),'utf8')),current=path.join(root,'reports/portrait-layout-v'+manifest.versionName.replace(/\./g,'')+'.json'),report=JSON.parse(fs.readFileSync(fs.existsSync(current)?current:path.join(root,'reports/portrait-layout-v031.json'),'utf8'));
test('normal and closeup portraits preserve original character-table anchors on one pixel scale',()=>{
 assert.equal(report.portraits,368);assert.equal(report.commonScale,.3375);
 const goldens={noir_01face:[64,5],karuha_01face:[64,25],neri_01face:[64,11],jibie_01face:[64,-32],hanae_01face:[64,-21],takase_01face:[64,-15],mashiro_00face:[64,3],large_noir_01face:[-37,-71],large_jibie_01face:[-20,-114]};
 for(const [name,position] of Object.entries(goldens)){const r=report.rows.find(x=>x.image===name);assert.ok(r,name);assert.deepEqual([r.drawLeft,r.drawTop],position,name);}
 const noir=report.rows.find(x=>x.image==='noir_01face'),takase=report.rows.find(x=>x.image==='takase_01face'),close=report.rows.find(x=>x.image==='large_noir_01face');assert.equal(noir.sourceDrawScale,takase.sourceDrawScale);assert.equal(noir.sourceDrawScale,close.sourceDrawScale);assert.notDeepEqual(noir.sourceSize,takase.sourceSize);
});
test('every used portrait keeps bounded geometry after trimming transparent margins',()=>{
 for(const r of report.rows){const b=fs.readFileSync(path.join(root,'src/common/images',r.image+'.png'));assert.equal(b.readUInt32BE(16),r.storedSize[0],r.image);assert.equal(b.readUInt32BE(20),r.storedSize[1],r.image);assert.ok(r.cropBox[0]>=0&&r.cropBox[1]>=0&&r.cropBox[2]<=432&&r.cropBox[3]<=286,r.image);assert.equal(r.bytes,b.length,r.image);}
});
