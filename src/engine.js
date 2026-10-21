import { WORLD, MOVEMENT, PLATFORMS, MOVES, DIFFICULTIES, characterById, stageById, isSuperMove, isSkillMove } from './config.js';
import {createCamera,updateCamera} from './camera.js';
import {moveFor} from './styles.js';
import {think} from './ai.js';
import {spawnAbility,advanceAbility,volleyCount} from './abilities.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const neutral=()=>({held:new Set(),pressed:new Set()});
const intersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const circleHits=(c,b)=>Math.hypot(c.x-clamp(c.x,b.x,b.x+b.w),c.y-clamp(c.y,b.y,b.y+b.h))<c.radius;
const ATTACK_INPUTS=['super','special','uppercut','grab','spin','kick','jab'];
const S=WORLD.fighterScale;
// Move data uses percentage-sized balance units; health uses 1000 points.
const H=WORLD.maxHealth/100;

export class Fighter {
  constructor(id,index){this.character=characterById(id);this.index=index;this.reset();}
  reset(){
    Object.assign(this,{
      x:WORLD.spawnX+(this.index===0?-290:290),y:WORLD.floor,vx:0,vy:0,facing:this.index===0?1:-1,
      hp:WORLD.maxHealth,trailHp:WORLD.maxHealth,energy:25,state:'idle',stateTime:0,attack:null,stun:0,slow:0,
      combo:0,comboTimer:0,maxCombo:0,landed:0,blocking:false,crouching:false,flash:0,invincible:0,
      buffer:null,cancelTime:0,aiThink:0,aiHeld:new Set(),hasHit:false,stunKind:'hurt',tauntTime:0,
      inputHeld:new Set(),history:[],tapTimes:{left:-10,right:-10},pendingDash:null,
      dashTime:0,dashCooldown:0,dashDirection:0,runDirection:0,jumpBuffer:0,jumpDodge:0,jumpReadyAt:0,upAttackHold:false,hitstunTime:0,
      confirmedMoves:[],lastMove:null,lastMoveTime:0,afterimages:[],
      platformId:null,airJumps:1,jumpSince:0,jumpRepeatDelay:0,dropThrough:0,dropHold:0,
      blinkTime:0,blinkCooldown:0,reaction:null,downTime:0,getUpTime:0,grappled:false,throwing:false,throwRotation:0,
      blinkCharges:MOVEMENT.blinkCharges,blinkRecharge:0,blinkBuffer:0,
      frost:0,charm:0,slowSource:null,healIds:[],juggleCount:0,
      frostStacks:0,frostWindow:0,petals:0,petalWindow:0,armorUsed:false,counterTime:0,
      aiPlan:[],aiLastConfirm:0,aiConfirmWatch:null,aiBlinkWatch:null,aiBlinkNext:0,aiRestUntil:0,aiWasAttacking:false,aiIntent:'approach',aiStats:{confirms:0,punishes:0,defenses:0,blinks:0},
    });
  }
  get grounded(){return (this.platformId!==null||this.y>=WORLD.floor-.5)&&this.vy>=0&&!this.grappled;}
  get hurtbox(){return {x:this.x-44*S,y:this.y-(this.crouching?WORLD.crouchHeight:WORLD.standHeight),w:88*S,h:this.crouching?WORLD.crouchHeight:WORLD.standHeight};}
  get hurtboxes(){
    if(this.crouching)return [{x:this.x-40*S,y:this.y-WORLD.crouchHeight,w:80*S,h:WORLD.crouchHeight}];
    // Three boxes follow the rounded silhouette, leaving empty corners unhittable.
    return [{x:this.x-29*S,y:this.y-WORLD.standHeight,w:58*S,h:72*S},{x:this.x-44*S,y:this.y-142*S,w:88*S,h:98*S},{x:this.x-33*S,y:this.y-48*S,w:66*S,h:48*S}];
  }
}

/** Browser-independent fixed-step combat simulation. */
export class Game {
  constructor({onEvent=()=>{},random=Math.random}={}){
    this.onEvent=onEvent;this.random=random;this.mode='ai';this.difficulty='normal';this.time=0;
    this.fighters=[new Fighter('classic',0),new Fighter('green',1)];this.phase='attract';
    this.round=1;this.wins=[0,0];this.projectiles=[];this.effects=[];this.roundTime=WORLD.roundSeconds;
    this.hitstop=0;this.shake=0;this.phaseTime=0;this.practiceGuard=false;
    this.matchWinner=null;this.lastWinner=null;this.matchStats=[{hits:0,maxCombo:0},{hits:0,maxCombo:0}];this.attackSerial=0;
    this.stageId='street';this.platforms=PLATFORMS;this.grapples=[];this.camera=createCamera();
  }
  emit(type,data={}){this.onEvent({type,...data});}
  start({p1='classic',p2='green',mode='ai',difficulty='normal',practiceGuard=false,stage='street'}={}){
    this.mode=mode;this.difficulty=difficulty;this.practiceGuard=practiceGuard;
    this.stageId=stageById(stage).id;
    this.fighters=[new Fighter(p1,0),new Fighter(p2,1)];this.wins=[0,0];this.round=1;
    this.matchWinner=null;this.lastWinner=null;this.matchStats=[{hits:0,maxCombo:0},{hits:0,maxCombo:0}];this.newRound();
  }
  newRound(){
    this.platforms=stageById(this.stageId).platforms;
    this.fighters.forEach(f=>f.reset());this.projectiles=[];this.effects=[];this.grapples=[];this.roundTime=WORLD.roundSeconds;this.hitstop=0;this.shake=0;
    this.camera=createCamera();updateCamera(this.camera,this.fighters,0,true);
    this.phase=this.mode==='practice'?'fight':'intro';this.phaseTime=0;
    if(this.mode==='practice')this.fighters.forEach(f=>{f.energy=100;});
    this.emit('round',{round:this.round});
  }
  preview(p1,p2,stage=this.stageId){
    if(this.phase!=='attract')return;
    this.fighters=[new Fighter(p1,0),new Fighter(p2,1)];this.fighters[0].x=825;this.fighters[1].x=1090;
    this.stageId=stageById(stage).id;this.platforms=stageById(stage).platforms;
  }
  toAttract(){this.phase='attract';this.projectiles=[];this.effects=[];this.grapples=[];}
  tick(dt,inputs=[neutral(),neutral()]){
    this.time+=dt;this.shake=Math.max(0,this.shake-dt*30);this.updateEffects(dt);
    if(this.phase==='attract'||this.phase==='matchOver')return;
    updateCamera(this.camera,this.fighters,dt);
    const [a,b]=this.fighters;
    if(this.phase==='fight'){
      if(!a.attack&&a.dashTime<=0&&!a.throwing&&!a.grappled&&a.blinkTime<=0)a.facing=a.x<=b.x?1:-1;
      if(!b.attack&&b.dashTime<=0&&!b.throwing&&!b.grappled&&b.blinkTime<=0)b.facing=b.x>=a.x?-1:1;
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
    this.updateGrapples(dt);
    this.resolvePush(a,b);
    for(const f of this.fighters)this.resolveAttack(f,this.fighters[1-f.index]);
    this.updateProjectiles(dt);
    if(this.mode==='practice'){
      for(const f of this.fighters){f.energy=100;if(f.hp<=0||(f.stun<=0&&f.comboTimer<=0&&f.downTime<=0&&f.getUpTime<=0&&!f.grappled))f.hp=WORLD.maxHealth;}
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
    if(!input.held.has('jump'))f.upAttackHold=false;
    if(pressed.has('jump')){f.jumpBuffer=.2;f.jumpReadyAt=this.time+(f.grounded ? .08 : 0);if(f.grounded)f.jumpDodge=.12;}
    if(input.command&&moveFor(f.character,input.command)){f.buffer={move:input.command,raw:input.command,ttl:.20};return;}
    for(const raw of ATTACK_INPUTS)if(pressed.has(raw)){
      const move=this.chooseMove(f,raw,input.held,pressed);
      if(move==='uppercut'&&raw==='jab'&&input.held.has('jump')){f.jumpBuffer=0;f.upAttackHold=true;}
      if(move==='grab')f.dropHold=0;
      f.buffer={move,raw,ttl:.20};break;
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
      if(backward)return 'stance';
      return 'special';
    }
    if(raw==='jab'){
      if(held.has('jump'))return 'uppercut';
      if(down)return 'grab';
      if(!f.grounded)return 'airJab';
      if(backward)return 'lowJab';
      if(quarterCircle){f.history=[];return 'uppercut';}
      if(f.attack?.move==='jab'&&f.hasHit)return 'jab2';
      if(f.attack?.move==='jab2'&&f.hasHit)return 'straight';
      if(f.attack?.move==='kick'&&f.hasHit)return 'link';
      if(f.dashTime>0||f.runDirection)return 'rushPunch';
      return 'jab';
    }
    if(raw==='kick'){
      if(!f.grounded)return 'diveKick';
      if(down)return 'sweep';
      if(f.hasHit&&f.cancelTime>0&&['jab','lowJab'].includes(f.attack?.move))return 'branch';
      if(f.hasHit&&f.cancelTime>0&&f.attack?.move==='jab2')return 'ender';
      if(f.dashTime>0||f.runDirection)return 'slide';
    }
    return raw;
  }
  updateFighter(f,input,dt){
    const {held,pressed}=input;f.stateTime+=dt;
    for(const timer of ['flash','invincible','slow','stun','cancelTime','comboTimer','dashTime','dashCooldown','jumpBuffer','jumpDodge','lastMoveTime','blinkTime','blinkBuffer','jumpRepeatDelay','dropThrough','downTime','getUpTime','frost','charm','frostWindow','petalWindow','counterTime'])f[timer]=Math.max(0,f[timer]-dt);
    if(f.frostWindow===0)f.frostStacks=0;if(f.petalWindow===0)f.petals=0;
    if(f.blinkCharges<MOVEMENT.blinkCharges){
      f.blinkRecharge-=dt;
      if(f.blinkRecharge<=0){f.blinkCharges++;f.blinkRecharge=f.blinkCharges<MOVEMENT.blinkCharges?f.blinkRecharge+MOVEMENT.blinkRecharge:0;}
    }
    f.blinkCooldown=f.blinkCharges>0?0:Math.max(0,f.blinkRecharge);
    f.hitstunTime=f.stun>0&&f.stunKind==='hurt'?f.hitstunTime+dt:0;
    f.jumpSince+=dt;if(f.reaction)f.reaction.age+=dt;
    f.trailHp+=(f.hp-f.trailHp)*Math.min(1,dt*3.5);f.energy=clamp(f.energy+dt*3.5,0,100);
    if(f.comboTimer===0){f.combo=0;f.confirmedMoves=[];}
    f.blocking=false;
    if(f.buffer&&(f.buffer.ttl-=dt)<=0)f.buffer=null;
    if(f.pendingDash&&(f.pendingDash.ttl-=dt)<=0)f.pendingDash=null;
    f.afterimages=f.afterimages.filter(image=>(image.life-=dt)>0);
    if(f.grappled||f.throwing)return;
    if(pressed.has('blink'))f.blinkBuffer=.22;
    if(f.blinkBuffer>0&&f.blinkTime<=0&&f.blinkCharges>0&&f.downTime<=0&&(!f.attack||!isSuperMove(f.attack.move))&&(!f.reaction||f.hitstunTime>.10||f.reaction.age>.10))this.beginBlink(f,held);
    if(f.blinkTime>0){
      f.state='blink';f.crouching=false;f.blocking=false;
      if(Math.floor(f.stateTime*60)%2===0)f.afterimages.push({x:f.x,y:f.y,life:.23});
      this.physics(f,dt);return;
    }
    if(f.downTime>0||f.getUpTime>0){
      f.state=f.downTime>0?'knockdown':'getup';f.attack=null;f.blocking=false;f.crouching=false;this.physics(f,dt);return;
    }
    if(f.stun>0){
      f.state=f.hp<=0?'ko':f.stunKind;f.attack=null;f.dashTime=0;f.runDirection=0;
      if(f.stunKind==='guard'){f.blocking=held.has('guard')||held.has(f.facing===1?'left':'right');f.crouching=held.has('down');}
      if(f.stunKind!=='guard')f.crouching=false;
      this.physics(f,dt);return;
    }
    if(f.reaction&&['trip','launch','tumble'].includes(f.reaction.type)&&!f.grounded){f.state='hurt';this.physics(f,dt);return;}
    if(f.attack){
      if(!f.grounded&&f.jumpBuffer>0&&f.airJumps>0&&f.jumpSince>.12&&!isSuperMove(f.attack.move)&&f.attack.time>.09){f.attack=null;this.jump(f,true);}
      else{this.updateAttack(f,dt);this.physics(f,dt);return;}
    }
    if(f.reaction&&f.stun<=0&&f.grounded)f.reaction=null;
    if(f.pendingDash&&f.grounded&&f.dashCooldown<=0&&!held.has('guard')&&!held.has('down')){
      f.dashDirection=f.pendingDash.direction;f.runDirection=f.dashDirection;f.dashTime=MOVEMENT.dashDuration;f.dashCooldown=.34;
      f.vx=f.dashDirection*(f.dashDirection===f.facing?MOVEMENT.dashForward:MOVEMENT.dashBack);
      if(f.dashDirection!==f.facing)f.jumpDodge=.085;
      f.pendingDash=null;f.stateTime=0;this.effect('dust',f.x,WORLD.floor-2,'#f5e1ba',8);this.emit('dash',{index:f.index});
    }
    f.crouching=held.has('down')&&f.grounded;
    if(f.platformId!==null&&held.has('down')){
      f.dropHold+=dt;
      if(f.dropHold>.18){f.platformId=null;f.dropThrough=.28;f.y+=8;f.vy=80;f.crouching=false;f.jumpRepeatDelay=.22;}
    }else f.dropHold=0;
    const movingBack=held.has(f.facing===1?'left':'right');
    f.blocking=f.grounded&&f.dashTime<=0&&(held.has('guard')||movingBack);
    if(pressed.has('taunt')&&f.grounded&&f.tauntTime<=0){f.tauntTime=1.8;f.stateTime=0;this.emit('laugh',{index:f.index});}
    if(f.buffer||f.jumpBuffer>0||held.has('left')||held.has('right')||held.has('guard'))f.tauntTime=0;
    if(f.tauntTime>0){f.tauntTime=Math.max(0,f.tauntTime-dt);f.state='taunt';f.vx=0;f.blocking=false;this.physics(f,dt);return;}
    if(!held.has('guard')&&!held.has('down')&&!f.upAttackHold){
      if(f.grounded&&f.jumpRepeatDelay<=0&&this.time>=f.jumpReadyAt&&(f.jumpBuffer>0||held.has('jump')))this.jump(f,false);
      else if(!f.grounded&&f.jumpBuffer>0&&f.airJumps>0&&f.jumpSince>.12)this.jump(f,true);
    }
    if(f.buffer&&!held.has('guard')){
      const move=f.buffer.move,aerial=!f.grounded&&f.jumpSince<.04;
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
        const speed=f.character.speed*(f.slow>0?.58:1)*(f.charm>0?.8:1)*(running?MOVEMENT.runMultiplier:1);
        f.vx+=(direction*speed-f.vx)*Math.min(1,dt*(f.grounded?24:7));
        f.state=!f.grounded?'jump':f.crouching?'crouch':held.has('guard')?'guard':running?'dash':direction?'walk':'idle';
      }
    }
    this.physics(f,dt);
  }
  updateAttack(f,dt){
    const attack=f.attack;attack.time+=dt;
    if(attack.config.projectile){
      const count=volleyCount(attack);
      while(attack.spawnedCount<count&&attack.time>=attack.config.startup+attack.spawnedCount*(attack.config.interval||0)){
        this.spawnSpecial(f,attack,attack.spawnedCount++);
      }
    }
    if(attack.config.warp&&!attack.warped&&attack.time>=attack.config.startup*.5){
      const opponent=this.fighters[1-f.index],from=f.x;
      if(Math.abs(opponent.x-f.x)<470&&Math.abs(opponent.y-f.y)<180){
        f.x=clamp(opponent.x+f.facing*(WORLD.pushDistance+6),WORLD.left,WORLD.right);f.facing=f.x<opponent.x?1:-1;
        f.invincible=.09;f.afterimages.push({x:from,y:f.y,life:.3});this.effect('sigil',f.x,f.y-75,attack.config.colors[1],1,.4);
      }
      attack.warped=true;
    }
    if(attack.config.travelThrough&&attack.time>attack.config.startup+.06){const opponent=this.fighters[1-f.index];if(Math.abs(opponent.x-f.x)>25)f.facing=opponent.x>f.x?1:-1;}
    if(attack.config.drive&&attack.time<attack.config.startup+(isSuperMove(attack.move)?attack.config.active:.14)){
      const opponent=this.fighters[1-f.index];f.vx=f.facing*(Math.abs(opponent.x-f.x)>WORLD.pushDistance+17*S?attack.config.drive:45);
      if(Math.floor(attack.time*60)%4===0)f.afterimages.push({x:f.x-f.facing*15,y:f.y,life:.15});
    }
    const next=f.buffer?.move,aerialFollowup=attack.move==='uppercut'&&['airJab','diveKick','airWave'].includes(next);
    const canCancel=next&&f.hasHit&&f.cancelTime>0&&!isSuperMove(attack.move)&&attack.move!=='grab'&&(moveFor(f.character,next)?.rank>attack.config.rank||aerialFollowup);
    if(canCancel&&f.energy>=this.moveCost(f,next))this.beginAttack(f,next);
    else if(attack.time>=attack.config.startup+attack.config.active+attack.config.recovery){
      f.attack=null;f.state=f.grounded?'idle':'jump';f.stateTime=0;
    }
  }
  physics(f,dt){
    const previousY=f.y,previousX=f.x;
    f.x=clamp(f.x+f.vx*dt,WORLD.left,WORLD.right);
    const support=this.platforms.find(p=>p.id===f.platformId);
    if(f.platformId!==null&&!support)f.platformId=null;
    if(support&&(f.x<support.x-15||f.x>support.x+support.w+15||f.vy<0))f.platformId=null;
    if(f.platformId!==null&&f.vy>=0){f.y=support.y;f.vy=0;}
    else if(f.y<WORLD.floor||f.vy<0){
      f.vy+=WORLD.gravity*dt;f.y+=f.vy*dt;
      let landing=null;
      if(f.vy>=0&&f.dropThrough<=0)landing=this.platforms.filter(p=>previousY<=p.y+.5&&f.y>=p.y&&f.x>=p.x-15&&f.x<=p.x+p.w+15).sort((a,b)=>a.y-b.y)[0];
      if(landing)this.land(f,landing.y,landing.id);
      else if(f.y>=WORLD.floor)this.land(f,WORLD.floor,null);
    }
    if(f.y<WORLD.top+WORLD.standHeight){f.y=WORLD.top+WORLD.standHeight;f.vy=Math.max(0,f.vy);}
    const other=this.fighters[1-f.index];
    if(!f.grappled&&!f.throwing&&Math.abs(f.x-other.x)>WORLD.maxSeparation&&Math.abs(f.x-other.x)>Math.abs(previousX-other.x))f.x=previousX;
    if(f.blinkTime<=0&&(f.stun>0||f.attack&&!f.attack.config.drive))f.vx*=Math.exp(-dt*8);
    if(f.afterimages.length>8)f.afterimages.splice(0,f.afterimages.length-8);
  }
  jump(f,second){
    f.vy=-f.character.jump*(second?MOVEMENT.airJumpRatio:1);f.platformId=null;f.jumpBuffer=0;f.jumpSince=0;
    f.airJumps=second?0:1;f.jumpDodge=second?.06:.12;f.crouching=false;f.blocking=false;f.dashTime=0;f.stateTime=0;
    if(second)this.effect('airRing',f.x,f.y-5,'#fff4ca',1,.35);
    this.emit(second?'doubleJump':'jump',{index:f.index});
  }
  land(f,y,platformId){
    f.y=y;f.vy=0;f.platformId=platformId;f.airJumps=1;f.jumpRepeatDelay=.065;f.juggleCount=0;
    this.effect('dust',f.x,y,'#f5e1ba',6);this.emit('land',{index:f.index});
    if(f.reaction&&['trip','launch','tumble'].includes(f.reaction.type)){
      f.downTime=.3;f.getUpTime=.52;f.invincible=.65;f.stun=0;f.reaction={type:'slam',age:0};
      this.effect('shockwave',f.x,y,'#fff1b4',1,.3);this.emit('slam',{index:f.index});
    }
  }
  beginBlink(f,held){
    const opponent=this.fighters[1-f.index];
    let direction=Number(held.has('right'))-Number(held.has('left'))||(f.x<opponent.x?-1:1);
    if(!held.has('left')&&!held.has('right')&&(f.x<WORLD.left+140||f.x>WORLD.right-140))direction=f.x<WORLD.left+140?1:-1;
    f.blinkCharges--;if(f.blinkRecharge<=0)f.blinkRecharge=MOVEMENT.blinkRecharge;
    f.blinkCooldown=f.blinkCharges>0?0:f.blinkRecharge;f.blinkBuffer=0;
    f.blinkTime=MOVEMENT.blinkDuration;f.invincible=.24;f.vx=direction*MOVEMENT.blinkSpeed;
    f.stun=0;f.hitstunTime=0;f.attack=null;f.buffer=null;f.reaction=null;f.tauntTime=0;f.dashTime=0;f.runDirection=0;f.stateTime=0;f.aiStats.blinks++;
    opponent.combo=0;opponent.confirmedMoves=[];opponent.cancelTime=0;
    this.effect('airRing',f.x,f.y-90*S,f.character.accent,1,.3);this.emit('blink',{index:f.index});
  }
  moveCost(f,move){
    const cost=moveFor(f.character,move)?.cost||0;
    if(!isSuperMove(move)||f.combo<3||f.cancelTime<=0)return cost;
    const credit=f.confirmedMoves.reduce((total,hit)=>total+(hit.cost||0),0);
    return Math.max(0,cost-Math.min(35,credit));
  }
  beginAttack(f,move){
    const config=moveFor(f.character,move);
    const cost=this.moveCost(f,move);
    if(!config||f.energy+.001<cost){if(f.buffer)this.emit('noEnergy',{index:f.index});f.buffer=null;return false;}
    f.energy=clamp(f.energy-cost,0,100);
    f.attack={id:++this.attackSerial,move,config,cost,time:0,connected:false,pulses:new Set(),spawnedCount:0,aerial:!f.grounded};
    f.state=move;f.stateTime=0;f.buffer=null;f.hasHit=false;f.blocking=false;f.crouching=config.posture==='crouch';f.tauntTime=0;f.dashTime=0;f.runDirection=0;
    f.vx=config.drive?f.facing*config.drive:f.vx*.2;
    f.armorUsed=false;f.counterTime=config.counter?config.active+config.startup:0;
    if(config.lift&&f.grounded){f.vy=-config.lift;f.platformId=null;f.jumpSince=0;f.jumpDodge=.1;}
    if(move==='diveKick'){f.vx=f.facing*340;f.vy=Math.max(200,f.vy);}
    if(config.invincible)f.invincible=config.invincible;
    const name=config.name;
    f.lastMove={move,name};f.lastMoveTime=1.4;this.emit('attack',{move,index:f.index,character:f.character.id,name});
    if(isSuperMove(move)){this.shake=9;this.effect('super',f.x,f.y-100,config.colors[1],1,.9);this.emit('super',{index:f.index,name,theme:config.theme});}
    else if(isSkillMove(move)||move==='spin')this.emit('skill',{index:f.index,move,theme:config.theme});
    return true;
  }
  resolvePush(a,b){
    if(a.blinkTime>0||b.blinkTime>0||a.attack?.config.travelThrough||b.attack?.config.travelThrough||a.grappled||b.grappled||a.throwing||b.throwing||Math.abs(a.y-b.y)>125*S)return;
    const distance=b.x-a.x;
    if(Math.abs(distance)<WORLD.pushDistance){
      const push=(WORLD.pushDistance-Math.abs(distance))/2,sign=distance>=0?1:-1;
      a.x=clamp(a.x-sign*push,WORLD.left,WORLD.right);b.x=clamp(b.x+sign*push,WORLD.left,WORLD.right);
    }
  }
  evades(defender,level,originY=WORLD.floor){
    if(defender.invincible>0||defender.grappled||defender.throwing||defender.downTime>0||defender.getUpTime>0)return true;
    if(level==='high'&&defender.crouching)return true;
    if(level==='low'&&originY-defender.y>34*S)return true;
    if(level==='throw'&&!defender.grounded)return true;
    return defender.jumpDodge>0&&!['antiAir','overhead'].includes(level);
  }
  resolveAttack(attacker,defender){
    const attack=attacker.attack;
    if(!attack||attack.config.projectile||attack.config.counter)return;
    const {config,time}=attack;
    if(time<config.startup||time>config.startup+config.active)return;
    const pulse=config.hits?Math.floor((time-config.startup)/config.interval):0;
    if(pulse>=(config.hits||1)||attack.pulses.has(pulse)||this.evades(defender,config.level,attacker.y))return;
    if(config.level==='throw'&&Math.abs(attacker.x-defender.x)>config.reach)return;
    const box={x:attacker.facing===1?attacker.x:attacker.x-config.reach,y:attacker.y-config.top,w:config.reach,h:config.top-config.bottom};
    if(defender.hurtboxes.some(hurtbox=>intersects(box,hurtbox))){
      attack.pulses.add(pulse);attack.connected=true;
      if(config.level==='throw'){this.startThrow(attacker,defender,attack);return;}
      const final=pulse===(config.hits||1)-1;
      const hitConfig=final&&isSuperMove(attack.move)&&config.hits?{...config,push:330,launch:520}:config;
      this.hit(attacker,defender,hitConfig,attack.move,null,attack.id);
      if(attack.move==='pulse')this.effect('shockwave',attacker.x,attacker.y-2,attacker.character.accent,1,.45);
    }
  }
  startThrow(attacker,defender,attack){
    const direction=attacker.facing;
    const targetX=clamp(attacker.x-direction*(attack.config.throwDistance||230)*S,WORLD.left,WORLD.right);
    let attackerX=attacker.x;
    if(Math.abs(targetX-attackerX)<WORLD.pushDistance+12)attackerX=clamp(targetX+direction*(WORLD.pushDistance+20),WORLD.left,WORLD.right);
    const landing=this.platforms.filter(p=>targetX>=p.x&&targetX<=p.x+p.w&&p.y>=attacker.y-.5).sort((a,b)=>a.y-b.y)[0];
    const targetY=landing?.y??WORLD.floor;
    this.grapples.push({attacker:attacker.index,defender:defender.index,time:0,duration:attack.config.throwDuration||.64,arc:attack.config.throwArc||180,originX:attacker.x,originY:attacker.y,fromX:defender.x,fromY:defender.y,targetX,targetY,attackerX,platformId:landing?.id??null,direction,attack});
    attacker.throwing=true;attacker.vx=0;attacker.vy=0;attacker.attack=null;attacker.state='grab';attacker.stateTime=0;
    defender.grappled=true;defender.attack=null;defender.blocking=false;defender.crouching=false;defender.vx=0;defender.vy=0;defender.platformId=null;defender.reaction={type:'caught',age:0};
    this.emit('catch',{index:attacker.index,target:defender.index});
  }
  updateGrapples(dt){
    for(const grapple of this.grapples){
      grapple.time+=dt;
      const a=this.fighters[grapple.attacker],d=this.fighters[grapple.defender];
      const p=clamp(grapple.time/grapple.duration,0,1),lift=Math.min(1,p/.2);
      a.x=grapple.originX+(grapple.attackerX-grapple.originX)*p;
      if(p<.2){d.x=grapple.fromX+(a.x+grapple.direction*55*S-grapple.fromX)*lift;d.y=grapple.fromY-70*S*lift;}
      else{
        const arc=(p-.2)/.8,ease=arc*arc*(3-2*arc),fromX=a.x+grapple.direction*55*S;
        d.x=fromX+(grapple.targetX-fromX)*ease;
        d.y=grapple.originY-70*S+(grapple.targetY-grapple.originY+70*S)*ease-Math.sin(arc*Math.PI)*grapple.arc*S;
        d.throwRotation=-grapple.direction*Math.PI*arc;
      }
      if(p>=1){
        d.grappled=false;d.throwRotation=0;d.x=grapple.targetX;d.y=grapple.targetY;d.platformId=grapple.platformId;d.vy=0;
        this.hit(a,d,{...grapple.attack.config,push:0,launch:0},'grab',null,grapple.attack.id);
        d.reaction={type:'slam',age:0};d.downTime=.38;d.getUpTime=.64;d.invincible=.76;d.stun=0;d.vx=0;d.airJumps=1;
        a.throwing=false;a.state='idle';a.stun=.16;a.stunKind='idle';
        a.facing=a.x<=d.x?1:-1;d.facing=-a.facing;
        this.effect('shockwave',d.x,d.y,'#ffdc8e',1,.42);this.effect('dust',d.x,d.y,'#efdeb5',12);this.shake=8;
        this.emit('slam',{index:d.index});
      }
    }
    this.grapples=this.grapples.filter(g=>g.time<g.duration);
  }
  spawnSpecial(f,attack,sequence=0){
    if(spawnAbility(this,f,attack,sequence))return;
    const {move,config}=attack,superMove=isSuperMove(move),direction=f.facing,kind=f.character.special;
    const base={owner:f.index,character:f.character.id,attackId:attack.id,config,move,life:2.2,age:0,color:config.colors[1],colors:config.colors,theme:config.theme,super:superMove,slow:kind==='bubble',frost:kind==='frost',charm:kind==='charm',originY:f.y};
    if(move==='superStorm'){
      const opponent=this.fighters[1-f.index];
      this.projectiles.push({...base,x:clamp(opponent.x+(sequence%2?18:-18)*S,WORLD.left,WORLD.right),y:opponent.y-485,vx:direction*35,vy:690,radius:31*S,kind:'meteor',visual:'meteor',level:'overhead',life:1.3});
    }else if(move==='airWave'){
      for(const slope of [.55,1])this.projectiles.push({...base,x:f.x+direction*55*S,y:f.y-90*S,vx:direction*530,vy:530*slope,radius:20*S,kind,visual:'orb',level:'overhead',life:1.5});
    }else{
      const ground=kind==='stomp'&&move!=='powerWave',dash=kind==='dash'&&move==='special',powered=move==='powerWave';
      if(dash){f.vx=direction*850;f.jumpDodge=.1;}
      this.projectiles.push({...base,x:f.x+direction*55*S,y:f.y-(ground?24:143)*S,vx:direction*(dash?900:kind==='bubble'?480:690)*(powered?1.18:1),vy:0,
        radius:(superMove?55:powered?30:ground?24:22)*S,kind,visual:ground?'ground':dash?'slash':kind==='frost'?'ice':kind==='charm'?'heart':'orb',level:ground?'low':superMove?'mid':'high',life:superMove?1.9:2.2});
    }
    this.emit('projectile',{index:f.index,super:superMove,move});
  }
  updateProjectiles(dt){
    for(const p of this.projectiles){
      if(advanceAbility(this,p,dt))continue;
      p.life-=dt;p.age+=dt;p.x+=p.vx*dt;p.y+=(p.vy||0)*dt;
      const defender=this.fighters[1-p.owner];
      if(p.life>0&&!p.hits?.has(defender.index)&&!this.evades(defender,p.level,p.originY)&&defender.hurtboxes.some(box=>circleHits(p,box))){
        this.hit(this.fighters[p.owner],defender,p.config,p.move,p,p.attackId);
        if(p.returning)p.hits.add(defender.index);else p.life=0;
      }
      if(p.x< -100||p.x>WORLD.arenaWidth+100||p.y>WORLD.floor+45)p.life=0;
    }
    for(let i=0;i<this.projectiles.length;i++)for(let j=i+1;j<this.projectiles.length;j++){
      const a=this.projectiles[i],b=this.projectiles[j];
      if(a.field||b.field){
        const wall=a.barrier?a:b.barrier?b:null,shot=wall===a?b:a;
        if(wall&&wall.owner!==shot.owner&&!shot.field&&shot.life>0&&Math.abs(wall.x-shot.x)<wall.radius+shot.radius&&Math.abs(wall.y-shot.y)<130*S){
          shot.life=0;wall.barrierHp-=shot.super?3:1;if(wall.barrierHp<=0)wall.life=0;this.effect('iceShard',shot.x,shot.y,'#c8f5ff',8);this.emit('clash');
        }
        continue;
      }
      if(a.owner!==b.owner&&a.life>0&&b.life>0&&Math.hypot(a.x-b.x,a.y-b.y)<a.radius+b.radius){
        if(!a.super||b.super)a.life=0;if(!b.super||a.super)b.life=0;
        this.effect('spark',(a.x+b.x)/2,(a.y+b.y)/2,'#fff2c1',12);this.emit('clash');
      }
    }
    this.projectiles=this.projectiles.filter(p=>p.life>0);
  }
  hit(attacker,defender,config,move,projectile=null,attackId=0){
    if(defender.hp<=0||this.evades(defender,projectile?.level||config.level,projectile?.originY??attacker.y))return;
    const direction=projectile?Math.sign(projectile.vx)||attacker.facing:attacker.facing;
    const front=projectile?Math.sign(projectile.x-defender.x)===defender.facing:Math.sign(attacker.x-defender.x)===defender.facing;
    const level=projectile?.level||config.level;
    const guardHeight=level==='low'?defender.crouching:level==='overhead'?!defender.crouching:true;
    const blocked=level!=='throw'&&guardHeight&&defender.blocking&&front&&defender.grounded&&!defender.attack&&(defender.stun<=0||defender.stunKind==='guard');
    if(defender.counterTime>0&&defender.attack?.config.counter&&level!=='throw'){
      const counter=defender.attack;defender.counterTime=0;defender.attack=null;defender.invincible=.12;
      this.effect('sigil',defender.x,defender.y-90*S,counter.config.colors[1],1,.5);
      if(projectile&&!projectile.field){
        this.projectiles.push({...projectile,owner:defender.index,character:defender.character.id,attackId:counter.id,x:defender.x+defender.facing*45*S,
          vx:defender.facing*Math.max(650,Math.abs(projectile.vx)),vy:-(projectile.vy||0),age:0,life:1.5,hits:new Set(),returning:false,homing:0,
          config:{...counter.config,counter:false,launch:0},move:'stance',level:'mid',colors:counter.config.colors,theme:counter.config.theme});
      }else if(!projectile)this.hit(defender,attacker,{...counter.config,counter:false,level:'mid',launch:330},'stance',null,counter.id);
      this.emit('counter',{index:defender.index});return;
    }
    const armored=defender.attack?.config.armor>defender.attack?.time&&!defender.armorUsed&&level!=='throw'&&!isSuperMove(move);
    const damage=config.damage*WORLD.damageScale*H*attacker.character.power*Math.max(.28,.80**Math.max(0,attacker.combo-2))*(armored?.6:1);
    defender.hp=Math.max(0,defender.hp-damage*(blocked?.12:1));defender.vx=direction*config.push*(blocked?.38:1);
    const hitY=clamp(projectile?.y??attacker.y-((config.top||160*S)+(config.bottom||60*S))/2,defender.y-WORLD.standHeight+12*S,defender.y-10*S);
    if(blocked){
      defender.stun=.1;defender.stunKind='guard';defender.state='guard';defender.energy=clamp(defender.energy+7,0,100);
      this.effect('block',defender.x+defender.facing*34*S,hitY,'#b1e7e2',5);this.hitstop=.022;this.emit('block',{index:defender.index});return;
    }
    if(armored){defender.armorUsed=true;defender.flash=.12;this.effect('armor',defender.x,hitY,'#ffba64',1,.32);this.emit('armor',{index:defender.index});return;}
    if(defender.stun<=0||defender.stunKind!=='hurt')defender.hitstunTime=0;
    defender.stun=config.stun;defender.stunKind='hurt';defender.state=defender.hp<=0?'ko':'hurt';defender.stateTime=0;defender.tauntTime=0;defender.attack=null;
    defender.dashTime=0;defender.runDirection=0;defender.flash=.1;defender.crouching=false;
    let reaction=config.launch?'launch':['sweep','slide','pulse'].includes(move)?'trip':['kick','diveKick','straight','rushPunch','rushSkill'].includes(move)?'body':isSuperMove(move)?'tumble':'flinch';
    if(projectile?.frost){reaction='freeze';defender.frost=.24;defender.slow=projectile.super?1.6:.8;defender.slowSource='frost';}
    if(projectile?.charm){reaction='charm';defender.charm=1.1;
      if(!attacker.healIds.includes(attackId)){attacker.hp=Math.min(WORLD.maxHealth,attacker.hp+(projectile.super?5:2)*H);attacker.healIds.push(attackId);attacker.healIds=attacker.healIds.slice(-12);this.effect('heart',attacker.x,attacker.y-125,'#efa3bd',4,.65);}
    }
    defender.reaction={type:reaction,age:0,direction};
    if(projectile?.slow){defender.slow=projectile.super?2.1:1.2;defender.slowSource='bubble';}
    if(config.slow){defender.slow=config.slow;defender.slowSource='moon';}
    if(config.pull)defender.vx=-direction*config.pull;
    if(config.frost||projectile?.frost){
      defender.frostStacks++;defender.frostWindow=2;defender.frost=.24;defender.slow=.8;defender.slowSource='frost';
      if(defender.frostStacks>=3){defender.frostStacks=0;defender.stun=Math.max(defender.stun,.48);defender.reaction={type:'freeze',age:0,direction};defender.frost=.55;this.effect('iceShard',defender.x,hitY,'#d3faff',14);}
    }
    if(config.mark||projectile?.charm){
      defender.petals++;defender.petalWindow=2.3;
      if(defender.petals>=3){defender.petals=0;defender.hp=Math.max(0,defender.hp-2.5*H);attacker.hp=Math.min(WORLD.maxHealth,attacker.hp+2*H);this.effect('bloom',defender.x,hitY,'#ffadd3',1,.55);this.emit('bloom',{index:attacker.index});}
    }
    defender.energy=clamp(defender.energy+8,0,100);
    if(config.launch){defender.vy=-config.launch;defender.platformId=null;defender.jumpDodge=0;defender.juggleCount++;}
    else if(reaction==='trip'){defender.vy=-225;defender.platformId=null;}
    if(defender.juggleCount>4){defender.invincible=.8;defender.reaction.type='tumble';}
    attacker.combo++;attacker.comboTimer=config.stun+.23;attacker.maxCombo=Math.max(attacker.maxCombo,attacker.combo);attacker.landed++;
    this.matchStats[attacker.index].hits++;this.matchStats[attacker.index].maxCombo=Math.max(this.matchStats[attacker.index].maxCombo,attacker.combo);
    if(!attacker.confirmedMoves.some(c=>c.id===attackId))attacker.confirmedMoves.push({id:attackId,move,time:this.time,cost:isSkillMove(move)||move==='spin'?(config.cost||0):0});
    attacker.confirmedMoves=attacker.confirmedMoves.slice(-8);attacker.hasHit=true;attacker.cancelTime=.38;attacker.energy=clamp(attacker.energy+(config.meter||0),0,100);
    const superMove=isSuperMove(move);
    this.hitstop=superMove?.065:['kick','sweep','uppercut','grab'].includes(move)?.06:.04;this.shake=superMove?10:config.damage>=12?6:3;
    this.effect(projectile?.frost?'iceShard':projectile?.charm?'heart':'spark',defender.x-direction*22,hitY,projectile?.frost?'#b7ecff':projectile?.charm?'#f3a8c0':superMove?'#ffce62':'#fff1b8',superMove?15:8);
    this.effect('ring',defender.x-direction*22,hitY,'#fff2d3',1,.28);
    this.effect('impact',defender.x-direction*22,hitY,config.colors?.[1]||attacker.character.accent,1,superMove?.27:.17);
    this.emit('hit',{index:attacker.index,target:defender.index,move,damage,combo:attacker.combo,theme:config.theme});
  }
  endRound(){
    const [a,b]=this.fighters,winner=a.hp===b.hp?null:a.hp>b.hp?0:1;this.lastWinner=winner;
    if(winner!==null)this.wins[winner]++;this.phase='roundOver';this.phaseTime=0;this.projectiles=[];this.grapples=[];
    for(const f of this.fighters){f.attack=null;f.blocking=false;f.crouching=false;f.grappled=false;f.throwing=false;f.platformId=null;f.state=f.index===winner?'victory':f.hp<=0?'ko':'idle';f.stateTime=0;f.vx=0;f.dashTime=0;}
    this.emit('roundEnd',{winner,knockout:a.hp<=0||b.hp<=0});
  }
  ai(f,opponent,dt){return think(this,f,opponent,dt);}
  effect(type,x,y,color,count,duration=.48){
    for(let i=0;i<count;i++){const angle=this.random()*Math.PI*2,speed=75+this.random()*280;this.effects.push({type,x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,color,life:duration,duration,size:2+this.random()*6});}
    if(this.effects.length>240)this.effects.splice(0,this.effects.length-240);
  }
  updateEffects(dt){
    for(const e of this.effects){e.life-=dt;if(['spark','dust','heart','iceShard'].includes(e.type)){e.x+=e.vx*dt;e.y+=e.vy*dt;e.vy+=dt*(e.type==='heart'?-140:e.type==='dust'?-180:550);}}
    this.effects=this.effects.filter(e=>e.life>0);
  }
}
