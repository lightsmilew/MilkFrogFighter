import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine.js';
import { WORLD, MOVES, CHARACTERS } from '../src/config.js';

const none=()=>({held:new Set(),pressed:new Set()});
const input=(held=[],pressed=[])=>({held:new Set(held),pressed:new Set(pressed)});
function arena(options={}){
  const events=[];
  const game=new Game({onEvent:event=>events.push(event),random:()=>.5});
  game.start({mode:'local',...options});game.phase='fight';game.platforms=[];
  game.fighters[0].x=500;game.fighters[1].x=500+130*WORLD.fighterScale;
  return {game,events,a:game.fighters[0],b:game.fighters[1]};
}
function advance(game,seconds,held=[[],[]]){
  for(let frame=0;frame<Math.ceil(seconds*60);frame++)game.tick(1/60,held.map(keys=>input(keys)));
}
function press(game,index,move,held=[[],[]]){
  game.tick(1/60,[0,1].map(i=>input(held[i],i===index?[move]:[])));
}

test('a normal punch hits once during its active frames',()=>{
  const {game,a,b,events}=arena();press(game,0,'jab');advance(game,.7);
  assert.ok(b.hp>96&&b.hp<98);assert.equal(a.hp,100);
  assert.equal(events.filter(event=>event.type==='hit').length,1);
  assert.equal(game.matchStats[0].hits,1);
});

test('attacks do not hit outside their actual reach',()=>{
  const {game,b}=arena();b.x=1000;press(game,0,'kick');advance(game,.8);assert.equal(b.hp,100);
});

test('guard reduces damage and produces a block, not a combo',()=>{
  const {game,a,b,events}=arena();press(game,0,'kick',[[],['guard']]);advance(game,.8,[[],['guard']]);
  assert.ok(b.hp>98&&b.hp<100);assert.equal(a.combo,0);
  assert.equal(events.filter(event=>event.type==='block').length,1);
});

test('moving backward automatically guards a frontal hit',()=>{
  const {game,a,b,events}=arena();b.x=560;a.x=500;
  press(game,0,'jab',[[],['right']]);advance(game,.2,[[],['right']]);
  assert.ok(b.hp>98);assert.ok(events.some(event=>event.type==='block'));
});

test('crouching avoids a high jab but down plus punch grabs a crouched opponent',()=>{
  const {game,b}=arena();press(game,0,'jab',[[],['down']]);advance(game,.6,[[],['down']]);assert.equal(b.hp,100);
  game.fighters[0].x=500;b.x=500+WORLD.pushDistance;
  press(game,0,'jab',[['down'],['down']]);advance(game,1.1,[['down'],['down']]);assert.ok(b.hp<100);
});

test('jumping uses gravity, permits one air jump, and then lands exactly',()=>{
  const {game,a}=arena();press(game,0,'jump');advance(game,.15);assert.ok(a.y<WORLD.floor);
  press(game,0,'jump');advance(game,.08);assert.equal(a.airJumps,0);assert.ok(a.vy< -700);
  advance(game,.2);const airborneVelocity=a.vy;press(game,0,'jump');assert.ok(a.vy>airborneVelocity);
  advance(game,1.5);assert.equal(a.y,WORLD.floor);assert.equal(a.vy,0);
});

test('energy costs are enforced and super cannot be used without a full gauge',()=>{
  const {game,a}=arena();a.energy=24;assert.equal(game.beginAttack(a,'special'),false);assert.equal(a.attack,null);
  a.energy=99;assert.equal(game.beginAttack(a,'super'),false);
  a.energy=100;assert.equal(game.beginAttack(a,'super'),true);assert.equal(a.energy,0);assert.ok(a.invincible>0);
});

test('milk wave travels and damages its opponent once',()=>{
  const {game,a,b}=arena();a.x=300;b.x=850;a.energy=50;
  press(game,0,'special');advance(game,1.8);assert.ok(b.hp>92&&b.hp<95);assert.equal(game.projectiles.length,0);
});

test('purple bubbles apply a temporary slowing effect',()=>{
  const {game,a,b}=arena({p1:'purple'});a.energy=100;b.x=760;
  press(game,0,'special');advance(game,.7);
  assert.ok(b.hp<100);assert.ok(b.slow>0);
  advance(game,1.6);assert.equal(b.slow,0);
});

test('opposing equal waves cancel each other before hitting fighters',()=>{
  const {game,a,b,events}=arena({p2:'classic'});a.x=300;b.x=980;a.energy=b.energy=100;
  game.tick(1/60,[input([],['special']),input([],['special'])]);advance(game,1.5);
  assert.equal(a.hp,100);assert.equal(b.hp,100);assert.ok(events.some(event=>event.type==='clash'));
});

test('a confirmed punch can cancel into a kick and increase the combo',()=>{
  const {game,a,b}=arena();press(game,0,'jab');
  for(let i=0;i<25&&!a.hasHit;i++)game.tick(1/60,[none(),none()]);
  assert.ok(a.hasHit);
  press(game,0,'kick');advance(game,.5);
  assert.ok(b.hp>89&&b.hp<93);assert.ok(game.matchStats[0].maxCombo>=2);
});

test('a whiffed punch cannot cancel its recovery into a kick',()=>{
  const {game,a,b}=arena();b.x=1100;press(game,0,'jab');advance(game,.12);press(game,0,'kick');
  assert.equal(a.attack.move,'jab');
});

test('taunting triggers the classic laugh and can be cancelled by movement',()=>{
  const {game,a,events}=arena();press(game,0,'taunt');assert.equal(a.state,'taunt');assert.ok(events.some(event=>event.type==='laugh'));
  advance(game,.4);assert.equal(a.state,'taunt');advance(game,.1,[['left'],[]]);assert.notEqual(a.state,'taunt');
});

test('fighters cannot walk through each other on the ground or leave the stage',()=>{
  const {game,a,b}=arena();advance(game,3,[['right'],['left']]);assert.ok(b.x-a.x>=WORLD.pushDistance-.01);
  a.x=WORLD.left;b.x=WORLD.left+500;advance(game,2,[['left'],[]]);assert.equal(a.x,WORLD.left);
  a.x=WORLD.right-500;b.x=WORLD.right;advance(game,2,[[],['right']]);assert.equal(b.x,WORLD.right);
});

test('practice grants infinite energy, restores health after stun, and has no timer',()=>{
  const {game,a,b}=arena({mode:'practice'});const initialTime=game.roundTime;
  press(game,0,'kick');advance(game,.3);assert.ok(b.hp<100);
  advance(game,1.1);assert.equal(b.hp,100);assert.equal(a.energy,100);assert.equal(game.roundTime,initialTime);
  assert.equal(game.phase,'fight');
});

test('two round wins end the match and preserve stats across rounds',()=>{
  const {game,a,b,events}=arena();game.matchStats[0]={hits:7,maxCombo:3};b.hp=0;game.tick(1/60);
  assert.deepEqual(game.wins,[1,0]);assert.equal(game.phase,'roundOver');
  advance(game,3);assert.equal(game.round,2);assert.equal(game.fighters[1].hp,100);assert.equal(game.matchStats[0].hits,7);
  advance(game,2.3);game.fighters[1].hp=0;game.tick(1/60);advance(game,3);
  assert.equal(game.phase,'matchOver');assert.equal(game.matchWinner,0);assert.ok(events.some(event=>event.type==='matchEnd'));
});

test('time expiry awards the fighter with more health and a tie replays fairly',()=>{
  const {game,a,b}=arena();game.roundTime=.001;a.hp=62;b.hp=61;game.tick(1/60);assert.deepEqual(game.wins,[1,0]);
  const tie=arena().game;tie.roundTime=.001;tie.tick(1/60);assert.equal(tie.lastWinner,null);assert.deepEqual(tie.wins,[0,0]);
});

test('each character has a working special and super without invalid state',()=>{
  for(const character of CHARACTERS){
    const {game,a,b}=arena({p1:character.id});a.energy=100;b.x=770;
    press(game,0,'super');advance(game,1.5);
    assert.ok(Number.isFinite(a.x)&&Number.isFinite(b.hp),character.id);
    assert.ok(b.hp<100,`${character.id} super should connect`);
    assert.ok(a.energy<25,character.id);
  }
});

test('AI completes matches and all world values remain finite under sustained play',()=>{
  for(const difficulty of ['easy','normal','hard']){
    let seed=1729;
    const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    const game=new Game({random});game.start({mode:'ai',difficulty});
    for(let frame=0;frame<60*180&&game.phase!=='matchOver';frame++){
      game.tick(1/60,[none(),none()]);
      for(const fighter of game.fighters){
        assert.ok(Number.isFinite(fighter.x)&&Number.isFinite(fighter.hp));
        assert.ok(fighter.energy>=0&&fighter.energy<=100);
      }
    }
    assert.equal(game.phase,'matchOver',difficulty);assert.equal(game.matchWinner,1,difficulty);
  }
});
