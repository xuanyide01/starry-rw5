const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('node:assert/strict'),{createRequire}=require('module');
const root=path.resolve(__dirname,'..'),toolkit=process.env.WATCH_COMPAT_TOOLKIT||path.join(__dirname,'compat-toolkit/node_modules/aiot-toolkit');
const req=createRequire(path.join(path.resolve(toolkit),'package.json')),JSZip=req('jszip');
const algorithm=req.resolve('@aiot-toolkit/packager/lib/signature/algorithm'),crcModule=require(path.join(path.dirname(algorithm),'crc32.js')),crc=crcModule.default||crcModule;
const hash=b=>crypto.createHash('sha256').update(b).digest();
function sized(b,at=0){assert.ok(at+4<=b.length);const end=at+4+b.readUInt32LE(at);assert.ok(end<=b.length);return {data:b.subarray(at+4,end),end};}
function parse(raw){
 let footer=-1;for(let i=raw.length-22;i>=Math.max(0,raw.length-65557);i--){if(raw.readUInt32LE(i)===0x06054b50&&i+22+raw.readUInt16LE(i+20)===raw.length){footer=i;break;}}assert.ok(footer>=0);
 const central=raw.readUInt32LE(footer+16);assert.equal(raw.subarray(central-16,central).toString(),'RPK Sig Block 42');
 const size=Number(raw.readBigUInt64LE(central-24))+8,start=central-size;assert.equal(raw.readBigUInt64LE(start)+8n,BigInt(size));
 const entries=new Map();for(let at=start+8;at<central-24;){const len=Number(raw.readBigUInt64LE(at));assert.ok(len>=4&&at+8+len<=central-24);entries.set(raw.readUInt32LE(at+8),raw.subarray(at+12,at+8+len));at+=8+len;}
 const signer=sized(sized(entries.get(0x1000101)).data).data,signed=sized(signer),signatures=sized(signer,signed.end),signature=sized(signatures.data).data;
 assert.equal(signature.readUInt32LE(0),259);const sig=sized(signature,4).data;
 const digests=sized(signed.data),certificates=sized(signed.data,digests.end),cert=sized(certificates.data).data;
 const digest=sized(digests.data).data;assert.equal(digest.readUInt32LE(0),259);const expected=sized(digest,4).data;
 return {raw,footer,central,start,entries,signed:signed.data,sig,cert,expected};
}
async function audit(filename,baseline){
 const raw=fs.readFileSync(filename),p=parse(raw),certificate=new crypto.X509Certificate(p.cert),footer=Buffer.from(raw.subarray(p.footer));footer.writeUInt32LE(p.start,16);
 function chunk(b){const header=Buffer.alloc(5);header[0]=0xa5;header.writeUInt32LE(b.length,1);return hash(Buffer.concat([header,b]));}
 const header=Buffer.from([0x5a,3,0,0,0]),digest=hash(Buffer.concat([header,chunk(raw.subarray(0,p.start)),chunk(raw.subarray(p.central,p.footer)),chunk(footer)]));
 assert.ok(digest.equals(p.expected),'outer archive digest');assert.ok(crypto.verify('RSA-SHA256',p.signed,certificate.publicKey,p.sig),'outer RSA signature');
 const inner=sized(p.entries.get(0x1000201)).data,innerSigned=sized(inner),innerSignature=sized(inner,innerSigned.end).data;
 assert.equal(innerSigned.data.readUInt32LE(0),259);assert.equal(innerSignature.readUInt32LE(0),259);
 assert.ok(crypto.verify('RSA-SHA256',innerSigned.data,certificate.publicKey,sized(innerSignature,4).data),'inner RSA signature');
 const rows=[];for(let at=4;at<innerSigned.data.length;){const crc32=innerSigned.data.readUInt32LE(at),n=innerSigned.data.readUInt16LE(at+4);assert.ok(at+6+n<=innerSigned.data.length);rows.push({crc32,digest:innerSigned.data.subarray(at+6,at+6+n),used:false});at+=6+n;}
 const zip=await JSZip.loadAsync(raw,{checkCRC32:true});let bytes=0,count=0;
 for(const [name,entry] of Object.entries(zip.files))if(!entry.dir){const data=await entry.async('nodebuffer');bytes+=data.length;count++;const c=crc.digest(name)>>>0,h=hash(data),r=rows.find(r=>!r.used&&r.crc32===c&&r.digest.equals(h));assert.ok(r,'signed resource: '+name);r.used=true;}
 assert.equal(count,rows.length);assert.ok(rows.every(r=>r.used));
 const report={version:JSON.parse(fs.readFileSync(path.join(root,'src/manifest.json'),'utf8')).versionName,bytes:raw.length,expandedBytes:bytes,sha256:hash(raw).toString('hex'),certificateSha256:hash(p.cert).toString('hex'),zipCRCValid:true,outerSignatureValid:true,innerSignatureValid:true,allFileDigestsValid:true,signedFiles:count};
 if(baseline){report.sameCertificateAsV027=p.cert.equals(parse(fs.readFileSync(baseline)).cert);assert.ok(report.sameCertificateAsV027);}
 fs.mkdirSync(path.join(root,'reports'),{recursive:true});fs.writeFileSync(path.join(root,'reports','package-audit-v'+report.version.replace(/\./g,'')+'.json'),JSON.stringify(report,null,2));return report;
}
if(require.main===module){const manifest=JSON.parse(fs.readFileSync(path.join(root,'src/manifest.json'),'utf8')),file=process.argv[2]||path.join(root,'dist',manifest.package+'.debug.'+manifest.versionName+'.rpk');audit(file,process.argv[3]).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e);process.exitCode=1;});}
module.exports={audit};
