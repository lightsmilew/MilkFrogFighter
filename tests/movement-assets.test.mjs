import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {FRAME_DATA,ANIMATION_FRAMES,ATLAS_FRAME_SIZE} from '../assets/fighters/frames.js';
import {CHARACTERS,WORLD} from '../src/config.js';
import {Renderer} from '../src/renderer.js';
import {Game} from '../src/engine.js';

test('each fighter ships one atlas; walk and sprint replace old movement slots without duplicated rectangles',async()=>{
  assert.deepEqual((await readdir(new URL('../assets/fighters/',import.meta.url))).sort(),[...CHARACTERS.map(c=>c.id+'.webp'),'portraits.webp','frames.js'].sort());
  assert.equal(ANIMATION_FRAMES.walk.length,8);assert.equal(ANIMATION_FRAMES.run.length,6);
  assert.equal(new Set([...ANIMATION_FRAMES.walk,...ANIMATION_FRAMES.run]).size,14);
  for(const c of CHARACTERS){
    const frames=FRAME_DATA[c.id];assert.equal(frames.length,48);
    assert.equal(new Set(frames.map(f=>`${f.rect.x},${f.rect.y}`)).size,48);
    for(const [i,a] of frames.entries()){
      assert.ok(a.bounds.left>=0&&a.bounds.top>=0&&a.bounds.right<ATLAS_FRAME_SIZE&&a.bounds.bottom<ATLAS_FRAME_SIZE);
      for(const b of frames.slice(i+1))assert.ok(a.rect.x+a.rect.w<=b.rect.x||b.rect.x+b.rect.w<=a.rect.x||a.rect.y+a.rect.h<=b.rect.y||b.rect.y+b.rect.h<=a.rect.y);
    }
  }
});

test('real movement selects separate walk and run poses, including held-run and double-tap sprint',()=>{
  for(const quick of ['held','doubleTap']){
    const g=new Game({random:()=>.5});g.start({mode:'local'});g.phase='fight';g.platforms=[];const [a,b]=g.fighters;a.x=700;b.x=2000;
    const walk=new Set(),run=new Set();const tick=held=>g.tick(1/60,[{held:new Set(held),pressed:new Set()}, {held:new Set(),pressed:new Set()}]);
    for(let n=0;n<30;n++){tick(['right']);walk.add(Renderer.prototype.pose(a));}
    for(let n=0;n<20;n++)tick([]);
    if(quick==='doubleTap'){tick(['right']);tick([]);tick(['right']);}
    for(let n=0;n<30;n++){tick(quick==='held'?['right','run']:['right']);run.add(Renderer.prototype.pose(a));}
    assert.ok(walk.size>=4);assert.ok(run.size>=4);assert.ok([...walk].every(frame=>ANIMATION_FRAMES.walk.includes(frame)));
    assert.ok([...run].every(frame=>ANIMATION_FRAMES.run.includes(frame)),quick);assert.ok(a.runPhase>0);
    a.x=WORLD.right;a.vx=0;const phase=a.runPhase;for(let n=0;n<15;n++)tick(['right','run']);assert.equal(a.runPhase,phase);
  }
});
