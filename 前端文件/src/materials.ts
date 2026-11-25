import * as THREE from 'three';
// Local procedural material samples, no exterior images. Dimensions map to metre-scale surfaces.
export function materialTextures(){
 let seed=1237;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const make=(size:number)=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=size;return {canvas,c:canvas.getContext('2d')!}};
 const tex=(canvas:HTMLCanvasElement,repeat=1,color=true)=>{const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=8;if(color)t.colorSpace=THREE.SRGBColorSpace;return t};
 // Full 5.4×6.0m floor: 180mm boards, individually staggered 1.4–2.2m lengths.
 const floor=make(1024);floor.c.fillStyle='#b39a7c';floor.c.fillRect(0,0,1024,1024);const w=1024/30;
 for(let col=0;col<30;col++){
  let y=-rnd()*300;
  while(y<1024){const length=(1.4+rnd()*.8)*1024/6,tone=(rnd()-.5)*7;
   floor.c.fillStyle=`rgb(${180+tone},${156+tone},${125+tone})`;floor.c.fillRect(col*w,y,w,length);
   floor.c.save();floor.c.beginPath();floor.c.rect(col*w,y,w,length);floor.c.clip();
   for(let j=0;j<32;j++){const x=col*w+rnd()*w;floor.c.strokeStyle=`rgba(${rnd()>.55?'81,61,39':'218,201,174'},${.025+rnd()*.045})`;floor.c.lineWidth=.28+rnd()*.45;floor.c.beginPath();floor.c.moveTo(x,y);floor.c.bezierCurveTo(x-1.6,y+length*.32,x+2,y+length*.71,x+.4,y+length);floor.c.stroke()}
   floor.c.restore();floor.c.fillStyle='rgba(62,49,32,.13)';floor.c.fillRect(col*w,y,w,.45);y+=length;
  }
  floor.c.fillStyle='rgba(62,49,32,.13)';floor.c.fillRect(col*w,0,.45,1024);
 }
 const walnut=make(512);walnut.c.fillStyle='#977858';walnut.c.fillRect(0,0,512,512);
 for(let i=0;i<1100;i++){const x=rnd()*512;walnut.c.strokeStyle=`rgba(${rnd()>.5?'57,38,25':'183,154,115'},${.025+rnd()*.065})`;walnut.c.lineWidth=.3+rnd()*.65;walnut.c.beginPath();walnut.c.moveTo(x,0);walnut.c.bezierCurveTo(x+7,170,x-6,340,x+1,512);walnut.c.stroke()}
 const fabric=make(256),bump=make(256),fabricRoughness=make(256);
 const f=fabric.c.createImageData(256,256),b=bump.c.createImageData(256,256),fr=fabricRoughness.c.createImageData(256,256);
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4,noise=(rnd()-.5)*5,thread=Math.sin(x*Math.PI*.5+Math.sin(y*.07)*.15)*1.3+Math.sin(y*Math.PI*.5)*.8;f.data.set([222+noise+thread,216+noise+thread,205+noise+thread,255],i);const h=128+thread*5+noise*1.3;b.data.set([h,h,h,255],i);const r=247+noise;fr.data.set([r,r,r,255],i)}
 fabric.c.putImageData(f,0,0);bump.c.putImageData(b,0,0);fabricRoughness.c.putImageData(fr,0,0);
 // Quiet wool melange: isotropic irregular flecks and a restrained nap, no drawn square grid/border.
 // Four repeats over the whole rug => ~1.8mm per source pixel; no centimetre-scale checker weave.
 const rug=make(512),rugBump=make(512),rugRoughness=make(512),r= rug.c.createImageData(512,512),rb=rugBump.c.createImageData(512,512),rr=rugRoughness.c.createImageData(512,512);
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){const i=(y*512+x)*4,noise=(rnd()-.5)*7,melange=Math.sin(x*.13+y*.087)*.8+Math.sin(x*.032-y*.043)*.6,nap=Math.sin(y*2.7+Math.sin(x*.73)*1.5)*.8;const q=noise+melange+nap;r.data.set([195+q,185+q,166+q,255],i);const h=128+noise*3+nap*3;rb.data.set([h,h,h,255],i);const rough=245+noise;rr.data.set([rough,rough,rough,255],i)}
 rug.c.putImageData(r,0,0);rugBump.c.putImageData(rb,0,0);rugRoughness.c.putImageData(rr,0,0);
 return {floor:tex(floor.canvas),walnut:tex(walnut.canvas),fabric:tex(fabric.canvas,8),fabricBump:tex(bump.canvas,8,false),fabricRoughness:tex(fabricRoughness.canvas,8,false),rug:tex(rug.canvas,4),rugBump:tex(rugBump.canvas,4,false),rugRoughness:tex(rugRoughness.canvas,4,false)};
}
