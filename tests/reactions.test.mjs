import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/engine.js';
import {CHARACTERS,WORLD} from '../src/config.js';
import {MOVESETS,moveFor} from '../src/styles.js';
import {Renderer} from '../src/renderer.js';
import {reactionMotion} from '../src/vfx.js';
import {ANIMATION_FRAMES} from '../assets/fighters/frames.js';
const input=()=>({held:new Set(),pressed:new Set()});
const pose=f=>Renderer.prototype.pose(f);

test('all six attackers, 28 moves, six targets and both facings use dedicated reaction art at every phase',()=>{
  const allowed=new Set(Object.values(ANIMATION_FRAMES.reactions).flat()),kinds=new Set();let audited=0;
  assert.equal(allowed.size,16);assert.ok(!allowed.has(4)&&!allowed.has(21)&&!allowed.has(22));
  for(const attacker of CHARACTERS)for(const target of CHARACTERS)for(const [move,config] of Object.entries(MOVESETS[attacker.id]))for(const direction of [-1,1]){
    const g=new Game({random:()=>.5});g.start({mode:'local',p1:attacker.id,p2:target.id});const [a,b]=g.fighters;
    a.x=1500;b.x=a.x+direction*80;a.facing=direction;b.facing=-direction;
    g.hit(a,b,config,move,config.projectile?{vx:direction,x:b.x,y:b.y-80,originY:b.y,level:config.level}:null,1);
    assert.equal(b.state,'hurt',`${attacker.id}/${move}/${target.id}`);kinds.add(b.reaction.kind);
    for(const p of [0,.25,.5,.8,1]){
      b.reaction.age=p*b.reaction.duration;const frame=pose(b);assert.ok(allowed.has(frame),`${attacker.id}/${move} picked attack frame ${frame}`);
      const motion=reactionMotion(b);assert.ok(Math.abs(motion.rotation)<.5);assert.ok(Object.values(motion).every(Number.isFinite));
    }
    audited++;
  }
  assert.equal(audited,2016);for(const kind of ['head','body','heavy','launch','trip'])assert.ok(kinds.has(kind),kind);
});

test('head, abdomen and heavy hits have three distinct impact/recoil/recovery frames',()=>{
  for(const [move,expected] of [['jab','head'],['jab2','body'],['kick','heavy']]){
    const g=new Game();g.start({mode:'local'});const [a,b]=g.fighters;g.hit(a,b,moveFor(a.character,move),move,null,1);
    assert.equal(b.reaction.kind,expected);const phases=[.1,.45,.9].map(p=>{b.reaction.age=b.reaction.duration*p;return pose(b);});
    assert.deepEqual(phases,ANIMATION_FRAMES.reactions[expected]);
  }
});

test('launching ascent and descent, slipping, prone and all three get-up stages are different',()=>{
  const g=new Game();g.start({mode:'local'});g.phase='fight';g.platforms=[];const [a,b]=g.fighters;
  g.hit(a,b,moveFor(a.character,'uppercut'),'uppercut',null,1);const up=pose(b);b.vy=40;const down=pose(b);assert.notEqual(up,down);
  b.reaction={type:'trip',age:0};const slip=pose(b);b.reaction.age=.2;assert.notEqual(pose(b),slip);
  b.y=WORLD.floor-1;b.vy=100;b.reaction={type:'launch',age:.4};g.land(b,WORLD.floor,null);const prone=pose(b);const getups=new Set();
  for(let n=0;n<65;n++){g.hitstop=0;g.tick(1/60,[input(),input()]);if(b.state==='getup')getups.add(pose(b));}
  assert.equal(prone,10);assert.deepEqual([...getups],ANIMATION_FRAMES.reactions.getup);assert.equal(b.state,'idle');assert.equal(b.getUpTime,0);
});

test('a single frost shot reacts to the impact; actual freeze and binding use immobilized poses',()=>{
  const g=new Game();g.start({mode:'local',p1:'blue'});const [a,b]=g.fighters;
  g.hit(a,b,moveFor('blue','special'),'special',{vx:1,y:b.y-80,originY:b.y,level:'mid',frost:true},1);
  assert.equal(b.reaction.type,'body');assert.equal(b.controlTime,0);assert.ok(ANIMATION_FRAMES.reactions.body.includes(pose(b)));
  b.controlTime=.6;b.controlType='freeze';b.reaction={type:'freeze',age:.2};assert.equal(pose(b),ANIMATION_FRAMES.reactions.head[0]);
  b.controlType='bind';b.reaction={type:'bind',age:.2};assert.equal(pose(b),ANIMATION_FRAMES.reactions.body[1]);
  b.controlTime=0;b.controlImmune=.8;b.frostStacks=2;
  g.hit(a,b,moveFor('blue','jab'),'jab',null,2);assert.equal(b.controlTime,0);assert.notEqual(b.reaction.type,'freeze','control immunity must not use a frozen reaction');
});
