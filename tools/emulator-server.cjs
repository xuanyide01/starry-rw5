const fs=require('fs'),path=require('path'),http=require('http'),{spawn,execFile}=require('child_process');
const {promisify}=require('util');
const exec=promisify(execFile);
const {VvdManager}=require('@aiot-toolkit/emulator');
const {getRunningAvdConfigByName}=require('@aiot-toolkit/emulator/lib/emulatorutil/running');
const {createGrpcClient}=require('@aiot-toolkit/emulator/lib/vvd/grpc');
const environment=process.env.STARRY_EMULATOR_HOME || path.resolve(__dirname,'../.emulator');
const manager=new VvdManager({sdkHome:path.join(environment,'sdk'),vvdHome:path.join(environment,'vvd')});
const name='RedmiWatch5-432x514';
process.env.ANDROID_AVD_HOME=manager.vvdHome;
process.env.ANDROID_EMULATOR_HOME=environment;
process.env.ANDROID_SDK_ROOT=manager.sdkHome;
process.env.CI='1';
let agent,child,server;
fs.writeFileSync(path.join(environment,'controller-pid.json'),JSON.stringify({pid:process.pid,script:__filename}));
const log=fs.createWriteStream(path.join(environment,'emulator.log'),{flags:'a'});
const packageName=process.env.STARRY_EMULATOR_PACKAGE||'com.codex.starry.rw5';
const adb=path.resolve(__dirname,'../node_modules/@miwt/adb/bin/win/adb.exe');
async function adbCmd(...args){const r=await exec(adb,['-s','emulator-5554',...args],{windowsHide:true,timeout:240000,maxBuffer:1024*1024*8});return r.stdout;}
async function connect(){if(agent)return agent;const conf=getRunningAvdConfigByName(name);if(!conf)throw new Error('Emulator is not registered yet');agent=createGrpcClient(conf);await agent.waitForReady();return agent;}
async function install(rpk){const target='/data/starry-rw5.rpk';await adbCmd('wait-for-device');await adbCmd('push',rpk,target);try{return await adbCmd('shell','pm','install',target);}finally{await adbCmd('shell','rm',target).catch(()=>{});}}
(async()=>{
  const cmd=await manager.getVvdStartCmd({vvdName:name,qtHideWindow:true,serialPort:5554,grpcPort:8554,debugPort:10055});
  const args=cmd.split(' ').filter(Boolean);let binary=args.shift();if(!binary.endsWith('.exe'))binary+='.exe';
  const portIndex=args.indexOf('-port');if(portIndex>=0)args.splice(portIndex+1,0,'5554');
  console.log('STARTING',name);
  child=spawn(binary,args,{cwd:manager.sdkHome,windowsHide:true,stdio:'pipe',env:process.env});
  child.stdout.on('data',x=>log.write(x));child.stderr.on('data',x=>{log.write(x);if(/ERROR|PANIC/i.test(x))console.log(x.toString().slice(0,700));});
  child.on('exit',code=>{console.log('EMULATOR_EXIT',code);server?.close();log.end();setTimeout(()=>process.exit(code||0),300);});
  server=http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://127.0.0.1');let result;
      if(url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});res.end(fs.readFileSync(path.join(__dirname,'emulator-view.html')));return;}
      if(url.pathname==='/screen'){const a=await connect();const data=await a.getScreenshot();res.writeHead(200,{'Content-Type':'image/png'});res.end(data);return;}
      if(url.pathname==='/click'){const a=await connect();const x=Number(url.searchParams.get('x')),y=Number(url.searchParams.get('y'));a.sendMouse({x,y,buttons:1});await new Promise(r=>setTimeout(r,90));a.sendMouse({x,y,buttons:0});result='clicked';}
      else if(url.pathname==='/drag'){
        const a=await connect(),x0=Number(url.searchParams.get('x0')),y0=Number(url.searchParams.get('y0')),x1=Number(url.searchParams.get('x1')),y1=Number(url.searchParams.get('y1'));
        for(let i=0;i<=20;i++){a.sendMouse({x:Math.round(x0+(x1-x0)*i/20),y:Math.round(y0+(y1-y0)*i/20),buttons:1});await new Promise(r=>setTimeout(r,25));}
        a.sendMouse({x:x1,y:y1,buttons:0});result='dragged';
      }
      else if(url.pathname==='/install')result=await install(path.resolve(url.searchParams.get('rpk')));
      else if(url.pathname==='/start')result=await adbCmd('shell','am','start',packageName);
      else if(url.pathname==='/stop')result=await adbCmd('shell','am','stop',packageName);
      else if(url.pathname==='/status'){const a=await connect();const status=await a.getStatus();result={hardware:status.hardwareConfig};}
      else if(url.pathname==='/shutdown'){await adbCmd('shell','poweroff');result='stopped';server.close();}
      else if(url.pathname==='/info')result={name,packageName,ready:!!getRunningAvdConfigByName(name)};
      else {res.writeHead(404);res.end();return;}
      res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));
    }catch(e){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message||String(e)}));}
  });
  server.listen(43125,'127.0.0.1',()=>console.log('CONTROL http://127.0.0.1:43125'));
  process.on('SIGINT',()=>{child.kill();server.close();process.exit();});
})().catch(e=>{console.error(e);process.exitCode=1;});
