// The original game uses one numbered event ID for a scene's CG variants.
export function groupGallery(catalog){
  const groups=[],byId={};
  for(const item of catalog){
    const match=/^(?:large_)?evcg(\d+)[a-z]\d*$/.exec(item.image);
    const id=match?'evcg'+match[1]:item.image;
    let group=byId[id];
    if(!group){group={id,image:item.image,label:match?'CG '+match[1]:item.label,variants:[]};byId[id]=group;groups.push(group);}
    group.variants.push(item);
  }
  return groups;
}
export function stepVariant(index,delta,count){
  if(!Number.isInteger(count)||count<1)return 0;
  return ((index+delta)%count+count)%count;
}
