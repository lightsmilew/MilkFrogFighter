import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/engine.js';
import {WORLD,DIFFICULTIES} from '../src/config.js';
import {moveFor} from '../src/styles.js';
import {gameShareUrl,shareGame,PUBLIC_GAME_URL} from '../src/share.js';
const input=(held=[],pressed=[])=>({held:new Set(held),pressed:new Set(pressed)});
function arena(difficulty='normal'){
  const events=[],game=new Game({random:()=>.5,onEvent:e=>events.push(e)});game.start({mode:'local',difficulty,p2:'classic'});game.phase='fight';game.platforms=[];
  const [a,b]=game.fighters;a.x=500;b.x=500+WORLD.pushDistance;a.energy=100;return {game,a,b,events};
}
const tick=(game,held=[],pressed=[])=>game.tick(1/60,[input(held,pressed),input()]);
const advance=(game,seconds)=>{for(let i=0;i<Math.ceil(seconds*60);i++)tick(game);};

test('up plus punch takes priority over a jump, including a slightly staggered chord',()=>{
  for(const delay of [0,.05]){
    const {game,a,events}=arena();if(delay){tick(game,['jump'],['jump']);advance(game,delay);}
    tick(game,['jump'],['jab']);assert.equal(a.attack?.move,'uppercut');assert.equal(a.airJumps,1);
    for(let n=0;n<55;n++)tick(game,['jump']);
    assert.equal(events.filter(e=>['jump','doubleJump'].includes(e.type)).length,0);
    assert.ok(events.some(e=>e.type==='hit'&&e.move==='uppercut'));
  }
});

test('down plus punch grabs in both directions, while airborne down punch remains an air attack',()=>{
  for(const facing of [-1,1]){
    const {game,a,b,events}=arena();b.x=a.x+facing*WORLD.pushDistance;a.facing=facing;
    tick(game,['down'],['jab']);assert.equal(a.attack.move,'grab');advance(game,1.2);
    assert.ok((b.x-a.x)*facing<0);assert.ok(events.some(e=>e.type==='hit'&&e.move==='grab'));
  }
  const {game,a}=arena();a.y-=200;a.vy=-200;
  assert.equal(game.chooseMove(a,'jab',new Set(['down'])),'airJab');assert.equal(game.chooseMove(a,'jab',new Set(['jump'])),'uppercut');
});

test('plain jump and release-repress air jump still work after the directional chord window',()=>{
  const {game,a}=arena();tick(game,[],['jump']);advance(game,.25);assert.ok(a.y<WORLD.floor);assert.equal(a.airJumps,1);
  tick(game,[],['jump']);assert.equal(a.airJumps,0);advance(game,1.6);assert.equal(a.y,WORLD.floor);
});

test('AI escape decisions run even when its ordinary planning timer is far in the future',()=>{
  const {game,a,b,events}=arena();a.aiThink=10;a.stun=1;a.stunKind='hurt';a.reaction={type:'flinch',age:.12};a.hitstunTime=.12;b.combo=3;b.comboTimer=1;
  for(let n=0;n<25;n++)game.tick(1/60,[game.ai(a,b,1/60),input()]);
  assert.ok(events.some(e=>e.type==='blink'&&e.index===0));assert.equal(a.blinkCharges,1);assert.equal(a.stun,0);
});

test('fresh hits do not keep restarting the minimum escape window during a fast combo',()=>{
  const {game,a,b,events}=arena();
  for(let n=0;n<38;n++){
    if(n%6===0)game.hit(b,a,moveFor('classic','jab'),'jab',null,100+n);
    game.tick(1/60,[game.ai(a,b,1/60),input()]);
  }
  assert.ok(events.some(e=>e.type==='blink'&&e.index===0));assert.ok(a.blinkCharges>=0);assert.ok(a.blinkCharges<2);
});

test('an AI confirm gets one probability decision rather than a new roll on every frame',()=>{
  const {game,a,b}=arena('easy');game.random=()=>.99;game.beginAttack(a,'jab');a.hasHit=true;a.cancelTime=.38;a.combo=1;
  let followups=0;
  for(let n=0;n<20;n++){game.time+=1/60;if(game.ai(a,b,1/60).command)followups++;}
  game.random=()=>0;
  for(let n=0;n<30;n++){game.time+=1/60;if(game.ai(a,b,1/60).command)followups++;}
  assert.equal(followups,0);
});

test('easy and normal end their planned pressure chains before hard does',()=>{
  for(const difficulty of ['easy','normal','hard']){
    const {game,a,b}=arena(difficulty);game.random=()=>0;game.beginAttack(a,'jab');a.hasHit=true;a.cancelTime=.38;a.combo=4;
    let next=null;for(let n=0;n<20;n++){game.time+=1/60;next=game.ai(a,b,1/60).command||next;}
    assert.equal(Boolean(next),difficulty==='hard');
  }
});

test('AI uses a real limited blink stock and waits for its three-second recharge',()=>{
  const {game,a,b}=arena('hard');a.blinkCharges=0;a.blinkRecharge=3;a.stun=4;a.reaction={type:'flinch',age:.2};b.combo=3;
  for(let n=0;n<100;n++)game.tick(1/60,[game.ai(a,b,1/60),input()]);assert.equal(a.aiStats.blinks,0);assert.equal(a.blinkCharges,0);
  advance(game,1.5);assert.equal(a.blinkCharges,1);
});

test('sharing uses the public game from localhost and preserves deployed repository paths',()=>{
  assert.equal(gameShareUrl('http://localhost:4173/?v=controls5'),PUBLIC_GAME_URL);
  assert.equal(gameShareUrl('http://192.168.1.2:4173/'),PUBLIC_GAME_URL);
  assert.equal(gameShareUrl('https://friend.github.io/frog/index.html?v=test#fight'),'https://friend.github.io/frog/');
});

test('native sharing, cancellation, clipboard fallback and manual fallback are distinct',async()=>{
  let data,copied;
  const native=await shareGame('https://example.com/frog/',{share:async value=>{data=value;}});assert.equal(native.status,'shared');assert.equal(data.url,'https://example.com/frog/');
  const cancelled=await shareGame(PUBLIC_GAME_URL,{share:async()=>{throw Object.assign(new Error(),{name:'AbortError'});},clipboard:{writeText:async value=>{copied=value;}}});
  assert.equal(cancelled.status,'cancelled');assert.equal(copied,undefined);
  const fallback=await shareGame(PUBLIC_GAME_URL,{share:async()=>{throw new Error('Unsupported');},clipboard:{writeText:async value=>{copied=value;}}});
  assert.equal(fallback.status,'copied');assert.equal(copied,PUBLIC_GAME_URL);assert.equal((await shareGame(PUBLIC_GAME_URL,{})).status,'manual');
});

test('seeded pressure rounds separate all three difficulty levels and exercise AI flashes',()=>{
  const ids=['classic','green','red','purple','pink','blue'],wins={},blinks={};
  for(const difficulty of ['easy','normal','hard']){
    wins[difficulty]=0;blinks[difficulty]=0;
    for(let seed=1;seed<=18;seed++){
      let value=seed;const random=()=>{value=(value*1664525+1013904223)>>>0;return value/4294967296;};
      const game=new Game({random});game.start({mode:'ai',difficulty,p1:'classic',p2:ids[(seed-1)%6]});
      for(let n=0;n<60*96&&game.phase!=='roundOver';n++){
        const [a,b]=game.fighters,held=new Set(),pressed=new Set();
        if(Math.abs(a.x-b.x)>90){held.add(a.x<b.x?'right':'left');held.add('run');}
        if(n%13===0)pressed.add('jab');if(n%37===0)pressed.add('kick');if(n%71===0&&a.energy>=25){held.clear();pressed.add('special');}
        game.tick(1/60,[{held,pressed},input()]);
      }
      if(game.lastWinner===1)wins[difficulty]++;blinks[difficulty]+=game.fighters[1].aiStats.blinks;
    }
  }
  assert.ok(wins.easy+2<=wins.normal);assert.ok(wins.normal+5<=wins.hard);assert.ok(wins.normal<=12);
  assert.ok(blinks.normal>=18);assert.ok(blinks.hard>blinks.easy);
});

test('down punch starts a throw before a held-down platform drop can steal the gesture',()=>{
  const {game,a,b}=arena();game.platforms=[{id:'ledge',x:300,y:410,w:600}];
  for(const fighter of [a,b]){fighter.y=410;fighter.platformId='ledge';}
  for(let n=0;n<10;n++)tick(game,['down']);tick(game,['down'],['jab']);
  assert.equal(a.attack?.move,'grab');assert.equal(a.platformId,'ledge');assert.equal(a.y,410);
});
