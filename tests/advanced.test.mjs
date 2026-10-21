import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/engine.js';
import {WORLD,MOVES} from '../src/config.js';
import {isolateSilhouette} from '../src/atlas.js';

const input=(held=[],pressed=[])=>({held:new Set(held),pressed:new Set(pressed)});
function arena(options={}){
  const events=[],game=new Game({random:()=>.5,onEvent:e=>events.push(e)});
  game.start({mode:'local',...options});game.phase='fight';game.platforms=[];
  const [a,b]=game.fighters;a.x=500;b.x=500+WORLD.pushDistance+2;return {game,a,b,events};
}
const step=(game,held=[[],[]],pressed=[[],[]])=>game.tick(1/60,[0,1].map(i=>input(held[i],pressed[i])));
const advance=(game,seconds,held=[[],[]])=>{for(let i=0;i<Math.ceil(seconds*60);i++)step(game,held);};
function until(game,predicate,frames=120,held=[[],[]]){
  for(let i=0;i<frames&&!predicate();i++)step(game,held);
  assert.ok(predicate(),'expected combat state within frame budget');
}

test('double tapping either direction bursts, then holding runs; a single tap walks',()=>{
  for(const direction of ['left','right']){
    const {game,a,b,events}=arena();a.x=600;b.x=1150;
    const sign=direction==='right'?1:-1;
    step(game,[[direction],[]]);advance(game,.08);step(game,[[direction],[]]);
    assert.ok(a.dashTime>0);assert.ok(a.vx*sign>650);assert.ok(events.some(e=>e.type==='dash'));
    advance(game,.25,[[direction],[]]);assert.ok(a.vx*sign>a.character.speed*1.4);
  }
  const {game,a}=arena();advance(game,.5,[['left'],[]]);assert.equal(a.dashTime,0);assert.ok(Math.abs(a.vx)<=a.character.speed+.1);
});

test('slow repeat taps do not dash and holding run works for joystick input',()=>{
  const {game,a}=arena();step(game,[['left'],[]]);advance(game,.35);step(game,[['left'],[]]);assert.equal(a.dashTime,0);
  advance(game,.3,[['left','run'],[]]);assert.ok(-a.vx>a.character.speed*1.5);
});

test('all six variants have generous first-jump clearance and land without a second input',()=>{
  for(const p1 of ['classic','green','red','purple','pink','blue']){
    const {game,a}=arena({p1});step(game,[[],[]],[['jump'],[]]);let top=a.y;
    for(let i=0;i<100;i++){step(game);top=Math.min(top,a.y);}
    assert.ok(WORLD.floor-top>310,p1);assert.ok(WORLD.floor-top<405,p1);assert.equal(a.y,WORLD.floor);
  }
});

test('crouching cleanly avoids high kick and all high milk projectiles',()=>{
  for(const move of ['kick','special','powerWave']){
    const {game,a,b}=arena();a.energy=100;if(move!=='kick')b.x=780;
    step(game,[[],['down']]);game.beginAttack(a,move);advance(game,1.5,[[],['down']]);assert.equal(b.hp,1000,move);
  }
});

test('takeoff evades a ground punch while an uppercut can still counter a jump',()=>{
  const dodge=arena();dodge.game.beginAttack(dodge.a,'jab');advance(dodge.game,.05);
  step(dodge.game,[[],[]],[[],['jump']]);advance(dodge.game,.3);assert.equal(dodge.b.hp,1000);
  const counter=arena();counter.b.y=WORLD.floor-110;counter.b.vy=-160;
  counter.game.beginAttack(counter.a,'uppercut');advance(counter.game,.35);assert.ok(counter.b.hp<1000);assert.ok(counter.b.vy<0);
});

test('jumping clears sweeps and low milk shockwaves',()=>{
  for(const move of ['sweep','pulse']){
    const {game,a,b}=arena();a.energy=100;step(game,[[],[]],[[],['jump']]);advance(game,.1);
    game.beginAttack(a,move);advance(game,.4);assert.equal(b.hp,1000,move);
  }
});

test('low attacks break standing guard but crouch guard blocks them',()=>{
  for(const crouch of [false,true]){
    const {game,a,b,events}=arena();const held=[[],crouch?['guard','down']:['guard']];
    step(game,held);game.beginAttack(a,'sweep');advance(game,.5,held);
    assert.equal(events.some(e=>e.type==='block'),crouch);assert.ok(crouch?b.hp>990:b.hp>940&&b.hp<960);
  }
});

test('red ground projectile obeys low guard height',()=>{
  for(const crouch of [false,true]){
    const {game,a,b,events}=arena({p1:'red'});b.x=800;a.energy=100;const held=[[],crouch?['down','guard']:['guard']];
    game.beginAttack(a,'special');advance(game,1,held);assert.equal(events.some(e=>e.type==='block'),crouch);
    assert.ok(crouch?b.hp>980:b.hp>900&&b.hp<940);
  }
});

test('overhead divekick hits a croucher while standing guard can block it',()=>{
  for(const crouch of [false,true]){
    const {game,a,b,events}=arena();a.y=WORLD.floor-85;a.vy=150;const held=[[],crouch?['down','guard']:['guard']];
    step(game,held);game.beginAttack(a,'diveKick');advance(game,.45,held);
    assert.equal(events.some(e=>e.type==='block'),!crouch);assert.ok(crouch?b.hp>930&&b.hp<960:b.hp>990);
  }
});

test('close throw breaks guard but cannot grab an airborne opponent',()=>{
  for(const airborne of [false,true]){
    const {game,a,b,events}=arena();b.x=a.x+WORLD.pushDistance;if(airborne){b.y-=140;b.vy=-120;}
    game.beginAttack(a,'grab');advance(game,1.1,[[],['guard']]);
    assert.ok(airborne?b.hp===1000:b.hp>920&&b.hp<950);assert.equal(events.some(e=>e.type==='block'),false);
    if(!airborne)assert.ok(b.x<a.x);
  }
});

test('directional commands mirror with facing and motion history expires',()=>{
  for(const facing of [1,-1]){
    const {game,a}=arena();a.facing=facing;const forward=facing===1?'right':'left',back=facing===1?'left':'right';
    for(const [raw,held,want] of [['jab',['down'],'grab'],['jab',['jump'],'uppercut'],['kick',['down'],'sweep'],['special',['down'],'pulse'],['special',[forward],'rushSkill'],['super',[forward],'superRush'],['super',['down'],'superRise'],['super',[back],'superStorm'],['special',['kick'],'spin']]){
      assert.equal(game.chooseMove(a,raw,new Set(held)),want);
    }
    a.history=[{direction:'down',time:game.time-.2},{direction:'forward',time:game.time-.1}];
    assert.equal(game.chooseMove(a,'special',new Set([forward])),'powerWave');assert.equal(a.history.length,0);
    a.history=[{direction:'down',time:game.time-1},{direction:'forward',time:game.time-.4}];
    assert.equal(game.chooseMove(a,'special',new Set([forward])),'rushSkill');
  }
});

test('ground, air and dash contexts select distinct normal attacks',()=>{
  const {game,a}=arena();a.y-=100;a.vy=-100;
  for(const [raw,move] of [['jab','airJab'],['kick','diveKick'],['special','airWave']])assert.equal(game.chooseMove(a,raw,new Set()),move);
  a.y=WORLD.floor;a.vy=0;a.dashTime=.1;
  assert.equal(game.chooseMove(a,'jab',new Set()),'rushPunch');assert.equal(game.chooseMove(a,'kick',new Set()),'slide');
});

test('three successive confirmed J presses produce the complete three-hit chain',()=>{
  const {game,a,b,events}=arena();
  for(const [i,want] of ['jab','jab2','straight'].entries()){
    step(game,[[],[]],[['jab'],[]]);until(game,()=>a.attack?.move===want&&a.hasHit);
    assert.equal(game.matchStats[0].hits,i+1);
  }
  assert.equal(events.filter(e=>e.type==='hit').length,3);assert.ok(b.hp>880&&b.hp<920);
});

test('J K L I spends one full gauge across the skill and six-hit combo super',()=>{
  const {game,a,b,events}=arena();a.energy=100;
  for(const move of ['jab','kick','special']){
    const before=game.matchStats[0].hits;step(game,[[],[]],[[move],[]]);until(game,()=>game.matchStats[0].hits>before);
  }
  assert.equal(a.combo,3);assert.equal(game.chooseMove(a,'super',new Set()),'superFinish');
  assert.ok(a.energy<100);assert.ok(game.moveCost(a,'superFinish')<=a.energy);
  step(game,[[],[]],[['super'],[]]);until(game,()=>a.attack?.move==='superFinish');advance(game,1.7);
  assert.ok(events.filter(e=>e.type==='hit'&&e.move==='superFinish').length>=5);
  assert.ok(game.matchStats[0].maxCombo>=8);assert.ok(b.hp>700&&b.hp<800);assert.ok(a.energy<25);
});

test('five-hit rush, three-hit rising and four-hit storm supers all connect',()=>{
  for(const [move,count] of [['superRush',5],['superRise',3],['superStorm',4]]){
    const {game,a,b,events}=arena();a.energy=100;if(move==='superStorm')b.x=1000;
    assert.ok(game.beginAttack(a,move));advance(game,2);
    assert.equal(events.filter(e=>e.type==='hit'&&e.move===move).length,count,move);
    assert.ok(a.energy<15);assert.ok(b.hp>800&&b.hp<880);
  }
});

test('new skills honor their gauge costs and do not overspend',()=>{
  for(const move of ['spin','powerWave','pulse','rushSkill','airWave','superRush','superRise','superStorm','superFinish']){
    const {game,a}=arena();a.energy=MOVES[move].cost-1;assert.equal(game.beginAttack(a,move),false,move);
    a.energy=MOVES[move].cost;assert.ok(game.beginAttack(a,move));assert.equal(a.energy,0);
  }
});

test('air scatter emits two downward shots and spinning kick can hit twice',()=>{
  const scatter=arena();scatter.a.energy=100;scatter.a.y-=180;scatter.a.vy=-100;
  scatter.game.beginAttack(scatter.a,'airWave');advance(scatter.game,.19);
  assert.equal(scatter.game.projectiles.length,2);assert.ok(scatter.game.projectiles.every(p=>p.vy>0&&p.level==='overhead'));
  const spin=arena();spin.a.energy=100;spin.game.beginAttack(spin.a,'spin');advance(spin.game,.8);assert.equal(spin.events.filter(e=>e.type==='hit').length,2);
});

test('sprite extraction removes a detached neighbor foot and retains soft edges',()=>{
  const width=24,height=18,data=new Uint8ClampedArray(width*height*4);
  const pixel=(x,y,alpha)=>{data[(y*width+x)*4+3]=alpha;};
  for(let y=2;y<16;y++)for(let x=9;x<21;x++)pixel(x,y,255);
  for(let y=13;y<16;y++)for(let x=0;x<4;x++)pixel(x,y,255);
  pixel(8,5,20);pixel(5,1,25);
  const bounds=isolateSilhouette(data,width,height);
  assert.equal(bounds.left,9);assert.equal(bounds.height,14);assert.equal(data[(14*width+2)*4+3],0);
  assert.equal(data[(5*width+8)*4+3],20);assert.equal(data[(1*width+5)*4+3],0);
});
