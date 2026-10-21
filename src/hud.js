import {MOVEMENT} from './config.js';
const INK='#263d34',FONT='"Microsoft YaHei","PingFang SC",sans-serif';
const clamp=value=>Math.max(0,Math.min(1,value));

export function blinkStatus(fighter){
  const total=MOVEMENT.blinkCharges,charges=fighter.blinkCharges??total;
  return {charges,total,slots:Array.from({length:total},(_,i)=>{
    const remaining=i<charges?0:Math.max(0,fighter.blinkRecharge||0)+(i-charges)*MOVEMENT.blinkRecharge;
    return {ready:i<charges,remaining,progress:i<charges?1:clamp(1-remaining/MOVEMENT.blinkRecharge)};
  })};
}

export function drawStyleName(ctx,style,x,y,pixelScale,right=false){
  ctx.save();ctx.font=`italic 900 ${Math.max(14,9.5/pixelScale)}px ${FONT}`;
  ctx.textBaseline='middle';ctx.textAlign=right?'right':'left';
  ctx.strokeStyle='#fff1d2';ctx.lineWidth=Math.max(3,1.8/pixelScale);ctx.lineJoin='round';
  ctx.strokeText(style.name,x,y);ctx.fillStyle='#a83f28';ctx.fillText(style.name,x,y);ctx.restore();
}

export function drawBlinkMeter(ctx,fighter,x,y,width,pixelScale,right=false){
  const status=blinkStatus(fighter),height=Math.max(4,2.5/pixelScale),frame=Math.max(1,.5/pixelScale);
  ctx.save();ctx.font=`800 ${Math.max(11,7/pixelScale)}px ${FONT}`;ctx.textAlign=right?'right':'left';ctx.textBaseline='middle';
  ctx.lineWidth=Math.max(3,1.4/pixelScale);ctx.strokeStyle=INK;ctx.fillStyle='#fff3d7';
  const edge=right?x+width:x,textY=y+height+Math.max(7,5.5/pixelScale);
  ctx.strokeText('闪移',edge,textY);ctx.fillText('闪移',edge,textY);
  const trackWidth=width*.42,barGap=2/pixelScale,barWidth=(trackWidth-barGap)/2;
  const trackX=right?edge-trackWidth:edge,top=y;
  // Attach the rail directly to the milk bar. Put readable labels below it,
  // keeping the rail thin. P2 mirrors the stored charges and fill direction.
  status.slots.forEach((slot,i)=>{
    const left=trackX+(right?status.total-1-i:i)*(barWidth+barGap),fillWidth=Math.max(0,(barWidth-frame*2)*slot.progress);
    ctx.fillStyle='#18352c';ctx.fillRect(left,top,barWidth,height);
    ctx.fillStyle='#697367';ctx.fillRect(left+frame,top+frame,barWidth-frame*2,height-frame*2);
    ctx.fillStyle=slot.ready?'#f3df9a':'#efa85d';ctx.fillRect(right?left+barWidth-frame-fillWidth:left+frame,top+frame,fillWidth,height-frame*2);
  });
  if(status.charges<status.total){
    const timerX=right?trackX:trackX+trackWidth;
    ctx.font=`900 ${Math.max(15,9.5/pixelScale)}px Consolas,monospace`;ctx.textAlign=right?'left':'right';
    ctx.lineWidth=Math.max(3,1.6/pixelScale);ctx.strokeStyle=INK;ctx.fillStyle='#ffe3a0';
    const text=`${Math.max(0,fighter.blinkRecharge||0).toFixed(1)}s`;ctx.strokeText(text,timerX,textY);ctx.fillText(text,timerX,textY);
  }
  ctx.restore();return status;
}
