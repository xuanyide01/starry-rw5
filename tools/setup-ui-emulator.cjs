// Isolated preview device: never replaces another game's running emulator.
const fs=require('fs'),path=require('path');
const {VvdManager,VelaImageType,IVvdArchType}=require('@aiot-toolkit/emulator');
const home=process.env.STARRY_EMULATOR_HOME;
if(!home||!process.env.WATCH_SDK_HOME)throw Error('Set STARRY_EMULATOR_HOME and WATCH_SDK_HOME');
const name=process.env.WATCH_VVD_NAME||'StarryUI20261103';
const manager=new VvdManager({sdkHome:process.env.WATCH_SDK_HOME,vvdHome:path.join(home,'vvd')});
fs.mkdirSync(home,{recursive:true});
if(!manager.getVvdList().some(x=>x.name===name||x.vvdName===name))manager.createVvd({name,arch:IVvdArchType.arm,width:'432',height:'514',density:'320',shape:'rect',flavor:'watch',customLcdRadius:'24',imageType:VelaImageType.VELA_WATCH_5,imageDir:path.dirname(manager.getLocalSystemPath(VelaImageType.VELA_WATCH_5))});
const ini=path.join(require('os').homedir(),'.vela/vvd',name+'.ini'),data=fs.readFileSync(path.join(manager.vvdHome,name+'.ini'));
if(fs.existsSync(ini)&&!fs.readFileSync(ini).equals(data))throw Error('Refusing to replace existing VVD registration');
fs.writeFileSync(ini,data);
console.log('READY',name,home);
