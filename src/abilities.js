import {WORLD,isSuperMove} from './config.js';

const S=WORLD.fighterScale;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const volleyCount=attack=>['superStorm','airSuper'].includes(attack.move)?1:['cloneStorm','ribbonStorm'].includes(attack.config.pattern)?attack.config.hits:1;
export function fieldBounds(p){return {left:p.x-p.radius,right:p.x+p.radius,top:p.hitTop??p.y-95*S,bottom:p.hitBottom??p.y+70*S};}
const targetPoint=(owner,defender,range=900)=>({x:clamp(defender.x+clamp(defender.vx*.16,-95,95),Math.max(WORLD.left,owner.x-range),Math.min(WORLD.right,owner.x+range)),y:clamp(defender.y+defender.vy*.18,WORLD.top+WORLD.standHeight,WORLD.floor)});
function tacticalField(game,base,target,{radius=155,delay=.24,duration=.38,damage=9,control=0,controlType='bind',height=420,visual='stormColumn'}={}){
  const field={...base,emitter:false,travel:null,trace:null,x:target.x,y:target.y-65*S,originY:target.y,vx:0,vy:0,radius,field:true,linger:true,
    age:0,life:delay+duration,delay,hitTop:target.y-height,hitBottom:target.y+45,visual,hits:new Set(),level:'overhead',
    config:{...base.config,damage,stun:.23,push:18*S,control,controlType,launch:0}};
  game.projectiles.push(field);return field;
}
function ribbonHunters(game,base,owner,{damage=9,control=.7}={}){
  for(const side of [-1,1])game.projectiles.push({...base,emitter:false,field:false,x:owner.x+owner.facing*40*S,y:owner.y-(135+side*65)*S,
    vx:owner.facing*920,vy:side*170,age:0,life:2.8,radius:30*S,visual:'ribbonHunt',returning:true,turnAt:.95,homing2D:7,seekUntil:.85,
    level:'mid',hits:new Set(),trace:[],config:{...base.config,damage,stun:.27,push:25*S,control,controlType:'bind'}});
}

function roundImpact(game,base,target,{radius=145,delay=.2,duration=.3,damage=9,visual='spiralCollapse',launch=0}={}){
  const field=tacticalField(game,base,target,{radius,delay,duration,damage,visual,height:radius*2});
  const cy=target.centerY??target.y-WORLD.standHeight*.55;
  Object.assign(field,{y:cy,hitTop:cy-radius,hitBottom:cy+radius,shape:'ellipse',level:base.move==='airSuper'?'overhead':'mid'});
  field.config={...field.config,launch,reaction:launch?'launch':'body'};return field;
}

function clonePass(game,base,target,{side=1,delay=.18,damage=6,dive=false,phase=0}={}){
  const cy=target.y-WORLD.standHeight*.55,from={x:clamp(target.x+side*245,WORLD.left,WORLD.right),y:cy+(dive?-240:side*(phase%2?-85:85))};
  const to={x:clamp(target.x-side*115,WORLD.left,WORLD.right),y:cy+(dive?55:-side*45)};
  const duration=dive?.26:.24;
  game.projectiles.push({...base,emitter:false,field:false,visual:dive?'windDive':'clonePass',x:from.x,y:from.y,vx:(to.x-from.x)/duration,vy:(to.y-from.y)/duration,
    radius:48,originY:target.y,level:dive?'overhead':'mid',age:0,life:delay+duration+.04,delay,travel:{from,to,duration,arc:0},pose:phase%2?22:21,hits:new Set(),trace:[],config:{...base.config,damage,stun:.23,push:12*S,launch:0}});
}

function sweepContact(p,defender,from){
  const steps=Math.max(1,Math.ceil(Math.hypot(p.x-from.x,p.y-from.y)/(p.radius*.5)));
  for(let i=0;i<=steps;i++){
    const x=from.x+(p.x-from.x)*i/steps,y=from.y+(p.y-from.y)*i/steps;
    if(defender.hurtboxes.some(b=>Math.hypot(x-clamp(x,b.x,b.x+b.w),y-clamp(y,b.y,b.y+b.h))<p.radius))return true;
  }return false;
}

function elementalStorm(game,p,owner,defender){
  if(p.theme==='spiral'){
    while(p.wave<4&&p.age>=p.nextWave){
      const final=p.wave===3;roundImpact(game,p,targetPoint(owner,defender),{radius:final?165:125,delay:final?.25:.2,duration:.30,damage:final?12:8});p.wave++;p.nextWave+=.27;
    }return true;
  }
  if(p.theme==='wind'){
    while(p.wave<3&&p.age>=p.nextWave){
      const target=targetPoint(owner,defender);for(const side of [-1,1])clonePass(game,p,target,{side,delay:.17+p.wave*.02,phase:p.wave});p.wave++;p.nextWave+=.28;
      if(p.wave===3)roundImpact(game,p,target,{radius:155,delay:.48,duration:.24,damage:10,visual:'windCrossBurst',launch:260});
    }return true;
  }
  if(p.theme==='ribbon'){
    if(p.wave===0){ribbonHunters(game,p,owner);p.wave=1;}
    return true;
  }
  if(p.theme==='fire'){
    while(p.wave<4&&p.age>=p.nextWave){
      const final=p.wave===3,field=tacticalField(game,p,targetPoint(owner,defender),{radius:final?185:140,delay:final?.3:.2,duration:final?.4:1.05,damage:final?14:7,height:350,visual:'fireBlast'});
      field.shape='ellipse';field.strikeEnd=field.delay+.30;field.config.reaction=final?'launch':'body';field.config.launch=final?300:0;
      if(!final){field.burn=true;field.nextBurn=field.delay+.38;field.burns=0;}
      p.wave++;p.nextWave+=.28;
    }
    return true;
  }
  if(p.theme==='ice'){
    if(p.wave===0){
      p.lockTarget=targetPoint(owner,defender);
      for(const side of [-1,1])game.projectiles.push({...p,emitter:false,field:true,linger:false,x:clamp(p.lockTarget.x+side*155,WORLD.left,WORLD.right),y:p.lockTarget.y-65*S,originY:p.lockTarget.y,
        vx:0,vy:0,radius:32,visual:'iceMirror',barrier:true,barrierHp:3,age:0,life:1.65,delay:.18,nextPulse:.18,pulse:0,pulseCount:1,interval:1,
        hitTop:p.lockTarget.y-240,hitBottom:p.lockTarget.y+15,level:'mid',config:{...p.config,damage:3,stun:.16,push:0}});
      p.wave=1;p.nextWave=.22;
    }
    if(p.wave===1&&p.age>=p.nextWave){
      const aim=targetPoint(owner,defender);
      for(const side of [-1,1])for(const lift of [70,205]){
        const x=clamp(p.lockTarget.x+side*155,WORLD.left,WORLD.right),y=p.lockTarget.y-lift,dx=aim.x-x,dy=aim.y-100*S-y,length=Math.hypot(dx,dy)||1;
        game.projectiles.push({...p,emitter:false,field:false,x,y,vx:dx/length*980,vy:dy/length*980,age:0,life:1.15,radius:23*S,visual:'iceSpear',level:'mid',hits:new Set(),config:{...p.config,damage:6,stun:.22,push:10*S}});
      }
      p.wave=2;p.nextWave=.48;
    }
    if(p.wave===2&&p.age>=p.nextWave){
      const field=tacticalField(game,p,p.lockTarget,{radius:160,delay:.18,duration:.45,damage:12,control:.9,controlType:'freeze',height:410,visual:'iceBloom'});field.shape='ellipse';p.wave=3;
    }
    return true;
  }
  return false;
}

// Persistent skills are real combat objects: they can miss, be blocked, expire,
// collide with other shots, and use the same damage/escape rules as normal hits.
export function spawnAbility(game,f,attack,sequence){
  const {config,move}=attack,pattern=config.pattern;
  if(!pattern&&!['superStorm','airSuper'].includes(move))return false;
  const direction=f.facing,opponent=game.fighters[1-f.index];
  const base={owner:f.index,character:f.character.id,attackId:attack.id,config,move,age:0,life:2.1,
    x:f.x+direction*48*S,y:f.y-140*S,vx:direction*690,vy:0,radius:23*S,color:config.colors[1],colors:config.colors,
    theme:config.theme,originY:f.y,level:config.level||'high',super:isSuperMove(move),
    slow:f.character.id==='purple',charm:f.character.id==='pink',frost:f.character.id==='blue',hits:new Set(),visual:'orb'};
  if(move==='superStorm'){
    shotEmitter();return true;
  }
  if(move==='airSuper'){
    if(f.character.id==='classic'){
      const target=targetPoint(f,opponent,1000),to={x:target.x,y:target.y-WORLD.standHeight*.55},from={x:f.x+direction*40*S,y:f.y-110*S};
      game.projectiles.push({...base,visual:'spiralMeteor',x:from.x,y:from.y,age:0,life:1.2,delay:.10,radius:52,level:'overhead',originY:target.y,trace:[],
        travel:{from,to,duration:.48,arc:95,follow:.55},config:{...config,damage:8,stun:.27,push:10*S}});
      game.emit('projectile',{index:f.index,super:true,move,theme:config.theme});return true;
    }
    if(f.character.id==='green'){
      const target=targetPoint(f,opponent,1000);for(const side of [-1,1])clonePass(game,base,target,{side,delay:side===-1?.17:.3,damage:9,dive:true,phase:side===-1?0:1});
      roundImpact(game,base,target,{radius:150,delay:.57,duration:.28,damage:14,visual:'windCrossBurst'});
      game.emit('projectile',{index:f.index,super:true,move,theme:config.theme});return true;
    }
    const target=targetPoint(f,opponent,1000),dx=target.x-base.x,dy=target.y-90*S-base.y,angle=Math.atan2(dy,dx),shared=new Set();
    if(f.character.id==='pink')ribbonHunters(game,base,f,{damage:7,control:.6});
    else for(const spread of [-.22,0,.22])game.projectiles.push({...base,x:f.x+direction*35*S,y:f.y-100*S,
      vx:Math.cos(angle+spread)*1120,vy:Math.sin(angle+spread)*1120,radius:32*S,life:1.5,level:'overhead',
      visual:f.character.id==='green'?'clone':'orb',hits:shared,hitGroup:shared,config:{...config,damage:9,stun:.29},aimTrail:true});
    const visual={red:'fireBlast',pink:'petalBloom',blue:'iceBloom'}[f.character.id]||'airBurst';
    const burst=tacticalField(game,base,target,{radius:f.character.id==='green'?175:155,delay:clamp(Math.hypot(dx,dy)/1120,.24,.55),duration:.42,
      height:390,damage:f.character.id==='pink'?12:22,control:['purple','pink','blue'].includes(f.character.id)?.72:0,controlType:f.character.id==='blue'?'freeze':'bind',visual});
    if(['fireBlast','petalBloom','iceBloom'].includes(visual))burst.shape='ellipse';
    game.emit('projectile',{index:f.index,super:true,move,theme:config.theme});return true;
  }
  function shotEmitter(){
    game.projectiles.push({...base,x:f.x,y:f.y,vx:0,vy:0,radius:0,emitter:true,wave:0,nextWave:0,life:1.7});
    game.emit('projectile',{index:f.index,super:true,move,theme:config.theme});
  }
  const shot=overrides=>{game.projectiles.push({...base,...overrides});};
  const zone=(visual,count=3,overrides={})=>{
    const targetX=f.x+direction*Math.min(550,Math.max(140,Math.abs(opponent.x-f.x)));
    shot({x:targetX,y:f.y-65*S,vx:0,vy:0,radius:95*S,visual,field:true,delay:.28,nextPulse:.28,pulse:0,pulseCount:count,
      interval:.24,life:.28+count*.24+.14,level:'mid',config:{...config,damage:move==='super'?config.damage:6,stun:.28,push:0},...overrides});
  };
  switch(pattern){
    case 'clone':
      shot({visual:'clone',x:f.x-direction*90,y:f.y-90*S,vx:direction*840,radius:42*S,delay:.12,life:1.25,level:'mid'});break;
    case 'cloneStorm':
      shot({visual:'clone',x:f.x-direction*(60+sequence*30),y:f.y-90*S,vx:direction*1050,radius:46*S,life:1.4,level:'mid'});break;
    case 'windFan':
      for(const spread of [-.14,.14])shot({visual:'wind',vx:direction*920,vy:spread*500,radius:30*S,config:{...config,damage:12,stun:.32}});break;
    case 'windField':zone('tornado',3,{radius:125,pull:150,delay:.16,nextPulse:.16,interval:.27,life:1.18,trackAim:true,fieldHeight:320,config:{...config,damage:5,stun:.18,push:0,control:.62,controlType:'vortex'}});break;
    case 'fireGround':shot({visual:'flame',y:f.y-27*S,vx:direction*660,radius:29*S,level:'low'});break;
    case 'fireBreath':
      shot({visual:'dragon',radius:42*S,vx:direction*810,level:'mid'});break;
    case 'eruption':
      for(let i=0;i<3;i++)zone('pillar',1,{x:f.x+direction*(130+i*115),delay:.18+i*.13,nextPulse:.18+i*.13,life:.65+i*.13,radius:70*S,level:'low',config:{...config,damage:7,stun:.32,push:20*S}});break;
    case 'fireGuard':zone('pillar',2,{x:f.x+direction*80,y:f.y-70*S,radius:75*S,delay:.25,nextPulse:.25,life:1.1});break;
    case 'volcano':zone('volcano',5,{radius:150*S,interval:.17,life:1.5,level:'mid'});break;
    case 'homing':shot({visual:'moon',vx:direction*520,homing:1.8,life:2.5});break;
    case 'moonFan':
      for(let i=-1;i<=1;i++)shot({visual:'moon',vx:direction*610,vy:i*110,radius:21*S,homing:1.5,config:{...config,damage:10}});break;
    case 'gravityField':zone('gravity',3,{pull:420,radius:145,delay:.16,nextPulse:.16,interval:.28,life:1.35,trackAim:true,fieldHeight:340,config:{...config,damage:5,stun:.18,push:0,control:.86,controlType:'bind'}});break;
    case 'moonPrison':zone('gravity',5,{pull:540,radius:175,delay:.2,nextPulse:.2,interval:.2,life:1.45,trackAim:true,fieldHeight:410,config:{...config,damage:8,stun:.18,push:0,control:1.04,controlType:'bind'}});break;
    case 'moonRain':case 'fireRain':case 'iceRain':case 'petalRain':case 'cloneRain':
      shot({visual:pattern==='cloneRain'?'clone':pattern==='fireRain'?'flame':pattern==='iceRain'?'iceSpear':pattern==='petalRain'?'ribbon':'moon',x:opponent.x+(sequence%2?30:-30),y:opponent.y-400,vx:direction*20,vy:640,radius:35*S,level:'overhead',life:1.3});break;
    case 'boomerang':shot({visual:'ribbon',returning:true,vx:direction*710,turnAt:.48,life:1.65,level:'high',config:{...config,damage:10}});break;
    case 'heartPair':
      for(let i of [-1,1])shot({visual:'ribbon',y:f.y-(140+i*15)*S,returning:true,vx:direction*(650+i*70),turnAt:.5,config:{...config,damage:11}});break;
    case 'ribbonField':zone('lotus',3,{pull:240,radius:140,delay:.18,nextPulse:.18,interval:.28,life:1.35,trackAim:true,fieldHeight:320,config:{...config,damage:5,stun:.18,push:0,control:.78,controlType:'bind'}});break;
    case 'ribbonStorm':shot({visual:'ribbon',x:f.x+direction*50,y:f.y-(100+sequence%2*50)*S,homing:2.8,vx:direction*820,radius:31*S,level:'mid',life:1.7});break;
    case 'iceNeedle':shot({visual:'iceSpear',radius:25*S,vx:direction*850});break;
    case 'iceFan':
      for(const spread of [-.2,0,.2])shot({visual:'iceSpear',vx:direction*850,vy:spread*550,radius:22*S,config:{...config,damage:10}});break;
    case 'iceSpikes':
      for(let i=0;i<3;i++)zone('iceSpikes',1,{x:f.x+direction*(120+i*110),delay:.16+i*.11,nextPulse:.16+i*.11,life:.75+i*.11,radius:78*S,level:'low',config:{...config,damage:6,control:.7,controlType:'freeze'}});break;
    case 'iceWall':zone('iceWall',2,{x:f.x+direction*110,radius:62*S,barrier:true,barrierHp:3,delay:.2,nextPulse:.2,interval:.5,life:1.8});break;
    case 'iceCage':zone('iceCage',5,{radius:165,delay:.2,nextPulse:.2,interval:.2,life:1.5,trackAim:true,fieldHeight:390,config:{...config,damage:8,stun:.18,push:0,control:1.02,controlType:'freeze'}});break;
    default:return false;
  }
  game.emit('projectile',{index:f.index,super:base.super,move,theme:config.theme});
  return true;
}

export function advanceAbility(game,p,dt){
  const defender=game.fighters[1-p.owner],owner=game.fighters[p.owner];
  if(p.travel){
    p.age+=dt;p.life-=dt;if(p.age<p.delay)return true;
    const travel=p.travel,u=clamp((p.age-p.delay)/travel.duration,0,1),previous={x:p.x,y:p.y};
    if(travel.follow&&u<travel.follow){const target=targetPoint(owner,defender,1000);travel.to={x:target.x,y:target.y-WORLD.standHeight*.55};p.originY=target.y;}
    p.x=travel.from.x+(travel.to.x-travel.from.x)*u;p.y=travel.from.y+(travel.to.y-travel.from.y)*u-Math.sin(u*Math.PI)*travel.arc;
    p.vx=(p.x-previous.x)/dt;p.vy=(p.y-previous.y)/dt;p.trace.push(previous);if(p.trace.length>9)p.trace.shift();
    const contact=!p.hits.has(defender.index)&&!game.evades(defender,p.level,p.originY)&&sweepContact(p,defender,previous);
    if(contact){game.hit(owner,defender,p.config,p.move,p,p.attackId);p.hits.add(defender.index);}
    if(p.visual==='spiralMeteor'&&(contact||u>=1)){
      roundImpact(game,p,{x:p.x,y:p.originY,centerY:p.y},{radius:165,delay:contact?.08:0,duration:.30,damage:18,visual:'spiralImpact'});p.life=0;
    }else if(u>=1)p.life=0;
    return true;
  }
  if(p.emitter){
    p.life-=dt;p.age+=dt;
    if(elementalStorm(game,p,owner,defender))return true;
    while(p.wave<4&&p.age>=p.nextWave){
      const final=p.wave===3;
      tacticalField(game,p,targetPoint(owner,defender),{radius:p.theme==='wind'?175:p.theme==='fire'?165:155,delay:final?.28:.24,duration:final?.52:.34,
        damage:9,control:final&&['void','ribbon','ice'].includes(p.theme)?.65:0,controlType:p.theme==='ice'?'freeze':'bind'});
      p.wave++;p.nextWave+=.25;
    }
    return true;
  }
  if(p.field){
    p.life-=dt;p.age+=dt;
    if(p.trackAim&&p.age<p.delay*.7){const target=targetPoint(owner,defender,650);p.x=target.x;p.originY=target.y;p.y=target.y-65*S;}
    if(p.fieldHeight){p.hitTop=p.originY-p.fieldHeight;p.hitBottom=p.originY+45;}
    const bounds=fieldBounds(p),inside=()=>defender.hurtboxes.some(box=>{
      if(p.shape==='ellipse'){
        const centerY=(bounds.top+bounds.bottom)/2,rx=p.radius,ry=(bounds.bottom-bounds.top)/2;
        return ((clamp(p.x,box.x,box.x+box.w)-p.x)/rx)**2+((clamp(centerY,box.y,box.y+box.h)-centerY)/ry)**2<1;
      }
      return bounds.right>box.x&&bounds.left<box.x+box.w&&bounds.top<box.y+box.h&&bounds.bottom>box.y;
    });
    if(p.linger){
      if(p.age>=p.delay&&p.age<=(p.strikeEnd??Infinity)&&!p.hits.has(defender.index)&&!game.evades(defender,p.level,p.originY)&&inside()){
        game.hit(owner,defender,p.config,p.move,p,p.attackId);p.hits.add(defender.index);
      }
      if(p.burn)while(p.burns<2&&p.age>=p.nextBurn){
        p.burns++;p.nextBurn+=.34;
        if(Math.abs(defender.x-p.x)<p.radius&&Math.abs(defender.y-p.originY)<70&&!game.evades(defender,'low',p.originY))game.hit(owner,defender,{...p.config,damage:2,stun:.05,push:0,control:0,launch:0,reaction:'body',dot:true},p.move,{...p,level:'low'},p.attackId);
      }
      return true;
    }
    if(p.age>=p.delay&&Math.abs(defender.x-p.x)<p.radius&&Math.abs(defender.y-p.originY)<155*S&&p.pull&&!game.evades(defender,p.level,p.originY)){
      defender.vx+=(Math.sign(p.x-defender.x)*p.pull-defender.vx)*Math.min(1,dt*5);
    }
    while(p.age>=p.nextPulse&&p.pulse<p.pulseCount){
      p.pulse++;p.nextPulse+=p.interval;
      if(!game.evades(defender,p.level,p.originY)&&inside()){
        game.hit(owner,defender,p.config,p.move,p,p.attackId);
      }
      game.effect('sigil',p.x,p.y,p.colors[1],1,.32);
    }
    return true;
  }
  if(p.delay&&p.age<p.delay){p.age+=dt;p.life-=dt;return true;}
  if(p.trace){p.trace.push({x:p.x,y:p.y});if(p.trace.length>10)p.trace.shift();}
  if(p.returning&&p.age>p.turnAt&&!p.returned){p.returned=true;p.hits.clear();p.level='mid';}
  if(p.returned){
    const targetX=owner.x-p.x,targetY=owner.y-130*S-p.y,length=Math.hypot(targetX,targetY)||1;
    p.vx=targetX/length*840;p.vy=targetY/length*840;
    if(length<24&&p.age>p.turnAt+.15)p.life=0;
  }else if(p.homing2D&&p.age<p.seekUntil){
    const dx=defender.x+clamp(defender.vx*.12,-70,70)-p.x,dy=defender.y-100*S+defender.vy*.1-p.y,length=Math.hypot(dx,dy)||1;
    p.vx+=(dx/length*1050-p.vx)*Math.min(1,dt*p.homing2D);p.vy+=(dy/length*1050-p.vy)*Math.min(1,dt*p.homing2D);
  }else if(p.homing){
    const target=(defender.y-115*S-p.y)*p.homing;p.vy+=(clamp(target,-240,240)-p.vy)*Math.min(1,dt*3);
  }
  return false;
}
