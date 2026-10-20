import {styleOf,moveFor} from './styles.js';
import { CHARACTERS, COMMANDS, STAGES, stageById } from './config.js';
import { Game } from './engine.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { ArcadeAudio } from './audio.js';
import { FullscreenController } from './fullscreen.js';

const $ = id => document.getElementById(id);
const readStorage = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const saveStorage = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing/storage quota must not interrupt a match. */ } };
const isCoarse = matchMedia('(pointer: coarse)').matches;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const storedSettings = readStorage('milkfrog-settings', {});
delete storedSettings.scanlines;
const settings = { volume: 42, music: true, shake: !reducedMotion, touch: isCoarse, muted: false, ...storedSettings };
const record = { wins: 0, losses: 0, ...readStorage('milkfrog-record', {}) };
const state = { mode: 'ai', p1: 'classic', p2: 'green', stage:stageById(readStorage('milkfrog-stage','street')).id,player: 0, active: false, paused: false, loading: true, dummyGuard: false };
const audio = new ArcadeAudio();
const renderer = new Renderer($('game'));
export const fullscreen=new FullscreenController($('arcade'),active=>{
  $('arcade').classList.toggle('is-expanded',active);
  $('fullscreen-button').textContent=active?'↙':'⛶';$('fullscreen-button').setAttribute('aria-label',active?'退出全屏':'切换全屏');
});
let toastTimer = null;
let lastEnergyNotice = -1000;

function toast(message) {
  $('game-toast').textContent = message;
  $('game-toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('game-toast').classList.remove('visible'), 1900);
}

export const game = new Game({ onEvent(event) {
  audio.sfx(event.type, event);
  if(event.type==='noEnergy'&&event.index===0&&performance.now()-lastEnergyNotice>1500){
    lastEnergyNotice=performance.now();toast('奶气还没攒够，先来两拳！');
  }
  if(event.type==='matchEnd') finishMatch(event.winner);
} });

const input = new Input(code => {
  if(code==='Escape'&&fullscreen.pseudo){fullscreen.exit();return true;}
  if(code==='Escape'||code==='KeyP') {
    if(state.active){setPaused(!state.paused);return true;}
  }
  if(code==='Enter') {
    if([...document.querySelectorAll('dialog')].some(dialog=>dialog.open))return false;
    if(!$('result-overlay').hidden){start();return true;}
    if(state.paused){setPaused(false);return true;}
    if(!state.active){start();return true;}
  }
  return false;
});
input.bindTouch($('touch-controls'));

function renderRoster() {
  $('roster').innerHTML = CHARACTERS.map((character,index) => `
    <button class="fighter-card ${state.p1===character.id?'selected-p1':''} ${state.p2===character.id?'selected-p2':''}" data-character="${character.id}" aria-label="选择${character.name}。${character.description}" aria-pressed="${(state.player===0?state.p1:state.p2)===character.id}" ${state.active||game.phase==='matchOver'?'disabled':''}>
      <canvas class="fighter-portrait" width="320" height="340" data-portrait="${character.id}" aria-hidden="true"></canvas>
      <div class="fighter-info"><span class="fighter-number">0${index+1} / ${['BALANCED','RUSH DOWN','POWER','CONTROL','CHARM','FROST'][index]}</span><h3>${character.name}</h3><p class="fighter-tagline">${character.title}</p><span class="fighter-skill">${styleOf(character).name} · ${moveFor(character,'special').name} ↗</span></div>
      <div class="selection-tags">${state.p1===character.id?'<span class="selection-tag">P1</span>':''}${state.p2===character.id?`<span class="selection-tag cpu">${state.mode==='local'?'P2':state.mode==='practice'?'木桩':'CPU'}</span>`:''}</div>
    </button>`).join('');
  $('roster').querySelectorAll('[data-character]').forEach(button=>button.addEventListener('click',()=>{
    if(state.active||game.phase==='matchOver')return;
    state[state.player===0?'p1':'p2']=button.dataset.character;
    audio.unlock().then(()=>audio.sfx('select'));
    renderer.ensureFighter(button.dataset.character);game.preview(state.p1,state.p2,state.stage);renderRoster();
  }));
  const notes=$('fighter-notes');if(notes)notes.innerHTML=[state.p1,state.p2].map((id,i)=>{const style=styleOf(id),character=CHARACTERS.find(c=>c.id===id);return `<article style="--accent:${character.accent}"><small>${i?'对手':'你的流派'} / ${style.name}</small><strong>${character.name}</strong><p>${style.mechanic}</p><code>${style.recipe}</code></article>`;}).join('');
  drawPortraits();
}

function drawPortraits() {
  document.querySelectorAll('[data-portrait]').forEach(canvas=>renderer.drawPortrait(canvas,CHARACTERS.find(character=>character.id===canvas.dataset.portrait)));
}

function updateRecord() { $('record-label').textContent=`本地战绩 ${record.wins} 胜 / ${record.losses} 负`; }

function renderStages(){
  $('stage-options').innerHTML=STAGES.map(stage=>`<button class="stage-option ${state.stage===stage.id?'selected':''}" data-stage="${stage.id}" aria-pressed="${state.stage===stage.id}"><img src="./assets/${stage.image.replace('.webp','-thumb.webp')}" width="384" height="154" loading="lazy" decoding="async" alt=""><span><strong>${stage.name}</strong><small>${stage.subtitle}</small></span><b aria-hidden="true">${state.stage===stage.id?'●':'○'}</b></button>`).join('');
  $('stage-options').querySelectorAll('[data-stage]').forEach(button=>button.addEventListener('click',()=>{
    if(state.active)return;state.stage=button.dataset.stage;saveStorage('milkfrog-stage',state.stage);renderer.ensureStage(state.stage);game.preview(state.p1,state.p2,state.stage);renderStages();
  }));
  $('stage-label-text').textContent=stageById(state.stage).name;
}

function updateMode() {
  const descriptions={ai:'人机对战 · 三局两胜 · 每局 90 秒',local:'同屏双人 · 三局两胜 · 每局 90 秒',practice:'自由练习 · 无限奶气 · 无限时间'};
  $('mode-description').textContent=descriptions[state.mode];
  $('p2-select-label').textContent=state.mode==='local'?'P2 选手':state.mode==='practice'?'练习木桩':'CPU 对手';
  $('difficulty').disabled=state.mode!=='ai'||state.active||game.phase==='matchOver';
  $('record-label').hidden=state.mode!=='ai';
  $('practice-tools').hidden=state.mode!=='practice'||!state.active;
  $('stage-picker').hidden=state.active||game.phase==='matchOver';
  $('dummy-button').textContent=`木桩：${state.dummyGuard?'格挡':'站立'}`;
  document.querySelectorAll('[data-mode]').forEach(button=>{
    const active=button.dataset.mode===state.mode;
    button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    button.disabled=state.active||game.phase==='matchOver';
  });
  document.querySelectorAll('[data-player]').forEach(button=>{
    const active=Number(button.dataset.player)===state.player;
    button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    button.disabled=state.active||game.phase==='matchOver';
  });
  $('roster-hint').firstChild.textContent=state.active?'正在切磋中，回到街角后可以重新选蛙。':'点选喜欢的奶蛙，开打之后就别后悔。';
}

async function start() {
  if(state.loading){toast('奶蛙正在热身，马上就好。');return;}
  $('start-button').disabled=true;await Promise.all([renderer.ensureFighter(state.p1),renderer.ensureFighter(state.p2)]);$('start-button').disabled=false;
  if(state.active)return;state.active=true;state.paused=false;
  document.body.classList.remove('is-paused');
  document.body.classList.add('in-match');
  input.clear();input.enabled=true;
  $('home-overlay').hidden=true;$('pause-overlay').hidden=true;$('result-overlay').hidden=true;
  $('pause-button').hidden=false;$('stage-label').hidden=true;
  game.start({p1:state.p1,p2:state.p2,stage:state.stage,mode:state.mode,difficulty:$('difficulty').value,practiceGuard:state.dummyGuard});
  audio.unlock().then(()=>{audio.sfx('start');audio.setActive(true);});
  updateMode();renderRoster();
  $('game').focus({preventScroll:true});
  if(state.mode==='local'&&settings.touch)toast('双人请用键盘或两只手柄，触屏按键控制 P1。');
}

function setPaused(paused) {
  if(!state.active)return;
  state.paused=paused;input.clear();input.enabled=!paused;
  document.body.classList.toggle('is-paused',paused);
  $('pause-overlay').hidden=!paused;
  $('pause-button').textContent=paused?'▶':'Ⅱ';
  $('pause-button').setAttribute('aria-label',paused?'继续游戏':'暂停游戏');
  audio.setActive(!paused);
  if(!paused)$('game').focus({preventScroll:true});
}

function lobby() {
  if(fullscreen.active)fullscreen.exit();
  state.active=false;state.paused=false;
  document.body.classList.remove('is-paused');
  document.body.classList.remove('in-match');
  input.enabled=false;input.clear();game.toAttract();game.preview(state.p1,state.p2,state.stage);
  $('home-overlay').hidden=false;$('pause-overlay').hidden=true;$('result-overlay').hidden=true;
  $('pause-button').hidden=true;$('stage-label').hidden=false;
  audio.setActive(false);updateMode();renderRoster();
  $('start-button').focus({preventScroll:true});
}

function finishMatch(winner) {
  state.active=false;input.enabled=false;input.clear();audio.setActive(false);
  const character=game.fighters[winner].character;
  $('result-title').textContent=state.mode==='local'?`P${winner+1} · 今日街霸！`:winner===0?'这条街，你说了算。':'这只蛙，有点东西。';
  $('result-detail').textContent=`${character.name} 拿下本场。${winner===0?'笑到最后的，果然是你。':'喝口奶，下一局再赢回来。'}`;
  $('result-score').textContent=`${game.wins[0]} : ${game.wins[1]}`;
  $('result-combo').textContent=String(Math.max(...game.matchStats.map(stats=>stats.maxCombo)));
  $('result-hits').textContent=String(game.matchStats[winner].hits);
  $('result-overlay').hidden=false;
  $('pause-overlay').hidden=true;$('pause-button').hidden=true;
  if(state.mode==='ai'){
    if(winner===0)record.wins++;else record.losses++;
    saveStorage('milkfrog-record',record);updateRecord();
  }
  updateMode();renderRoster();
}

function applySettings() {
  audio.volume=Math.max(0,Math.min(1,Number(settings.volume)/100));audio.music=Boolean(settings.music);audio.muted=Boolean(settings.muted);audio.applyVolume();
  renderer.shakeEnabled=Boolean(settings.shake);
  $('touch-controls').hidden=!settings.touch;
  $('volume').value=settings.volume;$('volume-label').textContent=`${settings.volume}%`;
  $('music').checked=Boolean(settings.music);$('shake').checked=Boolean(settings.shake);$('touch-setting').checked=Boolean(settings.touch);
  $('sound-button').textContent=settings.muted?'♩':'♪';
  $('sound-button').setAttribute('aria-pressed',String(settings.muted));
  $('sound-button').setAttribute('aria-label',settings.muted?'开启声音':'静音');
  $('sound-button').title=settings.muted?'开启声音':'静音';
  saveStorage('milkfrog-settings',settings);
}

function openDialog(id) {
  const dialog=$(id),wasPaused=state.paused,wasActive=state.active;
  if(wasActive){setPaused(true);$('pause-overlay').hidden=true;}
  dialog.showModal();
  const close=()=>{
    if(wasActive&&state.active){
      if(wasPaused)$('pause-overlay').hidden=false;
      else setPaused(false);
    }
  };
  dialog.addEventListener('close',close,{once:true});
}

$('start-button').addEventListener('click',start);
$('pause-button').addEventListener('click',()=>setPaused(!state.paused));
$('resume-button').addEventListener('click',()=>setPaused(false));
$('restart-button').addEventListener('click',start);
$('rematch-button').addEventListener('click',start);
$('lobby-button').addEventListener('click',lobby);
$('result-lobby-button').addEventListener('click',lobby);
$('help-button').addEventListener('click',()=>openDialog('help-dialog'));
$('guide-help').addEventListener('click',()=>openDialog('help-dialog'));
$('settings-button').addEventListener('click',()=>openDialog('settings-dialog'));
$('credits-button').addEventListener('click',()=>openDialog('credits-dialog'));
$('sound-button').addEventListener('click',()=>{
  settings.muted=!settings.muted;applySettings();
  audio.unlock().then(()=>{audio.sfx('select');if(state.active&&!state.paused)audio.setActive(true);});
});
async function previewLaugh(){
  settings.muted=false;applySettings();
  const played=await audio.playLaugh(4);
  if(!played)toast('经典笑声未能加载，请刷新后重试。');
}
$('laugh-preview').addEventListener('click',previewLaugh);
$('laugh-test').addEventListener('click',previewLaugh);
$('volume').addEventListener('input',()=>{settings.volume=Number($('volume').value);applySettings();audio.unlock();});
for(const [id,key] of [['music','music'],['shake','shake'],['touch-setting','touch']]){
  $(id).addEventListener('change',()=>{settings[key]=$(id).checked;applySettings();audio.setActive(state.active&&!state.paused);});
}
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{
  if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}
}));
document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{
  if(state.active||game.phase==='matchOver')return;
  state.mode=button.dataset.mode;updateMode();renderRoster();
  audio.unlock().then(()=>audio.sfx('select'));
}));
document.querySelectorAll('[data-player]').forEach(button=>button.addEventListener('click',()=>{
  if(state.active||game.phase==='matchOver')return;
  state.player=Number(button.dataset.player);updateMode();renderRoster();
}));
$('dummy-button').addEventListener('click',()=>{state.dummyGuard=!state.dummyGuard;game.practiceGuard=state.dummyGuard;updateMode();input.clear();});
$('practice-reset').addEventListener('click',()=>{game.newRound();input.clear();});
$('fullscreen-button').addEventListener('click',()=>fullscreen.toggle());
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.active&&!state.paused)setPaused(true);});
window.addEventListener('blur',()=>{if(state.active&&!state.paused)setPaused(true);});

$('special-list').innerHTML=CHARACTERS.map(character=>{const style=styleOf(character);return `<details style="--accent:${character.accent}"><summary><strong>${character.name} · ${style.name}</strong><span>${moveFor(character,'special').name}</span></summary><p>${style.mechanic}</p><p><b>推荐连招</b>　${style.recipe}</p><dl>${[['L','special'],['前 L','rushSkill'],['下 L','pulse'],['后 L','stance'],['↓ 前 L','powerWave'],['I','super'],['前 I','superRush'],['下 I','superRise'],['后 I','superStorm']].map(([key,slot])=>`<div><dt>${key}</dt><dd>${moveFor(character,slot).name}</dd></div>`).join('')}</dl></details>`;}).join('');
$('command-list').innerHTML=COMMANDS.map(command=>`<li><code>${command.keys}</code><div><strong>${command.name}</strong><p>${command.detail}</p></div></li>`).join('');
$('start-button').disabled=true;
applySettings();updateRecord();updateMode();renderRoster();renderStages();game.preview(state.p1,state.p2,state.stage);

renderer.onAssetsUpdated=drawPortraits;
renderer.ready.then(errors=>{
  performance.mark('milkfrog-ready');
  const warm=()=>renderer.ensureStage(state.stage);
  if('requestIdleCallback' in window)requestIdleCallback(warm,{timeout:1000});else setTimeout(warm,50);
  state.loading=false;$('start-button').disabled=false;drawPortraits();
  $('loading-hint').hidden=true;
  if(errors.length){$('loading-hint').hidden=false;$('loading-hint').textContent='部分美术加载失败，基础画面仍可开打。';console.warn(errors.join('\n'));}
});

let lastTime=performance.now(),accumulator=0;
function frame(now){
  const elapsed=Math.min(.1,(now-lastTime)/1000);lastTime=now;
  if(!state.paused){
    accumulator+=elapsed;
    while(accumulator>=1/60){
      const inputs=state.active?input.read():undefined;
      // Input edges are consumed once per fixed simulation step. Held keys
      // remain present during catch-up frames without repeating the press.
      game.tick(1/60,inputs);accumulator-=1/60;
    }
  }else accumulator=0;
  renderer.render(game);
  const blinkLabel=document.querySelector('[data-blink-label]'),fighter=game.fighters[0];
  if(blinkLabel){const label=fighter.blinkCharges>0?`${fighter.blinkCharges}/2`:`${fighter.blinkRecharge.toFixed(1)}s`;if(blinkLabel.textContent!==label)blinkLabel.textContent=label;}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
