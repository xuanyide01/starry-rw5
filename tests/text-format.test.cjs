const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'src/common/text-format.js'),'utf8').replace(/export /g,''),{normalizeText}=new Function(source+';return {normalizeText};')();
test('desktop indentation disappears while paragraph boundaries and Latin words remain',()=>{
 assert.equal(normalizeText('可能是吵到她了。\n　靠在我肩膀上的诺瓦蜷了下身子。'),'可能是吵到她了。\n靠在我肩膀上的诺瓦蜷了下身子。');
 assert.equal(normalizeText('  Summer   Pockets \r\n\t Hello, world.  '),'Summer Pockets\nHello, world.');
 assert.equal(normalizeText('才  不是！\n狩叶！  狩叶你在哪！'),'才不是！\n狩叶！狩叶你在哪！');
 assert.equal(normalizeText('\ufeff　标题\u200b\n\n第二段　'),'标题\n\n第二段');
});
test('JS cleanup agrees with every original whitespace fix, preserving all visible characters',()=>{
 const report=JSON.parse(fs.readFileSync(path.join(root,'reports/text-whitespace-v031.json'),'utf8'));assert.equal(report.dialoguesAudited,13765);assert.equal(report.choiceTextsAudited,10);assert.equal(report.changedFields,1517);
 for(const row of report.rows){assert.equal(normalizeText(row.before),row.after);assert.equal(row.before.replace(/[\s\u200b\ufeff]/g,''),row.after.replace(/[\s\u200b\ufeff]/g,''));}
});
test('all dialogue, choice and speaker strings are clean and stable after repeated display',()=>{
 let texts=0,choices=0;
 for(let n=1;n<=17;n++)for(const op of JSON.parse(fs.readFileSync(path.join(root,'src/common/story',n+'.txt'),'utf8'))){
  if(op.op==='text'){texts++;assert.equal(normalizeText(op.text),op.text);assert.equal(normalizeText(op.speaker),op.speaker);assert.doesNotMatch(op.text,/(?:^|\n)[ \t\u3000]/);}
  if(op.op==='choice')for(const item of op.items){choices++;assert.equal(normalizeText(item.text),item.text);}
 }
 assert.equal(texts,13765);assert.equal(choices,10);
});
test('numeric chapter counters and empty narrator nameplates are absent from reading template',()=>{
 const page=fs.readFileSync(path.join(root,'src/pages/index/index.ux'),'utf8').split('<script>')[0];assert.ok(!page.includes('{{chapterLabel}}'));assert.ok(!page.includes('/ 17'));assert.match(page,/if="\{\{speaker !== ''\}\}" class="nameplate"/);
});
