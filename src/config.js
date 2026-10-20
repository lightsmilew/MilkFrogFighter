// Viewport dimensions stay fixed; world coordinates extend above and sideways.
export const WORLD = Object.freeze({ width:1280,height:720,arenaWidth:3840,top:-700,floor:610,left:64,right:3776,spawnX:1920,gravity:2050,fighterScale:.7,spriteSize:175,standHeight:145.6,crouchHeight:91,pushDistance:75.6,maxSeparation:1600,damageScale:.44,roundSeconds:90 });
export const MOVEMENT=Object.freeze({runMultiplier:2.15,dashForward:1180,dashBack:1020,dashDuration:.20,airJumpRatio:1,blinkSpeed:2300,blinkDuration:.16,blinkCharges:2,blinkRecharge:3});

export const PLATFORMS = Object.freeze([
  {id:'left-canopy',x:300,y:410,w:290,kind:'awning'},
  {id:'left-roof',x:630,y:190,w:300,kind:'roof'},
  {id:'left-terrace',x:1040,y:-20,w:280,kind:'terrace'},
  {id:'market-canopy',x:1350,y:405,w:280,kind:'awning'},
  {id:'center-roof',x:1690,y:205,w:330,kind:'roof'},
  {id:'high-walkway',x:2070,y:-10,w:310,kind:'terrace'},
  {id:'sky-terrace',x:2440,y:-210,w:300,kind:'terrace'},
  {id:'right-canopy',x:2550,y:410,w:320,kind:'awning'},
  {id:'right-roof',x:2940,y:190,w:320,kind:'roof'},
  {id:'right-terrace',x:3330,y:-20,w:280,kind:'terrace'},
]);

export const STAGES=Object.freeze([
  {id:'street',name:'晴日老街',subtitle:'午后暖阳 · 棚架与屋檐',weather:'sun',image:'milk-rooftops.webp',platforms:PLATFORMS},
  {id:'rain',name:'雨巷街口',subtitle:'细雨街灯 · 高低露台',weather:'rain',image:'milk-rain.webp',platforms:PLATFORMS.map((p,i)=>({...p,x:p.x+(i%2?55:-40),y:p.y+(p.kind==='roof'?-25:0)}))},
]);
export const stageById=id=>STAGES.find(stage=>stage.id===id)||STAGES[0];

// Every variant retains the classic yellow milk-frog silhouette. Color accents,
// movement and special moves give the variants different fighting identities.
export const CHARACTERS = Object.freeze([
  { id: 'classic', name: '奶蛙', short: '奶蛙', english: 'THE ORIGINAL', title: '笑着就把你打了', color: '#edc973', accent: '#ae4a2d', hue: 0, speed:360,power:1,jump:1220,special:'wave',specialName:'螺旋奶丸',superName:'大玉奶丸',stats:[3,3,4],description:'螺旋掌聚拢对手，蓄力丸接近身肚击；反击架势能弹开一击。' },
  { id:'green',name:'奶绿',short:'奶绿',english:'FAST & FROGGY',title:'你还没反应过来',color:'#b2c879',accent:'#48634b',hue:30,speed:430,power:.86,jump:1280,special:'dash',specialName:'风影分身',superName:'千影连袭',stats:[5,2,3],description:'高速近战与分身协同，穿身风刃持续追击，擅长抢攻。' },
  { id:'red',name:'奶红',short:'奶红',english:'RED HOT BELLY',title:'这一拳直接红温',color:'#f47f6c',accent:'#ad3e30',hue:340,speed:320,power:1.22,jump:1160,special:'stomp',specialName:'地走炎',superName:'火山大喷发',stats:[2,5,3],description:'重击带短暂霸体，三重火柱延迟爆发，靠爆炎冲拳破阵。' },
  { id:'purple',name:'奶紫',short:'奶紫',english:'PURPLE HAZE',title:'紫气一来你就慢了',color:'#ba96d8',accent:'#705787',hue:275,speed:370,power:.95,jump:1230,special:'bubble',specialName:'幻月追珠',superName:'月蚀结界',stats:[3,3,5],description:'月刃远端打击、幻步换边与牵引结界，控制对手站位。' },
  { id:'pink',name:'奶粉',short:'奶粉',english:'SWEET REVENGE',title:'甜一下，再揍一下',color:'#f6a6b8',accent:'#af526e',speed:375,power:.92,jump:1240,special:'charm',specialName:'回旋心弹',superName:'千绫花葬',stats:[3,3,5],description:'丝带追击叠加绯印，三层绽放回血；回旋心弹返程可再命中。' },
  { id:'blue',name:'奶蓝',short:'奶蓝',english:'KEEP IT COOL',title:'先冷静，再出拳',color:'#8bc1f1',accent:'#377b9e',speed:355,power:.96,jump:1260,special:'frost',specialName:'冰晶飞针',superName:'冰镜牢笼',stats:[3,4,4],description:'霜印叠至三层冻结，冰针、冰棱和可挡弹的冰镜封锁地面。' },
]);

const MOVE_DATA = {
  jab: { name:'直拳', startup:.06, active:.08, recovery:.14, damage:7, reach:112, top:164, bottom:105, level:'high', stun:.24, push:95, meter:8, rank:1 },
  jab2: { name:'追身肘', startup:.055, active:.09, recovery:.16, damage:6, reach:124, top:157, bottom:96, level:'high', stun:.25, push:85, meter:6, rank:1.5 },
  straight: { name:'崩山重拳', startup:.10, active:.11, recovery:.25, damage:10, reach:146, top:166, bottom:95, level:'high', stun:.33, push:185, meter:10, rank:2 },
  kick: { name:'高踢', startup:.14, active:.12, recovery:.23, damage:12, reach:155, top:181, bottom:104, level:'high', stun:.34, push:170, meter:12, rank:2 },
  lowJab: { name:'蹲拳', startup:.065, active:.09, recovery:.15, damage:6, reach:108, top:76, bottom:34, level:'mid', posture:'crouch', stun:.24, push:80, meter:7, rank:1 },
  sweep: { name:'扫堂腿', startup:.13, active:.13, recovery:.26, damage:11, reach:165, top:38, bottom:2, level:'low', posture:'crouch', stun:.4, push:200, meter:10, rank:2 },
  airJab: { name:'空中拳', startup:.055, active:.11, recovery:.16, damage:8, reach:118, top:125, bottom:50, level:'overhead', stun:.27, push:100, meter:8, rank:1 },
  diveKick: { name:'飞燕踢', startup:.09, active:.19, recovery:.19, damage:13, reach:152, top:88, bottom:-60, level:'overhead', stun:.36, push:165, meter:12, rank:2 },
  rushPunch: { name:'冲肩拳', startup:.07, active:.15, recovery:.24, damage:12, reach:145, top:159, bottom:65, level:'mid', stun:.33, push:225, meter:10, rank:2, drive:560 },
  slide: { name:'滑铲', startup:.08, active:.21, recovery:.25, damage:12, reach:155, top:40, bottom:1, level:'low', posture:'crouch', stun:.4, push:230, meter:10, rank:2, drive:570 },
  uppercut: { name:'奶气升龙', startup:.09, active:.22, recovery:.3, damage:15, reach:125, top:265, bottom:75, level:'antiAir', stun:.48, push:80, launch:700, lift:550, meter:12, rank:3, invincible:.13 },
  grab: { name:'大肚抱摔', startup:.11, active:.11, recovery:.36, damage:15, reach:116, top:155, bottom:10, level:'throw', stun:.55, push:345, launch:380, meter:12, rank:0 },
  spin: { name:'旋风腿', startup:.13, active:.30, recovery:.27, damage:9, reach:163, top:190, bottom:55, level:'mid', stun:.27, push:60, meter:4, cost:20, hits:2, interval:.16, rank:3 },
  special: { name:'专属技能', startup:.20, active:.12, recovery:.29, damage:15, reach:165, level:'high', stun:.34, push:185, cost:25, meter:5, rank:4, projectile:true },
  powerWave: { name:'强化流派技能', startup:.22, active:.13, recovery:.30, damage:21, reach:180, level:'high', stun:.41, push:210, cost:35, meter:6, rank:4, projectile:true },
  pulse: { name:'伏地奶气震', startup:.19, active:.13, recovery:.28, damage:13, reach:185, top:48, bottom:0, level:'low', posture:'crouch', stun:.42, push:180, cost:20, meter:5, rank:4 },
  rushSkill: { name:'破风掌', startup:.12, active:.23, recovery:.28, damage:18, reach:150, top:177, bottom:55, level:'mid', stun:.4, push:230, cost:30, meter:5, rank:4, drive:790 },
  airWave: { name:'空中散气', startup:.16, active:.12, recovery:.24, damage:11, reach:170, level:'overhead', stun:.32, push:170, cost:20, meter:4, rank:4, projectile:true },
  super: { name:'专属必杀', startup:.27, active:.22, recovery:.40, damage:33, reach:220, level:'mid', stun:.65, push:350, cost:100, meter:0, rank:5, projectile:true, invincible:.4 },
  superRush: { name:'百裂奶拳', startup:.14, active:.61, recovery:.36, damage:8, reach:192, top:183, bottom:35, level:'mid', stun:.23, push:35, launch:0, cost:100, hits:5, interval:.12, meter:0, rank:5, drive:690, invincible:.32 },
  superRise: { name:'九天升龙', startup:.13, active:.46, recovery:.35, damage:13, reach:175, top:315, bottom:40, level:'antiAir', stun:.32, push:45, launch:610, lift:610, cost:100, hits:3, interval:.15, meter:0, rank:5, invincible:.45 },
  superStorm: { name:'天降奶雨', startup:.28, active:.60, recovery:.34, damage:9, reach:240, level:'overhead', stun:.27, push:45, cost:100, hits:4, interval:.16, meter:0, rank:5, projectile:true, invincible:.35 },
  superFinish: { name:'奶气连携·终式', startup:.09, active:.68, recovery:.42, damage:8, reach:235, top:215, bottom:-5, level:'mid', stun:.24, push:25, cost:100, hits:6, interval:.11, meter:0, rank:5, drive:720, invincible:.45 },
};
// Pose, hurtbox, reach, projectile and effect sizes use the same body scale.
export const MOVES=Object.freeze(Object.fromEntries(Object.entries(MOVE_DATA).map(([name,move])=>[name,Object.freeze({...move,...Object.fromEntries(['reach','top','bottom','push'].filter(key=>key in move).map(key=>[key,move[key]*WORLD.fighterScale]))})])));

export const isSuperMove = move => MOVES[move]?.rank === 5;
export const isSkillMove = move => move==='stance'||MOVES[move]?.rank === 4;
export const COMMANDS = Object.freeze([
  {keys:'E / P2：8',name:'闪移脱身',detail:'可存两次，方向 + 闪移穿过对手；受击后也可脱身，每 3 秒恢复一次。'},
  {keys:'J → K / K → J',name:'流派分支追击',detail:'命中后拳接脚为分支，脚接拳为回身追击；J J K 接流派终结技。'},
  {keys:'后 + L',name:'战术技能',detail:'螺旋反击、风影分身、烈焰霸体、牵引结界、绯花结界、凝霜冰镜，消耗 20 奶气。'},
  {keys:'长按 W / 再按 W',name:'连续跳跃 / 二段跳',detail:'落地后自动再跳；空中松开再按可二段跳。摇杆持续上推或松开再上推相同。'},
  {keys:'平台上按住下',name:'穿过平台',detail:'按住下约 0.2 秒即可跳下棚架或屋檐，地面不受影响。'},
  { keys:'J → J → J', name:'流派三连击', detail:'每位角色各有三段普攻，命中后依次衔接；第三下可换 K 接不同的终结技。' },
  { keys:'J → K → L → I', name:'流派连携终式', detail:'连续命中后按必杀，接各自的多段终式；本连招的技能消耗计入 100 奶气总额。' },
  { keys:'上 + J / 下 + J / 下 + K', name:'升龙 / 抱摔 / 扫堂腿', detail:'上拳对空、下拳抱摔破防；下脚扫腿打下盘。键盘、摇杆与手柄使用同一规则。' },
  { keys:'跳跃 + J / K / L', name:'空中拳 / 飞燕踢 / 空中散气', detail:'空中出招；飞燕踢与散气能压蹲下的对手。' },
  { keys:'K + L', name:'流派旋风腿', detail:'脚与技能同时按，发动各流派的旋转追击。' },
  { keys:'冲刺中 J / K', name:'冲肩拳 / 滑铲', detail:'双击方向先冲刺，再出拳或铲腿。' },
  { keys:'下 + L / 前 + L', name:'伏地奶气震 / 破风掌', detail:'低段震地或向前突进，分别消耗 20 / 30 奶气。' },
  { keys:'↓ → 前 → L', name:'强化流派技能', detail:'半秒内依次输入，强化气功消耗 35 奶气。' },
  { keys:'I', name:'专属必杀', detail:'每只蛙独有的招牌必杀，消耗 100 奶气。' },
  { keys:'前 + I / K + I', name:'流派突进奥义', detail:'各流派独有的冲锋、多段、幻步或印记追击，消耗 100 奶气。' },
  { keys:'下 + I / U + I', name:'流派升空奥义', detail:'风轮、炎柱、月井、花雨、冰龙等独立效果，消耗 100 奶气。' },
  { keys:'后 + I / L + I', name:'流派空袭奥义', detail:'分身、陨火、月珠、花瓣、冰雨等四波空袭，消耗 100 奶气。' },
]);

export const DIFFICULTIES = Object.freeze({
  easy: {name:'散步蛙',reaction:.38,aggression:.48,block:.16,accuracy:.45,combo:.28,confirmDelay:.20,chainLimit:2,recoveryGap:.62,escape:.25,escapeCombo:3,escapeReaction:.20,dodgeReaction:.26,blinkPause:2.0,chaseBlink:0,punish:.25,skills:.25,ultimate:.18,tactics:.08,run:false},
  normal: {name:'认真蛙',reaction:.21,aggression:.77,block:.44,accuracy:.74,combo:.68,confirmDelay:.10,chainLimit:4,recoveryGap:.14,escape:.62,escapeCombo:2,escapeReaction:.12,dodgeReaction:.15,blinkPause:1.0,chaseBlink:.10,punish:.55,skills:.65,ultimate:.38,tactics:.30,run:true},
  hard: {name:'暴躁蛙',reaction:.10,aggression:.96,block:.78,accuracy:.95,combo:.96,confirmDelay:.045,chainLimit:7,recoveryGap:.055,escape:.92,escapeCombo:1,escapeReaction:.105,dodgeReaction:.075,blinkPause:.42,chaseBlink:.45,punish:.95,skills:.90,ultimate:.78,tactics:.72,run:true},
});

export const KEYMAPS = Object.freeze([
  { KeyA: 'left', KeyD: 'right', KeyW: 'jump', KeyS: 'down', KeyE:'blink', KeyJ: 'jab', KeyK: 'kick', KeyL: 'special', KeyI: 'super', KeyU: 'uppercut', KeyO: 'grab', KeyH: 'taunt', ShiftLeft:'run', Space: 'guard' },
  { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'jump', ArrowDown: 'down', Digit1: 'jab', Digit2: 'kick', Digit3: 'special', Digit4: 'super', Digit5: 'taunt', Digit6:'uppercut',Digit7:'grab',Digit8:'blink',Numpad8:'blink',Slash:'blink', Numpad1: 'jab', Numpad2: 'kick', Numpad3: 'special', Numpad4: 'super', Numpad5: 'taunt',Numpad6:'uppercut',Numpad7:'grab', KeyN: 'jab', KeyM: 'kick', Comma: 'special', Period: 'super', KeyB: 'taunt', ShiftRight: 'guard' },
]);

export const characterById = id => CHARACTERS.find(character => character.id === id) || CHARACTERS[0];
