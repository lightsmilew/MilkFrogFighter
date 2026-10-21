import {shareGame,gameShareUrl,canShareFile,shareImage} from './share.js';
import {setScreenIcon} from './screen-icons.js';
import {styleOf,moveFor} from './styles.js';
import {blinkStatus} from './hud.js';
import { CHARACTERS, COMMANDS, STAGES, stageById } from './config.js';
import { Game } from './engine.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { ArcadeAudio } from './audio.js';
import { FullscreenController } from './fullscreen.js';
import {assetUrl} from './asset-urls.js';
import {registerAssetCache,rememberLoadedAssets} from './asset-cache.js';

registerAssetCache();

const $ = id => document.getElementById(id);
const readStorage = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const saveStorage = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing/storage quota must not interrupt a match. */ } };
const isCoarse = matchMedia('(pointer: coarse)').matches;
const portraitQuery = matchMedia('(orientation: portrait)');
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const storedSettings = readStorage('milkfrog-settings', {});
delete storedSettings.scanlines;
const settings = { volume: 42, music: true, shake: !reducedMotion, touch: isCoarse, muted: false, ...storedSettings };
const record = { wins: 0, losses: 0, ...readStorage('milkfrog-record', {}) };
const state = {screen:'home',launchId:0, mode: 'ai', p1: 'classic', p2: 'green', stage:stageById(readStorage('milkfrog-stage','street')).id,player: 0, active: false, paused: false, loading: true, dummyGuard: false };
const audio = new ArcadeAudio();
audio.armGestureUnlock();
export { audio };
const renderer = new Renderer($('game'));
export const fullscreen=new FullscreenController($('arcade'),active=>{
  const wasExpanded=$('arcade').classList.contains('is-expanded');
  $('arcade').classList.toggle('is-expanded',active);
  setScreenIcon($('fullscreen-button'),active?'collapse':'expand',active?'退出全屏':'切换全屏');
  $('fullscreen-button').setAttribute('aria-pressed',String(active));
  updateRotateHint();
  if(wasExpanded&&!active&&state.active&&!state.paused)setPaused(true);
},{onUnavailable:showFullscreenTip});
let toastTimer = null;
let lastEnergyNotice = -1000;

/** iPhone Safari has no element fullscreen, so the in-page immersion mode is
 *  as close as a tab can get: explain the one-time upgrade instead of letting
 *  the player think the button is broken. */
let tipTimer = null;
function showFullscreenTip(){
  if(!isIOS||isStandalone)return;
  // Landscape already uses the whole height for the arena; the card would sit
  // on top of the health bars, so only explain this in portrait.
  if(!portraitQuery.matches)return;
  if(readStorage('milkfrog-fullscreen-tip',false))return;
  const tip=$('fullscreen-tip');if(!tip)return;
  saveStorage('milkfrog-fullscreen-tip',true);
  tip.hidden=false;
  requestAnimationFrame(()=>tip.classList.add('is-visible'));
  clearTimeout(tipTimer);tipTimer=setTimeout(hideFullscreenTip,12000);
}
function hideFullscreenTip(){
  const tip=$('fullscreen-tip');if(!tip)return;
  clearTimeout(tipTimer);
  tip.classList.remove('is-visible');tip.hidden=true;
}
function dismissFullscreenTip(){
  hideFullscreenTip();
  saveStorage('milkfrog-fullscreen-tip',true);
}

/** Landscape gives the two thumbs more space while the arena fills either
 *  orientation without changing the fighters' proportions. */
function updateRotateHint(){
  const hint=$('rotate-hint');if(!hint)return;
  hint.hidden=!(fullscreen.active&&portraitQuery.matches&&isCoarse);
  if(!portraitQuery.matches)hideFullscreenTip();
}

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
  if(code==='Escape'&&fullscreen.active){fullscreen.exit();return true;}
  if(code==='Escape'||code==='KeyP') {
    if(state.active){setPaused(!state.paused);return true;}
    if(code==='Escape'&&state.screen==='setup'){home();return true;}
  }
  if(code==='Enter') {
    if([...document.querySelectorAll('dialog')].some(dialog=>dialog.open))return false;
    if(!$('result-overlay').hidden){start();return true;}
    if(state.paused){setPaused(false);return true;}
    if(!state.active){if(state.screen==='home')openSetup();else start();return true;}
  }
  return false;
});
input.bindTouch($('touch-controls'));
const touchBlink=document.querySelector('[data-action="blink"]'),blinkLabel=document.querySelector('[data-blink-label]'),blinkTracks=[...document.querySelectorAll('[data-blink-charge]')];

function renderRoster() {
  $('roster').innerHTML = CHARACTERS.map((character,index) => `
    <button class="fighter-card ${state.p1===character.id?'selected-p1':''} ${state.p2===character.id?'selected-p2':''}" data-character="${character.id}" aria-label="选择${character.name}。${character.description}" aria-pressed="${(state.player===0?state.p1:state.p2)===character.id}" ${state.screen!=='setup'||state.active||state.starting||game.phase==='matchOver'?'disabled':''}>
      <canvas class="fighter-portrait" width="320" height="340" data-portrait="${character.id}" aria-hidden="true"></canvas>
      <div class="fighter-info"><span class="fighter-number">0${index+1} / ${['BALANCED','RUSH DOWN','POWER','CONTROL','CHARM','FROST'][index]}</span><h3>${character.name}</h3><p class="fighter-tagline">${character.title}</p><span class="fighter-skill">${styleOf(character).name} · ${moveFor(character,'special').name} ↗</span></div>
      <div class="selection-tags">${state.p1===character.id?'<span class="selection-tag">P1</span>':''}${state.p2===character.id?`<span class="selection-tag cpu">${state.mode==='local'?'P2':state.mode==='practice'?'木桩':'人机'}</span>`:''}</div>
    </button>`).join('');
  $('roster').querySelectorAll('[data-character]').forEach(button=>button.addEventListener('click',()=>{
    if(state.screen!=='setup'||state.active||state.starting||game.phase==='matchOver')return;
    state[state.player===0?'p1':'p2']=button.dataset.character;
    audio.unlock().then(()=>audio.sfx('select'));
    renderer.ensureFighter(button.dataset.character);game.preview(state.p1,state.p2,state.stage);renderRoster();
  }));
  const notes=$('fighter-notes');if(notes)notes.innerHTML=[state.p1,state.p2].map((id,i)=>{const style=styleOf(id),character=CHARACTERS.find(c=>c.id===id);return `<article style="--accent:${character.accent}"><small>${i?'对手':'你的流派'} / ${style.name}</small><strong>${character.name}</strong><p>${style.mechanic}</p><code>${style.recipe}</code></article>`;}).join('');
  drawPortraits();updateSetupSummary();
}

function drawPortraits() {
  document.querySelectorAll('[data-portrait]').forEach(canvas=>renderer.drawPortrait(canvas,CHARACTERS.find(character=>character.id===canvas.dataset.portrait)));
}

function updateRecord() { $('record-label').textContent=`本地战绩 ${record.wins} 胜 / ${record.losses} 负`; }

function renderStages(){
  $('stage-options').innerHTML=STAGES.map(stage=>`<button class="stage-option ${state.stage===stage.id?'selected':''}" data-stage="${stage.id}" aria-pressed="${state.stage===stage.id}" ${state.starting?'disabled':''}><img ${state.loading&&state.screen!=='setup'?'data-src':'src'}="${assetUrl(stage.thumbnail)}" width="384" height="154" loading="lazy" decoding="async" fetchpriority="low" alt=""><span><strong>${stage.name}</strong><small>${stage.subtitle}</small></span><b aria-hidden="true">${state.stage===stage.id?'●':'○'}</b></button>`).join('');
  $('stage-options').querySelectorAll('[data-stage]').forEach(button=>button.addEventListener('click',()=>{
    if(state.active||state.starting)return;state.stage=button.dataset.stage;saveStorage('milkfrog-stage',state.stage);renderer.ensureStage(state.stage);game.preview(state.p1,state.p2,state.stage);renderStages();
  }));
  $('stage-label-text').textContent=stageById(state.stage).name;updateSetupSummary();
}

function updateSetupSummary(){
  const name=id=>CHARACTERS.find(c=>c.id===id).name,mode={ai:'人机对战',local:'同屏双人',practice:'自由练习'}[state.mode];
  const level=$('difficulty').selectedOptions[0].textContent.split('·').at(-1).trim();
  $('setup-summary').textContent=`${name(state.p1)}　VS　${name(state.p2)}`;
  $('setup-summary-detail').textContent=`${mode}${state.mode==='ai'?` · ${level}`:''} · ${stageById(state.stage).name}`;
  $('match-summary').textContent=$('setup-summary-detail').textContent;
}

function showScreen(screen){
  state.screen=screen;document.body.dataset.screen=screen;
  $('setup-panel').hidden=screen!=='setup';
  for(const id of ['roster-section','setup-guide','site-footer'])$(id).hidden=screen==='match';
  $('arcade').hidden=false;$('home-overlay').hidden=screen!=='home';
  $('match-toolbar').hidden=false;$('match-info').hidden=screen!=='match';
  $('touch-controls').hidden=screen!=='match'||!state.active||!settings.touch;
}

function updateMode() {
  const descriptions={ai:'人机对战 · 三局两胜 · 每局 90 秒',local:'同屏双人 · 三局两胜 · 每局 90 秒',practice:'自由练习 · 无限奶气 · 无限时间'};
  $('mode-description').textContent=descriptions[state.mode];
  $('p2-select-label').textContent=state.mode==='local'?'P2 选手':state.mode==='practice'?'练习木桩':'人机对手';
  $('record-label').hidden=state.mode!=='ai';
  $('practice-tools').hidden=state.mode!=='practice'||!state.active;
  $('difficulty').disabled=state.mode!=='ai'||state.active||state.starting||game.phase==='matchOver';
  $('setup-mode-note').textContent={ai:'三局两胜，每局 90 秒。',local:'三局两胜；单个触屏面板只能操作 P1。',practice:'无限时间、无限奶气，木桩脱离连击后回满体力。'}[state.mode];
  $('fight-button').disabled=state.loading||Boolean(state.starting);
  $('fight-button').innerHTML=state.starting?'正在上擂台…':'就这局，开打 <span aria-hidden="true">↗</span>';
  $('touch-controls').hidden=state.screen!=='match'||!state.active||!settings.touch;
  $('dummy-button').textContent=`木桩：${state.dummyGuard?'格挡':'站立'}`;
  document.querySelectorAll('[data-mode]').forEach(button=>{
    const active=button.dataset.mode===state.mode;
    button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    button.disabled=state.screen!=='setup'||state.active||state.starting||game.phase==='matchOver';
  });
  document.querySelectorAll('[data-player]').forEach(button=>{
    const active=Number(button.dataset.player)===state.player;
    button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    button.disabled=state.screen!=='setup'||state.active||state.starting||game.phase==='matchOver';
  });
  $('roster-hint').firstChild.textContent=state.screen==='home'?'街坊先认个脸，投币进入选关后可以更换角色。':state.active?'正在切磋中，回到选关后可以重新选蛙。':`正在为${state.player===0?' P1 ':state.mode==='ai'?'人机对手':state.mode==='practice'?'练习木桩':' P2 '}选角色。`;
  $('roster-section').classList.toggle('roster-preview',state.screen==='home');
  document.querySelectorAll('[data-character]').forEach(button=>button.disabled=state.screen!=='setup'||state.starting);
  $('setup-difficulty-pane').hidden=state.mode!=='ai';
  updateSetupSummary();
}

function openSetup(){
  const leavingMatch=state.screen==='match';
  state.launchId++;state.starting=false;state.active=false;state.paused=false;
  if(leavingMatch&&fullscreen.active)fullscreen.exit();
  document.body.classList.remove('in-match','is-paused','match-ended');
  input.enabled=false;input.clear();game.toAttract();game.preview(state.p1,state.p2,state.stage);audio.setActive(false);
  $('pause-overlay').hidden=true;$('result-overlay').hidden=true;$('pause-button').hidden=true;
  showScreen('setup');updateMode();renderRoster();renderStages();
  window.scrollTo({top:0,behavior:'instant'});$('setup-heading').focus({preventScroll:true});
  audio.unlock();audio.whenRunning(()=>audio.sfx('select'));
}

function home(){
  state.launchId++;state.starting=false;state.active=false;state.paused=false;
  document.body.classList.remove('in-match','is-paused','match-ended');
  input.enabled=false;input.clear();game.toAttract();game.preview(state.p1,state.p2,state.stage);audio.setActive(false);
  $('pause-overlay').hidden=true;$('result-overlay').hidden=true;
  showScreen('home');updateMode();renderRoster();window.scrollTo({top:0,behavior:'instant'});$('start-button').focus({preventScroll:true});
}

async function start() {
  if(state.screen==='home'){openSetup();return;}
  if(state.loading){$('setup-loading').textContent='奶蛙正在热身，马上就好。';return;}
  if(state.starting)return;state.starting=true;
  const launchId=++state.launchId;updateMode();renderRoster();renderStages();
  // Unlock audio before any await: iPhone only starts Web Audio while the tap
  // is being handled, and asset await would push this outside the gesture.
  audio.unlock();audio.whenRunning(()=>audio.sfx('start'));
  try{await Promise.all([renderer.ensureFighter(state.p1),renderer.ensureFighter(state.p2)]);}
  finally{if(launchId===state.launchId)state.starting=false;}
  if(launchId!==state.launchId)return;
  state.active=true;state.paused=false;
  document.body.classList.remove('is-paused','match-ended');
  document.body.classList.add('in-match');
  showScreen('match');
  input.clear();input.enabled=true;
  $('home-overlay').hidden=true;$('pause-overlay').hidden=true;$('result-overlay').hidden=true;
  $('pause-button').hidden=false;$('stage-label').hidden=true;
  setScreenIcon($('pause-button'),'pause','暂停游戏');$('pause-button').setAttribute('aria-pressed','false');
  game.start({p1:state.p1,p2:state.p2,stage:state.stage,mode:state.mode,difficulty:$('difficulty').value,practiceGuard:state.dummyGuard});
  audio.setActive(true);
  updateMode();renderRoster();updateRotateHint();
  if(isStandalone&&isCoarse&&!fullscreen.active){fullscreen.enterPseudo();fullscreen.handleChange();}
  $('game').focus({preventScroll:true});
  if(!fullscreen.active)$('arcade').scrollIntoView({block:'start',behavior:'instant'});
  if(state.mode==='local'&&settings.touch)toast('双人请用键盘或两只手柄，触屏按键控制 P1。');
}

function setPaused(paused) {
  if(!state.active)return;
  state.paused=paused;input.clear();input.enabled=!paused;
  document.body.classList.toggle('is-paused',paused);
  $('pause-overlay').hidden=!paused;
  setScreenIcon($('pause-button'),paused?'play':'pause',paused?'继续游戏':'暂停游戏');
  $('pause-button').setAttribute('aria-pressed',String(paused));
  audio.setActive(!paused);
  if(!paused)$('game').focus({preventScroll:true});
}

function lobby() {
  openSetup();
}

function finishMatch(winner) {
  state.active=false;input.enabled=false;input.clear();audio.setActive(false);
  document.body.classList.add('match-ended');
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
  $('touch-controls').hidden=!settings.touch||state.screen!=='match'||!state.active;
  $('volume').value=settings.volume;$('volume-label').textContent=`${settings.volume}%`;
  $('music').checked=Boolean(settings.music);$('shake').checked=Boolean(settings.shake);$('touch-setting').checked=Boolean(settings.touch);
  $('sound-button').querySelector('[data-tool-label]').textContent=settings.muted?'静音':'声音';
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

$('start-button').addEventListener('click',openSetup);
$('fight-button').addEventListener('click',start);
$('home-button').addEventListener('click',home);
$('setup-roster-link').addEventListener('click',()=>$('roster-section').scrollIntoView({block:'start',behavior:reducedMotion?'instant':'smooth'}));
$('difficulty').addEventListener('change',()=>{saveStorage('milkfrog-difficulty',$('difficulty').value);updateSetupSummary();});
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
let shareAsset=null,shareKey='',shareObjectUrl=null;
$('share-button').addEventListener('click',()=>{
  const url=gameShareUrl(location.href),character=CHARACTERS.find(c=>c.id===state.p1),key=url+'|'+state.p1;
  $('share-link').value=url;openDialog('share-dialog');
  $('native-share-link').hidden=typeof navigator.share!=='function';
  $('share-status').textContent=typeof navigator.share==='function'?'选择链接或二维码图片分享。':'当前浏览器未开放系统分享，可复制链接或保存二维码图片。';
  if(shareKey===key&&shareAsset){$('native-share-image').hidden=!canShareFile(shareAsset.file);return;}
  shareKey=key;shareAsset=null;$('share-card-image').hidden=true;$('share-card-loading').hidden=false;
  $('share-card-loading').textContent='正在准备二维码图片…';$('native-share-image').disabled=true;$('save-share-image').removeAttribute('href');$('save-share-image').setAttribute('aria-disabled','true');
  const portrait=renderer.variants.get(state.p1)?.[20]?.canvas||renderer.portraits.get(state.p1)?.canvas;
  const shareModule=new URL(typeof __SHARE_CARD_URL__==='undefined'?'./share-card.js':__SHARE_CARD_URL__,import.meta.url).href;
  import(shareModule).then(module=>module.createShareCard(url,{name:character.name,accent:character.accent,portrait})).then(asset=>{
    if(shareKey!==key)return;
    if(shareObjectUrl)URL.revokeObjectURL(shareObjectUrl);
    shareAsset=asset;shareObjectUrl=URL.createObjectURL(asset.blob);
    $('share-card-image').src=shareObjectUrl;$('share-card-image').hidden=false;$('share-card-loading').hidden=true;
    $('save-share-image').href=shareObjectUrl;$('save-share-image').removeAttribute('aria-disabled');
    $('native-share-image').disabled=false;$('native-share-image').hidden=!canShareFile(asset.file);
  }).catch(()=>{$('share-card-loading').textContent='二维码图片暂时未能生成，请重试分享或先复制链接。';shareKey='';});
});
$('native-share-link').addEventListener('click',async()=>{
  // Invoke shareGame immediately in this new tap; image preparation is separate
  // so iOS transient user activation is never spent waiting for PNG encoding.
  const result=await shareGame(location.href);
  if(result.status==='cancelled')return;
  $('share-status').textContent=result.status==='shared'?'已打开系统分享。':result.status==='copied'?'系统分享不可用，链接已复制。':'系统分享不可用，可手动复制链接或保存二维码图片。';
});
$('native-share-image').addEventListener('click',async()=>{
  if(!shareAsset)return;
  const result=await shareImage(shareAsset.file);
  if(result.status==='cancelled')return;
  $('share-status').textContent=result.status==='shared'?'已打开图片分享。':'图片分享不可用，请保存图片后发送。';
});
$('copy-share-link').addEventListener('click',async()=>{
  const link=$('share-link');link.value=gameShareUrl(location.href);
  try{await navigator.clipboard.writeText(link.value);$('share-status').textContent='链接已复制，发给朋友吧。';}
  catch{link.focus();link.select();$('share-status').textContent='链接已选中，长按或使用复制快捷键。';}
});

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
  if(state.screen!=='setup'||state.active||state.starting||game.phase==='matchOver')return;
  state.mode=button.dataset.mode;updateMode();renderRoster();
  audio.unlock().then(()=>audio.sfx('select'));
}));
document.querySelectorAll('[data-player]').forEach(button=>button.addEventListener('click',()=>{
  if(state.screen!=='setup'||state.active||state.starting||game.phase==='matchOver')return;
  state.player=Number(button.dataset.player);updateMode();renderRoster();
}));
$('dummy-button').addEventListener('click',()=>{state.dummyGuard=!state.dummyGuard;game.practiceGuard=state.dummyGuard;updateMode();input.clear();});
$('practice-reset').addEventListener('click',()=>{game.newRound();input.clear();});
setScreenIcon($('fullscreen-button'),'expand','切换全屏');
setScreenIcon($('pause-button'),'pause','暂停游戏');
$('fullscreen-button').addEventListener('click',()=>fullscreen.toggle());
$('fullscreen-tip-close')?.addEventListener('click',dismissFullscreenTip);
portraitQuery.addEventListener?.('change',updateRotateHint);
window.addEventListener('resize',updateRotateHint);
window.addEventListener('orientationchange',()=>setTimeout(updateRotateHint,120));
if(isIOS){$('ios-audio-note')?.removeAttribute('hidden');}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.active&&!state.paused)setPaused(true);});
window.addEventListener('blur',()=>{if(state.active&&!state.paused)setPaused(true);});

$('special-list').innerHTML=CHARACTERS.map(character=>{const style=styleOf(character);return `<details style="--accent:${character.accent}"><summary><strong>${character.name} · ${style.name}</strong><span>${moveFor(character,'special').name}</span></summary><p>${style.mechanic}</p><p><b>推荐连招</b>　${style.recipe}</p><dl>${[['L','special'],['前 L','rushSkill'],['下 L','pulse'],['后 L','stance'],['↓ 前 L','powerWave'],['I','super'],['前 I','superRush'],['下 I','superRise'],['后 I','superStorm'],['跳跃 I','airSuper']].map(([key,slot])=>`<div><dt>${key}</dt><dd>${moveFor(character,slot).name}</dd></div>`).join('')}</dl></details>`;}).join('');
$('command-list').innerHTML=COMMANDS.map(command=>`<li><code>${command.keys}</code><div><strong>${command.name}</strong><p>${command.detail}</p></div></li>`).join('');
$('difficulty').value=['easy','normal','hard'].includes(readStorage('milkfrog-difficulty','normal'))?readStorage('milkfrog-difficulty','normal'):'normal';
$('start-button').disabled=false;
applySettings();updateRecord();updateMode();renderRoster();renderStages();game.preview(state.p1,state.p2,state.stage);

renderer.onAssetsUpdated=drawPortraits;
renderer.ready.then(errors=>{
  performance.mark('milkfrog-ready');
  window.dispatchEvent(new Event('milkfrog:ready'));
  rememberLoadedAssets();
  const warm=()=>renderer.ensureStage(state.stage);
  if('requestIdleCallback' in window)requestIdleCallback(warm,{timeout:1000});else setTimeout(warm,50);
  state.loading=false;updateMode();$('setup-loading').hidden=true;drawPortraits();
  document.querySelectorAll('#stage-options img[data-src]').forEach(image=>{image.src=image.dataset.src;delete image.dataset.src;});
  $('loading-hint').hidden=true;
  if(errors.length){$('loading-hint').hidden=false;$('loading-hint').textContent='部分美术加载失败，基础画面仍可开打。';console.warn(errors.join('\n'));}
});

let lastTime=performance.now(),accumulator=0;
function frame(now){
  renderer.syncViewport(game);
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
  if(state.screen!=='setup')renderer.render(game);
  const fighter=game.fighters[0],blink=blinkStatus(fighter);
  if(blinkLabel){const label=blink.charges===blink.total?'':`${fighter.blinkRecharge.toFixed(1)}s`;if(blinkLabel.textContent!==label)blinkLabel.textContent=label;const description=`闪移剩余 ${blink.charges} 次`+(blink.charges<2?`，下次恢复 ${fighter.blinkRecharge.toFixed(1)} 秒`:'');if(touchBlink.getAttribute('aria-label')!==description)touchBlink.setAttribute('aria-label',description);}
  blinkTracks.forEach((track,i)=>{const progress=blink.slots[i].progress.toFixed(3);if(track.style.getPropertyValue('--charge')!==progress)track.style.setProperty('--charge',progress);track.classList.toggle('is-ready',blink.slots[i].ready);});
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
