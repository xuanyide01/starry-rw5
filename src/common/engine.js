export function newState() {
  return {chapter:1,cursor:0,background:'bg_black',regularBackground:'bg_black',body:'',speaker:'',text:'',choices:[],history:[],ended:false};
}
export function checkpoint(state) {
  return {chapter:state.chapter,cursor:state.cursor,background:state.background,regularBackground:state.regularBackground,body:state.body,
    speaker:state.speaker,text:state.text,choices:state.choices.slice(),ended:state.ended};
}
export function restore(saved) {
  if (!saved || !Number.isInteger(saved.chapter) || saved.chapter<1 || saved.chapter>17 ||
    !Number.isInteger(saved.cursor) || saved.cursor<0) throw new Error('存档位置无效');
  return Object.assign(newState(),saved,{regularBackground:saved.regularBackground||saved.background||'bg_black',history:[],choices:Array.isArray(saved.choices)?saved.choices.slice():[]});
}
export function readFrame(ops,state) {
  if (!Array.isArray(ops) || state.cursor>ops.length) throw new Error('剧情位置无效');
  for(let guard=0;guard<10000;guard++) {
    if(state.cursor>=ops.length) {
      if(state.chapter>=17) {state.ended=true;return {type:'end'};}
      return {type:'jump',to:[state.chapter+1,0]};
    }
    const op=ops[state.cursor];
    if(op.op==='text') {
      state.speaker=op.speaker;state.text=op.text;
      return {type:'text',speaker:op.speaker,text:op.text};
    }
    if(op.op==='choice') return {type:'choice',items:op.items};
    if(op.op==='jump') return {type:'jump',to:op.to};
    if(op.op==='end') {state.ended=true;return {type:'end'};}
    if(op.op==='background') {state.background=op.image;if(!op.event)state.regularBackground=op.image;if(op.clearBody)state.body='';}
    if(op.op==='restoreBackground'){state.background=state.regularBackground;state.body='';}
    if(op.op==='body') state.body=op.image;
    state.cursor++;
  }
  throw new Error('剧情跳转次数过多');
}
export function next(state) {
  state.history.push(checkpoint(state));
  if(state.history.length>30)state.history.shift();
  state.cursor++;
}
export function nextChapter(state) {
  if(state.chapter>=17)return false;
  const chapter=state.chapter+1,choices=state.choices.slice(),history=state.history;
  history.push(checkpoint(state));
  if(history.length>30)history.shift();
  Object.assign(state,newState(),{chapter,choices,history});
  return true;
}
export function choose(state,item,index) {
  if(!item || !Array.isArray(item.to) || item.to.length!==2)throw new Error('选项目标无效');
  state.history.push(checkpoint(state));
  if(state.history.length>30)state.history.shift();
  state.choices.push(index);state.chapter=item.to[0];state.cursor=item.to[1];state.ended=false;
}
export function previous(state) {
  const last=state.history.pop();
  if(!last)return false;
  const history=state.history;
  Object.assign(state,last,{history});return true;
}
