import { WORLD, PLATFORMS, CHARACTERS, stageById, isSuperMove, isSkillMove } from './config.js';
import {FRAME_DATA} from '../assets/fighters/frames.js';
import {styleOf} from './styles.js';
import {attackMotion,stylePose,drawAttackVfx,drawTechnique,drawRichEffect} from './vfx.js';
import {updateCamera} from './camera.js';

const FONT = '"Microsoft YaHei", "PingFang SC", sans-serif';
const MONO = 'Consolas, monospace';
const INK = '#263d34';
const S=WORLD.fighterScale;

function hudMetrics(pixelScale){
  const nameFont=Math.max(22,12/pixelScale),nameY=Math.max(39,nameFont+7);
  const hpY=nameY+13,hpH=Math.max(28,16/pixelScale),milkY=hpY+hpH+2,milkH=Math.max(16,10/pixelScale);
  const noteY=milkY+milkH+Math.max(19,11/pixelScale);
  return {nameFont,nameY,hpY,hpH,milkY,milkH,noteY,comboY:Math.max(225,noteY+70)};
}

function imageAsset(name,priority='auto') {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding='async';image.fetchPriority=priority;
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`无法加载素材：${name}`));
    image.src = new URL(`../assets/${name}`, import.meta.url).href;
  });
}

function rounded(ctx, x, y, width, height, radius = 4) {
  ctx.beginPath(); ctx.roundRect(x, y, width, height, radius);
}

function paintPanorama(ctx,image,stage){
  const height=stage.imageBottom-stage.imageTop;
  // Preserve pixel proportions, with cloud/paving bleed for extreme viewports.
  ctx.save();ctx.translate(0,stage.imageTop);ctx.scale(1,-1);
  ctx.drawImage(image,0,0,image.width,image.height*.35,0,0,WORLD.arenaWidth,height*.35);ctx.restore();
  ctx.drawImage(image,0,stage.imageTop,WORLD.arenaWidth,height);
  ctx.save();ctx.translate(0,stage.imageBottom);ctx.scale(1,-1);
  ctx.drawImage(image,0,image.height*.8,image.width,image.height*.2,0,-height*.2,WORLD.arenaWidth,height*.2);ctx.restore();
}

function ellipse(ctx, x, y, rx, ry, fill, stroke = null, line = 3) {
  ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);
  ctx.fillStyle=fill;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.variants = new Map();this.portraits=new Map();this.packs=new Map();this.stageLoads=new Map();this.assetErrors=[];
    this.shakeEnabled = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.touchHud=matchMedia('(pointer:coarse)').matches;
    this.viewport={width:WORLD.width,height:WORLD.height};
    this.resizeObserver=new ResizeObserver(()=>{this.needsResize=true;});
    this.resizeObserver.observe(canvas);this.needsResize=true;
    this.ready = this.load();
  }

  syncViewport(game){
    if(this.needsResize){
      this.needsResize=false;
      const rect=this.canvas.getBoundingClientRect();
      if(rect.width>0&&rect.height>0){
        const aspect=rect.width/rect.height;
        this.viewport=aspect>=16/9?{width:720*aspect,height:720}:{width:1280,height:1280/aspect};
        // One uniform scale preserves round bodies. Wider screens reveal more
        // world instead of stretching the fighters or retaining side bars.
        const density=Math.min(2,devicePixelRatio||1);
        this.canvas.width=Math.round(rect.width*density);this.canvas.height=Math.round(rect.height*density);
        const cabinet=this.canvas.closest('.is-expanded'),style=cabinet&&getComputedStyle(cabinet),unit=this.viewport.width/rect.width;
        this.hudInset={left:style?(parseFloat(style.getPropertyValue('--safe-left'))||0)*unit:0,right:style?(parseFloat(style.getPropertyValue('--safe-right'))||0)*unit:0,top:style?(parseFloat(style.getPropertyValue('--safe-top'))||0)*unit:0};
        this.hudLayout=hudMetrics(rect.width/this.viewport.width);
      }
    }
    const {width,height}=this.viewport;
    const safeTop=(this.hudLayout?.noteY||131)+55+(this.hudInset?.top||0);
    if(game.camera.viewportWidth!==width||game.camera.viewportHeight!==height||game.camera.safeTop!==safeTop){
      Object.assign(game.camera,{viewportWidth:width,viewportHeight:height,safeTop});
      updateCamera(game.camera,game.fighters,0,true);
    }
  }

  async load() {
    imageAsset('fighters/portraits.webp','low').then(image=>{
      CHARACTERS.forEach((character,i)=>{const canvas=document.createElement('canvas');canvas.width=192;canvas.height=192;canvas.getContext('2d').drawImage(image,i*192,0,192,192,0,0,192,192);this.portraits.set(character.id,{...FRAME_DATA[character.id][20],canvas});});
      this.onAssetsUpdated?.();
    }).catch(error=>this.assetErrors.push(error.message));
    imageAsset('milk-lobby.webp','low').then(image=>{this.background=image;}).catch(error=>this.assetErrors.push(error.message));
    await Promise.allSettled(['classic','green'].map(id=>this.ensureFighter(id)));
    return this.assetErrors;
  }

  ensureFighter(id){
    if(this.packs.has(id))return this.packs.get(id);
    const promise=imageAsset(`fighters/${id}.webp`,'high').then(image=>{
      const frames=FRAME_DATA[id].map((data,i)=>{
        const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
        canvas.getContext('2d').drawImage(image,i%8*256,Math.floor(i/8)*256,256,256,0,0,256,256);
        return {...data,canvas};
      });
      this.variants.set(id,frames);
      if(id==='classic'){this.frames=frames;this.sprites=image;this.advanced=true;}
      this.onAssetsUpdated?.();return true;
    }).catch(error=>{this.assetErrors.push(error.message);return false;});
    this.packs.set(id,promise);return promise;
  }

  ensureStage(id){
    if(this.stageLoads.has(id))return this.stageLoads.get(id);
    const stage=stageById(id);
    const promise=imageAsset(stage.image,'low').then(image=>{if(id==='rain')this.rainPanorama=image;else this.panorama=image;return true;})
      .catch(error=>{this.assetErrors.push(error.message);return false;});
    this.stageLoads.set(id,promise);return promise;
  }

  async warmRoster(){
    for(const character of CHARACTERS){await new Promise(resolve=>setTimeout(resolve,0));await this.ensureFighter(character.id);}
  }

  render(game) {
    this.syncViewport(game);
    const ctx = this.ctx;
    const {width,height}=this.viewport;
    this.activePlatforms=game.platforms;
    ctx.save();
    ctx.setTransform(this.canvas.width/width,0,0,this.canvas.height/height,0,0);
    ctx.fillStyle=game.stageId==='rain'?'#67796f':'#bea273';ctx.fillRect(0,0,width,height);
    if(game.shake>0 && this.shakeEnabled && game.phase!=='attract'){
      const amount=game.shake;ctx.translate(Math.sin(game.time*180)*amount*.5,Math.cos(game.time*143)*amount*.35);
    }
    if(game.phase==='attract'){
      const cover=Math.max(width/1280,height/720);
      ctx.save();ctx.translate((width-1280*cover)/2,(height-720*cover)/2);ctx.scale(cover,cover);
      this.drawStage(ctx,game);
      const first=game.fighters[0],second=game.fighters[1];
      this.drawFighter(ctx,second,game.time,{size:320,pose:0});
      this.drawFighter(ctx,first,game.time,{size:320,pose:0});
      ctx.restore();
    }else{
      const camera=game.camera;
      ctx.save();ctx.scale(camera.scale,camera.scale);ctx.translate(-camera.x,-camera.y);
      this.drawStage(ctx,game);
      this.drawPlatforms(ctx,game.platforms);
      for(const effect of game.effects)if(effect.type==='super')this.drawEffect(ctx,effect);
      const order=[...game.fighters].sort((a,b)=>a.y-b.y);
      for(const fighter of order) this.drawFighter(ctx,fighter,game.time);
      for(const projectile of game.projectiles) this.drawProjectile(ctx,projectile,game.time);
      for(const effect of game.effects) if(effect.type!=='super') this.drawEffect(ctx,effect);
      for(const fighter of game.fighters)this.drawPlayerTag(ctx,fighter,game);
      this.drawWeather(ctx,game);
      ctx.restore();
      if(game.hitstop>0&&!this.reducedMotion&&game.effects.some(effect=>effect.type==='impact')){ctx.fillStyle='#fff5cc15';ctx.fillRect(0,0,width,height);}
      this.drawHUD(ctx,game);
      this.drawAnnouncements(ctx,game);
    }
    ctx.restore();
  }

  drawStage(ctx,game) {
    const active=game.phase!=='attract';
    const stage=stageById(game.stageId);
    const panorama=game.stageId==='rain'?this.rainPanorama:this.panorama;
    if(active){
      ctx.fillStyle=game.stageId==='rain'?'#78929e':'#8fc7e7';ctx.fillRect(-1000,-2500,WORLD.arenaWidth+2000,3300);
      ctx.fillStyle=game.stageId==='rain'?'#67796f':'#bea273';ctx.fillRect(-1000,WORLD.height,WORLD.arenaWidth+2000,1800);
    }
    if(active&&panorama){
      paintPanorama(ctx,panorama,stage);
      if(game.camera.x+(this.viewport?.width||WORLD.width)/game.camera.scale>WORLD.arenaWidth){
        ctx.save();ctx.translate(WORLD.arenaWidth*2,0);ctx.scale(-1,1);paintPanorama(ctx,panorama,stage);ctx.restore();
      }
    }
    else if(!active&&game.stageId==='rain'&&panorama){ctx.drawImage(panorama,0,panorama.height*.35,panorama.width,panorama.height*.40,0,0,1280,720);this.drawWeather(ctx,game);}
    else if(this.background){
      if(active){ctx.fillStyle='#bcd8d3';ctx.fillRect(0,WORLD.top,WORLD.arenaWidth,WORLD.height-WORLD.top);for(let x=0;x<WORLD.arenaWidth;x+=WORLD.width)ctx.drawImage(this.background,x,0,WORLD.width,WORLD.height);}
      else ctx.drawImage(this.background,0,0,WORLD.width,WORLD.height);
    }
    else {
      ctx.fillStyle='#c9dcce';ctx.fillRect(0,0,1280,720);
      ctx.fillStyle='#e1cf9e';ctx.fillRect(0,420,1280,300);
      ctx.fillStyle='#698c78';ctx.fillRect(60,150,450,295);
      ctx.fillStyle='#c8653b';ctx.fillRect(35,170,500,75);
      ctx.fillStyle='#f0dfaf';ctx.fillRect(740,130,360,310);
      ctx.fillStyle='#8d9c76';ctx.fillRect(780,220,280,220);
    }
    const gradient=ctx.createLinearGradient(0,500,0,720);gradient.addColorStop(0,'#64573100');gradient.addColorStop(1,'#62432428');ctx.fillStyle=gradient;ctx.fillRect(0,450,active?WORLD.arenaWidth:1280,270);
    // Tiny drifting leaves give the still painted street a little afternoon air.
    if(!this.reducedMotion)for(let i=0;i<8;i++){
      const x=((game.time*(13+i*2)+i*(active?483:183))%(active?WORLD.arenaWidth+180:1460))-90;
      const y=180+(i*91)%430+Math.sin(game.time*1.3+i)*19;
      ctx.save();ctx.translate(x,y);ctx.rotate(game.time+i);ctx.globalAlpha=.32;
      ellipse(ctx,0,0,5,2,'#f5d477');ctx.restore();
    }
    if(game.phase!=='attract'){
      ctx.save();ctx.globalAlpha=.25;ctx.strokeStyle='#f8e6bd';ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(WORLD.left,WORLD.floor+14);ctx.lineTo(WORLD.right,WORLD.floor+14);ctx.stroke();
      ctx.restore();
    }
  }

  drawWeather(ctx,game){
    if(stageById(game.stageId).weather!=='rain')return;
    const active=game.phase!=='attract',camera=game.camera||{x:0,y:0,scale:1},left=active?camera.x:0,width=active?(this.viewport?.width||WORLD.width)/camera.scale:WORLD.width,top=active?camera.y:0,height=active?(this.viewport?.height||WORLD.height)/camera.scale:WORLD.height;
    ctx.save();ctx.strokeStyle='#d5e9ee80';ctx.lineWidth=1.3;
    const count=this.reducedMotion?65:260,clock=this.reducedMotion?0:game.time;
    ctx.beginPath();for(let n=0;n<count;n++){
      const x=left+(n*197.37+clock*135)%width,y=top+(n*91.71+clock*(680+n%5*45))%height;
      ctx.moveTo(x,y);ctx.lineTo(x+3,y+12+n%7);
    }ctx.stroke();
    ctx.strokeStyle='#d9eef199';ctx.lineWidth=1;
    for(let n=0;n<24;n++){const phase=(clock*2.2+n*.13)%1,x=left+(n*173.4+51)%width;ctx.globalAlpha=(1-phase)*.45;ctx.beginPath();ctx.ellipse(x,active?WORLD.floor+3:WORLD.floor+10,3+phase*13,1+phase*3,0,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  }

  drawPlayerTag(ctx,fighter,game){
    const scale=game.camera.scale,role=fighter.index===0?'P1 · 玩家':game.mode==='local'?'P2 · 玩家':game.mode==='practice'?'P2 · 木桩':'P2 · 电脑';
    const label=role+(fighter.slow>0?(fighter.slowSource==='frost'?' · 冰缓':' · 减速'):fighter.charm>0?' · 失衡':'');
    const crouch=fighter.crouching,down=fighter.downTime>0;
    const x=fighter.x,y=fighter.y-(down?95*S:crouch?WORLD.crouchHeight:WORLD.standHeight)-15;
    ctx.save();ctx.translate(x,y);ctx.scale(1/scale,1/scale);
    ctx.font=`900 12px ${FONT}`;ctx.textAlign='center';
    ctx.strokeStyle='#fff4db';ctx.lineWidth=3;ctx.strokeText(label,0,-13);ctx.fillStyle=fighter.index===0?'#a23e29':'#2e6670';ctx.fillText(label,0,-13);
    ctx.beginPath();ctx.moveTo(-6,-3);ctx.lineTo(6,-3);ctx.lineTo(0,4);ctx.closePath();ctx.fill();ctx.restore();
  }

  drawPlatforms(ctx,platforms=PLATFORMS){
    for(const p of platforms){
      ctx.save();ctx.translate(p.x,p.y);
      ctx.fillStyle='#333a2c26';ctx.fillRect(-7,12,p.w+14,14);
      if(p.kind==='awning'){
        ctx.fillStyle='#ac5639';ctx.fillRect(0,0,p.w,20);
        for(let x=0;x<p.w;x+=34){ctx.fillStyle='#ead29b';ctx.fillRect(x,0,17,20);}
        ctx.strokeStyle='#795c3d';ctx.lineWidth=7;
        for(const x of [10,p.w-10]){ctx.beginPath();ctx.moveTo(x,20);ctx.lineTo(x,WORLD.floor-p.y);ctx.stroke();}
        ctx.fillStyle='#d9b46a';ctx.fillRect(-5,-4,p.w+10,5);
      }else if(p.kind==='roof'){
        ctx.fillStyle='#65573c';ctx.fillRect(-12,0,p.w+24,14);
        ctx.fillStyle='#a9643c';ctx.fillRect(-6,-7,p.w+12,12);
        ctx.strokeStyle='#d9aa71';ctx.lineWidth=2;
        for(let x=0;x<p.w;x+=23){ctx.beginPath();ctx.moveTo(x,-6);ctx.lineTo(x+5,4);ctx.stroke();}
        ctx.strokeStyle='#786345';ctx.lineWidth=7;
        for(const x of [30,p.w-30]){ctx.beginPath();ctx.moveTo(x,15);ctx.lineTo(x+32,68);ctx.lineTo(x+32,15);ctx.stroke();}
      }else{
        ctx.strokeStyle='#536d55';ctx.lineWidth=5;
        ctx.beginPath();ctx.moveTo(3,-37);ctx.lineTo(p.w-3,-37);ctx.stroke();
        for(let x=8;x<p.w;x+=42){ctx.beginPath();ctx.moveTo(x,-37);ctx.lineTo(x,0);ctx.stroke();}
        ctx.fillStyle='#6c7c5c';ctx.fillRect(-7,0,p.w+14,15);
        ctx.fillStyle='#e6d4a1';ctx.fillRect(-7,-3,p.w+14,5);
        ctx.strokeStyle='#6b7050';ctx.lineWidth=8;
        for(const x of [20,p.w-45]){ctx.beginPath();ctx.moveTo(x,15);ctx.lineTo(x+25,60);ctx.lineTo(x+25,15);ctx.stroke();}
      }
      ctx.strokeStyle='#fff0c6';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-2);ctx.lineTo(p.w,-2);ctx.stroke();
      ctx.restore();
    }
  }

  pose(fighter) {
    if(fighter.state==='ko')return 10;
    if(fighter.throwing)return 17;
    if(fighter.grappled)return 3;
    if(fighter.downTime>0||fighter.state==='knockdown')return 10;
    if(fighter.getUpTime>0||fighter.state==='getup')return 7;
    if(fighter.state==='victory'||fighter.state==='taunt')return 11;
    if(fighter.state==='hurt')return fighter.reaction?.type==='flinch'?4:fighter.reaction?.type==='trip'?10:fighter.reaction?.type==='freeze'?0:9;
    if(fighter.state==='guard'||fighter.blocking&&fighter.state==='idle')return 7;
    if(fighter.attack){
      const styledPose=stylePose(fighter);if(styledPose!==null)return styledPose;
      const {move,time,config}=fighter.attack;
      if(['jab','jab2','straight','rushPunch'].includes(move))return time<config.startup?4:5;
      if(move==='lowJab')return 13;
      if(['sweep','slide','pulse'].includes(move))return 14;
      if(['uppercut','superRise'].includes(move))return 15;
      if(move==='airJab')return 5;
      if(move==='diveKick')return 16;
      if(move==='grab')return 17;
      if(move==='spin')return Math.floor(time*17)%2?18:6;
      if(move==='superRush'||move==='superFinish')return Math.floor(time*24)%3===0?6:5;
      if(move==='kick')return time<config.startup?4:6;
      if(isSkillMove(move)||isSuperMove(move))return time<config.startup?4:8;
    }
    if(!fighter.grounded)return 3;
    if(fighter.state==='dash'||fighter.state==='blink')return 19;
    if(fighter.crouching)return 12;
    if(fighter.state==='walk')return Math.floor(fighter.stateTime*9)%2?1:2;
    return 0;
  }

  drawFighter(ctx,fighter,time,{size=WORLD.spriteSize,pose=null}={}) {
    let frame=pose??this.pose(fighter);
    if(frame>=12&&!this.advanced)frame=[7,5,6,3,6,8,6,1][frame-12];
    const asset=this.variants.get(fighter.character.id)?.[frame]||this.portraits.get(fighter.character.id);
    if(!asset&&this.assetErrors.length===0)return;
    const drawSize=size*(asset?.scale||1);
    const phase=time*3.5+fighter.index;
    const platform=(this.activePlatforms||PLATFORMS).filter(p=>fighter.x>=p.x&&fighter.x<=p.x+p.w&&p.y>=fighter.y-.5).sort((a,b)=>a.y-b.y)[0];
    const groundY=platform?.y??WORLD.floor;
    const airborne=groundY-fighter.y;
    const shadowScale=Math.max(.3,1-airborne/500);
    ctx.save();ctx.globalAlpha=.23;ellipse(ctx,fighter.x+5,groundY+3,size*.21*shadowScale,9*shadowScale,'#403722');ctx.restore();
    if(asset&&!this.reducedMotion)for(const trail of fighter.afterimages||[]){
      ctx.save();ctx.globalAlpha=trail.life*.95;ctx.translate(trail.x,trail.y);ctx.scale(fighter.facing,1);
      ctx.drawImage(asset.canvas,-drawSize*asset.anchor.x,-drawSize*asset.anchor.y,drawSize,drawSize);ctx.restore();
    }
    if(fighter.invincible>0 && isSuperMove(fighter.attack?.move)){
      ctx.save();ctx.globalAlpha=.18+.08*Math.sin(time*40);ellipse(ctx,fighter.x,fighter.y-100*S,80*S,110*S,'#fff2a8');ctx.restore();
    }
    ctx.save();ctx.translate(fighter.x,fighter.y);
    ctx.scale(fighter.facing,1);
    this.drawAttackLight(ctx,fighter,time);
    const idle=['idle','walk'].includes(fighter.state)&&!fighter.attack;
    const laughing=['victory','taunt'].includes(fighter.state);
    const bob=this.reducedMotion?0:idle?Math.sin(phase)*3:laughing?Math.sin(time*18)*5:0;
    let sx=1,sy=1;
    if(idle&&!this.reducedMotion){sx+=Math.sin(phase)*.009;sy-=Math.sin(phase)*.008;}
    if(laughing&&!this.reducedMotion){sx+=Math.sin(time*18)*.025;sy-=Math.sin(time*18)*.015;}
    if(fighter.crouching){sy=asset?WORLD.crouchHeight/(asset.bounds.height/asset.canvas.height*drawSize):.44;sx=1.06;}
    const reaction=fighter.reaction;
    if(fighter.grappled||fighter.state==='hurt'){
      const age=reaction?.age||0,type=reaction?.type;
      const rotation=fighter.grappled?fighter.throwRotation*fighter.facing:type==='trip'?-.4-age*2:type==='launch'?-Math.min(1.8,age*3):type==='tumble'?age*6:type==='body'?-.32: type==='freeze'?0:-.08;
      ctx.translate(0,-92*S);ctx.rotate(rotation);ctx.translate(0,92*S);
      if(type==='body')ctx.translate(-Math.sin(Math.min(1,age/.23)*Math.PI)*12,0);
      if(type==='freeze')ctx.filter='brightness(1.12) saturate(.6)';
    }
    const motion=attackMotion(fighter);
    ctx.translate(motion.x,motion.y);ctx.translate(0,-70*S);ctx.rotate(motion.rotation);ctx.translate(0,70*S);
    ctx.scale(sx*motion.sx,sy*motion.sy);ctx.translate(0,bob);
    if(fighter.slow>0){ctx.shadowColor='#97e8e4';ctx.shadowBlur=22;}
    if(asset){
      if(fighter.flash>0)ctx.filter='brightness(1.25) saturate(.9)';
      // Isolated frames retain their sampling margins and calibrated anchors,
      // keeping extended limbs and the feet baseline aligned across poses.
      const anchor=asset.anchor;
      ctx.drawImage(asset.canvas,-drawSize*anchor.x,-drawSize*anchor.y,drawSize,drawSize);
    }else this.drawFallback(ctx,fighter,frame,size/350);
    ctx.restore();
    if(fighter.petals>0||fighter.frostStacks>0){ctx.save();ctx.fillStyle=fighter.petals?'#ffb7d6':'#c8f3ff';for(let i=0;i<(fighter.petals||fighter.frostStacks);i++){ctx.beginPath();ctx.arc(fighter.x+(i-.5)*12,fighter.y-WORLD.standHeight-35,3.5,0,Math.PI*2);ctx.fill();}ctx.restore();}
    if(fighter.frost>0){ctx.save();ctx.translate(fighter.x,fighter.y);ctx.scale(S,S);ctx.strokeStyle='#beeaff';ctx.fillStyle='#a8e6ff44';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-68,-8);ctx.lineTo(-58,-170);ctx.lineTo(0,-225);ctx.lineTo(65,-145);ctx.lineTo(67,-6);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}
    if(fighter.charm>0){ctx.save();ctx.fillStyle='#ef93b1';ctx.font=`${21*S}px ${FONT}`;ctx.textAlign='center';for(let n=0;n<3;n++)ctx.fillText('♥',fighter.x+Math.cos(time*5+n*2)*58*S,fighter.y-220*S+Math.sin(time*5+n*2)*14*S);ctx.restore();}
  }

  drawAttackLight(ctx,fighter,time){drawAttackVfx(ctx,fighter,time);}

  drawFallback(ctx,fighter,frame,scale) {
    ctx.save();ctx.scale(scale,scale);
    const color=fighter.character.color;
    const g=ctx.createLinearGradient(-70,-150,75,-120);g.addColorStop(0,'#ffe685');g.addColorStop(1,color);
    const arm=(x,y,angle)=>{ctx.save();ctx.translate(x,y);ctx.rotate(angle);ellipse(ctx,0,0,24,65,g);ellipse(ctx,0,48,24,23,'#8a7a52');ctx.restore();};
    ellipse(ctx,-36,-9,37,17,'#9b8958');ellipse(ctx,39,-9,37,17,'#9b8958');
    arm(-65,-132,frame===5?-1.3:.4);ellipse(ctx,0,-110,84,104,g);ellipse(ctx,0,-92,61,66,'#fff1cf');
    ellipse(ctx,0,-215,67,53,g);ellipse(ctx,-25,-223,19,22,'#a6c982');ellipse(ctx,26,-223,19,22,'#a6c982');
    ellipse(ctx,-21,-218,9,11,'#111e17');ellipse(ctx,30,-218,9,11,'#111e17');
    ctx.strokeStyle='#776132';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-13,-185);ctx.quadraticCurveTo(10,-179,33,-190);ctx.stroke();
    arm(64,-135,frame===5?-1.4:frame===7?1.1:-.3);ctx.restore();
  }

  drawPortrait(canvas,character,time=0) {
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
    const fighter={character,index:0,x:canvas.width*.55,y:canvas.height+7,facing:-1,state:'idle',stateTime:0,grounded:true,slow:0,flash:0,invincible:0};
    this.drawFighter(ctx,fighter,time,{size:canvas.height*1.12,pose:20});
  }

  drawProjectile(ctx,p,time){drawTechnique(ctx,p,time,this);}

  drawEffect(ctx,effect) {
    if(drawRichEffect(ctx,effect))return;
    const progress=1-effect.life/effect.duration;
    ctx.save();ctx.globalAlpha=Math.max(0,1-progress);ctx.translate(effect.x,effect.y);ctx.scale(S,S);
    if(effect.type==='heart'){
      ctx.fillStyle=effect.color;ctx.font=`${14+effect.size}px ${FONT}`;ctx.fillText('♥',0,0);
    }else if(effect.type==='iceShard'){
      ctx.rotate(progress*4);ctx.fillStyle=effect.color;ctx.beginPath();ctx.moveTo(0,-effect.size*2);ctx.lineTo(effect.size,0);ctx.lineTo(0,effect.size);ctx.lineTo(-effect.size,0);ctx.closePath();ctx.fill();
    }else if(effect.type==='airRing'){
      ctx.strokeStyle=effect.color;ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(0,0,25+progress*65,8+progress*15,0,0,Math.PI*2);ctx.stroke();
    }else if(effect.type==='shockwave'){
      ctx.strokeStyle='#fff1ad';ctx.lineWidth=7*(1-progress);ctx.beginPath();ctx.ellipse(0,0,30+progress*190,8+progress*22,0,0,Math.PI*2);ctx.stroke();
    }else if(effect.type==='ring'||effect.type==='block'){
      ctx.strokeStyle=effect.color;ctx.lineWidth=effect.type==='block'?5:3;ctx.beginPath();ctx.arc(0,0,14+progress*60,0,Math.PI*2);ctx.stroke();
    }else if(effect.type==='impact'){
      const radius=effect.duration>.3?112:65;
      ctx.globalCompositeOperation='lighter';
      const light=ctx.createRadialGradient(0,0,1,0,0,radius*1.5);light.addColorStop(0,'#fffef1');light.addColorStop(.25,'#fff1a3c9');light.addColorStop(.6,'#ffad4444');light.addColorStop(1,'#ffaf4400');ctx.fillStyle=light;ctx.fillRect(-radius*1.5,-radius*1.5,radius*3,radius*3);
      ctx.rotate(.3);ctx.fillStyle='#fff9de';ctx.beginPath();
      for(let n=0;n<16;n++){const a=n*Math.PI/8,r=n%2?radius*.22:radius*(.65+progress*.8);const x=Math.cos(a)*r,y=Math.sin(a)*r;if(n===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
      ctx.closePath();ctx.fill();
      ctx.globalAlpha=1-progress;ctx.strokeStyle='#fff7cf';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,radius*(.35+progress),0,Math.PI*2);ctx.stroke();
    }else if(effect.type==='super'){
      ctx.globalAlpha=(1-progress)*.23;ctx.fillStyle='#fff4b7';ctx.beginPath();ctx.arc(0,0,80+progress*400,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=(1-progress)*.6;ctx.strokeStyle='#fff6c2';ctx.lineWidth=6;ctx.beginPath();ctx.arc(0,0,30+progress*220,0,Math.PI*2);ctx.stroke();
    }else if(effect.type==='dust'){
      ellipse(ctx,0,0,effect.size*(1+progress*2),effect.size*.65,'#f5e6c5');
    }else{
      ctx.rotate(Math.atan2(effect.vy,effect.vx));ctx.fillStyle=effect.color;
      ctx.beginPath();ctx.moveTo(-effect.size*2.8,0);ctx.lineTo(0,-effect.size*.45);ctx.lineTo(effect.size*1.8,0);ctx.lineTo(0,effect.size*.45);ctx.closePath();ctx.fill();
    }
    ctx.restore();
  }

  drawHUD(ctx,game) {
    const {width=1280,height=720}=this.viewport||{};
    const extra=width-1280;
    const inset=this.hudInset||{},leftPad=Math.max(68,(inset.left||0)+16),rightPad=Math.max(68,(inset.right||0)+16),topPad=inset.top||0;
    const pixelScale=this.canvas.getBoundingClientRect().width/width||1;
    const {nameFont,nameY,hpY,hpH,milkY,milkH,noteY,comboY}=this.hudLayout||hudMetrics(pixelScale);
    ctx.save();
    ctx.translate(0,topPad);
    game.fighters.forEach((fighter,i)=>{
      const right=i===1,x=right?width-rightPad-468:leftPad,w=468;
      ctx.textAlign=right?'right':'left';ctx.font=`900 ${nameFont}px ${FONT}`;
      ctx.lineWidth=5;ctx.strokeStyle='#fff4d9';ctx.strokeText(fighter.character.name,right?x+w:x,nameY);ctx.fillStyle=INK;ctx.fillText(fighter.character.name,right?x+w:x,nameY);
      if(!this.touchHud){ctx.font=`11px ${FONT}`;ctx.fillText(styleOf(fighter.character).name,right?x+w-80:x+80,nameY-1);}
      ctx.fillStyle='#18352c';rounded(ctx,x-3,hpY-3,w+6,hpH+milkH+8,3);ctx.fill();ctx.fillStyle='#3f4032';ctx.fillRect(x,hpY,w,hpH);
      const hpWidth=Math.max(0,w*fighter.hp/WORLD.maxHealth),trailWidth=Math.max(0,w*fighter.trailHp/WORLD.maxHealth);
      ctx.fillStyle='#b56948';ctx.fillRect(right?x+w-trailWidth:x,hpY,trailWidth,hpH);
      const hpGradient=ctx.createLinearGradient(0,hpY,0,hpY+hpH);hpGradient.addColorStop(0,fighter.hp>WORLD.maxHealth*.3?'#ffe6a0':'#f8ad80');hpGradient.addColorStop(1,fighter.hp>WORLD.maxHealth*.3?'#d5a24f':'#c95b42');ctx.fillStyle=hpGradient;
      ctx.fillRect(right?x+w-hpWidth:x,hpY,hpWidth,hpH);
      ctx.strokeStyle='#fff1bd45';ctx.lineWidth=1;for(let n=1;n<10;n++){ctx.beginPath();ctx.moveTo(x+n*w/10,hpY);ctx.lineTo(x+n*w/10,hpY+hpH);ctx.stroke();}
      for(let n=0;n<2;n++){
        const dx=right?x+17+n*21:x+w-17-n*21;
        ellipse(ctx,dx,nameY-8,6,6,game.wins[i]>n?'#edc55f':'#f0e5c5',INK,2);
      }
      // The same paired HUD on every device keeps both resources clear of
      // the thumbs. Values stay centered even as the colored fill shrinks.
      const full=fighter.energy>=99.9;
      ctx.fillStyle='#33564c';ctx.fillRect(x,milkY,w,milkH);
      const milkGradient=ctx.createLinearGradient(0,milkY,0,milkY+milkH);milkGradient.addColorStop(0,full?'#e4f9c0':'#b5e5d3');milkGradient.addColorStop(1,full?'#9fd08c':'#69b49b');ctx.fillStyle=milkGradient;
      const milkWidth=w*Math.max(0,Math.min(100,fighter.energy))/100;ctx.fillRect(right?x+w-milkWidth:x,milkY,milkWidth,milkH);
      ctx.strokeStyle='#def7e82e';for(let n=1;n<4;n++){ctx.beginPath();ctx.moveTo(x+w*n/4,milkY);ctx.lineTo(x+w*n/4,milkY+milkH);ctx.stroke();}
      for(const [y,h,value,max] of [[hpY,hpH,Math.ceil(Math.max(0,fighter.hp)),WORLD.maxHealth],[milkY,milkH,Math.floor(fighter.energy),100]]){
        ctx.save();ctx.textBaseline='middle';ctx.textAlign='center';ctx.font=`900 ${Math.max(y===hpY?19:12,(y===hpY?11:8)/pixelScale)}px ${MONO}`;
        ctx.strokeStyle='#17382e';ctx.lineWidth=2.5;ctx.fillStyle='#fff9e6';const text=`${value} / ${max}`;
        ctx.strokeText(text,x+w/2,y+h/2+1);ctx.fillText(text,x+w/2,y+h/2+1);
        ctx.restore();
      }
      ctx.textAlign=right?'right':'left';ctx.font=`700 ${Math.max(11,9/pixelScale)}px ${FONT}`;ctx.lineWidth=3;ctx.strokeStyle='#254235';ctx.fillStyle='#f5edcf';
      const blinkText=`闪移 ${fighter.blinkCharges}/2`+(fighter.blinkCharges<2?` · +${fighter.blinkRecharge.toFixed(1)}s`:'');
      ctx.strokeText(blinkText,right?x+w:x,noteY);ctx.fillText(blinkText,right?x+w:x,noteY);
      if(full){ctx.textAlign=right?'left':'right';ctx.fillStyle='#dcf6ba';ctx.strokeText('必杀就绪',right?x:x+w,noteY);ctx.fillText('必杀就绪',right?x:x+w,noteY);}
      if(fighter.lastMoveTime>0){ctx.textAlign=right?'right':'left';ctx.font=`900 16px ${FONT}`;ctx.lineWidth=4;ctx.strokeStyle='#fff4db';ctx.fillStyle=INK;const lx=right?x+w:x,ly=noteY+28;ctx.strokeText(fighter.lastMove.name,lx,ly);ctx.fillText(fighter.lastMove.name,lx,ly);}
      if(fighter.combo>=2&&fighter.comboTimer>0){
        const cx=right?1080+extra:200;
        ctx.textAlign='center';ctx.font=`italic 900 47px ${MONO}`;ctx.lineWidth=6;ctx.strokeStyle='#fff0d3';ctx.strokeText(`${fighter.combo} HIT`,cx,comboY);ctx.fillStyle='#b6492c';ctx.fillText(`${fighter.combo} HIT`,cx,comboY);
        ctx.font=`900 12px ${FONT}`;ctx.fillText(fighter.combo>=4?'奶气冲天！':'连得漂亮！',cx,comboY+25);
      }
    });
    ctx.save();ctx.translate(extra/2,0);
    ctx.fillStyle=INK;ctx.beginPath();ctx.moveTo(590,17);ctx.lineTo(690,17);ctx.lineTo(679,91);ctx.lineTo(601,91);ctx.closePath();ctx.fill();
    ctx.textAlign='center';ctx.fillStyle='#f6e8ba';ctx.font=`900 43px ${MONO}`;ctx.fillText(game.mode==='practice'?'∞':String(Math.ceil(game.roundTime)).padStart(2,'0'),640,63);
    ctx.font=`9px ${MONO}`;ctx.fillStyle='#ffedc3';ctx.fillText(game.mode==='practice'?'PRACTICE':`ROUND ${game.round}`,640,81);ctx.restore();
    const mapX=width/2-180,mapY=height-44-topPad,mapW=360,mapH=27;
    ctx.fillStyle='#263d34ba';rounded(ctx,mapX-8,mapY-10,mapW+16,mapH+16,3);ctx.fill();
    ctx.strokeStyle='#ddd3ac';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(mapX,mapY+mapH);ctx.lineTo(mapX+mapW,mapY+mapH);ctx.stroke();
    for(const p of game.platforms){const py=mapY+(p.y-WORLD.top)/(WORLD.floor-WORLD.top)*mapH;ctx.strokeStyle='#9bab81';ctx.beginPath();ctx.moveTo(mapX+p.x/WORLD.arenaWidth*mapW,py);ctx.lineTo(mapX+(p.x+p.w)/WORLD.arenaWidth*mapW,py);ctx.stroke();}
    const viewX=mapX+game.camera.x/WORLD.arenaWidth*mapW,viewWidth=width/game.camera.scale/WORLD.arenaWidth*mapW;
    ctx.strokeStyle='#f6e9be5c';ctx.strokeRect(viewX,mapY-2,viewWidth,mapH+4);
    for(const f of game.fighters)ellipse(ctx,mapX+f.x/WORLD.arenaWidth*mapW,mapY+(f.y-WORLD.top)/(WORLD.floor-WORLD.top)*mapH,3,3,f.index===0?'#f7d469':'#e89d82');
    ctx.restore();
  }

  drawAnnouncements(ctx,game) {
    const {width=1280,height=720}=this.viewport||{};
    ctx.save();ctx.translate((width-1280)/2,(height-720)/2);
    let title='',subtitle='',color='#f8e4ac';
    if(game.phase==='intro'){
      title=game.phaseTime<1.35?`ROUND ${game.round}`:'开打！';
      subtitle=game.phaseTime<1.35?'奶气已就位 · 谁先笑出声':'F R O G H T !';
    }else if(game.phase==='roundOver'){
      title=game.lastWinner===null?'平手！':game.fighters.some(f=>f.hp<=0)?'K.O.':'TIME UP';
      subtitle=game.lastWinner===null?'这回谁也没占便宜，再来！':`${game.fighters[game.lastWinner].character.name} · 拿下一局`;
    }
    const superEffect=game.effects.find(e=>e.type==='super'&&e.life>.4);
    if(superEffect&&!title){
      const fighter=game.fighters.find(f=>isSuperMove(f.attack?.move))||game.fighters[0];
      ctx.save();ctx.fillStyle='#263d34d9';ctx.fillRect(0,270,1280,58);ctx.font=`900 27px ${FONT}`;ctx.fillStyle='#f9d77f';ctx.textAlign='center';ctx.fillText(fighter.lastMove?.name||fighter.character.superName,640,309);ctx.restore();
    }
    if(!title){ctx.restore();return;}
    ctx.save();ctx.textAlign='center';ctx.fillStyle='#263d345c';ctx.fillRect(0,272,1280,156);
    ctx.font=`italic 900 78px ${title.includes('ROUND')||title==='K.O.'||title==='TIME UP'?MONO:FONT}`;ctx.lineWidth=9;ctx.strokeStyle=INK;ctx.strokeText(title,640,357);ctx.fillStyle=color;ctx.fillText(title,640,357);
    ctx.font=`900 16px ${FONT}`;ctx.fillStyle='#fff1cb';ctx.fillText(subtitle,640,395);ctx.restore();ctx.restore();
  }
}
