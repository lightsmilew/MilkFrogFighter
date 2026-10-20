import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/engine.js';
import {CHARACTERS,WORLD} from '../src/config.js';
import {MOVESETS,STYLES,moveFor} from '../src/styles.js';
const none=()=>({held:new Set(),pressed:new Set()});
function arena(id='classic'){
  const events=[],game=new Game({random:()=>.5,onEvent:e=>events.push(e)});
  game.start({mode:'local',p1:id,p2:'classic'});game.phase='fight';game.platforms=[];
  const [a,b]=game.fighters;a.x=500;b.x=590;a.energy=100;
  return {game,a,b,events};
}
function advance(g,seconds){for(let i=0;i<Math.ceil(seconds*60);i++)g.tick(1/60,[none(),none()]);}

test('six styles resolve 27 named moves with distinct normal, skill and combo data',()=>{
  for(const character of CHARACTERS){
    assert.equal(Object.keys(MOVESETS[character.id]).length,27);
    assert.equal(new Set(Object.values(MOVESETS[character.id]).map(m=>m.name)).size,27);
    assert.ok(STYLES[character.id].recipe.length>10);
  }
  for(const slot of ['jab','kick','special','stance','super','superRush','superFinish']){
    assert.equal(new Set(CHARACTERS.map(c=>JSON.stringify(moveFor(c,slot)))).size,6,slot);
  }
});

test('all move variants simulate in both directions without invalid numbers or unbounded objects',()=>{
  for(const character of CHARACTERS)for(const move of Object.keys(MOVESETS[character.id]))for(const facing of [-1,1]){
    const {game,a,b}=arena(character.id);a.x=1500;b.x=1500+facing*160;a.facing=facing;b.facing=-facing;
    if(['airWave','airJab','diveKick'].includes(move)){a.y-=150;a.vy=-80;}
    assert.ok(game.beginAttack(a,move),`${character.id} ${move}`);advance(game,2);
    for(const f of [a,b])assert.ok([f.x,f.y,f.hp,f.energy].every(Number.isFinite),`${character.id} ${move}`);
    assert.ok(game.projectiles.length<20);assert.ok(game.effects.length<=240);
  }
});

test('confirmed punches branch into followup kick, second-punch ender and kick-to-palm',()=>{
  const {game,a}=arena();a.hasHit=true;a.cancelTime=.3;
  for(const [current,raw,next] of [['jab','kick','branch'],['jab2','kick','ender'],['kick','jab','link']]){
    a.attack={move:current};assert.equal(game.chooseMove(a,raw,new Set()),next);
  }
  a.hasHit=false;assert.equal(game.chooseMove(a,'kick',new Set()),'kick');
  a.facing=-1;assert.equal(game.chooseMove(a,'special',new Set(['right'])),'stance');
});

test('wind clone is delayed, travels independently and deals a blockable hit',()=>{
  const {game,a,b}=arena('green');b.x=850;game.beginAttack(a,'special');advance(game,.15);
  assert.equal(game.projectiles[0].visual,'clone');assert.equal(b.hp,100);
  advance(game,.8);assert.ok(b.hp<100);assert.equal(a.x,500);
});

test('fire pillars telegraph before dealing damage and can be escaped vertically',()=>{
  const {game,a,b}=arena('red');b.x=745;game.beginAttack(a,'pulse');advance(game,.23);
  assert.equal(game.projectiles.length,3);assert.equal(b.hp,100);
  b.y=WORLD.floor-250;b.vy=-400;advance(game,.6);assert.equal(b.hp,100);
});

test('red armor absorbs one light hit but cannot repeatedly ignore followups',()=>{
  const {game,a,b,events}=arena('red');game.beginAttack(a,'stance');
  const config=moveFor(b.character,'jab');game.hit(b,a,config,'jab',null,100);
  assert.ok(a.attack);assert.equal(a.armorUsed,true);assert.equal(a.stun,0);
  game.hit(b,a,config,'jab',null,101);assert.equal(a.attack,null);assert.ok(a.stun>0);
  assert.equal(events.filter(e=>e.type==='armor').length,1);
});

test('spiral counter reverses one strike and still loses to a throw',()=>{
  const {game,a,b,events}=arena();game.beginAttack(a,'stance');
  game.hit(b,a,moveFor(b.character,'jab'),'jab',null,200);assert.equal(a.hp,100);assert.ok(b.hp<100);
  assert.equal(events.filter(e=>e.type==='counter').length,1);
  a.invincible=0;game.beginAttack(a,'stance');game.hit(b,a,moveFor(b.character,'grab'),'grab',null,201);assert.ok(a.hp<100);
});

test('phantom rush warps behind an opponent instead of just recoloring a dash',()=>{
  const {game,a,b}=arena('purple');b.x=780;game.beginAttack(a,'rushSkill');advance(game,.12);
  assert.ok(a.x>b.x);assert.equal(a.facing,-1);advance(game,.25);assert.ok(b.hp<100);
});

test('moon well pulls an opponent toward its center and expires',()=>{
  const {game,a,b}=arena('purple');b.x=820;game.beginAttack(a,'stance');advance(game,.3);
  const field=game.projectiles[0];b.x=field.x+50;advance(game,.25);assert.ok(b.vx<0);advance(game,2);assert.equal(game.projectiles.length,0);
});

test('returning heart can hit once outward and once returning, healing only once',()=>{
  const {game,a,b,events}=arena('pink');a.hp=70;b.x=780;game.beginAttack(a,'special');advance(game,1.6);
  assert.equal(events.filter(e=>e.type==='hit').length,2);assert.equal(a.hp,72);assert.ok(b.hp<94);
});

test('three petal marks burst, reset their stack and heal the caster',()=>{
  const {game,a,b,events}=arena('pink');a.hp=70;
  for(let i=0;i<3;i++)game.hit(a,b,moveFor(a.character,'jab'),'jab',null,300+i);
  assert.equal(b.petals,0);assert.equal(a.hp,72);assert.ok(events.some(e=>e.type==='bloom'));
});

test('three frost hits freeze briefly, clear their stack and then recover',()=>{
  const {game,a,b}=arena('blue');
  for(let i=0;i<3;i++)game.hit(a,b,moveFor(a.character,'jab'),'jab',null,400+i);
  assert.equal(b.frostStacks,0);assert.ok(b.frost>=.5);assert.equal(b.reaction.type,'freeze');
  advance(game,1);assert.equal(b.frost,0);assert.equal(b.stun,0);
});

test('ice mirror intercepts enemy shots and breaks after absorbing enough',()=>{
  const {game,a,b}=arena('blue');b.x=1000;game.beginAttack(a,'stance');advance(game,.16);
  const wall=game.projectiles[0];assert.ok(wall.barrier);
  for(let i=0;i<3;i++){
    game.projectiles.push({owner:1,x:wall.x,y:wall.y,vx:-1,vy:0,radius:10,life:1,age:0,level:'high',originY:WORLD.floor,config:moveFor('classic','special'),move:'special'});
    game.updateProjectiles(1/60);
  }
  assert.ok(wall.life<=0);assert.equal(a.hp,100);
});

test('normal AI confirms extended combos and uses real meter without hidden damage bonuses',()=>{
  for(const id of ['classic','green','red','purple','pink','blue']){
    const {game,a,b}=arena(id);game.mode='local';game.difficulty='normal';a.energy=100;
    for(let i=0;i<60*20&&game.phase==='fight';i++)game.tick(1/60,[game.ai(a,b,1/60),none()]);
    assert.ok(a.aiStats.confirms>=2,`${id} confirms ${a.aiStats.confirms}`);
    assert.ok(game.matchStats[0].maxCombo>=3,`${id} max combo`);assert.ok(b.hp<75,`${id} pressure`);
    assert.ok(a.energy>=0&&a.energy<=100);
  }
});

test('AI punishes a visible whiff and defends observed low attacks',()=>{
  const {game,a,b}=arena();game.difficulty='hard';a.x=500;b.x=650;
  game.beginAttack(b,'kick');b.attack.time=.4;
  assert.equal(game.ai(a,b,1/60).command,'rushPunch');assert.equal(a.aiIntent,'punish');
  a.aiThink=0;b.x=580;game.beginAttack(b,'sweep');b.attack.time=.12;
  const reaction=game.ai(a,b,1/60);assert.ok(reaction.held.has('guard'));assert.ok(reaction.held.has('down'));
});

test('holding guard blocks every hit of a rush super without leaking through blockstun',()=>{
  const {game,a,b,events}=arena();b.x=500+WORLD.pushDistance;
  game.beginAttack(a,'superRush');
  for(let i=0;i<100;i++)game.tick(1/60,[none(),{held:new Set(['guard']),pressed:new Set()}]);
  assert.equal(events.filter(e=>e.type==='block').length,5);assert.equal(game.matchStats[0].hits,0);assert.ok(b.hp>97);
});

test('countering a distant projectile reflects a real shot instead of damaging its caster remotely',()=>{
  const {game,a,b}=arena();b.x=950;game.beginAttack(a,'stance');
  const config=moveFor('classic','special');
  game.hit(b,a,config,'special',{owner:1,x:530,y:510,vx:-690,vy:0,radius:16,level:'high',originY:WORLD.floor,config,move:'special'},900);
  assert.equal(a.hp,100);assert.equal(b.hp,100);assert.equal(game.projectiles[0].owner,0);assert.ok(game.projectiles[0].vx>0);
  advance(game,1);assert.ok(b.hp<100);
});
