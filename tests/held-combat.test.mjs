import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/engine.js';
import {CHARACTERS,WORLD,COMBAT,KEYMAPS} from '../src/config.js';
import {MOVESETS,moveFor} from '../src/styles.js';
import {stylePose,reactionMotion} from '../src/vfx.js';
import {blinkStatus} from '../src/hud.js';
const input=(held=[],pressed=[])=>({held:new Set(held),pressed:new Set(pressed)});
function arena(id='classic',practice=false){
  const events=[],g=new Game({random:()=>.5,onEvent:e=>events.push(e)});g.start({mode:practice?'practice':'local',p1:id,p2:'classic'});g.phase='fight';g.platforms=[];
  const [a,b]=g.fighters;a.x=1100;b.x=1100+WORLD.pushDistance+2;a.energy=100;
  return {g,a,b,events};
}
function step(g,n,held=[],pressed=[]){for(let i=0;i<n;i++)g.tick(1/60,[input(held,i?[]:pressed),input()]);}

test('holding J performs one punch; three fresh presses still confirm the distinct combo punches',()=>{
  const {g,a,b,events}=arena('classic',true);step(g,95,['jab']);
  const moves=events.filter(e=>e.type==='attack').map(e=>e.move);
  assert.deepEqual(moves,['jab']);step(g,1);step(g,1,['jab']);
  for(let n=0;n<25&&!a.hasHit;n++)step(g,1,['jab']);step(g,1,[],['jab']);
  for(let n=0;n<25&&a.attack?.move!=='jab2';n++)step(g,1);
  for(let n=0;n<25&&!a.hasHit;n++)step(g,1);step(g,1,[],['jab']);
  for(let n=0;n<25&&a.attack?.move!=='straight';n++)step(g,1);
  assert.deepEqual(events.filter(e=>e.type==='attack').map(e=>e.move).slice(-3),['jab','jab2','straight']);
  const poses=['jab','jab2','straight'].map(move=>{const config=moveFor('classic',move);return stylePose({...a,attack:{move,config,time:config.startup+.01}});});
  assert.equal(new Set(poses).size,3);
  assert.ok(b.hp<1000||events.some(e=>e.type==='hit'));
});
test('held K/L/I each produce one action even in practice with unlimited meter',()=>{
  for(const raw of ['kick','special','super']){
    const {g,events}=arena('classic',true);step(g,150,[raw]);assert.equal(events.filter(e=>e.type==='attack').length,1,raw);
    step(g,1);step(g,1,[raw]);assert.equal(events.filter(e=>e.type==='attack').length,2,raw);
  }
  const {g,a,events}=arena();step(g,180,['super']);assert.equal(events.filter(e=>e.type==='attack').length,1);assert.ok(a.energy<15);
});
test('a punch queued during startup becomes the next combo punch only after a real hit',()=>{
  const {g,a}=arena();step(g,1,[],['jab']);step(g,1,[],['jab']);step(g,11);
  assert.equal(a.attack?.move,'jab2');
  const whiff=arena();whiff.b.x+=500;step(whiff.g,1,[],['jab']);step(whiff.g,1,[],['kick']);step(whiff.g,10);assert.equal(whiff.a.attack.move,'jab');
});
test('adding K while J remains held branches the punch instead of misreading an old hold as a throw',()=>{
  const {g,a}=arena();step(g,1,['jab'],['jab']);for(let n=0;n<25&&!a.hasHit;n++)step(g,1,['jab']);
  step(g,1,['jab','kick'],['kick']);for(let n=0;n<10&&a.attack?.move==='jab';n++)step(g,1,['jab','kick']);assert.equal(a.attack?.move,'branch');
});
test('an unaffordable super never starts and a fresh punch still works',()=>{
  const {g,a,events}=arena();a.energy=0;step(g,1,['super']);step(g,1,['super','jab'],['jab']);step(g,80,['super','jab']);assert.equal(events.filter(e=>e.type==='attack'&&e.move==='jab').length,1);assert.ok(events.every(e=>e.type!=='attack'||e.move!=='super'));
});
test('a previous projectile cannot falsely confirm the punch that is still starting',()=>{
  const {g,a,b}=arena();g.beginAttack(a,'jab');const id=a.attack.id;
  g.hit(a,b,moveFor('classic','special'),'special',{vx:1,x:b.x,y:b.y-80,originY:b.y,level:'mid'},id-1);
  assert.equal(a.hasHit,false);assert.equal(a.attack.connected,false);
  g.hit(a,b,moveFor('classic','jab'),'jab',null,id);assert.equal(a.hasHit,true);
});
test('directions held well before the attack still select their command in either facing',()=>{
  for(const side of [-1,1])for(const [held,raw,expected] of [
    [['down'],'jab','grab'],[['down'],'kick','sweep'],[['down'],'special','pulse'],[['down'],'super','superRise'],
    [[side===1?'right':'left'],'special','rushSkill'],[[side===1?'left':'right'],'special','stance'],
    [[side===1?'right':'left'],'super','superRush'],[[side===1?'left':'right'],'super','superStorm'],
  ]){
    const {g,a,b}=arena();b.x=a.x+side*500;step(g,30,held);step(g,1,[...held,raw],[raw]);assert.equal(a.attack?.move,expected,`${side} ${held} ${raw}`);
  }
});
test('holding jump then adding or reversing a direction steers through repeated jumps and air attacks',()=>{
  const {g,a,b}=arena();a.x=1400;b.x=2400;step(g,20,['jump']);const x=a.x;
  step(g,20,['jump','right']);assert.ok(a.x>x+55);
  step(g,1,['jump','right'],['kick']);const attackX=a.x;step(g,10,['jump','right']);assert.ok(a.x>attackX+25);
  step(g,100,['jump','left']);assert.ok(a.x<attackX-100);assert.ok(a.y<WORLD.floor);
});
test('all six styles use grounded stagger or their declared launch/control, never an automatic spinning reaction',()=>{
  for(const c of CHARACTERS)for(const [move,config] of Object.entries(MOVESETS[c.id]).filter(([,config])=>config.rank>=4)){
    const {g,a,b}=arena(c.id);g.hit(a,b,config,move,config.projectile?{vx:1,y:b.y-80,originY:b.y,level:config.level,field:false}:null,1);
    assert.notEqual(b.reaction?.type,'tumble',`${c.id} ${move}`);
    for(const age of [.1,.6,2,8])assert.ok(Math.abs(reactionMotion({...b,reaction:{...b.reaction,age}}).rotation)<=.46,`${c.id} ${move}`);
  }
});
test('the classic neutral super keeps a ground target upright rather than spinning in place',()=>{
  const {g,a,b}=arena();b.x=a.x+300;g.beginAttack(a,'super');
  for(let n=0;n<90&&!b.reaction;n++)step(g,1);
  assert.equal(b.reaction?.type,'body');assert.equal(b.vy,0);assert.equal(b.y,WORLD.floor);
});
test('two blink charge bars expose sequential recovery and the second pending cooldown',()=>{
  const {g,a}=arena();assert.ok(blinkStatus(a).slots.every(s=>s.ready&&s.progress===1));
  g.beginBlink(a,new Set(['left']));g.beginBlink(a,new Set(['left']));step(g,90);
  const status=blinkStatus(a);assert.equal(status.charges,0);assert.ok(Math.abs(status.slots[0].progress-.5)<.02);assert.equal(status.slots[1].progress,0);assert.ok(status.slots[1].remaining>4.4);
  step(g,95);assert.equal(blinkStatus(a).charges,1);assert.equal(blinkStatus(a).slots[0].progress,1);assert.ok(blinkStatus(a).slots[1].progress>0);
});

test('attack pressed early in hitstun survives its lock and fires once on the first legal frame for either player',()=>{
  for(const index of [0,1]){
    const {g,events}=arena(),victim=g.fighters[index],attacker=g.fighters[1-index];victim.energy=100;
    g.hit(attacker,victim,{...moveFor(attacker.character,'jab'),stun:.6},'jab',null,1);g.hitstop=0;
    for(let n=0;n<70;n++){
      const held=n<65?['jab']:[],p=n===0?['jab']:[];const pair=[input(),input()];pair[index]=input(held,p);g.tick(1/60,pair);
      if(n<34)assert.equal(victim.attack,null,'no attack during genuine hitstun');
    }
    assert.equal(events.filter(e=>e.type==='attack'&&e.index===index).length,1);assert.ok(victim.stun<=0);
  }
});

test('continuous grounded hitstun has a bounded exit and a buffered normal can retaliate',()=>{
  const {g,a,b,events}=arena();b.x=a.x+80;b.energy=100;const config={...moveFor(a.character,'jab'),stun:.35,damage:.1,push:0};
  let escaped=false,maxStun=0;
  for(let n=0;n<120;n++){
    if(n%5===0)g.hit(a,b,config,'jab',null,100+n);
    g.hitstop=0;g.tick(1/60,[input(),input(n>10?['jab']:[],n===11?['jab']:[])]);maxStun=Math.max(maxStun,b.hitstunTime);
    if(events.some(e=>e.type==='attack'&&e.index===1)){escaped=true;break;}
  }
  assert.ok(escaped);assert.ok(maxStun<=COMBAT.maxContinuousHitstun+1/30);assert.ok(b.invincible>0);
});

test('defensive attack inputs survive control and knockdown, but old presses expire',()=>{
  for(const locked of ['control','down']){
    const {g,a,events}=arena();
    if(locked==='control'){a.controlTime=.6;a.controlType='bind';a.controlDuration=.6;a.reaction={type:'bind',age:0};}
    else{a.downTime=.3;a.getUpTime=a.getUpDuration=.32;a.reaction={type:'slam',age:0};}
    step(g,1,['kick'],['kick']);step(g,70);assert.equal(events.filter(e=>e.type==='attack').length,1,locked);
  }
  const {g,a,events}=arena();a.controlTime=3;a.controlType='bind';step(g,1,['jab'],['jab']);step(g,200);assert.equal(events.filter(e=>e.type==='attack').length,0);
});

test('guard defaults are Q and Enter including the numeric Enter key',()=>{
  assert.equal(KEYMAPS[0].KeyQ,'guard');assert.equal(KEYMAPS[1].Enter,'guard');assert.equal(KEYMAPS[1].NumpadEnter,'guard');assert.equal(KEYMAPS[0].Space,undefined);assert.equal(KEYMAPS[1].ShiftRight,undefined);
});
