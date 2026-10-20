import { WORLD, MOVES, DIFFICULTIES, characterById, isSuperMove, isSkillMove } from './config.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const neutral=()=>({held:new Set(),pressed:new Set()});
const intersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const circleHits=(c,b)=>Math.hypot(c.x-clamp(c.x,b.x,b.x+b.w),c.y-clamp(c.y,b.y,b.y+b.h))<c.radius;
const ATTACK_INPUTS=['super','special','uppercut','grab','spin','kick','jab'];

export class Fighter {
  constructor(id,index){this.character=characterById(id);this.index=index;this.reset();}
  reset(){
    Object.assign(this,{
      x:this.index===0?350:930,y:WORLD.floor,vx:0,vy:0,facing:this.index===0?1:-1,
      hp:100,trailHp:100,energy:25,state:'idle',stateTime:0,attack:null,stun:0,slow:0,
      combo:0,comboTimer:0,maxCombo:0,landed:0,blocking:false,crouching:false,flash:0,invincible:0,
      buffer:null,cancelTime:0,aiThink:0,aiHeld:new Set(),hasHit:false,stunKind:'hurt',tauntTime:0,
      inputHeld:new Set(),history:[],tapTimes:{left:-10,right:-10},pendingDash:null,
      dashTime:0,dashCooldown:0,dashDirection:0,runDirection:0,jumpBuffer:0,jumpDodge:0,
      confirmedMoves:[],lastMove:null,lastMoveTime:0,afterimages:[],
    });
  }
  get grounded(){return this.y>=WORLD.floor-.5&&this.vy>=0;}
  get hurtbox(){return {x:this.x-44,y:this.y-(this.crouching?WORLD.crouchHeight:WORLD.standHeight),w:88,h:this.crouching?WORLD.crouchHeight:WORLD.standHeight};}
  get hurtboxes(){
    if(this.crouching)return [{x:this.x-40,y:this.y-WORLD.crouchHeight,w:80,h:WORLD.crouchHeight}];
    // Three boxes follow the rounded silhouette, leaving empty corners unhittable.
    return [{x:this.x-29,y:this.y-WORLD.standHeight,w:58,h:72},{x:this.x-44,y:this.y-142,w:88,h:98},{x:this.x-33,y:this.y-48,w:66,h:48}];
  }
}

/** Browser-independent fixed-step combat simulation. */
export class Game {
  constructor({onEvent=()=>{},random=Math.random}={}){
    this.onEvent=onEvent;this.random=random;this.mode='ai';this.difficulty='normal';this.time=0;
    this.fighters=[new Fighter('classic',0),new Fighter('green',1)];this.phase='attract';
    this.round=1;this.wins=[0,0];this.projectiles=[];this.effects=[];this.roundTime=60;
    this.hitstop=0;this.shake=0;this.phaseTime=0;this.practiceGuard=false;
    this.matchWinner=null;this.lastWinner=null;this.matchStats=[{hits:0,maxCombo:0},{hits:0,maxCombo:0}];this.attackSerial=0;
  }
  emit(type,data={}){this.onEvent({type,...data});}
  start({p1='classic',p2='green',mode='ai',difficulty='normal',practiceGuard=false}={}){
    this.mode=mode;this.difficulty=difficulty;this.practiceGuard=practiceGuard;
    this.fighters=[new Fighter(p1,0),new Fighter(p2,1)];this.wins=[0,0];this.round=1;
    this.matchWinner=null;this.lastWinner=null;this.matchStats=[{hits:0,maxCombo:0},{hits:0,maxCombo:0}];this.newRound();
  }
  newRound(){
    this.fighters.forEach(f=>f.reset());this.projectiles=[];this.effects=[];this.roundTime=60;this.hitstop=0;this.shake=0;
    this.phase=this.mode==='practice'?'fight':'intro';this.phaseTime=0;
    if(this.mode==='practice')this.fighters.forEach(f=>{f.energy=100;});
    this.emit('round',{round:this.round});
  }
  preview(p1,p2){
    if(this.phase!=='attract')return;
    this.fighters=[new Fighter(p1,0),new Fighter(p2,1)];this.fighters[0].x=825;this.fighters[1].x=1090;
  }
  toAttract(){this.phase='attract';this.projectiles=[];this.effects=[];}
  tick(dt,inputs=[neutral(),neutral()]){
    this.time+=dt;this.shake=Math.max(0,this.shake-dt*30);this.updateEffects(dt);
    if(this.phase==='attract'||this.phase==='matchOver')return;
    const [a,b]=this.fighters;
    if(this.phase==='fight'){
      if(!a.attack&&a.dashTime<=0)a.facing=a.x<=b.x?1:-1;
      if(!b.attack&&b.dashTime<=0)b.facing=b.x>=a.x?-1:1;
      if(this.mode==='ai')inputs[1]=this.hitstop>0?{held:b.aiHeld,pressed:new Set()}:this.ai(b,a,dt);
      if(this.mode==='practice')inputs[1]={held:new Set(this.practiceGuard?['guard']:[]),pressed:new Set()};
      // Intake precedes hitstop, preserving motion commands and jump edges.
      this.fighters.forEach((f,i)=>this.intake(f,inputs[i]||neutral()));
    }
    if(this.hitstop>0){this.hitstop-=dt;return;}
    this.phaseTime+=dt;
    if(this.phase==='intro'){
      if(this.phaseTime>=2.2){this.phase='fight';this.phaseTime=0;this.emit('fight');}return;
    }
    if(this.phase==='roundOver'){
      for(const f of this.fighters){f.stateTime+=dt;this.physics(f,dt);}
      if(this.phaseTime>=2.8){
        if(this.wins.some(w=>w>=2)){this.phase='matchOver';this.matchWinner=this.wins[0]>=2?0:1;this.emit('matchEnd',{winner:this.matchWinner,wins:[...this.wins]});}
        else{this.round++;this.newRound();}
      }return;
    }
    if(this.mode!=='practice')this.roundTime=Math.max(0,this.roundTime-dt);
    this.fighters.forEach((f,i)=>this.updateFighter(f,inputs[i]||neutral(),dt));
    this.resolvePush(a,b);
    for(const f of this.fighters)this.resolveAttack(f,this.fighters[1-f.index]);
    this.updateProjectiles(dt);
    if(this.mode==='practice'){
      for(const f of this.fighters){f.energy=100;if(f.hp<=0||(f.stun<=0&&f.comboTimer<=0))f.hp=100;}
    }else if(a.hp<=0||b.hp<=0||this.roundTime<=0)this.endRound();
  }
  intake(f,input){
    const pressed=new Set(input.pressed);
    for(const d of ['left','right','down','jump'])if(input.held.has(d)&&!f.inputHeld.has(d))pressed.add(d);
    for(const d of ['down','left','right'])if(pressed.has(d)){
      const relative=d==='down'?'down':(d==='right'?1:-1)===f.facing?'forward':'back';
      f.history.push({direction:relative,time:this.time});
      if(d!=='down'){
        if(this.time-f.tapTimes[d]<.26)f.pendingDash={direction:d==='right'?1:-1,ttl:.16};
        f.tapTimes[d]=this.time;
      }
    }
    f.history=f.history.filter(e=>this.time-e.time<.6).slice(-12);f.inputHeld=new Set(input.held);
    if(pressed.has('jump'))f.jumpBuffer=.14;
    for(const raw of ATTACK_INPUTS)if(pressed.has(raw)){
      f.buffer={move:this.chooseMove(f,raw,input.held,pressed),raw,ttl:.20};break;
    }
  }
  chooseMove(f,raw,held,pressed=new Set()){
    const forward=held.has(f.facing===1?'right':'left'),backward=held.has(f.facing===1?'left':'right');
    const down=held.has('down')&&f.grounded;
    if(raw==='super'){
      if(down||held.has('uppercut'))return 'superRise';
      if(backward||held.has('special'))return 'superStorm';
      if(forward||held.has('kick'))return 'superRush';
      if(f.combo>=3&&f.cancelTime>0)return 'superFinish';
      return 'super';
    }
    if(raw==='grab'||((pressed.has('jab')||pressed.has('kick'))&&held.has('jab')&&held.has('kick')))return 'grab';
    if(raw==='uppercut')return 'uppercut';
    if(raw==='spin'||raw==='special'&&held.has('kick'))return 'spin';
    const forwardIndex=f.history.findLastIndex(e=>e.direction==='forward');
    const quarterCircle=forwardIndex>=0&&f.history.slice(0,forwardIndex).some(e=>e.direction==='down'&&f.history[forwardIndex].time-e.time<.5)&&this.time-f.history[forwardIndex].time<.3;
    if(raw==='special'){
      if(!f.grounded)return 'airWave';
      if(quarterCircle){f.history=[];return 'powerWave';}
      if(down)return 'pulse';
      if(forward)return 'rushSkill';
      return 'special';
    }
    if(raw==='jab'){
      if(!f.grounded)return 'airJab';
      if(down)return 'lowJab';
      if(quarterCircle){f.history=[];return 'uppercut';}
      if(f.attack?.move==='jab'&&f.hasHit)return 'jab2';
      if(f.attack?.move==='jab2'&&f.hasHit)return 'straight';
      if(f.dashTime>0||f.runDirection)return 'rushPunch';
      return 'jab';
    }
    if(raw==='kick'){
      if(!f.grounded)return 'diveKick';
      if(down)return 'sweep';
      if(f.dashTime>0||f.runDirection)return 'slide';
    }
    return raw;
  }
  updateFighter(f,input,dt){
    const {held,pressed}=input;f.stateTime+=dt;
    for(const timer of ['flash','invincible','slow','stun','cancelTime','comboTimer','dashTime','dashCooldown','jumpBuffer','jumpDodge','lastMoveTime'])f[timer]=Math.max(0,f[timer]-dt);
    f.trailHp+=(f.hp-f.trailHp)*Math.min(1,dt*3.5);f.energy=clamp(f.energy+dt*3.5,0,100);
    if(f.comboTimer===0){f.combo=0;f.confirmedMoves=[];}
    f.blocking=false;
    if(f.buffer&&(f.buffer.ttl-=dt)<=0)f.buffer=null;
    if(f.pendingDash&&(f.pendingDash.ttl-=dt)<=0)f.pendingDash=null;
    f.afterimages=f.afterimages.filter(image=>(image.life-=dt)>0);
    if(f.stun>0){
      f.state=f.hp<=0?'ko':f.stunKind;f.attack=null;f.dashTime=0;f.runDirection=0;
      if(f.stunKind!=='guard')f.crouching=false;
      this.physics(f,dt);return;
    }
    if(f.attack){this.updateAttack(f,dt);this.physics(f,dt);return;}
    if(f.pendingDash&&f.grounded&&f.dashCooldown<=0&&!held.has('guard')&&!held.has('down')){
      f.dashDirection=f.pendingDash.direction;f.runDirection=f.dashDirection;f.dashTime=.18;f.dashCooldown=.34;
      f.vx=f.dashDirection*(f.dashDirection===f.facing?850:710);
      if(f.dashDirection!==f.facing)f.jumpDodge=.085;
      f.pendingDash=null;f.stateTime=0;this.effect('dust',f.x,WORLD.floor-2,'#f5e1ba',8);this.emit('dash',{index:f.index});
    }
    f.crouching=held.has('down')&&f.grounded;
    const movingBack=held.has(f.facing===1?'left':'right');
    f.blocking=f.grounded&&f.dashTime<=0&&(held.has('guard')||movingBack);
    if(pressed.has('taunt')&&f.grounded&&f.tauntTime<=0){f.tauntTime=1.8;f.stateTime=0;this.emit('laugh',{index:f.index});}
    if(f.buffer||f.jumpBuffer>0||held.has('left')||held.has('right')||held.has('guard'))f.tauntTime=0;
    if(f.tauntTime>0){f.tauntTime=Math.max(0,f.tauntTime-dt);f.state='taunt';f.vx=0;f.blocking=false;this.physics(f,dt);return;}
    if(f.jumpBuffer>0&&f.grounded&&!held.has('guard')){
      f.vy=-f.character.jump;f.jumpBuffer=0;f.jumpDodge=.12;f.crouching=false;f.blocking=false;f.dashTime=0;f.stateTime=0;
      this.emit('jump',{index:f.index});
    }
    if(f.buffer&&!held.has('guard')){
      const move=f.buffer.move,aerial=f.vy<0&&f.y>=WORLD.floor-1;
      this.beginAttack(f,aerial&&['jab','kick','special'].includes(move)?{jab:'airJab',kick:'diveKick',special:'airWave'}[move]:move);
    }
    if(!f.attack){
      let direction=Number(held.has('right'))-Number(held.has('left'));
      if(f.crouching||held.has('guard'))direction=0;
      if(direction!==f.runDirection)f.runDirection=0;
      if(f.dashTime>0){
        f.state='dash';
        if(Math.floor(f.stateTime*60)%3===0)f.afterimages.push({x:f.x,y:f.y,life:.14});
      }else{
        const running=direction&&(f.runDirection||held.has('run'));
        const speed=f.character.speed*(f.slow>0?.58:1)*(running?1.6:1);
        f.vx+=(direction*speed-f.vx)*Math.min(1,dt*(f.grounded?24:7));
        f.state=!f.grounded?'jump':f.crouching?'crouch':held.has('guard')?'guard':running?'dash':direction?'walk':'idle';
      }
    }
    this.physics(f,dt);
  }
  updateAttack(f,dt){
    const attack=f.attack;attack.time+=dt;
    if(attack.config.projectile){
      const count=attack.move==='superStorm'?4:1;
      while(attack.spawnedCount<count&&attack.time>=attack.config.startup+attack.spawnedCount*(attack.config.interval||0)){
        this.spawnSpecial(f,attack,attack.spawnedCount++);
      }
    }
    if(attack.config.drive&&attack.time<attack.config.startup+(isSuperMove(attack.move)?attack.config.active:.14)){
      const opponent=this.fighters[1-f.index];f.vx=f.facing*(Math.abs(opponent.x-f.x)>125?attack.config.drive:45);
      if(Math.floor(attack.time*60)%4===0)f.afterimages.push({x:f.x-f.facing*15,y:f.y,life:.15});
    }
    const next=f.buffer?.move,aerialFollowup=attack.move==='uppercut'&&['airJab','diveKick','airWave'].includes(next);
    const canCancel=next&&f.hasHit&&f.cancelTime>0&&!isSuperMove(attack.move)&&attack.move!=='grab'&&(MOVES[next].rank>attack.config.rank||aerialFollowup);
    if(canCancel&&f.energy>=this.moveCost(f,next))this.beginAttack(f,next);
    else if(attack.time>=attack.config.startup+attack.config.active+attack.config.recovery){
      f.attack=null;f.state=f.grounded?'idle':'jump';f.stateTime=0;
    }
  }
  physics(f,dt){
    f.x=clamp(f.x+f.vx*dt,WORLD.left,WORLD.right);
    if(f.y<WORLD.floor||f.vy<0){
      f.vy+=WORLD.gravity*dt;f.y+=f.vy*dt;
      if(f.y>=WORLD.floor){f.y=WORLD.floor;f.vy=0;this.effect('dust',f.x,WORLD.floor,'#f5e1ba',7);this.emit('land',{index:f.index});}
    }
    if(f.stun>0||f.attack&&!f.attack.config.drive)f.vx*=Math.exp(-dt*8);
    if(f.afterimages.length>8)f.afterimages.splice(0,f.afterimages.length-8);
  }
  moveCost(f,move){
    const cost=MOVES[move]?.cost||0;
    if(!isSuperMove(move)||f.combo<3||f.cancelTime<=0)return cost;
    const credit=f.confirmedMoves.reduce((total,hit)=>total+(hit.cost||0),0);
    return Math.max(0,cost-Math.min(35,credit));
  }
  beginAttack(f,move){
    const config=MOVES[move];
    const cost=this.moveCost(f,move);
    if(!config||f.energy+.001<cost){if(f.buffer)this.emit('noEnergy',{index:f.index});f.buffer=null;return false;}
    f.energy=clamp(f.energy-cost,0,100);
    f.attack={id:++this.attackSerial,move,config,cost,time:0,connected:false,pulses:new Set(),spawnedCount:0,aerial:!f.grounded};
    f.state=move;f.stateTime=0;f.buffer=null;f.hasHit=false;f.blocking=false;f.crouching=config.posture==='crouch';f.tauntTime=0;f.dashTime=0;f.runDirection=0;
    f.vx=config.drive?f.facing*config.drive:f.vx*.2;
    if(config.lift&&f.grounded){f.vy=-config.lift;f.jumpDodge=.1;}
    if(move==='diveKick'){f.vx=f.facing*340;f.vy=Math.max(200,f.vy);}
    if(config.invincible)f.invincible=config.invincible;
    const name=move==='special'?f.character.specialName:move==='super'?f.character.superName:config.name;
    f.lastMove={move,name};f.lastMoveTime=1.4;this.emit('attack',{move,index:f.index,character:f.character.id,name});
    if(isSuperMove(move)){this.shake=9;this.effect('super',f.x,f.y-100,f.character.accent,1,.9);this.emit('super',{index:f.index,name});}
    else if(isSkillMove(move)||move==='spin')this.emit('skill',{index:f.index,move});
    return true;
  }
  resolvePush(a,b){
    if(Math.abs(a.y-b.y)>125)return;
    const distance=b.x-a.x;
    if(Math.abs(distance)<WORLD.pushDistance){
      const push=(WORLD.pushDistance-Math.abs(distance))/2,sign=distance>=0?1:-1;
      a.x=clamp(a.x-sign*push,WORLD.left,WORLD.right);b.x=clamp(b.x+sign*push,WORLD.left,WORLD.right);
    }
  }
  evades(defender,level){
    if(defender.invincible>0)return true;
    if(level==='high'&&defender.crouching)return true;
    if(level==='low'&&WORLD.floor-defender.y>34)return true;
    if(level==='throw'&&!defender.grounded)return true;
    return defender.jumpDodge>0&&!['antiAir','overhead'].includes(level);
  }
  resolveAttack(attacker,defender){
    const attack=attacker.attack;
    if(!attack||attack.config.projectile)return;
    const {config,time}=attack;
    if(time<config.startup||time>config.startup+config.active)return;
    const pulse=config.hits?Math.floor((time-config.startup)/config.interval):0;
    if(pulse>=(config.hits||1)||attack.pulses.has(pulse)||this.evades(defender,config.level))return;
    if(config.level==='throw'&&Math.abs(attacker.x-defender.x)>config.reach)return;
    const box={x:attacker.facing===1?attacker.x:attacker.x-config.reach,y:attacker.y-config.top,w:config.reach,h:config.top-config.bottom};
    if(defender.hurtboxes.some(hurtbox=>intersects(box,hurtbox))){
      attack.pulses.add(pulse);attack.connected=true;
      const final=pulse===(config.hits||1)-1;
      const hitConfig=final&&isSuperMove(attack.move)&&config.hits?{...config,push:330,launch:520}:config;
      this.hit(attacker,defender,hitConfig,attack.move,null,attack.id);
      if(attack.move==='pulse')this.effect('shockwave',attacker.x,WORLD.floor-2,attacker.character.accent,1,.45);
    }
  }
  spawnSpecial(f,attack,sequence=0){
    const {move,config}=attack,superMove=isSuperMove(move),direction=f.facing,kind=f.character.special;
    const base={owner:f.index,attackId:attack.id,config,move,life:2.2,age:0,color:f.character.accent,super:superMove,slow:kind==='bubble'};
    if(move==='superStorm'){
      const opponent=this.fighters[1-f.index];
      this.projectiles.push({...base,x:clamp(opponent.x+(sequence%2?18:-18),80,1200),y:125,vx:direction*35,vy:690,radius:31,kind:'meteor',visual:'meteor',level:'overhead',life:1.3});
    }else if(move==='airWave'){
      for(const slope of [.55,1])this.projectiles.push({...base,x:f.x+direction*55,y:f.y-90,vx:direction*530,vy:530*slope,radius:20,kind,visual:'orb',level:'overhead',life:1.5});
    }else{
      const ground=kind==='stomp'&&move!=='powerWave',dash=kind==='dash'&&move==='special',powered=move==='powerWave';
      if(dash){f.vx=direction*850;f.jumpDodge=.1;}
      this.projectiles.push({...base,x:f.x+direction*55,y:f.y-(ground?24:143),vx:direction*(dash?900:kind==='bubble'?480:690)*(powered?1.18:1),vy:0,
        radius:superMove?55:powered?30:ground?24:22,kind,visual:ground?'ground':dash?'slash':'orb',level:ground?'low':superMove?'mid':'high',life:superMove?1.9:2.2});
    }
    this.emit('projectile',{index:f.index,super:superMove,move});
  }
  updateProjectiles(dt){
    for(const p of this.projectiles){
      p.life-=dt;p.age+=dt;p.x+=p.vx*dt;p.y+=(p.vy||0)*dt;
      const defender=this.fighters[1-p.owner];
      if(p.life>0&&!this.evades(defender,p.level)&&defender.hurtboxes.some(box=>circleHits(p,box))){
        this.hit(this.fighters[p.owner],defender,p.config,p.move,p,p.attackId);p.life=0;
      }
      if(p.x< -100||p.x>WORLD.width+100||p.y>WORLD.floor+45)p.life=0;
    }
    for(let i=0;i<this.projectiles.length;i++)for(let j=i+1;j<this.projectiles.length;j++){
      const a=this.projectiles[i],b=this.projectiles[j];
      if(a.owner!==b.owner&&a.life>0&&b.life>0&&Math.hypot(a.x-b.x,a.y-b.y)<a.radius+b.radius){
        if(!a.super||b.super)a.life=0;if(!b.super||a.super)b.life=0;
        this.effect('spark',(a.x+b.x)/2,(a.y+b.y)/2,'#fff2c1',12);this.emit('clash');
      }
    }
    this.projectiles=this.projectiles.filter(p=>p.life>0);
  }
  hit(attacker,defender,config,move,projectile=null,attackId=0){
    if(defender.hp<=0||this.evades(defender,projectile?.level||config.level))return;
    const direction=projectile?Math.sign(projectile.vx)||attacker.facing:attacker.facing;
    const front=projectile?Math.sign(projectile.x-defender.x)===defender.facing:Math.sign(attacker.x-defender.x)===defender.facing;
    const level=projectile?.level||config.level;
    const guardHeight=level==='low'?defender.crouching:level==='overhead'?!defender.crouching:true;
    const blocked=level!=='throw'&&guardHeight&&defender.blocking&&front&&defender.grounded&&!defender.attack&&defender.stun<=0;
    const damage=config.damage*attacker.character.power*Math.max(.48,.88**Math.max(0,attacker.combo-2));
    defender.hp=Math.max(0,defender.hp-damage*(blocked?.12:1));defender.vx=direction*config.push*(blocked?.38:1);
    const hitY=clamp(projectile?.y??attacker.y-((config.top||160)+(config.bottom||60))/2,defender.y-WORLD.standHeight+12,defender.y-10);
    if(blocked){
      defender.stun=.1;defender.stunKind='guard';defender.state='guard';defender.energy=clamp(defender.energy+7,0,100);
      this.effect('block',defender.x+defender.facing*34,hitY,'#b1e7e2',5);this.hitstop=.022;this.emit('block',{index:defender.index});return;
    }
    defender.stun=config.stun;defender.stunKind='hurt';defender.state=defender.hp<=0?'ko':'hurt';defender.stateTime=0;defender.tauntTime=0;defender.attack=null;
    defender.dashTime=0;defender.runDirection=0;defender.flash=.1;defender.crouching=false;
    if(projectile?.slow)defender.slow=projectile.super?2.1:1.2;
    defender.energy=clamp(defender.energy+8,0,100);
    if(config.launch){defender.vy=-config.launch;defender.jumpDodge=0;}
    attacker.combo++;attacker.comboTimer=config.stun+.23;attacker.maxCombo=Math.max(attacker.maxCombo,attacker.combo);attacker.landed++;
    this.matchStats[attacker.index].hits++;this.matchStats[attacker.index].maxCombo=Math.max(this.matchStats[attacker.index].maxCombo,attacker.combo);
    if(!attacker.confirmedMoves.some(c=>c.id===attackId))attacker.confirmedMoves.push({id:attackId,move,time:this.time,cost:isSkillMove(move)||move==='spin'?(config.cost||0):0});
    attacker.confirmedMoves=attacker.confirmedMoves.slice(-8);attacker.hasHit=true;attacker.cancelTime=.32;attacker.energy=clamp(attacker.energy+(config.meter||0),0,100);
    const superMove=isSuperMove(move);
    this.hitstop=superMove?.065:['kick','sweep','uppercut','grab'].includes(move)?.06:.04;this.shake=superMove?10:config.damage>=12?6:3;
    this.effect('spark',defender.x-direction*22,hitY,superMove?'#ffce62':'#fff1b8',superMove?19:10);
    this.effect('ring',defender.x-direction*22,hitY,'#fff2d3',1,.28);
    this.effect('impact',defender.x-direction*22,hitY,attacker.character.accent,1,superMove?.27:.17);
    this.emit('hit',{index:attacker.index,target:defender.index,move,damage,combo:attacker.combo});
  }
  endRound(){
    const [a,b]=this.fighters,winner=a.hp===b.hp?null:a.hp>b.hp?0:1;this.lastWinner=winner;
    if(winner!==null)this.wins[winner]++;this.phase='roundOver';this.phaseTime=0;this.projectiles=[];
    for(const f of this.fighters){f.attack=null;f.blocking=false;f.crouching=false;f.state=f.index===winner?'victory':f.hp<=0?'ko':'idle';f.stateTime=0;f.vx=0;f.dashTime=0;}
    this.emit('roundEnd',{winner,knockout:a.hp<=0||b.hp<=0});
  }
  ai(f,opponent,dt){
    const level=DIFFICULTIES[this.difficulty]||DIFFICULTIES.normal;f.aiThink-=dt;const pressed=new Set();
    if(f.aiThink<=0){
      f.aiThink=level.reaction*(.8+this.random()*.5);const held=new Set(),distance=Math.abs(f.x-opponent.x);
      const towards=opponent.x<f.x?'left':'right',away=towards==='left'?'right':'left';
      const projectileDanger=this.projectiles.some(p=>p.owner!==f.index&&Math.abs(p.x-f.x)<310),threat=opponent.attack?.config.level;
      if((opponent.attack||projectileDanger)&&this.random()<level.block){
        if(projectileDanger&&this.random()<.48)held.add('down');
        else{held.add('guard');if(threat==='low')held.add('down');}
        if(threat==='low'&&this.random()<.35)pressed.add('jump');
      }else{
        if(distance>125)held.add(towards);
        if(distance>300&&this.random()<.22)held.add('run');
        if(distance<80&&this.random()<.2)held.add(away);
        if(f.stun<=0&&this.random()<level.aggression){
          if(f.energy>=100&&distance<650){
            pressed.add('super');if(this.random()<.3)held.add('down');else if(distance>350){held.delete(towards);held.add(away);}
          }else if(!opponent.grounded&&distance<180)pressed.add('uppercut');
          else if(opponent.blocking&&distance<116&&this.random()<.5)pressed.add('grab');
          else if(f.energy>=25&&distance>180&&this.random()<.65){pressed.add('special');if(this.random()<.4)held.delete(towards);}
          else if(distance<145*level.accuracy+40){pressed.add(this.random()<.55?'jab':'kick');if(this.random()<.24)held.add('down');}
          if(distance>180&&distance<420&&f.grounded&&this.random()<.13)pressed.add('jump');
        }
      }
      f.aiHeld=held;
    }
    return {held:f.aiHeld,pressed};
  }
  effect(type,x,y,color,count,duration=.48){
    for(let i=0;i<count;i++){const angle=this.random()*Math.PI*2,speed=75+this.random()*280;this.effects.push({type,x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,color,life:duration,duration,size:2+this.random()*6});}
    if(this.effects.length>240)this.effects.splice(0,this.effects.length-240);
  }
  updateEffects(dt){
    for(const e of this.effects){e.life-=dt;if(['spark','dust'].includes(e.type)){e.x+=e.vx*dt;e.y+=e.vy*dt;e.vy+=dt*(e.type==='dust'?-180:550);}}
    this.effects=this.effects.filter(e=>e.life>0);
  }
}
