import {Game} from '../src/engine.js';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('artifacts',{recursive:true});
const results=[];const ids=['classic','green','red','purple','pink','blue'];
for(const difficulty of ['easy','normal','hard']){
 let wins=0,combos=[],times=[],hits=[],blinks=[];
 for(let seed=1;seed<=18;seed++){
  let value=seed;const random=()=>{value=(value*1664525+1013904223)>>>0;return value/4294967296;};
  const game=new Game({random});game.start({mode:'ai',difficulty,p1:'classic',p2:ids[(seed-1)%6]});
  for(let n=0;n<60*96&&game.phase!=='roundOver';n++){
   const [a,b]=game.fighters,distance=Math.abs(a.x-b.x),held=new Set(),pressed=new Set();
   if(distance>90){held.add(a.x<b.x?'right':'left');held.add('run');}
   if(n%13===0)pressed.add('jab');if(n%37===0)pressed.add('kick');if(n%71===0&&a.energy>=25){held.clear();pressed.add('special');}
   game.tick(1/60,[{held,pressed},{held:new Set(),pressed:new Set()}]);
  }
  if(game.lastWinner===1)wins++;combos.push(game.matchStats[1].maxCombo);times.push(+game.time.toFixed(1));hits.push(game.matchStats[1].hits);blinks.push(game.fighters[1].aiStats.blinks);
 }
 results.push({difficulty,aiWins:wins,rounds:18,maxCombo:Math.max(...combos),totalBlinks:blinks.reduce((a,b)=>a+b,0),averageBlinks:+(blinks.reduce((a,b)=>a+b,0)/18).toFixed(1),averageCombo:+(combos.reduce((a,b)=>a+b,0)/18).toFixed(1),times,averageHits:+(hits.reduce((a,b)=>a+b,0)/18).toFixed(1)});
}
await writeFile('artifacts/ai-benchmark.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
