export const WORLD = Object.freeze({ width: 1280, height: 720, floor: 610, left: 64, right: 1216, gravity: 2150, spriteSize: 250, standHeight: 208, crouchHeight: 130, pushDistance: 108 });

// Every variant retains the classic yellow milk-frog silhouette. Color accents,
// movement and special moves give the variants different fighting identities.
export const CHARACTERS = Object.freeze([
  { id: 'classic', name: '奶蛙', short: '奶蛙', english: 'THE ORIGINAL', title: '笑着就把你打了', color: '#e2ab3c', accent: '#ae4a2d', hue: 0, speed: 310, power: 1, jump: 1030, special: 'wave', specialName: '奶气波', superName: '爆笑奶气炮', stats: [3, 3, 4], description: '经典大肚皮。攻守均衡，一发奶气波打开局面。' },
  { id: 'green', name: '奶绿', short: '奶绿', english: 'FAST & FROGGY', title: '你还没反应过来', color: '#97ae58', accent: '#48634b', hue: 30, speed: 385, power: .86, jump: 1100, special: 'dash', specialName: '疾风突进', superName: '疾风连环踢', stats: [5, 2, 3], description: '脚下生风。突进贴脸，靠速度打出连续压制。' },
  { id: 'red', name: '奶红', short: '奶红', english: 'RED HOT BELLY', title: '这一拳直接红温', color: '#cf7f6a', accent: '#ad3e30', hue: 340, speed: 275, power: 1.22, jump: 970, special: 'stomp', specialName: '红温震地', superName: '红温大爆发', stats: [2, 5, 3], description: '一肚子力量。近身重击和红温震地都很有分量。' },
  { id: 'purple', name: '奶紫', short: '奶紫', english: 'PURPLE HAZE', title: '紫气一来你就慢了', color: '#a99cb6', accent: '#705787', hue: 275, speed: 320, power: .95, jump: 1050, special: 'bubble', specialName: '紫气泡泡', superName: '紫气东来', stats: [3, 3, 5], description: '紫气控场。泡泡命中会减速，拉开距离再出手。' },
]);

export const MOVES = Object.freeze({
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
  powerWave: { name:'螺旋奶气波', startup:.22, active:.13, recovery:.30, damage:21, reach:180, level:'high', stun:.41, push:210, cost:35, meter:6, rank:4, projectile:true },
  pulse: { name:'伏地奶气震', startup:.19, active:.13, recovery:.28, damage:13, reach:185, top:48, bottom:0, level:'low', posture:'crouch', stun:.42, push:180, cost:20, meter:5, rank:4 },
  rushSkill: { name:'破风掌', startup:.12, active:.23, recovery:.28, damage:18, reach:150, top:177, bottom:55, level:'mid', stun:.4, push:230, cost:30, meter:5, rank:4, drive:790 },
  airWave: { name:'空中散气', startup:.16, active:.12, recovery:.24, damage:11, reach:170, level:'overhead', stun:.32, push:170, cost:20, meter:4, rank:4, projectile:true },
  super: { name:'专属必杀', startup:.27, active:.22, recovery:.40, damage:33, reach:220, level:'mid', stun:.65, push:350, cost:100, meter:0, rank:5, projectile:true, invincible:.4 },
  superRush: { name:'百裂奶拳', startup:.14, active:.61, recovery:.36, damage:8, reach:192, top:183, bottom:35, level:'mid', stun:.23, push:35, launch:0, cost:100, hits:5, interval:.12, meter:0, rank:5, drive:690, invincible:.32 },
  superRise: { name:'九天升龙', startup:.13, active:.46, recovery:.35, damage:13, reach:175, top:315, bottom:40, level:'antiAir', stun:.32, push:45, launch:610, lift:610, cost:100, hits:3, interval:.15, meter:0, rank:5, invincible:.45 },
  superStorm: { name:'天降奶雨', startup:.28, active:.60, recovery:.34, damage:9, reach:240, level:'overhead', stun:.27, push:45, cost:100, hits:4, interval:.16, meter:0, rank:5, projectile:true, invincible:.35 },
  superFinish: { name:'奶气连携·终式', startup:.09, active:.68, recovery:.42, damage:8, reach:235, top:215, bottom:-5, level:'mid', stun:.24, push:25, cost:100, hits:6, interval:.11, meter:0, rank:5, drive:720, invincible:.45 },
});

export const isSuperMove = move => MOVES[move]?.rank === 5;
export const isSkillMove = move => MOVES[move]?.rank === 4;
export const COMMANDS = Object.freeze([
  { keys:'J → J → J', name:'三连奶拳', detail:'直拳 → 追身肘 → 崩山重拳，命中后依次衔接。' },
  { keys:'J → K → L → I', name:'奶气连携·终式', detail:'连续命中后按必杀，接六段终式；本连招的技能消耗计入 100 奶气总额。' },
  { keys:'下 + J / 下 + K', name:'蹲拳 / 扫堂腿', detail:'蹲下躲高段；扫腿打下盘，站防挡不住。' },
  { keys:'跳跃 + J / K / L', name:'空中拳 / 飞燕踢 / 空中散气', detail:'空中出招；飞燕踢与散气能压蹲下的对手。' },
  { keys:'U / O / K + L', name:'升龙 / 抱摔 / 旋风腿', detail:'升龙对空，抱摔破防，旋风腿两段命中。' },
  { keys:'冲刺中 J / K', name:'冲肩拳 / 滑铲', detail:'双击方向先冲刺，再出拳或铲腿。' },
  { keys:'下 + L / 前 + L', name:'伏地奶气震 / 破风掌', detail:'低段震地或向前突进，分别消耗 20 / 30 奶气。' },
  { keys:'↓ → 前 → L', name:'螺旋奶气波', detail:'半秒内依次输入，强化气功消耗 35 奶气。' },
  { keys:'I', name:'专属必杀', detail:'每只蛙独有的招牌必杀，消耗 100 奶气。' },
  { keys:'前 + I / K + I', name:'百裂奶拳', detail:'贴身突进五连击，消耗 100 奶气。' },
  { keys:'下 + I / U + I', name:'九天升龙', detail:'上升三段对空大招，消耗 100 奶气。' },
  { keys:'后 + I / L + I', name:'天降奶雨', detail:'四波空袭，命中蹲下的对手，消耗 100 奶气。' },
]);

export const DIFFICULTIES = Object.freeze({
  easy: { name: '散步蛙', reaction: .35, aggression: .42, block: .13, accuracy: .60 },
  normal: { name: '认真蛙', reaction: .21, aggression: .65, block: .35, accuracy: .77 },
  hard: { name: '暴躁蛙', reaction: .12, aggression: .86, block: .57, accuracy: .90 },
});

export const KEYMAPS = Object.freeze([
  { KeyA: 'left', KeyD: 'right', KeyW: 'jump', KeyS: 'down', KeyJ: 'jab', KeyK: 'kick', KeyL: 'special', KeyI: 'super', KeyU: 'uppercut', KeyO: 'grab', KeyH: 'taunt', ShiftLeft:'run', Space: 'guard' },
  { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'jump', ArrowDown: 'down', Digit1: 'jab', Digit2: 'kick', Digit3: 'special', Digit4: 'super', Digit5: 'taunt', Digit6:'uppercut',Digit7:'grab', Numpad1: 'jab', Numpad2: 'kick', Numpad3: 'special', Numpad4: 'super', Numpad5: 'taunt',Numpad6:'uppercut',Numpad7:'grab', KeyN: 'jab', KeyM: 'kick', Comma: 'special', Period: 'super', KeyB: 'taunt', ShiftRight: 'guard' },
]);

export const characterById = id => CHARACTERS.find(character => character.id === id) || CHARACTERS[0];
