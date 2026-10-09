const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),common=path.join(root,'src/common'),toUri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const moduleSource=name=>fs.readFileSync(path.join(common,name+'.js'),'utf8');
const summer=fs.existsSync(path.join(common,'catalog.js'));
const catalogSource=summer?moduleSource('catalog'):'';
const engineSource=moduleSource('engine').replace("'./catalog.js'",JSON.stringify(toUri(catalogSource)));
async function pageWithReader(reader){
 const e=await import(toUri(engineSource)),s=await import(toUri(moduleSource('saves').replace("'./catalog.js'",JSON.stringify(toUri(catalogSource))).replace("'./engine.js'",JSON.stringify(toUri(engineSource))))),g=await import(toUri(moduleSource('gallery'))),a=await import(toUri(moduleSource('assets')));
 const catalog=summer?(await import(toUri(catalogSource))).catalog:undefined;
 const source=fs.readFileSync(path.join(root,'src/pages/index/index.ux'),'utf8').split('<script>')[1].split('</script>')[0].replace(/^import[^\n]+\n/gm,'').replace('export default','globalThis.page=');
 const context=vm.createContext({...e,...s,...g,...a,catalog,file:{readText:reader},storage:{get:o=>o.success('')},prompt:{showToast(){}},console:{log(){},error(){}},setTimeout,clearTimeout,Date});
 vm.runInContext(source,context);const p=context.page;Object.assign(p,p.private);p.onInit();return p;
}
test('actual page reads packaged TXT chapters and CG catalog; API 202 exits loading and exposes its reason',async()=>{
 const seen=[];
 const page=await pageWithReader(o=>{seen.push(o.uri);assert.match(o.uri,/^\/common\/.+\.txt$/);const target=path.join(root,'src',o.uri);o.success({text:fs.readFileSync(target,'utf8')});});
 let reads=0;
 if(summer){
  for(const dir of fs.readdirSync(path.join(common,'story'))){for(const name of fs.readdirSync(path.join(common,'story',dir))){page.cachedChapter=0;page.session.cursor=Number(path.parse(name).name)*1024;page.readChapter(Number(dir),()=>{reads++;});}}
  assert.equal(reads,457);
 }else{for(let chapter=1;chapter<=17;chapter++){page.cachedChapter=0;page.readChapter(chapter,()=>{reads++;});}assert.equal(reads,17);}
 page.openGallery();assert.equal(page.loading,false);assert.equal(page._galleryTotal,summer?856:124);assert.equal(page._galleryCatalog.length,summer?155:24);
 assert.ok(seen.includes('/common/gallery.txt'));
 const failed=await pageWithReader(o=>o.fail('invalid file path',202));
 failed.readChapter(1,()=>assert.fail('A failed read must not render a frame'));
 assert.equal(failed.loading,false);assert.equal(failed.mode,'error');assert.match(failed.errorText,/202.*invalid file path/);
 failed.toTitle();assert.equal(failed.mode,'title');assert.equal(failed.backgroundSrc,'/common/title_bg.png');
 failed.openGallery();assert.equal(failed.loading,false);assert.equal(failed.mode,'error');assert.match(failed.errorText,/202/);
});
