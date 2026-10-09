const assert=require('assert/strict'),fs=require('fs'),path=require('path');
module.exports=async function checkGallery({click,expectedClick,capture,logs}){
 const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'../src/common/gallery.txt'),'utf8'));
 const patterns=id=>catalog.filter(x=>new RegExp('^(?:large_)?evcg'+id+'[a-z]\\d*$').test(x.image));
 const expect=(group,variant,image)=>new RegExp('STARRY_RW5 cg '+group+' '+variant+' '+image+'(?:\\s|$)');
 await expectedClick(216,463,/STARRY_RW5 gallery ready 24 124/);await capture('v022-gallery');
 // Three standalone opening pictures remain separate; normal CG 01 is one tile.
 await expectedClick(318,350,expect(4,1,'evcg01a'));await capture('v022-cg01-first');
 const first=patterns('01');assert.equal(first.length,12);
 for(let i=1;i<first.length;i++)await expectedClick(216,220,expect(4,i+1,first[i].image));
 await capture('v022-cg01-last');await expectedClick(216,220,expect(4,1,first[0].image));
 await expectedClick(66,487,expect(3,1,'neriaban'));
 let boundary=logs().length;await click(216,220);assert.ok(!logs().slice(boundary).includes('STARRY_RW5 cg'));
 await expectedClick(366,487,expect(4,1,'evcg01a'));await click(216,487);
 // Additional original variants c/d share the CG 04 tile.
 await click(348,474);await expectedClick(114,350,expect(7,1,'evcg04a'));
 await expectedClick(216,220,expect(7,2,'evcg04b'));await expectedClick(216,220,expect(7,3,'evcg04c'));
 await expectedClick(216,220,expect(7,4,'evcg04d'));await expectedClick(216,220,expect(7,1,'evcg04a'));await click(216,487);
 // The largest scene has 21 variants and loops without changing scene.
 await click(348,474);await click(348,474);await expectedClick(114,170,expect(13,1,'evcg10a'));
 const large=patterns('10');assert.equal(large.length,21);
 for(let i=1;i<large.length;i++)await expectedClick(216,220,expect(13,i+1,large[i].image));
 await expectedClick(216,220,expect(13,1,large[0].image));await click(216,487);
 await click(348,474);await capture('v022-gallery-page05');
 // A scene with one image does not jump to the following scene on tap.
 await expectedClick(318,170,expect(18,1,'evcg15a'));boundary=logs().length;await click(216,220);assert.ok(!logs().slice(boundary).includes('STARRY_RW5 cg'));await click(216,487);
 await click(348,474);await capture('v022-gallery-last');
 await expectedClick(318,350,expect(24,1,'evcg21a'));
 const last=patterns('21');for(let i=1;i<last.length;i++)await expectedClick(216,220,expect(24,i+1,last[i].image));
 await capture('v022-cg21-last');await expectedClick(216,220,expect(24,1,last[0].image));
 boundary=logs().length;await click(366,487);assert.ok(!logs().slice(boundary).includes('STARRY_RW5 cg'));
 await expectedClick(66,487,expect(23,1,'evcg20a'));await expectedClick(366,487,expect(24,1,'evcg21a'));
 await click(216,487);await capture('v022-return-to-last-page');await click(216,474);
 return {groups:24,images:124,pagesChecked:6,cyclicVariants:true,variantGroupsChecked:['01','04','10','21'],singleImageGuard:true,sceneNavigation:true,returnToSamePage:true};
};
