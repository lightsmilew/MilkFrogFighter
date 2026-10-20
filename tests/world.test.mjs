import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/engine.js';
import {WORLD,MOVEMENT,CHARACTERS,PLATFORMS,STAGES} from '../src/config.js';
import {createCamera,updateCamera} from '../src/camera.js';
const input=(held=[],pressed=[])=>({held:new Set(held),pressed:new Set(pressed)});
function arena(stage='street',platforms=false){
  const events=[],game=new Game({random:()=>.5,onEvent:e=>events.push(e)});
  game.start({mode:'local',stage});game.phase='fight';if(!platforms)game.platforms=[];
  const [a,b]=game.fighters;a.x=500;b.x=500+WORLD.pushDistance+2;return {game,a,b,events};
}
const step=(g,held=[[],[]],pressed=[[],[]])=>g.tick(1/60,[0,1].map(i=>input(held[i],pressed[i])));
const advance=(g,t,held=[[],[]])=>{for(let n=0;n<Math.ceil(t*60);n++)step(g,held);};

test('held jump repeatedly takes off after landing without consuming the air jump',()=>{
  const {game,a,events}=arena();advance(game,3.2,[['jump'],[]]);
  assert.ok(events.filter(e=>e.type==='jump').length>=3);
  assert.equal(events.filter(e=>e.type==='doubleJump').length,0);assert.equal(a.airJumps,1);
});

test('a fresh airborne jump edge boosts once, while a third edge cannot boost',()=>{
  const {game,a,events}=arena();step(game,[['jump'],[]]);advance(game,.22);
  const firstVelocity=a.vy;step(game,[['jump'],[]]);assert.ok(a.vy<firstVelocity);assert.equal(a.airJumps,0);
  advance(game,.15);const secondVelocity=a.vy;step(game,[[],[]],[['jump'],[]]);assert.ok(a.vy>secondVelocity);
  assert.equal(events.filter(e=>e.type==='doubleJump').length,1);
});

test('one-way platforms catch a falling fighter without tunneling',()=>{
  const {game,a}=arena('street',true);a.x=400;a.y=350;a.vy=400;
  game.physics(a,.2);assert.equal(a.y,410);assert.equal(a.platformId,'left-canopy');assert.ok(a.grounded);assert.equal(a.airJumps,1);
  a.vy=-800;game.physics(a,.1);assert.equal(a.platformId,null);assert.ok(a.y<410);
});

test('walking off and holding down both release a platform cleanly',()=>{
  for(const action of ['walk','drop']){
    const {game,a}=arena('street',true);a.x=400;a.y=410;a.platformId='left-canopy';a.vy=0;
    if(action==='walk'){a.x=620;game.physics(a,1/60);}
    else advance(game,.25,[['down'],[]]);
    assert.equal(a.platformId,null);assert.ok(a.y>410);advance(game,1);assert.equal(a.y,WORLD.floor);
  }
});

test('a platform jump and second jump can reach a higher ledge',()=>{
  const {game,a,b}=arena('street',true);a.x=700;a.y=410;a.platformId='left-canopy';
  // Isolate a vertical pair with realistic reachable spacing.
  game.platforms=[{id:'lower',x:600,y:410,w:300},{id:'upper',x:600,y:190,w:300}];a.platformId='lower';b.x=1100;
  step(game,[[],[]],[['jump'],[]]);advance(game,.22);step(game,[[],[]],[['jump'],[]]);advance(game,1.8);
  assert.equal(a.platformId,'upper');assert.equal(a.y,190);
});

test('camera tracks past the old edges while viewport dimensions remain fixed',()=>{
  const {game,a,b}=arena();a.x=2600;b.x=3000;updateCamera(game.camera,[a,b],0,true);
  assert.ok(game.camera.x>1500);assert.equal(WORLD.width,1280);assert.equal(WORLD.height,720);
  for(const f of [a,b]){const screen=(f.x-game.camera.x)*game.camera.scale;assert.ok(screen>0&&screen<1280);}
  a.x=100;b.x=450;updateCamera(game.camera,[a,b],0,true);assert.equal(game.camera.x,0);
});

test('camera expands its vertical view to keep ground and rooftop fighters visible',()=>{
  const {a,b}=arena();a.y=-400;b.y=610;const camera=createCamera();updateCamera(camera,[a,b],0,true);
  assert.ok(camera.scale<.7);assert.ok(camera.y<0);
  for(const f of [a,b]){
    assert.ok((f.y-WORLD.standHeight-camera.y)*camera.scale>=140);
    assert.ok((f.y-camera.y)*camera.scale<=645);
  }
});

test('two stored flashes cross an opponent, dodge a punch and refill sequentially',()=>{
  const {game,a,b,events}=arena();game.beginAttack(b,'jab');
  step(game,[['right'],[]],[['blink'],[]]);advance(game,.22);
  assert.ok(a.x>b.x);assert.equal(a.hp,100);assert.equal(a.blinkCharges,1);assert.equal(a.blinkCooldown,0);
  step(game,[['right'],[]],[['blink'],[]]);assert.equal(a.blinkCharges,0);assert.ok(a.blinkCooldown>1);
  const count=events.filter(e=>e.type==='blink').length;advance(game,.2);step(game,[[],[]],[['blink'],[]]);assert.equal(events.filter(e=>e.type==='blink').length,count);
  assert.equal(MOVEMENT.blinkRecharge,2.5);
  advance(game,2);assert.equal(a.blinkCharges,0);advance(game,.12);assert.equal(a.blinkCharges,1);
  advance(game,2.5);assert.equal(a.blinkCharges,2);assert.equal(a.blinkRecharge,0);
});

test('flash breaks hitstun after a brief confirm window and escapes the wall',()=>{
  const {game,a,b}=arena();a.x=WORLD.left;b.x=WORLD.left+WORLD.pushDistance+2;
  game.beginAttack(b,'jab');advance(game,.13);assert.ok(a.stun>0);advance(game,.11);
  step(game,[[],[]],[['blink'],[]]);assert.equal(a.stun,0);assert.ok(a.blinkTime>0);advance(game,.2);
  assert.ok(a.x>b.x);assert.equal(b.combo,0);
});

test('throw follows an airborne arc and lands on the opposite side exactly once',()=>{
  for(const direction of [1,-1]){
    const {game,a,b,events}=arena();a.x=1500;b.x=a.x+direction*WORLD.pushDistance;a.facing=direction;b.facing=-direction;
    game.beginAttack(a,'grab');advance(game,.4);
    assert.ok(b.grappled);assert.ok(b.y<WORLD.floor-100);assert.equal(b.hp,100);
    advance(game,.5);assert.equal(b.grappled,false);assert.ok((b.x-a.x)*direction<0);assert.equal(b.reaction.type,'slam');assert.ok(b.downTime>0);
    assert.equal(events.filter(e=>e.type==='hit'&&e.move==='grab').length,1);
    advance(game,1);assert.ok(b.grounded);assert.equal(b.getUpTime,0);assert.equal(b.state,'idle');
  }
});

test('wall throws preserve side switching and cannot be interrupted by flash',()=>{
  const {game,a,b}=arena();a.x=WORLD.left;b.x=a.x+WORLD.pushDistance;game.beginAttack(a,'grab');advance(game,.25);
  step(game,[[],[]],[[],['blink']]);assert.ok(b.grappled);assert.equal(b.blinkTime,0);
  advance(game,.6);assert.ok(b.x<a.x);assert.ok(b.x>=WORLD.left);assert.ok(a.x-b.x>=WORLD.pushDistance);
});

test('hit reactions distinguish light, heavy, trip and rising attacks',()=>{
  for(const [move,type] of [['jab','flinch'],['kick','body'],['sweep','trip'],['uppercut','launch']]){
    const {game,a,b}=arena();game.beginAttack(a,move);
    for(let n=0;n<40&&!b.reaction;n++)step(game);
    assert.equal(b.reaction?.type,type,move);
    if(['trip','launch'].includes(type))assert.ok(b.vy<0);
  }
});

test('knocked-down fighters have a visible get-up and cannot be corner stunlocked',()=>{
  const {game,a,b}=arena();game.beginAttack(a,'sweep');advance(game,.5);assert.ok(b.downTime>0);const hp=b.hp;
  a.x=b.x-WORLD.pushDistance;game.beginAttack(a,'jab');advance(game,.18);assert.equal(b.hp,hp);assert.ok(b.getUpTime>0);
  advance(game,.6);assert.equal(b.getUpTime,0);assert.equal(b.state,'idle');
});

test('pink heals once per skill and blue produces a temporary freeze',()=>{
  for(const p1 of ['pink','blue']){
    const {game}=arena();game.start({mode:'local',p1});game.phase='fight';game.platforms=[];
    const [a,b]=game.fighters;a.x=500;b.x=690;a.energy=100;a.hp=70;game.beginAttack(a,'special');advance(game,.48);
    assert.ok(b.hp<100,p1);
    if(p1==='pink'){assert.equal(a.hp,72);assert.ok(b.charm>0);assert.equal(b.reaction.type,'charm');}
    else{assert.ok(b.frost>0);assert.ok(b.slow>0);assert.equal(b.reaction.type,'freeze');}
    advance(game,2);assert.equal(b.frost,0);assert.equal(b.charm,0);
  }
});

test('low attacks work on the same raised platform instead of treating it as a jump',()=>{
  const {game,a,b}=arena('street',true);game.platforms=[{id:'test',x:350,y:410,w:500}];
  for(const f of [a,b]){f.y=410;f.platformId='test';}
  game.beginAttack(a,'sweep');advance(game,.3);assert.ok(b.hp<100);
});

test('both maps initialize their own ledges and invalid map ids have a fallback',()=>{
  const game=new Game();
  for(const stage of STAGES){game.start({stage:stage.id});assert.equal(game.stageId,stage.id);assert.deepEqual(game.platforms,stage.platforms);}
  assert.notEqual(STAGES[0].platforms[0].x,STAGES[1].platforms[0].x);
  game.start({stage:'missing'});assert.equal(game.stageId,'street');assert.equal(game.roundTime,90);
});

test('rain of meteors targets the expanded world and upper platforms',()=>{
  const {game,a,b}=arena();a.x=2400;b.x=2700;b.y=190;a.energy=100;
  game.beginAttack(a,'superStorm');advance(game,.32);const meteor=game.projectiles[0];
  assert.ok(meteor.x>2600&&meteor.x<2800);assert.ok(meteor.y<0);
});

test('seeded active duels no longer normally finish in ten seconds',()=>{
  const durations=[];
  for(let seed=1;seed<=9;seed++){
    let s=seed;const random=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
    const game=new Game({random});game.start({mode:'ai'});
    for(let n=0;n<60*94&&game.phase!=='roundOver';n++)game.tick(1/60,[game.ai(game.fighters[0],game.fighters[1],1/60),input()]);
    durations.push(game.time);
  }
  const median=durations.sort((a,b)=>a-b)[4];assert.ok(median>23&&median<65,`median ${median.toFixed(1)}s`);
});

test('all six fighters can comfortably land on first and second real ledges',()=>{
  for(const stage of STAGES)for(const character of CHARACTERS){
    for(const timing of [null,.15,.35]){
      const second=timing!==null;
      const game=new Game();game.start({mode:'local',p1:character.id,stage:stage.id});game.phase='fight';
      const [a,b]=game.fighters;a.x=second?760:450;b.x=1200;
      step(game,[[],[]],[['jump'],[]]);
      if(second){advance(game,timing);step(game,[[],[]],[['jump'],[]]);}
      advance(game,2);
      assert.equal(a.platformId,second?'left-roof':'left-canopy',`${character.id} ${second?'second':'first'} ledge`);
      assert.equal(a.y,stage.platforms.find(p=>p.id===(second?'left-roof':'left-canopy')).y);
    }
  }
});

test('run acceleration and body geometry follow the tuning constants',()=>{
  const {game,a,b}=arena();a.x=500;b.x=1800;advance(game,.4,[['right','run'],[]]);
  assert.ok(a.vx>a.character.speed*2);assert.ok(a.vx<=a.character.speed*MOVEMENT.runMultiplier+.01);
  assert.equal(WORLD.spriteSize,175);assert.equal(a.hurtbox.w,88*.7);assert.equal(WORLD.standHeight,208*.7);
});

test('a second flash pressed during the first is buffered without losing its travel',()=>{
  const {game,a,events}=arena();step(game,[['right'],[]],[['blink'],[]]);advance(game,.05,[['right'],[]]);
  step(game,[['right'],[]],[['blink'],[]]);assert.equal(a.blinkCharges,1);
  advance(game,.3,[['right'],[]]);assert.equal(a.blinkCharges,0);assert.equal(events.filter(e=>e.type==='blink').length,2);assert.ok(a.x>1100);
});
