// Reuse standard ZIP DEFLATE streams; re-sign with the compatible development certificate.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('node:assert/strict'),{createRequire}=require('module');
const toolkit=process.env.WATCH_COMPAT_TOOLKIT||path.join(__dirname,'compat-toolkit/node_modules/aiot-toolkit'),requireToolkit=createRequire(path.join(toolkit,'package.json'));
const JSZip=requireToolkit('jszip'),CompressedObject=requireToolkit('jszip/lib/compressedObject'),compressions=requireToolkit('jszip/lib/compressions'),algorithmPath=requireToolkit.resolve('@aiot-toolkit/packager/lib/signature/algorithm'),{doSign}=require(algorithmPath);
async function compact(input,cache){
 const original=fs.readFileSync(input),zip=await JSZip.loadAsync(original,{checkCRC32:true}),parts=JSON.parse(fs.readFileSync(cache,'utf8')),files=[],contents=new Map();
 for(const [name,entry] of Object.entries(zip.files))if(!entry.dir){const data=await entry.async('nodebuffer');contents.set(name,data);files.push({name,hash:crypto.createHash('sha256').update(data).digest()});}
 for(const row of parts.rows){const entry=zip.file(row.file),b=Buffer.from(row.deflateBase64,'base64');assert.equal(entry._data.uncompressedSize,row.expanded);assert.equal(entry._data.crc32>>>0,row.crc32);entry._data=new CompressedObject(b.length,row.expanded,entry._data.crc32,compressions.DEFLATE,b);}
 const unsigned=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:9}}),pem=path.join(path.dirname(algorithmPath),'../pem');
 const signed=doSign(unsigned,files,fs.readFileSync(path.join(pem,'private.pem')),fs.readFileSync(path.join(pem,'certificate.pem'))),check=await JSZip.loadAsync(signed,{checkCRC32:true});
 assert.equal(Object.values(check.files).filter(e=>!e.dir).length,files.length);
 for(const [name,data] of contents)assert.ok(data.equals(await check.file(name).async('nodebuffer')),name);
 assert.ok(signed.length<original.length,'compact ZIP should save bytes');fs.writeFileSync(input,signed);
 return {beforeBytes:original.length,afterBytes:signed.length,savedBytes:original.length-signed.length,allUncompressedFileBytesIdentical:true,sha256:crypto.createHash('sha256').update(signed).digest('hex')};
}
module.exports={compact};
if(require.main===module)compact(...process.argv.slice(2)).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e);process.exitCode=1});
