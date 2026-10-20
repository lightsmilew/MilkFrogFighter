import {WORLD,isSuperMove} from './config.js';

const S=WORLD.fighterScale;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const volleyCount=attack=>attack.move==='superStorm'?4:['cloneStorm','ribbonStorm'].includes(attack.config.pattern)?attack.config.hits:1;

// Persistent skills are real combat objects: they can miss, be blocked, expire,
// collide with other shots, and use the same damage/escape rules as normal hits.
export function spawnAbility(game,f,attack,sequence){
  const {config,move}=attack,pattern=config.pattern;
  if(!pattern)return false;
  const direction=f.facing,opponent=game.fighters[1-f.index];
  const base={owner:f.index,character:f.character.id,attackId:attack.id,config,move,age:0,life:2.1,
    x:f.x+direction*48*S,y:f.y-140*S,vx:direction*690,vy:0,radius:23*S,color:config.colors[1],colors:config.colors,
    theme:config.theme,originY:f.y,level:config.level||'high',super:isSuperMove(move),
    slow:f.character.id==='purple',charm:f.character.id==='pink',frost:f.character.id==='blue',hits:new Set(),visual:'orb'};
  const shot=overrides=>{game.projectiles.push({...base,...overrides});};
  const zone=(visual,count=3,overrides={})=>{
    const targetX=f.x+direction*Math.min(430,Math.max(140,Math.abs(opponent.x-f.x)));
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
    case 'windField':zone('tornado',3,{radius:105*S,pull:150,life:1.25});break;
    case 'fireGround':shot({visual:'flame',y:f.y-27*S,vx:direction*660,radius:29*S,level:'low'});break;
    case 'fireBreath':
      shot({visual:'dragon',radius:42*S,vx:direction*810,level:'mid'});break;
    case 'eruption':
      for(let i=0;i<3;i++)zone('pillar',1,{x:f.x+direction*(130+i*115),delay:.22+i*.15,nextPulse:.22+i*.15,life:.7+i*.15,radius:55*S,level:'low',config:{...config,damage:7,stun:.3,push:20*S}});break;
    case 'fireGuard':zone('pillar',2,{x:f.x+direction*80,y:f.y-70*S,radius:75*S,delay:.25,nextPulse:.25,life:1.1});break;
    case 'volcano':zone('volcano',5,{radius:150*S,interval:.17,life:1.5,level:'mid'});break;
    case 'homing':shot({visual:'moon',vx:direction*520,homing:1.8,life:2.5});break;
    case 'moonFan':
      for(let i=-1;i<=1;i++)shot({visual:'moon',vx:direction*610,vy:i*110,radius:21*S,homing:1.5,config:{...config,damage:10}});break;
    case 'gravityField':zone('gravity',3,{pull:420,radius:140*S,interval:.32,life:1.65,config:{...config,damage:5,stun:.26,push:0}});break;
    case 'moonPrison':zone('gravity',5,{pull:540,radius:190*S,interval:.18,life:1.6});break;
    case 'moonRain':case 'fireRain':case 'iceRain':case 'petalRain':case 'cloneRain':
      shot({visual:pattern==='cloneRain'?'clone':pattern==='fireRain'?'flame':pattern==='iceRain'?'iceSpear':pattern==='petalRain'?'ribbon':'moon',x:opponent.x+(sequence%2?30:-30),y:opponent.y-400,vx:direction*20,vy:640,radius:35*S,level:'overhead',life:1.3});break;
    case 'boomerang':shot({visual:'ribbon',returning:true,vx:direction*710,turnAt:.48,life:1.65,level:'high',config:{...config,damage:10}});break;
    case 'heartPair':
      for(let i of [-1,1])shot({visual:'ribbon',y:f.y-(140+i*15)*S,returning:true,vx:direction*(650+i*70),turnAt:.5,config:{...config,damage:11}});break;
    case 'ribbonField':zone('lotus',3,{pull:240,radius:130*S,interval:.3,life:1.5});break;
    case 'ribbonStorm':shot({visual:'ribbon',x:f.x+direction*50,y:f.y-(100+sequence%2*50)*S,homing:2.8,vx:direction*820,radius:31*S,level:'mid',life:1.7});break;
    case 'iceNeedle':shot({visual:'iceSpear',radius:25*S,vx:direction*850});break;
    case 'iceFan':
      for(const spread of [-.2,0,.2])shot({visual:'iceSpear',vx:direction*850,vy:spread*550,radius:22*S,config:{...config,damage:10}});break;
    case 'iceSpikes':
      for(let i=0;i<3;i++)zone('iceSpikes',1,{x:f.x+direction*(120+i*110),delay:.2+i*.13,nextPulse:.2+i*.13,life:.8+i*.13,radius:58*S,level:'low',config:{...config,damage:6}});break;
    case 'iceWall':zone('iceWall',2,{x:f.x+direction*110,radius:62*S,barrier:true,barrierHp:3,delay:.2,nextPulse:.2,interval:.5,life:1.8});break;
    case 'iceCage':zone('iceCage',5,{radius:150*S,interval:.18,life:1.6});break;
    default:return false;
  }
  game.emit('projectile',{index:f.index,super:base.super,move,theme:config.theme});
  return true;
}

export function advanceAbility(game,p,dt){
  const defender=game.fighters[1-p.owner],owner=game.fighters[p.owner];
  if(p.field){
    p.life-=dt;p.age+=dt;
    if(p.age>=p.delay&&Math.abs(defender.x-p.x)<p.radius&&Math.abs(defender.y-p.originY)<155*S&&p.pull&&!game.evades(defender,p.level,p.originY)){
      defender.vx+=(Math.sign(p.x-defender.x)*p.pull-defender.vx)*Math.min(1,dt*5);
    }
    while(p.age>=p.nextPulse&&p.pulse<p.pulseCount){
      p.pulse++;p.nextPulse+=p.interval;
      if(!game.evades(defender,p.level,p.originY)&&defender.hurtboxes.some(box=>p.x+p.radius>box.x&&p.x-p.radius<box.x+box.w&&p.y-95*S<box.y+box.h&&p.y+70*S>box.y)){
        game.hit(owner,defender,p.config,p.move,p,p.attackId);
      }
      game.effect('sigil',p.x,p.y,p.colors[1],1,.32);
    }
    return true;
  }
  if(p.delay&&p.age<p.delay){p.age+=dt;p.life-=dt;return true;}
  if(p.returning&&p.age>p.turnAt&&!p.returned){p.returned=true;p.hits.clear();p.level='mid';}
  if(p.returned){
    const targetX=owner.x-p.x,targetY=owner.y-130*S-p.y,length=Math.hypot(targetX,targetY)||1;
    p.vx=targetX/length*840;p.vy=targetY/length*840;
    if(length<24&&p.age>p.turnAt+.15)p.life=0;
  }else if(p.homing){
    const target=(defender.y-115*S-p.y)*p.homing;p.vy+=(clamp(target,-240,240)-p.vy)*Math.min(1,dt*3);
  }
  return false;
}
