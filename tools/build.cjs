// Keep the compiler version used by the supplied working physical-watch app.
const fs=require('fs'),path=require('path');
const toolkit=process.env.WATCH_COMPAT_TOOLKIT||path.join(__dirname,'compat-toolkit/node_modules/aiot-toolkit');
if(!fs.existsSync(path.join(toolkit,'package.json')))throw Error('Install the compatible compiler: npm install --prefix tools/compat-toolkit --ignore-scripts');
if(JSON.parse(fs.readFileSync(path.join(toolkit,'package.json'),'utf8')).version!=='1.1.0')throw Error('Compatible compiler must be aiot-toolkit 1.1.0');
const {compile}=require(path.join(toolkit,'lib/commands/compile'));
(async()=>{
 const result=await compile('native',process.argv.includes('--release')?'prod':'dev',false,{signMode:'BUILD'});
 if(result.compileError||result.stats.hasErrors())throw Error('Compatible compiler failed');
 const manifest=JSON.parse(fs.readFileSync('src/manifest.json','utf8'));
 const name=manifest.package+'.debug.'+manifest.versionName+'.rpk',file=path.join('dist',name);
 if(!fs.existsSync(file))throw Error('Current-version package was not produced');
 const bytes=fs.statSync(file).size;if(bytes>25000000)throw Error('Package exceeds the 25,000,000-byte cap: '+bytes);
 console.log('BUILD_OUTPUT',name,bytes);
})().catch(e=>{console.error(e);process.exitCode=1;});
