import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import {qrMatrix} from '../src/share-card.js';
import {PUBLIC_GAME_URL,canShareFile,shareImage} from '../src/share.js';
test('generated QR data independently decodes to the complete game link',()=>{
  for(const url of [PUBLIC_GAME_URL,'https://friend.example/奶蛙/街头/?invite=一起来玩']){
    const matrix=qrMatrix(url),cell=7,quiet=4,width=(matrix.length+quiet*2)*cell,data=new Uint8ClampedArray(width*width*4).fill(255);
    matrix.forEach((row,y)=>row.forEach((dark,x)=>{if(dark)for(let yy=0;yy<cell;yy++)for(let xx=0;xx<cell;xx++){const index=(((y+quiet)*cell+yy)*width+(x+quiet)*cell+xx)*4;data[index]=data[index+1]=data[index+2]=0;}}));
    assert.equal(jsQR(data,width,width)?.data,url);
  }
});
test('image sharing passes a prepared PNG file directly and handles unsupported/cancelled APIs',async()=>{
  const file=new File(['png'],'invite.png',{type:'image/png'});let shared;
  const platform={canShare:data=>data.files[0]===file,share:async data=>{shared=data;}};
  assert.equal(canShareFile(file,platform),true);assert.equal((await shareImage(file,platform)).status,'shared');assert.equal(shared.files[0],file);
  assert.equal((await shareImage(file,{})).status,'unsupported');
  platform.share=async()=>{throw Object.assign(new Error(),{name:'AbortError'});};assert.equal((await shareImage(file,platform)).status,'cancelled');
});
