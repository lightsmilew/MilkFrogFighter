// qrcode-generator 2.0.4, MIT; see licenses/qrcode-generator.txt.
import qrcode from './vendor/qrcode.js';

export function qrMatrix(url){
  qrcode.stringToBytes=text=>Array.from(new TextEncoder().encode(text));
  const qr=qrcode(0,url.length>600?'M':'Q');qr.addData(url,'Byte');qr.make();
  return Array.from({length:qr.getModuleCount()},(_,row)=>Array.from({length:qr.getModuleCount()},(_,col)=>qr.isDark(row,col)));
}

function wrapped(ctx,text,x,y,width,lineHeight){
  let line='';
  for(const character of text){
    if(ctx.measureText(line+character).width>width){ctx.fillText(line,x,y);line=character;y+=lineHeight;}
    else line+=character;
  }
  ctx.fillText(line,x,y);
}

export async function createShareCard(url,{portrait=null,name='奶蛙',accent='#b95334'}={}){
  const canvas=document.createElement('canvas');canvas.width=720;canvas.height=1000;
  const ctx=canvas.getContext('2d'),ink='#263d34';
  ctx.fillStyle='#f3efdf';ctx.fillRect(0,0,720,1000);
  ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.strokeRect(26,26,668,948);
  ctx.fillStyle=ink;ctx.font='15px Consolas,monospace';ctx.fillText('MILKFROG FIGHT CLUB',58,75);
  ctx.font='900 60px "Microsoft YaHei","PingFang SC",sans-serif';ctx.fillText('奶蛙街头',54,151);
  ctx.font='bold 28px "Microsoft YaHei","PingFang SC",sans-serif';ctx.fillText('约朋友，来一局。',58,207);
  if(portrait)ctx.drawImage(portrait,486,83,176,176);
  ctx.strokeStyle='#a7ad96';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(58,281);ctx.lineTo(662,281);ctx.stroke();
  ctx.fillStyle=accent;ctx.font='bold 18px sans-serif';ctx.fillText(`${name} 已经就位 · 就等你出拳`,58,258);
  ctx.fillStyle='#ffffff';ctx.fillRect(136,316,448,448);
  const matrix=qrMatrix(url),quiet=4,cell=Math.floor(432/(matrix.length+quiet*2)),size=cell*(matrix.length+quiet*2);
  const left=Math.floor((720-size)/2),top=324+Math.floor((432-size)/2);
  ctx.fillStyle='#17352a';
  matrix.forEach((row,y)=>row.forEach((dark,x)=>{if(dark)ctx.fillRect(left+(x+quiet)*cell,top+(y+quiet)*cell,cell,cell);}));
  ctx.fillStyle=ink;ctx.textAlign='center';ctx.font='900 29px sans-serif';ctx.fillText('扫一扫，直接开打。',360,815);
  ctx.font='17px sans-serif';ctx.fillText('六位选手 · 晴雨双街 · 手机电脑都能玩',360,853);
  ctx.textAlign='left';ctx.fillStyle='#65715f';ctx.font='15px Consolas,monospace';wrapped(ctx,url,58,901,604,21);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('PNG encoding failed')),'image/png'));
  return {blob,file:new File([blob],'奶蛙街头-约战.png',{type:'image/png'}),width:720,height:1000};
}
