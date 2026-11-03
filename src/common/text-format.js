// Remove desktop paragraph indentation; preserve paragraph breaks and Latin word spacing.
export function normalizeText(value){
  return String(value==null?'':value).replace(/\r\n?/g,'\n').replace(/[\u200b\ufeff]/g,'').split('\n').map(line=>
    line.replace(/[\t\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g,' ').trim().replace(/ {2,}/g,' ')
      .replace(/([\u2e80-\u9fff\uf900-\ufaff\uff01-\uff65…—“”‘’]) +(?=[\u2e80-\u9fff\uf900-\ufaff\uff01-\uff65…—“”‘’])/g,'$1')
  ).join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
