// Keep production JS optimization, but forbid the toolkit's extra lossy PNG pass.
// ResourcePlugin copies files during emit; ZipPlugin signs the package during done.
const fs=require('fs'),path=require('path');
class PreserveWatchPNG {
 apply(compiler){compiler.hooks.emit.tap({name:'PreserveWatchPNG',stage:1000},()=>{
  const source=path.join(__dirname,'src/common'),dest=path.join(__dirname,'build/common');
  function copy(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){
   const full=path.join(dir,item.name);if(item.isDirectory())copy(full);
   else if(/\.(png|jpe?g)$/i.test(item.name)){const target=path.join(dest,path.relative(source,full));fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(full,target);}
  }}copy(source);
 });}
}
module.exports={postHook(config){config.plugins.push(new PreserveWatchPNG());}};
