import {WORLD,isSkillMove,isSuperMove} from './config.js';
import {styleOf} from './styles.js';
const TAU=Math.PI*2,S=WORLD.fighterScale;
const clamp=v=>Math.max(0,Math.min(1,v));

function glow(ctx,path,color,width=4,alpha=1){
  ctx.save();ctx.globalAlpha*=alpha;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.globalAlpha*=.75;ctx.strokeStyle=color;ctx.lineWidth=width*2.1;ctx.shadowColor=color;ctx.shadowBlur=15;path();ctx.stroke();
  ctx.shadowBlur=0;ctx.strokeStyle='#fffdf1';ctx.lineWidth=Math.max(.75,width*.22);path();ctx.stroke();ctx.restore();
}
function halo(ctx,x,y,r,color,alpha=.45){
  const gradient=ctx.createRadialGradient(x,y,1,x,y,Math.max(2,r));
  gradient.addColorStop(0,`${color}bb`);gradient.addColorStop(.35,`${color}55`);gradient.addColorStop(1,`${color}00`);
  ctx.save();ctx.globalAlpha*=alpha;ctx.fillStyle=gradient;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();
}
function ring(ctx,x,y,rx,ry,color,width=2,angle=0){
  glow(ctx,()=>{ctx.beginPath();ctx.ellipse(x,y,Math.max(1,rx),Math.max(1,ry),angle,0,TAU);},color,width);
}
function star(ctx,x,y,r,color,points=4,rotation=0){
  ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.fillStyle=color;ctx.beginPath();
  for(let n=0;n<points*2;n++){const a=n*Math.PI/points,rad=n%2?r*.18:r;ctx.lineTo(Math.cos(a)*rad,Math.sin(a)*rad);}ctx.closePath();ctx.fill();ctx.restore();
}
function crystal(ctx,x,y,size,color,rotation=0){
  ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.fillStyle=`${color}99`;ctx.strokeStyle='#efffff';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(0,-size*1.8);ctx.lineTo(size*.6,-size*.2);ctx.lineTo(size*.4,size*.7);ctx.lineTo(-size*.5,size*.7);ctx.lineTo(-size*.65,-size*.15);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,-size*1.6);ctx.lineTo(0,size*.6);ctx.lineTo(size*.6,-size*.2);ctx.stroke();ctx.restore();
}
function spiral(ctx,x,y,r,time,color){
  for(let n=0;n<3;n++)glow(ctx,()=>{ctx.beginPath();for(let i=0;i<38;i++){
    const p=i/37,a=p*TAU*1.4+time*9+n*TAU/3,rad=p*r;
    const px=x+Math.cos(a)*rad,py=y+Math.sin(a)*rad*.8;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
  }},color,2.1);
}

export function attackMotion(f){
  if(!f.attack)return {x:0,y:0,rotation:0,sx:1,sy:1};
  const {config,time}=f.attack,charge=clamp(time/config.startup),p=clamp((time-config.startup)/(config.active+config.recovery));
  const swing=Math.sin(p*Math.PI),windup=time<config.startup?Math.sin(charge*Math.PI):0;
  const style=styleOf(f.character).theme;
  if(style==='wind')return {x:swing*12,y:-Math.abs(Math.sin(p*TAU))*5,rotation:.13*swing,sx:1+.05*swing,sy:1-.03*swing};
  if(style==='fire')return {x:swing*9-windup*3,y:0,rotation:.16*swing-.07*windup,sx:1+windup*.07,sy:1-windup*.06};
  if(style==='void')return {x:-windup*5,y:-swing*9,rotation:-.11*swing,sx:1,sy:1};
  if(style==='ribbon')return {x:Math.sin(p*TAU)*6,y:-swing*4,rotation:Math.sin(p*TAU)*.12,sx:1,sy:1};
  if(style==='ice')return {x:swing*7,y:0,rotation:.06*swing,sx:1+.03*swing,sy:1-.025*swing};
  return {x:swing*6,y:-swing*3,rotation:.1*swing,sx:1+.025*swing,sy:1};
}

export function stylePose(f){
  const a=f.attack;if(!a)return null;
  const active=a.time>=a.config.startup;
  if(a.move==='pulse'&&f.character.id==='classic')return 14;
  if(['jab','jab2','straight','branch','link','rushPunch','rushSkill'].includes(a.move))return active?21:20;
  if(['kick','ender','spin','diveKick'].includes(a.move))return active?22:20;
  if(a.move==='stance'||isSkillMove(a.move)||isSuperMove(a.move))return active?23:20;
  return null;
}

export function drawAttackVfx(ctx,f,time){
  const a=f.attack;if(!a)return;
  const {config,move}=a,style=styleOf(f.character),color=style.colors[1];
  const skill=isSkillMove(move)||isSuperMove(move),superMove=isSuperMove(move);
  const active=a.time>=config.startup&&a.time<config.startup+config.active+.06;
  const p=clamp((a.time-config.startup)/Math.max(.1,config.active)),charge=clamp(a.time/config.startup);
  ctx.save();ctx.scale(S,S);ctx.globalCompositeOperation='screen';
  if(skill){
    const radius=(superMove?85:44)*(a.time<config.startup?charge:1-p*.45);
    halo(ctx,48,-128,radius*1.8,color,.65);ring(ctx,0,-3,68+charge*24,13,color,1.4);
    for(let i=0;i<8;i++){const angle=time*4+i*TAU/8,r=radius*(1.5-charge*.5);star(ctx,48+Math.cos(angle)*r,-128+Math.sin(angle)*r,3,style.colors[0]);}
    if(style.theme==='spiral')spiral(ctx,48,-128,radius,time,color);
    else if(style.theme==='wind')for(let n=0;n<3;n++)glow(ctx,()=>{ctx.beginPath();ctx.arc(35,-115,radius+n*10,time*9+n*2,time*9+n*2+Math.PI);},color,2.4);
    else if(style.theme==='fire')for(let n=0;n<5;n++){const x=35+(n-2)*13;glow(ctx,()=>{ctx.beginPath();ctx.moveTo(x,-90);ctx.quadraticCurveTo(x+Math.sin(time*20+n)*18,-140,x+Math.sin(time*15+n)*10,-170-charge*18);},color,4);}
    else if(style.theme==='void'){ring(ctx,45,-125,radius,radius*.3,color,2,time);ring(ctx,45,-125,radius*.8,radius*.8,color,1.5);}
    else if(style.theme==='ribbon')for(let n=0;n<2;n++)glow(ctx,()=>{ctx.beginPath();ctx.moveTo(-45,-25-n*30);ctx.bezierCurveTo(100,-220,150,10,35,-135);},color,3.5);
    else for(let n=0;n<5;n++){const angle=time*.8+n*TAU/5;crystal(ctx,40+Math.cos(angle)*radius,-120+Math.sin(angle)*radius,11,color,angle);}
  }
  if(active&&!config.projectile&&!config.counter){
    const reach=config.reach/S,low=config.level==='low',y=low?-25:-125;
    const alpha=Math.max(.18,Math.sin(p*Math.PI));
    for(let n=0;n<3;n++){
      const offset=n*10,tilt=style.theme==='ribbon'?Math.sin(time*12+n)*35:0;
      glow(ctx,()=>{ctx.beginPath();ctx.moveTo(15,y+offset-15);ctx.bezierCurveTo(reach*.4,y-65-offset,reach,y-45+tilt,reach+5,y+offset+10);},color,n===0?6:1.6,alpha*(1-n*.2));
    }
    if(style.theme==='ice')for(let n=0;n<4;n++)crystal(ctx,35+n*reach/4,y+Math.sin(n)*17,10,color,1.4);
    if(style.theme==='fire')halo(ctx,reach*.8,y,60,color,.6);
    if(style.theme==='spiral')spiral(ctx,reach*.8,y,28,time,color);
    if(style.theme==='void')ring(ctx,reach*.8,y,33,33,color,2);
  }
  ctx.restore();
}

export function drawTechnique(ctx,p,time,renderer){
  const theme=p.theme||'spiral',colors=p.colors||['#fff8d5','#ffd45f','#ec943a'],color=colors[1],r=p.radius;
  ctx.save();ctx.translate(p.x,p.y);ctx.globalCompositeOperation='screen';
  if(p.field){
    const ready=p.age>=p.delay,age=p.age-p.delay,pulse=ready?.65+.35*Math.sin(age*20):.35;
    ctx.globalAlpha=clamp(p.life/.2)*(ready?.72:.4);const floor=65*S;
    ctx.save();ctx.translate(0,floor);ctx.setLineDash(ready?[]:[8,8]);ring(ctx,0,0,r,15,color,2.2);ctx.setLineDash([]);
    if(!ready){ctx.font='18px sans-serif';ctx.fillStyle=colors[0];ctx.textAlign='center';ctx.fillText('!',0,-14);ctx.restore();ctx.restore();return true;}
    halo(ctx,0,-45,r*1.5,color,.35);
    if(['pillar','volcano'].includes(p.visual)){
      const count=p.visual==='volcano'?7:4;
      for(let n=0;n<count;n++){const x=(n-(count-1)/2)*r*1.5/count,h=(90+Math.sin(n*3+time*14)*28)*S*pulse;
        glow(ctx,()=>{ctx.beginPath();ctx.moveTo(x-12,0);ctx.bezierCurveTo(x-30,-h*.5,x+15,-h*.7,x+Math.sin(time*15+n)*18,-h*1.6);ctx.quadraticCurveTo(x+38,-h*.7,x+12,0);},n%2?colors[0]:color,9);
      }
    }else if(p.visual==='gravity'){
      for(let n=0;n<3;n++){ring(ctx,0,-25-n*24,r*(1-n*.17),14,color,1.8,time*.2);}
      for(let n=0;n<8;n++){const a=n*TAU/8+time;glow(ctx,()=>{ctx.beginPath();ctx.moveTo(Math.cos(a)*r,0);ctx.quadraticCurveTo(Math.cos(a+1)*r*.4,-90,0,-40);},color,1.5);}
      star(ctx,0,-45,28,colors[0],4,time);
    }else if(p.visual==='tornado'){
      for(let n=0;n<7;n++)glow(ctx,()=>{ctx.beginPath();ctx.ellipse(Math.sin(time*8+n)*8,-n*19,(r*.4+n*7),9,0,time*8+n,time*8+n+Math.PI*1.5);},color,2.8);
    }else if(p.visual==='lotus'){
      for(let n=0;n<8;n++){const a=n*TAU/8+time*.4;ctx.save();ctx.translate(Math.cos(a)*r*.5,-25+Math.sin(a)*r*.15);ctx.rotate(a);glow(ctx,()=>{ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-30,-65,45,-70,0,0);},color,4);ctx.restore();}
    }else{
      const count=p.visual==='iceWall'?4:7;
      for(let n=0;n<count;n++){const x=(n-(count-1)/2)*r*1.6/count;crystal(ctx,x,-25,(40+Math.sin(n*2+1)*15)*(.7+pulse*.3),color,(n-(count-1)/2)*.14);}
      if(p.visual==='iceCage'){ring(ctx,0,-115,r*.8,20,color,2.4);for(let n=0;n<5;n++)glow(ctx,()=>{ctx.beginPath();ctx.moveTo((n-2)*r*.35,0);ctx.lineTo((n-2)*r*.25,-115);},color,1.3);}
    }
    ctx.restore();ctx.restore();return true;
  }
  if(p.delay&&p.age<p.delay)ctx.globalAlpha=.25;
  if(p.visual==='clone'){
    ctx.globalCompositeOperation='source-over';const asset=renderer.variants.get(p.character)?.[Math.floor(time*16)%2?5:19];
    if(asset){const size=WORLD.spriteSize*(asset.scale||1);ctx.scale(Math.sign(p.vx)||1,1);for(let i=3;i>=0;i--){ctx.globalAlpha=i?.09:.55;ctx.filter='brightness(1.2) saturate(.6)';ctx.drawImage(asset.canvas,-size*asset.anchor.x-i*23,90*S-size*asset.anchor.y,size,size);}ctx.filter='none';}
    ctx.globalCompositeOperation='screen';ring(ctx,0,0,r*.9,r*1.8,color,1.4);ctx.restore();return true;
  }
  const angle=Math.atan2(p.vy||0,p.vx||1);ctx.rotate(angle);
  halo(ctx,0,0,r*2.8,color,.65);
  for(let n=0;n<3;n++)glow(ctx,()=>{ctx.beginPath();ctx.moveTo(-r*(3+n*.6),Math.sin(time*17+n)*r*.4);ctx.quadraticCurveTo(-r*1.4,Math.cos(time*14+n)*r,0,0);},color,2.1,.55);
  if(theme==='spiral'){spiral(ctx,0,0,r,time,color);ring(ctx,0,0,r*.85,r*.8,color,2);halo(ctx,0,0,r*.6,colors[0],1);}
  else if(theme==='wind')for(let n=0;n<3;n++)glow(ctx,()=>{ctx.beginPath();ctx.arc(0,0,r*(.7+n*.3),time*8+n*2,time*8+n*2+4.1);},color,3);
  else if(theme==='fire'){
    for(let n=0;n<6;n++){const yy=Math.sin(n*2)*r*.5;glow(ctx,()=>{ctx.beginPath();ctx.moveTo(r*.8,yy);ctx.bezierCurveTo(0,-r*1.7,-r*2,yy-r,-r*(2+Math.sin(time*20+n)*.6),yy);},n%2?color:colors[0],r*.22);}
    if(p.visual==='dragon'){star(ctx,r*.6,0,r*1.1,colors[0],5);ctx.fillStyle='#d65b38';ctx.fillRect(r*.5,-r*.3,4,4);}
  }else if(theme==='void'){
    ctx.fillStyle='#403255';ctx.beginPath();ctx.arc(0,0,r*.6,0,TAU);ctx.fill();ring(ctx,0,0,r,r*.45,color,2,time*2);ring(ctx,0,0,r*.8,r*.85,color,2);star(ctx,0,0,r*.7,colors[0],4,time);
  }else if(theme==='ribbon'){
    for(let n=0;n<3;n++)glow(ctx,()=>{ctx.beginPath();ctx.moveTo(-r*3,n*6-6);ctx.bezierCurveTo(-r,-r*2,2*r,r*2,0,0);},color,3);
    ctx.fillStyle=colors[0];ctx.beginPath();ctx.moveTo(0,r*.6);ctx.bezierCurveTo(-r*1.5,-r*.2,-r*.6,-r*1.2,0,-r*.4);ctx.bezierCurveTo(r*.8,-r*1.3,r*1.5,-r*.1,0,r*.6);ctx.fill();
  }else{crystal(ctx,0,0,r*.85,color,Math.PI/2);for(let n=0;n<4;n++)crystal(ctx,-r*(1+n*.4),Math.sin(time*8+n)*r*.8,4,color,time+n);}
  ctx.restore();return true;
}

export function drawRichEffect(ctx,e){
  if(!['impact','sigil','bloom','armor'].includes(e.type))return false;
  const p=1-e.life/e.duration,color=e.color;
  ctx.save();ctx.translate(e.x,e.y);ctx.scale(S,S);ctx.globalAlpha=(1-p)*.85;ctx.globalCompositeOperation='screen';
  const r=e.type==='impact'?28+55*p:35+70*p;
  halo(ctx,0,0,r*1.5,color,.4);ring(ctx,0,0,r,r*(e.type==='sigil'?.4:1),color,3*(1-p)+1,p);
  if(e.type==='bloom')for(let i=0;i<10;i++){const a=i*TAU/10;ctx.save();ctx.translate(Math.cos(a)*r*.7,Math.sin(a)*r*.7);ctx.rotate(a);ctx.fillStyle='#ffe1ee';ctx.beginPath();ctx.ellipse(0,0,12*(1-p),5*(1-p),0,0,TAU);ctx.fill();ctx.restore();}
  else if(e.type==='armor'){for(let i=0;i<6;i++)star(ctx,Math.cos(i)*r,Math.sin(i)*r,9,'#fff2c8',4,i);}
  else if(e.type==='sigil'){ring(ctx,0,0,r*.65,r*.65,color,1.3);star(ctx,0,0,r*.6,'#fff8df',6,p);}
  else{star(ctx,0,0,r*.5,'#fffce8',4,.3);for(let n=0;n<9;n++){const a=n*TAU/9+.2;glow(ctx,()=>{ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.65,Math.sin(a)*r*.65);ctx.lineTo(Math.cos(a)*r*(1.3+n%2*.4),Math.sin(a)*r*(1.3+n%2*.4));},color,1.5);}}
  ctx.restore();return true;
}
