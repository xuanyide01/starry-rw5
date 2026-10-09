import {checkpoint,restore} from './engine.js';
export const SLOT_COUNT=30;
export const LEGACY_KEY='starry_rw5_save_v1';
export function slotKey(index){
  if(!Number.isInteger(index)||index<0||index>=SLOT_COUNT)throw new Error('存档栏位无效');
  return 'starry_rw5_slot_v1_'+(index+1);
}
export function decodeSave(raw){
  if(!raw)return null;
  const saved=typeof raw==='string'?JSON.parse(raw):raw;
  if(!saved||saved.version!==1)throw new Error('存档版本不兼容');
  return {version:1,state:checkpoint(restore(saved.state)),savedAt:saved.savedAt||0,sceneMode:saved.sceneMode||'play'};
}
export function createSave(state,sceneMode,savedAt){
  return {version:1,state:checkpoint(state),sceneMode,savedAt};
}
function two(n){return n<10?'0'+n:String(n);}
export function slotRow(index,saved){
  const row={index,number:index+1,title:'存档 '+two(index+1),meta:'空栏位',preview:'',occupied:!!saved};
  if(!saved)return row;
  if(saved.invalid){row.meta='存档无法读取';row.preview='可以选择其他栏位';return row;}
  let date='';
  if(saved.savedAt){const d=new Date(saved.savedAt);date=two(d.getMonth()+1)+'/'+two(d.getDate())+' '+two(d.getHours())+':'+two(d.getMinutes());}
  row.meta=(saved.legacy?'旧版存档 · ':'')+'第 '+saved.state.chapter+' 章'+(date?' · '+date:'');
  const preview=saved.sceneMode==='choice'?'正在选择下一步':(saved.state.text||'章节开头');
  row.preview=preview.replace(/・/g,'·').replace(/\s+/g,' ').slice(0,20)+(preview.length>20?'…':'');
  return row;
}
