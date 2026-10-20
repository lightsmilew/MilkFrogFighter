export const WORLD = Object.freeze({ width: 1280, height: 720, floor: 610, left: 80, right: 1200, gravity: 2050 });

// Every variant retains the classic yellow milk-frog silhouette. Color accents,
// movement and special moves give the variants different fighting identities.
export const CHARACTERS = Object.freeze([
  { id: 'classic', name: '奶蛙', short: '奶蛙', english: 'THE ORIGINAL', title: '笑着就把你打了', color: '#e2ab3c', accent: '#ae4a2d', hue: 0, speed: 270, power: 1, jump: 790, special: 'wave', specialName: '奶气波', superName: '爆笑奶气炮', stats: [3, 3, 4], description: '经典大肚皮。攻守均衡，一发奶气波打开局面。' },
  { id: 'green', name: '奶绿', short: '奶绿', english: 'FAST & FROGGY', title: '你还没反应过来', color: '#97ae58', accent: '#48634b', hue: 30, speed: 345, power: .86, jump: 865, special: 'dash', specialName: '疾风突进', superName: '疾风连环踢', stats: [5, 2, 3], description: '脚下生风。突进贴脸，靠速度打出连续压制。' },
  { id: 'red', name: '奶红', short: '奶红', english: 'RED HOT BELLY', title: '这一拳直接红温', color: '#cf7f6a', accent: '#ad3e30', hue: 340, speed: 225, power: 1.22, jump: 730, special: 'stomp', specialName: '红温震地', superName: '红温大爆发', stats: [2, 5, 3], description: '一肚子力量。近身重击和红温震地都很有分量。' },
  { id: 'purple', name: '奶紫', short: '奶紫', english: 'PURPLE HAZE', title: '紫气一来你就慢了', color: '#a99cb6', accent: '#705787', hue: 275, speed: 280, power: .95, jump: 810, special: 'bubble', specialName: '紫气泡泡', superName: '紫气东来', stats: [3, 3, 5], description: '紫气控场。泡泡命中会减速，拉开距离再出手。' },
]);

export const MOVES = Object.freeze({
  jab: { startup: .075, active: .10, recovery: .16, damage: 7, reach: 140, stun: .22, push: 145, meter: 8, name: '直拳' },
  kick: { startup: .15, active: .13, recovery: .25, damage: 12, reach: 185, stun: .31, push: 235, meter: 12, name: '踢腿' },
  special: { startup: .23, active: .12, recovery: .34, damage: 15, reach: 190, stun: .34, push: 250, cost: 25, meter: 5 },
  super: { startup: .32, active: .25, recovery: .5, damage: 33, reach: 225, stun: .62, push: 430, cost: 100, meter: 0 },
});

export const DIFFICULTIES = Object.freeze({
  easy: { name: '散步蛙', reaction: .35, aggression: .42, block: .13, accuracy: .60 },
  normal: { name: '认真蛙', reaction: .21, aggression: .65, block: .35, accuracy: .77 },
  hard: { name: '暴躁蛙', reaction: .12, aggression: .86, block: .57, accuracy: .90 },
});

export const KEYMAPS = Object.freeze([
  { KeyA: 'left', KeyD: 'right', KeyW: 'jump', KeyS: 'down', KeyJ: 'jab', KeyK: 'kick', KeyL: 'special', KeyI: 'super', KeyH: 'taunt', Space: 'guard' },
  { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'jump', ArrowDown: 'down', Digit1: 'jab', Digit2: 'kick', Digit3: 'special', Digit4: 'super', Digit5: 'taunt', Numpad1: 'jab', Numpad2: 'kick', Numpad3: 'special', Numpad4: 'super', Numpad5: 'taunt', KeyN: 'jab', KeyM: 'kick', Comma: 'special', Period: 'super', KeyB: 'taunt', ShiftRight: 'guard' },
]);

export const characterById = id => CHARACTERS.find(character => character.id === id) || CHARACTERS[0];
