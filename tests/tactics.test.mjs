import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/engine.js';
import {WORLD,CHARACTERS} from '../src/config.js';
import {moveFor} from '../src/styles.js';
import {spawnAbility,advanceAbility} from '../src/abilities.js';
const input=(held=[],pressed=[])=>({held:new Set(held),pressed:new Set(pressed)});
const step=(g,count=1,a=input(),b=input())=>{for(let n=0;n<count;n++)g.tick(1/60,[a,n?input([...b.held]):b]);};
function arena(id='purple'){
  const events=[],g=new Game({random:()=>.5,onEvent:event=>events.push(event)});g.start({mode:'local',p1:id,p2:'classic'});g.phase='fight';g.platforms=[];
  const [a,b]=g.fighters;a.x=700;b.x=1020;a.energy=100;return {g,a,b,events};
}
test('persistent control leaves a real approach window after the caster recovers',()=>{
  for(const id of ['purple','pink','blue']){
    const {g,a,b}=arena(id);if(id==='blue')b.x=940;
    g.beginAttack(a,'pulse');step(g,36);
    assert.equal(a.attack,null,id);assert.ok(b.controlTime>.20,id);
    const ax=a.x,bx=b.x;step(g,7,input(['right']),input(['left','jump'],['jab']));
    assert.ok(a.x>ax+10,id);assert.ok(Math.abs(b.x-bx)<8,id);assert.equal(b.attack,null,id);
  }
});
test('the same cast cannot keep refreshing control, and recovery resists another immediate bind',()=>{
  const {g,a,b}=arena();const config={...moveFor('purple','pulse'),control:.7,controlType:'bind',push:0};
  g.hit(a,b,config,'pulse',null,99);step(g,12);const remaining=b.controlTime;
  g.hit(a,b,config,'pulse',null,99);assert.equal(b.controlTime,remaining);
  step(g,65);assert.equal(b.controlTime,0);assert.ok(b.controlImmune>0);
  g.hit(a,b,config,'pulse',null,100);assert.equal(b.controlTime,0);
});
test('a stored flash breaks control through the real input path',()=>{
  const {g,a,b}=arena();g.hit(a,b,{...moveFor('purple','pulse'),control:1,controlType:'freeze'},'pulse',null,22);
  step(g,20);assert.ok(b.controlTime>0);
  step(g,1,input(),input(['right'],['blink']));assert.equal(b.controlTime,0);assert.equal(b.blinkCharges,1);assert.ok(b.blinkTime>0);
});
test('a standing guard can block a centered control field without receiving its status',()=>{
  const {g,a,b,events}=arena();g.beginAttack(a,'pulse');step(g,90,input(),input(['guard']));
  assert.equal(b.controlTime,0);assert.ok(b.hp>970);assert.ok(events.some(e=>e.type==='block'));
});
test('storm warnings lock a position; later waves continue after the caster can move',()=>{
  const {g,a,b}=arena('classic');g.beginAttack(a,'superStorm');step(g,19);
  const first=g.projectiles.find(p=>p.visual==='spiralCollapse');assert.ok(first);const x=first.x;b.x+=500;
  step(g,15,input(['right']));assert.equal(first.x,x);assert.equal(a.attack,null);const casterX=a.x;
  step(g,18,input(['right']));assert.ok(a.x>casterX);assert.ok(g.projectiles.some(p=>p.visual==='spiralCollapse'&&p.x>x+300));
});
test('the redesigned ranged ultimate pressures a continuous jump instead of missing all four waves',()=>{
  for(const id of CHARACTERS.map(c=>c.id)){
    const {g,a,b,events}=arena(id);b.x=1240;g.beginAttack(a,'superStorm');step(g,130,input(),input(['jump']));
    assert.ok(events.some(e=>e.type==='hit'),id);assert.ok(b.hp>680,id);
  }
});
test('a telegraphed spiral collapse can still be escaped with a well-timed flash',()=>{
  const {g,a,b}=arena('classic');g.beginAttack(a,'superStorm');step(g,19);
  g.projectiles=g.projectiles.filter(p=>p.visual==='spiralCollapse');const column=g.projectiles[0];column.age=column.delay-.04;
  step(g,1,input(),input(['right'],['blink']));step(g,35,input(),input(['right','run']));assert.equal(b.hp,1000);
});
test('all six aerial ultimates aim at the opponent and leave an independently active burst',()=>{
  for(const id of CHARACTERS.map(c=>c.id)){
    const {g,a,b,events}=arena(id);a.y=260;a.vy=-30;b.x=1210;
    assert.equal(g.chooseMove(a,'super',new Set()),'airSuper');g.beginAttack(a,'airSuper');step(g,110);
    assert.ok(events.some(e=>e.type==='hit'),id);assert.ok(b.hp<940&&b.hp>750,`${id} ${b.hp}`);assert.equal(a.attack,null);
  }
});
test('walking cadence follows displacement, and stops advancing at the wall',()=>{
  const {g,a,b}=arena('classic');b.x=1500;step(g,30,input(['right']));assert.ok(a.walkPhase>0);
  a.x=WORLD.left;b.x=1500;a.vx=0;const phase=a.walkPhase;step(g,30,input(['left']));assert.equal(a.walkPhase,phase);
});
test('red pursuit detonates at successive snapshots and leaves jumpable ground burns without binding',()=>{
  const {g,a,b}=arena('red');g.beginAttack(a,'superStorm');step(g,20);
  const first=g.projectiles.find(p=>p.visual==='fireBlast');assert.ok(first);const x=first.x;
  b.x+=320;step(g,24);assert.equal(first.x,x);assert.ok(g.projectiles.some(p=>p.visual==='fireBlast'&&p.x>x+250));
  g.projectiles=[first];first.age=first.strikeEnd+.01;first.nextBurn=first.age;first.burns=0;b.x=x;b.y=WORLD.floor;
  const hp=b.hp;g.updateProjectiles(1/60);assert.ok(b.hp<hp);assert.equal(b.controlTime,0);
  b.y-=140;first.nextBurn=first.age;const airborneHp=b.hp;g.updateProjectiles(1/60);assert.equal(b.hp,airborneHp);
});
test('pink pursuit bends into an aerial opponent then returns, hitting both ways but healing once',()=>{
  const {g,a,b,events}=arena('pink');a.hp=800;b.y-=180;b.vy=0;g.beginAttack(a,'superStorm');step(g,19);
  const ribbons=g.projectiles.filter(p=>p.visual==='ribbonHunt');assert.equal(ribbons.length,2);assert.ok(ribbons.every(p=>!p.field));
  const startY=ribbons[0].y;step(g,24);assert.ok(ribbons[0].y<startY);assert.ok(ribbons[0].trace.length>2);
  step(g,100);assert.ok(ribbons.every(p=>p.returned));assert.ok(events.filter(e=>e.type==='hit').length>=3);assert.equal(a.healIds.length,1);assert.ok(a.hp>800);
});
test('blue pursuit constructs destructible mirrors, fires cross-shots and freezes the center',()=>{
  const {g,a,b,events}=arena('blue');g.beginAttack(a,'superStorm');step(g,20);
  const mirrors=g.projectiles.filter(p=>p.visual==='iceMirror');assert.equal(mirrors.length,2);assert.ok(mirrors.every(p=>p.barrierHp===3));
  step(g,10);assert.ok(g.projectiles.some(p=>p.visual==='iceSpear'));
  const wall=mirrors[0];g.projectiles.push({owner:1,field:false,x:wall.x,y:wall.y-150,vx:0,vy:0,life:1,age:0,radius:10,hits:new Set(),config:moveFor('classic','special'),level:'high'});
  g.updateProjectiles(1/60);assert.equal(wall.barrierHp,2);assert.ok(events.some(e=>e.type==='clash'));
  step(g,30);assert.ok(g.projectiles.some(p=>p.visual==='iceBloom'));assert.equal(b.controlType,'freeze');assert.ok(b.controlTime>0);assert.equal(a.attack,null);
});
test('up plus super works from the ground on the same input frame without replacing directional supers',()=>{
  const {g,a}=arena('red');step(g,1,input(['jump'],['super']));assert.equal(a.attack?.move,'airSuper');assert.ok(a.vy<0);
  assert.equal(g.chooseMove(a,'super',new Set(['jump','left'])),'superStorm');assert.equal(g.chooseMove(a,'super',new Set(['jump','right'])),'superRush');
});
test('retreating reverses the walk cycle rather than skating forwards',()=>{
  const {g,a,b}=arena('classic');b.x=1500;step(g,30,input(['left']));assert.ok(a.walkPhase<0);
});

test('the spiral meteor detonates at its real contact point and leaves a stationary circle',()=>{
  const {g,a,b,events}=arena('classic');a.y-=200;
  spawnAbility(g,a,{config:moveFor('classic','airSuper'),move:'airSuper',id:90},0);
  const meteor=g.projectiles[0];assert.equal(meteor.visual,'spiralMeteor');
  // A coarse update traverses the whole path: swept collision must still hit.
  advanceAbility(g,meteor,.6);assert.ok(events.some(e=>e.type==='hit'));assert.equal(meteor.life,0);
  const impact=g.projectiles.find(p=>p.visual==='spiralImpact');assert.ok(impact);assert.equal(impact.travel,null);
  assert.equal(impact.x,meteor.x);assert.equal(impact.y,meteor.y);assert.equal(impact.shape,'ellipse');
  const position=[impact.x,impact.y];advanceAbility(g,impact,.1);assert.deepEqual([impact.x,impact.y],position);
  assert.equal(g.projectiles.filter(p=>p.visual==='spiralImpact').length,1);assert.ok(b.hp<1000);
});
test('spiral damage uses the visible circle instead of the corners of an invisible column',()=>{
  const {g,a}=arena('classic');spawnAbility(g,a,{config:moveFor('classic','superStorm'),move:'superStorm',id:91},0);
  advanceAbility(g,g.projectiles[0],.01);const circle=g.projectiles.find(p=>p.visual==='spiralCollapse');assert.ok(circle);
  const hits=[],defender={index:1,hurtboxes:[{x:circle.x+circle.radius*.83,y:circle.y+circle.radius*.83,w:1,h:1}]};
  const collision={fighters:[a,defender],evades:()=>false,hit:(...args)=>hits.push(args)};
  advanceAbility(collision,circle,circle.delay+.01);assert.equal(hits.length,0);
  defender.hurtboxes=[{x:circle.x-5,y:circle.y-5,w:10,h:10}];advanceAbility(collision,circle,.01);assert.equal(hits.length,1);
});
test('green aerial and pursuit ultimates send damaging clones from both flanks, with no helix column',()=>{
  for(const move of ['airSuper','superStorm']){
    const {g,a,events}=arena('green');spawnAbility(g,a,{config:moveFor('green',move),move,id:92},0);
    if(move==='superStorm')advanceAbility(g,g.projectiles[0],.01);
    const clones=g.projectiles.filter(p=>p.travel);assert.equal(clones.length,2);
    assert.deepEqual(clones.map(p=>Math.sign(p.travel.to.x-p.travel.from.x)),[1,-1]);
    assert.ok(clones.every(p=>p.visual===(move==='airSuper'?'windDive':'clonePass')&&p.pose>=21&&p.radius===48));
    assert.equal(g.projectiles.some(p=>['airBurst','stormColumn'].includes(p.visual)),false);
    // Each clone is a real swept contact, independent of the caster animation.
    for(const clone of clones)advanceAbility(g,clone,clone.delay+clone.travel.duration);
    assert.ok(events.some(e=>e.type==='hit'),move);
    assert.ok(clones.every(p=>p.hits.has(1)),move);
  }
});
