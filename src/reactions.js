import {ANIMATION_FRAMES} from '../assets/fighters/frames.js';

// Move slots describe the contact, independent of the attacker's art/style.
// Explicit launches and actual control override this grounded hit vocabulary.
const CONTACT={jab:'head',jab2:'body',straight:'heavy',kick:'heavy',lowJab:'body',sweep:'trip',airJab:'head',diveKick:'heavy',rushPunch:'body',slide:'trip',uppercut:'heavy',grab:'heavy',spin:'heavy',special:'body',powerWave:'heavy',pulse:'body',rushSkill:'heavy',airWave:'head',super:'heavy',superRush:'body',superRise:'heavy',superStorm:'heavy',superFinish:'heavy',branch:'heavy',link:'body',stance:'body',ender:'heavy',airSuper:'heavy'};
const clamp=v=>Math.max(0,Math.min(1,v));

export function hitReaction(config,move,projectile){
  const type=config.reaction||(config.launch?'launch':['sweep','slide'].includes(move)||move==='pulse'&&!projectile?'trip':projectile||config.rank>=4||['kick','diveKick','straight','rushPunch','rushSkill'].includes(move)?'body':'flinch');
  let kind=['launch','trip','freeze','bind','caught','slam'].includes(type)?type:CONTACT[move]||'body';
  // A ground flame/low wave folds the belly; a falling shot staggers the head.
  if(projectile&&!config.launch){if(config.rank<5&&projectile.level==='overhead')kind='head';else if(projectile.level==='low')kind='body';}
  return {type,kind};
}

export function reactionFrame(f){
  const frames=ANIMATION_FRAMES.reactions,{type,kind=type,age=0,duration=.3}=f.reaction||{};
  if(f.downTime>0||f.state==='knockdown'||f.state==='ko'&&f.grounded)return frames.down[0];
  if(f.getUpTime>0||f.state==='getup'){
    const p=clamp(1-f.getUpTime/(f.getUpDuration||.32));return frames.getup[Math.min(2,Math.floor(p*3))];
  }
  if(f.grappled||type==='caught')return frames.launch[0];
  if(type==='freeze'||f.controlType==='freeze'&&f.controlTime>0)return frames.head[0];
  if(type==='bind'||f.controlTime>0)return frames.body[age<.1?0:1];
  if(type==='launch'||type==='tumble'||f.state==='ko')return frames.launch[f.vy<0?0:1];
  if(type==='trip')return frames.trip[age<.16?0:1];
  if(type==='slam')return frames.down[0];
  if(type==='guard')return 7;
  const cycle=frames[kind]||frames[type==='flinch'?'head':'body'];
  const p=clamp(age/Math.max(.12,duration));return cycle[Math.min(cycle.length-1,Math.floor(p*cycle.length))];
}
