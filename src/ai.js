import {WORLD,DIFFICULTIES,isSuperMove} from './config.js';
import {moveFor,styleOf} from './styles.js';

function dodge(game,f,opponent,level,distance,towards,away){
  if(f.blinkCharges<=0||f.blinkTime>0||f.downTime>0||f.getUpTime>0||f.grappled||f.throwing||isSuperMove(f.attack?.move)||game.time<f.aiBlinkNext)return null;
  const cornered=f.x<WORLD.left+180||f.x>WORLD.right-180;
  const hurt=f.stun>0&&f.stunKind==='hurt'&&(opponent.combo>=level.escapeCombo||cornered||f.hp<25);
  const incoming=game.projectiles.find(p=>p.owner!==f.index&&p.life>0&&(
    p.field?Math.abs(p.x-f.x)<p.radius+30&&Math.abs(p.originY-f.y)<150&&p.age>=p.delay-.2:
    Math.abs(p.x-f.x)<285&&((p.x-f.x)*p.vx<0&&Math.abs(p.y-f.y+95)<110||p.vy>0&&p.y<f.y&&Math.abs(p.x-f.x)<85)));
  const closeAttack=distance<185&&opponent.attack&&opponent.attack.time<opponent.attack.config.startup+opponent.attack.config.active;
  const chase=!f.attack&&!f.stun&&f.blinkCharges===2&&distance>420&&distance<850&&Math.abs(f.y-opponent.y)<100;
  const key=hurt?'hurt':incoming?`shot:${incoming.attackId}`:closeAttack&&(cornered||opponent.attack.config.level==='throw')?`pressure:${opponent.attack.id}`:chase&&level.chaseBlink>0?`chase:${Math.floor(game.time/2)}`:null;
  if(!key){f.aiBlinkWatch=null;return null;}
  if(f.aiBlinkWatch?.key!==key)f.aiBlinkWatch={key,at:game.time+(hurt?level.escapeReaction:level.dodgeReaction),decided:false};
  const watch=f.aiBlinkWatch;
  if(watch.decided||game.time<watch.at||hurt&&f.hitstunTime<.10&&f.reaction?.age<.10)return null;
  watch.decided=true;
  if(game.random()>=(key.startsWith('chase:')?level.chaseBlink:level.escape))return null;
  const held=new Set([chase||cornered?towards:incoming?.field?(f.x<incoming.x?'left':'right'):away]);
  f.aiBlinkNext=game.time+level.blinkPause;f.aiHeld=held;f.aiIntent=hurt?'escape':chase?'reposition':'evade';
  return {held,pressed:new Set(['blink'])};
}

// Decisions use visible attacks and positions, never future player inputs.
// Followups are queued only after a confirmed hit and pay normal skill costs.
export function think(game,f,opponent,dt){
  const level=DIFFICULTIES[game.difficulty]||DIFFICULTIES.normal,style=styleOf(f.character);
  const distance=Math.abs(f.x-opponent.x),height=opponent.y-f.y;
  const towards=opponent.x<f.x?'left':'right',away=towards==='left'?'right':'left';
  const pressed=new Set();f.aiThink-=dt;
  const command=(move,intent)=>{f.aiIntent=intent;f.aiHeld=new Set();return {held:f.aiHeld,pressed,command:move};};
  const current=f.attack;
  if(current)f.aiWasAttacking=true;
  else if(f.aiWasAttacking){f.aiWasAttacking=false;f.aiRestUntil=game.time+level.recoveryGap;}
  const evasion=dodge(game,f,opponent,level,distance,towards,away);if(evasion)return evasion;
  if(current&&f.hasHit&&f.cancelTime>0&&!isSuperMove(current.move)&&f.aiLastConfirm!==current.id){
    if(f.aiConfirmWatch?.id!==current.id)f.aiConfirmWatch={id:current.id,at:game.time+level.confirmDelay};
    if(game.time<f.aiConfirmWatch.at)return {held:new Set(),pressed};
    // One roll per hit confirmation; retrying every frame erased difficulty.
    f.aiLastConfirm=current.id;
    const routes={jab:style.route.includes('kick')?'kick':'jab2',jab2:'ender',lowJab:'branch',kick:'link',branch:'rushSkill',link:'special',ender:f.character.id==='classic'?'rushSkill':'special',uppercut:'airWave',rushPunch:'branch',slide:'rushSkill'};
    let next=routes[current.move];
    if(['special','rushSkill','powerWave','airWave'].includes(current.move)&&f.combo>=3){
      next=style.route.at(-1);if(!isSuperMove(next))next='superFinish';
    }
    const nextConfig=moveFor(f.character,next);
    if(f.combo<level.chainLimit&&nextConfig&&nextConfig.rank>current.config.rank&&f.energy>=game.moveCost(f,next)&&game.random()<level.combo){
      f.aiStats.confirms++;return command(next,'confirm');
    }
  }
  if(f.aiThink>0)return {held:f.aiHeld,pressed};
  f.aiThink=level.reaction*(.85+game.random()*.3);
  const held=new Set();f.aiHeld=held;
  if(f.stun>0||f.downTime>0||f.getUpTime>0||f.throwing||f.grappled)return {held,pressed};
  const incoming=game.projectiles.find(p=>p.owner!==f.index&&p.life>0&&Math.abs(p.x-f.x)<300&&(!p.field||Math.abs(p.x-f.x)<p.radius+50));
  const attack=opponent.attack;
  const threat=attack&&distance<attack.config.reach+90&&Math.abs(height)<190&&attack.time>level.reaction*.6&&attack.time<attack.config.startup+attack.config.active;
  if(!current&&incoming&&distance>180&&f.energy>=20&&['blue','purple'].includes(f.character.id)&&game.random()<level.tactics)return command('stance','intercept');
  if(!current&&threat&&attack.time<attack.config.startup&&f.energy>=20&&['classic','red'].includes(f.character.id)&&attack.config.level!=='throw'&&game.random()<level.tactics*.4)return command('stance','counter');
  if(!current&&(threat||incoming)&&game.random()<level.block){
    const type=incoming?.level||attack?.config.level;
    if(type==='throw'&&f.blinkCharges){pressed.add('blink');held.add(away);}
    else if(incoming?.field&&f.grounded){pressed.add('jump');held.add(away);}
    else{held.add('guard');if(type==='low')held.add('down');}
    f.aiStats.defenses++;f.aiIntent='defend';return {held,pressed};
  }
  if(current)return {held,pressed};
  if(game.time<f.aiRestUntil){f.aiIntent='recover';return {held,pressed};}
  if(height< -120){
    if(distance<150&&height> -280&&f.energy>=0)return command('uppercut','antiAir');
    if(f.grounded){
      const ledge=game.platforms.filter(p=>p.y<f.y-70&&p.y>f.y-440).sort((a,b)=>Math.abs(a.x+a.w/2-f.x)-Math.abs(b.x+b.w/2-f.x))[0];
      held.add(ledge?(ledge.x+ledge.w/2<f.x?'left':'right'):towards);held.add('jump');
    }else if(f.airJumps>0&&f.jumpSince>.22&&f.vy> -160){pressed.add('jump');held.add(towards);}
    else held.add(towards);
    f.aiIntent='pursue';return {held,pressed};
  }
  if(f.platformId&&height>170){held.add('down');return {held,pressed};}
  if(!f.grounded){
    if(distance<170&&Math.abs(height)<150)return command(f.vy>0?'diveKick':'airJab','aerial');
    held.add(towards);return {held,pressed};
  }
  const punish=attack&&attack.time>attack.config.startup+attack.config.active;
  if(punish&&distance<210&&Math.abs(height)<90&&game.random()<level.punish){
    f.aiStats.punishes++;return command(distance<115?'jab':'rushPunch','punish');
  }
  if(game.random()<level.aggression&&Math.abs(height)<140){
    if(opponent.blocking&&distance<moveFor(f.character,'grab').reach+7&&game.random()<level.accuracy*.75)return command('grab','throw');
    if(f.energy>=100&&distance<480&&game.random()<level.ultimate)return command(distance>210?'super':'superRush','ultimate');
    if(distance<style.range){
      if(opponent.crouching)return command(game.random()<.55?'lowJab':'branch','mixup');
      return command(game.random()<.7?'jab':'sweep','pressure');
    }
    if(f.energy>=30&&distance<420&&game.random()<level.skills){
      if(f.character.id==='purple'&&distance>220)return command('rushSkill','flank');
      if(['red','purple','blue'].includes(f.character.id)&&game.random()<.34)return command('pulse','control');
      return command(distance<230?'rushSkill':'special','skill');
    }
    if(distance<230&&game.random()<.7)return command('rushPunch','approachHit');
  }
  held.add(towards);if(distance>230&&level.run)held.add('run');
  f.aiIntent='approach';return {held,pressed};
}
