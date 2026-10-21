import {WORLD,isSkillMove,isSuperMove} from './config.js';
import {styleOf} from './styles.js';
import {fieldBounds} from './abilities.js';
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
  const {config,time,move}=f.attack,charge=clamp(time/config.startup),p=clamp((time-config.startup)/(config.active+Math.min(.12,config.recovery)));
  const swing=Math.sin(p*Math.PI),windup=time<config.startup?Math.sin(charge*Math.PI):0;
  const style=styleOf(f.character).theme;
  const chain=motion=>({...motion,rotation:motion.rotation*(['jab2','link'].includes(move)?-1:1),x:motion.x+(move==='straight'?swing*5:0)});
  if(style==='wind')return chain({x:swing*12,y:-Math.abs(Math.sin(p*TAU))*5,rotation:.13*swing,sx:1+.05*swing,sy:1-.03*swing});
  if(style==='fire')return chain({x:swing*9-windup*3,y:0,rotation:.16*swing-.07*windup,sx:1+windup*.07,sy:1-windup*.06});
  if(style==='void')return chain({x:-windup*5,y:-swing*9,rotation:-.11*swing,sx:1,sy:1});
  if(style==='ribbon')return chain({x:Math.sin(p*TAU)*6,y:-swing*4,rotation:Math.sin(p*TAU)*.12,sx:1,sy:1});
  if(style==='ice')return chain({x:swing*7,y:0,rotation:.06*swing,sx:1+.03*swing,sy:1-.025*swing});
  return chain({x:swing*6,y:-swing*3,rotation:.1*swing,sx:1+.025*swing,sy:1});
}

export function reactionMotion(f){
  if(f.grappled)return {rotation:f.throwRotation*f.facing,x:0};
  const {type,kind=type,age=0,direction=f.facing}=f.reaction||{},sign=direction*f.facing;
  const pulse=Math.sin(clamp(age/.10)*Math.PI/2)*Math.exp(-age*7);
  if(type==='freeze')return {rotation:0,x:Math.sin(age*55)*.5};
  if(type==='bind')return {rotation:Math.sin(age*18)*.018,x:Math.sin(age*22)*.8};
  if(type==='launch'||type==='tumble')return {rotation:sign*(.08+.08*clamp(age/.4)),x:0};
  if(type==='trip')return {rotation:sign*.08*clamp(age/.2),x:0};
  if(type==='guard')return {rotation:sign*.045*pulse,x:sign*3*pulse};
  const heavy=kind==='heavy',belly=kind==='body';
  return {rotation:sign*(heavy?.17:belly?-.065:.085)*pulse,x:sign*(heavy?10:4)*pulse,y:belly?pulse*3:-pulse*2,sx:1+pulse*(belly?.035:.015),sy:1-pulse*(belly?.04:.015)};
}

export function stylePose(f){
  const a=f.attack;if(!a)return null;
  const active=a.time>=a.config.startup&&a.time<a.config.startup+a.config.active+Math.min(.06,a.config.recovery*.25);
  if(a.move==='pulse'&&f.character.id==='classic')return 14;
  if(a.move==='jab2'||a.move==='link')return active?5:20;
  if(a.move==='straight'||a.move==='branch')return active?22:20;
  if(['jab','rushPunch','rushSkill'].includes(a.move))return active?21:20;
  if(['kick','ender'].includes(a.move))return active?22:20;
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

export function drawControlSeal(ctx,f,time){
  if(!(f.controlTime>0))return;
  const ice=f.controlType==='freeze',color=ice?'#a3e5ff':f.controlColor||(f.controlType==='vortex'?'#a6f28c':'#d4abff');
  ctx.save();ctx.translate(f.x,f.y);ctx.globalCompositeOperation='screen';
  ring(ctx,0,-7,57,12,color,2.3);
  for(let n=0;n<3;n++){const a=time*4+n*TAU/3;star(ctx,Math.cos(a)*48,-55+Math.sin(a)*22,5,color,4,a);}
  if(!ice)for(let n=0;n<2;n++)glow(ctx,()=>{ctx.beginPath();ctx.ellipse(0,-70-n*27,44,12,.12*Math.sin(time*5),0,TAU);},color,1.4);
  ctx.globalCompositeOperation='source-over';ctx.fillStyle=ice?'#e4faff':'#f6e6ff';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.shadowColor='#263d34';ctx.shadowBlur=3;
  ctx.fillText(ice?'冻结':f.controlType==='vortex'?'风缚':'定身',0,-WORLD.standHeight-17);
  ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,-70,52,-Math.PI/2,-Math.PI/2+TAU*f.controlTime/f.controlDuration);ctx.stroke();ctx.restore();
}

function drawTacticalField(ctx,p,time){
  const b=fieldBounds(p),h=b.bottom-b.top,r=p.radius,ready=p.age>=p.delay,color=p.colors[1],light=p.colors[0];
  ctx.save();ctx.translate(p.x,b.bottom);ctx.globalCompositeOperation='screen';
  if(!ready){
    const charge=clamp(p.age/p.delay);ctx.globalAlpha=.42+charge*.35;ctx.setLineDash([7,8]);
    ring(ctx,0,-4,r,13,color,1.7);ctx.setLineDash([]);
    ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-r,-h);ctx.lineTo(-r,0);ctx.moveTo(r,-h);ctx.lineTo(r,0);ctx.stroke();
    ring(ctx,0,-h,r*.55,10,color,1.7);star(ctx,0,-h,9+charge*10,light,4,time);
    ctx.restore();return;
  }
  const fade=clamp(p.life/.14),pulse=.8+Math.sin(time*35)*.2;
  ctx.globalAlpha=fade;
  const gradient=ctx.createLinearGradient(0,-h,0,0);gradient.addColorStop(0,`${color}05`);gradient.addColorStop(.4,`${color}2b`);gradient.addColorStop(1,`${color}44`);
  ctx.fillStyle=gradient;ctx.fillRect(-r,-h,r*2,h);ring(ctx,0,-5,r*pulse,16,color,3);halo(ctx,0,-h*.45,r*1.7,color,.32);
  for(let n=0;n<4;n++){
    const x=(n-1.5)*r*.45,shift=Math.sin(time*13+n)*r*.12;
    if(p.theme==='ice'){crystal(ctx,x,-h*(.18+n*.17),48,color,.15*Math.sin(n));glow(ctx,()=>{ctx.beginPath();ctx.moveTo(x,-h);ctx.lineTo(x+shift,-20);},color,2.4);}
    else if(p.theme==='fire')glow(ctx,()=>{ctx.beginPath();ctx.moveTo(x,-8);ctx.bezierCurveTo(x-r*.3,-h*.3,x+r*.3,-h*.7,x+shift,-h);},n%2?light:color,9);
    else if(p.theme==='ribbon')glow(ctx,()=>{ctx.beginPath();ctx.moveTo(x,-h);ctx.bezierCurveTo(x+r,-h*.6,x-r,-h*.3,x+shift,0);},color,4);
    else if(p.theme==='void'){ring(ctx,0,-h*(.15+n*.22),r*(.5+n*.1),20,color,2,time*.3);star(ctx,x,-h*.6,12,light,4,time);}
    else if(p.theme==='wind')glow(ctx,()=>{ctx.beginPath();ctx.moveTo(-r,-h*(n+.5)/4);ctx.bezierCurveTo(r,-h*(n+1)/4,r,-h*(n+2)/4,-r,-h*(n+1.5)/4);},color,5);
    else spiral(ctx,x,-h*(.18+n*.19),34*pulse,time+n,color);
  }
  for(let n=0;n<9;n++){const a=n*2.4+time*2;star(ctx,Math.sin(a)*r*.9,-((time*180+n*47)%h),3+n%3,light,4,a);}
  ctx.restore();
}

function drawElementalField(ctx,p,time){
  const b=fieldBounds(p),r=p.radius,h=b.bottom-b.top,ry=h/2,age=p.age-p.delay,ready=age>=0;
  const color=p.colors[1],light=p.colors[0],fade=clamp(p.life/.16);
  ctx.save();ctx.translate(p.x,(b.top+b.bottom)/2);ctx.globalCompositeOperation='screen';ctx.globalAlpha=fade;
  if(p.visual==='iceMirror'){
    const grow=ready?clamp(age/.12):clamp(p.age/p.delay)*.35;
    ctx.scale(1,Math.max(.02,grow));
    const outline=()=>{ctx.beginPath();ctx.moveTo(0,-ry);ctx.lineTo(r,-ry*.76);ctx.lineTo(r,ry*.75);ctx.lineTo(0,ry);ctx.lineTo(-r,ry*.75);ctx.lineTo(-r,-ry*.76);ctx.closePath();};
    ctx.globalCompositeOperation='source-over';ctx.fillStyle=ready?'#59c5ef55':'#bcefff16';outline();ctx.fill();ctx.globalCompositeOperation='screen';glow(ctx,outline,'#9bdfff',3);
    glow(ctx,()=>{ctx.beginPath();ctx.moveTo(-r,-ry*.76);ctx.lineTo(r,ry*.75);ctx.moveTo(r,-ry*.76);ctx.lineTo(-r,ry*.75);ctx.moveTo(0,-ry);ctx.lineTo(0,ry);},'#dcf8ff',1.1,.6);
    halo(ctx,0,0,r*2,'#8fdcff',.28);
    for(let n=0;n<p.barrierHp;n++)crystal(ctx,(n-(p.barrierHp-1)/2)*14,ry+10,5,'#c3f5ff');
    ctx.restore();return;
  }
  if(!ready){
    const charge=clamp(p.age/p.delay);ctx.globalAlpha*=.3+charge*.5;ctx.setLineDash([6,7]);
    ring(ctx,0,0,r,ry,color,1.2);ctx.setLineDash([]);
    if(p.visual==='fireBlast'){halo(ctx,0,ry*.35,25+charge*35,'#ff8a35',.8);star(ctx,0,ry*.35,12+charge*13,'#ffe1a0',6,time);}
    else if(p.visual==='iceBloom')for(let n=0;n<6;n++){const a=n*TAU/6;crystal(ctx,Math.cos(a)*r*.6,Math.sin(a)*ry*.6,7+charge*8,color,a+Math.PI/2);}
    else for(let n=0;n<6;n++){const a=n*TAU/6+time;star(ctx,Math.cos(a)*r*.6,Math.sin(a)*ry*.6,7,light,4,a);}
    ctx.restore();return;
  }
  if(p.visual==='fireBlast'){
    const burning=p.burn&&p.age>p.strikeEnd;
    if(burning){
      // Only the ground residue remains dangerous after the initial explosion.
      ring(ctx,0,ry-25,r*.9,12,'#fb7130',1.4);
      for(let n=0;n<7;n++){const x=(n-3)*r*.24,height=14+(Math.sin(time*17+n*3)+1)*12;glow(ctx,()=>{ctx.beginPath();ctx.moveTo(x-7,ry-10);ctx.quadraticCurveTo(x-14,ry-height,x+Math.sin(time*13+n)*7,ry-height-12);ctx.quadraticCurveTo(x+14,ry-height*.4,x+7,ry-10);},n%2?'#ff9b38':'#ffca61',3);}
    }else{
      const expansion=clamp(age/.13),pulse=.85+.15*Math.sin(age*27);
      halo(ctx,0,0,r*1.8,'#ff8734',.7);halo(ctx,0,ry*.15,r*.8,'#ffdd91',.65);
      ring(ctx,0,ry*.35,r*(.4+expansion*.6),ry*.24,'#ffac50',3);
      for(let n=0;n<11;n++){
        const a=n*TAU/11,x=Math.cos(a)*r*.7*expansion,y=Math.sin(a)*ry*.65*expansion;
        ctx.save();ctx.translate(x,y);ctx.scale(1,ry/r*.8);
        const size=r*(.22+n%3*.04)*pulse;
        const flame=()=>{ctx.beginPath();ctx.moveTo(-size*.7,size*.65);ctx.bezierCurveTo(-size*1.2,-size*.2,-size*.25,-size*.1,0,-size*1.3);ctx.bezierCurveTo(size*.05,-size*.35,size*1.1,-size*.1,size*.5,size*.65);ctx.closePath();};
        const heat=ctx.createLinearGradient(0,-size*1.3,0,size*.65);heat.addColorStop(0,'#f14c27aa');heat.addColorStop(.5,'#ff8b24b0');heat.addColorStop(1,'#ffe498b0');
        ctx.globalCompositeOperation='source-over';ctx.fillStyle=heat;flame();ctx.fill();ctx.globalCompositeOperation='screen';glow(ctx,flame,n%2?'#ff9c3d':'#ffda83',3.5,.8);
        ctx.restore();
      }
      for(let n=0;n<12;n++){const a=n*2.4;star(ctx,Math.sin(a)*r*.9,-ry*.1-((age*190+n*39)%h)*.65,3+n%3,'#ffe5a5',4,a);}
    }
  }else if(p.visual==='iceBloom'){
    const expansion=clamp(age/.16),rotation=-Math.PI/2;
    halo(ctx,0,0,r*1.4,'#86d9ff',.35);
    // A faceted six-point frost seal, with radial ice instead of a light column.
    for(let n=0;n<6;n++){
      const a=n*TAU/6+rotation,dx=Math.cos(a)*r*expansion,dy=Math.sin(a)*ry*expansion;
      glow(ctx,()=>{ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(dx,dy);for(const t of [.5,.75]){ctx.moveTo(dx*t-dy*.13*r/ry,dy*t+dx*.13*ry/r);ctx.lineTo(dx*(t-.14),dy*(t-.14));ctx.lineTo(dx*t+dy*.13*r/ry,dy*t-dx*.13*ry/r);}},'#b5edff',2.8);
      crystal(ctx,dx*.83,dy*.83,13,color,a+Math.PI/2);
    }
    glow(ctx,()=>{ctx.beginPath();for(let n=0;n<=6;n++){const a=n*TAU/6+rotation;const x=Math.cos(a)*r*.62,y=Math.sin(a)*ry*.62;if(n===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}},'#d7faff',1.4);
    for(let n=0;n<10;n++){const a=n*2.4;star(ctx,Math.cos(a)*r*.85,Math.sin(a)*ry*.85,3,'#ecffff',6,time*.4);}
  }else{
    halo(ctx,0,0,r*1.4,'#efa0cd',.35);
    for(let n=0;n<8;n++){
      const a=n*TAU/8+time*.35;ctx.save();ctx.scale(1,ry/r);ctx.rotate(a);
      glow(ctx,()=>{ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(r*.2,-r*.6,r*1.2,-r*.35,r,0);ctx.bezierCurveTo(r*.65,r*.28,r*.2,r*.2,0,0);},n%2?light:color,3);ctx.restore();
    }
    ring(ctx,0,0,r*.4,ry*.4,color,2,-time*.4);
  }
  ctx.restore();
}

function drawRibbonHunter(ctx,p,time){
  const color=p.colors[1],r=p.radius;
  ctx.save();ctx.globalCompositeOperation='screen';
  for(let n=0;n<2;n++)glow(ctx,()=>{
    ctx.beginPath();for(const [i,point] of p.trace.entries()){
      const t=i/Math.max(1,p.trace.length-1),x=point.x,y=point.y+Math.sin(t*TAU-time*10+n*Math.PI)*r*.65;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }ctx.lineTo(p.x,p.y);
  },n? '#ffe4f2':color,n?1.5:5,.8);
  ctx.translate(p.x,p.y);halo(ctx,0,0,r*2.8,color,.6);
  ring(ctx,0,0,r*1.6,r*.6,color,1.8,time*3*(p.returned?-1:1));
  ctx.rotate(Math.sin(time*8)*.25);ctx.fillStyle='#ffe6f2';ctx.shadowColor=color;ctx.shadowBlur=12;
  ctx.beginPath();ctx.moveTo(0,r*.7);ctx.bezierCurveTo(-r*1.7,-r*.2,-r*.5,-r*1.4,0,-r*.45);ctx.bezierCurveTo(r*.8,-r*1.5,r*1.6,-r*.1,0,r*.7);ctx.fill();
  for(let n=0;n<3;n++){const a=time*4+n*TAU/3;star(ctx,Math.cos(a)*r*1.8,Math.sin(a)*r*1.2,3,p.colors[0],4,a);}
  ctx.restore();
}

function drawRoundUltimate(ctx,p,time){
  const ready=p.age>=p.delay,progress=clamp((p.age-p.delay)/Math.max(.1,p.life+p.age-p.delay)),r=p.radius,color=p.colors[1];
  ctx.save();ctx.translate(p.x,p.y);ctx.globalCompositeOperation='screen';
  if(!ready){
    ctx.globalAlpha=.55;ctx.setLineDash([7,7]);ring(ctx,0,0,r,r,color,1.5);ctx.setLineDash([]);
    if(p.visual==='windCrossBurst')for(const sign of [-1,1])glow(ctx,()=>{ctx.beginPath();ctx.moveTo(-r*.65,-sign*r*.65);ctx.lineTo(r*.65,sign*r*.65);},color,1.5,.5);
    else{const size=r*(1-clamp(p.age/p.delay)*.6);spiral(ctx,0,0,size,time,color);}ctx.restore();return;
  }
  ctx.globalAlpha=clamp(p.life/.13);
  if(p.visual==='windCrossBurst'){
    for(const sign of [-1,1])for(let n=0;n<3;n++)glow(ctx,()=>{ctx.beginPath();ctx.moveTo(-r*.7,-sign*r*.7+n*6);ctx.bezierCurveTo(-r*.1,-sign*r*.3,r*.15,sign*r*.5,r*.7,sign*r*.7-n*6);},n?p.colors[0]:color,n?2:7);
    for(let n=0;n<5;n++){const a=n*TAU/5+time*3;glow(ctx,()=>{ctx.beginPath();ctx.arc(0,0,r*(.45+n*.1),a,a+.8);},color,2.3);}star(ctx,0,0,25,p.colors[0],4,.7);
  }else{
    const core=r*(p.visual==='spiralImpact'?.58:.45)+Math.sin(time*32)*3;
    halo(ctx,0,0,r,color,.65);const gradient=ctx.createRadialGradient(-core*.2,-core*.3,2,0,0,core);gradient.addColorStop(0,'#fffdf0');gradient.addColorStop(.3,'#fff2bb');gradient.addColorStop(1,'#eebf4b00');ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(0,0,core,0,TAU);ctx.fill();
    spiral(ctx,0,0,core,time,color);ring(ctx,0,0,r*(.4+.58*progress),r*(.4+.58*progress),p.colors[0],2.5);
    for(let n=0;n<6;n++){const a=n*TAU/6+time*2;glow(ctx,()=>{ctx.beginPath();ctx.arc(0,0,r*(.76+n%2*.2),a,a+.65);},color,2.2);}
  }
  ctx.restore();
}

function drawMovingUltimate(ctx,p,time,renderer){
  const ready=p.age>=p.delay,color=p.colors[1];
  ctx.save();ctx.globalCompositeOperation='screen';
  if(!ready&&p.visual!=='spiralMeteor'){
    ctx.globalAlpha=.35;ctx.setLineDash([8,9]);glow(ctx,()=>{ctx.beginPath();ctx.moveTo(p.travel.from.x,p.travel.from.y);ctx.lineTo(p.travel.to.x,p.travel.to.y);},color,1.7);ctx.setLineDash([]);
  }
  if(ready)for(let n=0;n<2;n++)glow(ctx,()=>{ctx.beginPath();p.trace.forEach((point,i)=>{const x=point.x,y=point.y+n*5;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.lineTo(p.x,p.y);},n?p.colors[0]:color,n?1.5:5,.7);
  ctx.translate(p.x,p.y);ctx.globalAlpha=ready?1:.35;
  if(p.visual==='spiralMeteor'){
    halo(ctx,0,0,p.radius*1.5,color,.65);ctx.fillStyle='#fff6c5';ctx.beginPath();ctx.arc(0,0,p.radius*.65,0,TAU);ctx.fill();spiral(ctx,0,0,p.radius,time,color);ring(ctx,0,0,p.radius,p.radius*.9,p.colors[0],2,time*3);
  }else{
    const asset=renderer.variants.get(p.character)?.[p.pose];
    if(asset){ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=ready?.66:.22;ctx.scale(Math.sign(p.travel.to.x-p.travel.from.x)||1,1);const size=WORLD.spriteSize*asset.scale;ctx.drawImage(asset.canvas,-size*asset.anchor.x,WORLD.standHeight*.55-size*asset.anchor.y,size,size);ctx.restore();}
    const angle=Math.atan2(p.vy,p.vx);ctx.rotate(angle);for(let n=0;n<3;n++)glow(ctx,()=>{ctx.beginPath();ctx.arc(0,0,p.radius*(.72+n*.12),-.9,1.0);},n?p.colors[0]:color,n?1.7:5);
  }
  ctx.restore();
}

export function drawTechnique(ctx,p,time,renderer){
  if(p.emitter)return true;
  if(p.travel){drawMovingUltimate(ctx,p,time,renderer);return true;}
  if(['spiralCollapse','spiralImpact','windCrossBurst'].includes(p.visual)){drawRoundUltimate(ctx,p,time);return true;}
  if(['fireBlast','iceMirror','iceBloom','petalBloom'].includes(p.visual)){drawElementalField(ctx,p,time);return true;}
  if(p.visual==='ribbonHunt'){drawRibbonHunter(ctx,p,time);return true;}
  if(p.visual==='stormColumn'||p.visual==='airBurst'){drawTacticalField(ctx,p,time);return true;}
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
