import {CHARACTERS,MOVES,WORLD} from './config.js';

// A button is a move slot. Each fighter resolves that slot to its own move data,
// choreography, elemental rules and AI route; input remains identical on mobile.
export const STYLES=Object.freeze({
  classic:{name:'螺旋流',theme:'spiral',colors:['#fff8d5','#ffd45f','#ec943a'],range:110,
    mechanic:'螺旋掌聚拢对手，蓄力丸接近身肚击；后 + 技进入反击架势。',
    route:['jab','jab2','ender','rushSkill','superFinish'],recipe:'J → J → K → 前 L → I',
    names:['探路掌','回旋肘','螺旋肚击','摆莲腿','伏身掌','贴地扫','空旋掌','坠星踢','铁山靠','滚地铲','旋涡升龙','过肩摔','双轮旋踢','螺旋奶丸','双螺旋丸','震地回旋','螺旋突掌','空旋散丸','大玉奶丸','螺旋连弹','升空螺旋','流星奶雨','螺旋·终式','旋身摆掌','回身肘','螺旋反架','肚皮弹射'],
    overrides:{jab:{pull:25},jab2:{drive:180,pull:40},ender:{drive:310,launch:320,stun:.45},stance:{counter:true},grab:{throwArc:180,throwDistance:230}},
  },
  green:{name:'风影流',theme:'wind',colors:['#f1ffe4','#a6f28c','#3cae99'],range:100,
    mechanic:'快拳接穿身风刃，分身延迟追击；普攻收招短，适合持续抢攻。',
    route:['jab','jab2','branch','rushSkill','superRush'],recipe:'J → J → K → 前 L → 前 I',
    names:['疾风刺','影切肘','回风踢','剪风腿','潜影掌','扫叶腿','空影拳','燕返踢','瞬身撞','掠地滑','风轮升空','风车摔','风轮双切','风影分身','双影风刃','伏地风阵','穿风闪袭','空刃散射','千影连袭','疾风十字','风轮龙卷','群影空袭','风影·乱舞','穿身回踢','回风双掌','残影伏兵','影步连踢'],
    overrides:{jab:{startup:.045,recovery:.10,damage:5,drive:110},jab2:{startup:.04,recovery:.10,drive:210},straight:{drive:300,launch:260},kick:{startup:.09,active:.14,drive:150},branch:{drive:660,reach:165,travelThrough:true},link:{drive:420,hits:2,interval:.1,active:.22,damage:5},ender:{drive:480,hits:2,interval:.11,active:.24,damage:6},rushSkill:{drive:1180,travelThrough:true,hits:2,interval:.12,active:.25,damage:10},spin:{hits:3,interval:.11,active:.34,damage:6},grab:{throwArc:220,throwDistance:330,throwDuration:.52},uppercut:{hits:2,interval:.1,active:.23,damage:8,lift:650},special:{startup:.13,pattern:'clone'},powerWave:{pattern:'windFan'},pulse:{posture:null,projectile:true,pattern:'windField'},stance:{projectile:true,pattern:'clone',counter:false},super:{pattern:'cloneStorm',active:.65,hits:5,interval:.13,damage:8},superRush:{drive:1050,travelThrough:true,hits:7,interval:.09,active:.64,damage:6},superRise:{hits:4,interval:.11,active:.46,damage:9,lift:720},superStorm:{pattern:'cloneRain'},superFinish:{travelThrough:true,drive:1150,hits:8,interval:.085,active:.69,damage:6}},
  },
  red:{name:'熔火流',theme:'fire',colors:['#fff5bb','#ffab4e','#e54c35'],range:120,
    mechanic:'慢启动重拳带短暂霸体，火柱延迟爆发，烈焰蓄势能扛住一次轻击。',
    route:['jab','jab2','ender','rushSkill','super'],recipe:'J → J → K → 前 L → I',
    names:['崩岩拳','锻火肘','熔岩重锤','烈焰摆腿','碎岩掌','熔地扫','空坠锤','陨火踢','炉心冲撞','火犁滑','爆炎升龙','火山背摔','熔火回轮','地走炎','炎龙吐息','三重火柱','爆燃冲拳','火雨散弹','火山大喷发','熔炉连轰','冲天炎柱','陨火天降','熔火·碎岳','裂地锤','熔岩膝','烈焰蓄势','爆炎砸地'],
    overrides:{jab:{startup:.105,damage:10,armor:.18,reach:135},jab2:{damage:9,armor:.18,drive:200},straight:{damage:15,startup:.17,armor:.25,launch:400},kick:{damage:15,startup:.19,armor:.2},branch:{damage:13,armor:.24,launch:290},ender:{damage:17,startup:.18,armor:.25,launch:450},uppercut:{damage:18,lift:620,launch:760,armor:.25},grab:{throwArc:270,throwDistance:190,throwDuration:.8,damage:19},special:{pattern:'fireGround'},powerWave:{pattern:'fireBreath',level:'mid'},pulse:{posture:null,projectile:true,pattern:'eruption',active:.40,hits:3,interval:.15},stance:{projectile:true,pattern:'fireGuard',armor:.65,counter:false},rushSkill:{drive:650,armor:.35,damage:21},super:{pattern:'volcano',active:.8,hits:5,interval:.16,damage:10},superRush:{hits:3,interval:.2,active:.62,damage:14,armor:.65,drive:610},superRise:{armor:.6,damage:15},superStorm:{pattern:'fireRain'},superFinish:{armor:.8,hits:4,interval:.17,active:.7,damage:13,launch:300}},
  },
  purple:{name:'幻月流',theme:'void',colors:['#f5ddff','#c598f1','#7862dc'],range:145,
    mechanic:'长距离月刃与牵引结界控制落点；幻步突袭换边，绕过正面防御。',
    route:['jab','kick','link','special','superStorm'],recipe:'J → K → J → L → 后 I',
    names:['月刃掌','回月勾','幻月斩','弦月踢','影缚指','月轮扫','空月刃','月落踢','幻步掌','影潜滑','月轮升空','幻月摔','月刃回环','幻月追珠','三月连珠','牵引结界','幻步背袭','空月散珠','月蚀结界','月轮追袭','月轮升华','幻月天幕','幻月·寂灭','新月横切','月钩牵引','引力月井','满月坠击'],
    overrides:{jab:{reach:162,startup:.09,pull:80},jab2:{reach:172,pull:100},kick:{reach:192,pull:100,damage:10},link:{reach:200,pull:280,stun:.43},branch:{reach:182,slow:1.2},ender:{reach:200,launch:310},uppercut:{reach:165,pull:120,launch:560,lift:420},grab:{throwArc:110,throwDistance:360,throwDuration:.58,slow:1},special:{pattern:'homing',startup:.17},powerWave:{pattern:'moonFan'},pulse:{posture:null,projectile:true,pattern:'gravityField',active:.5},stance:{projectile:true,pattern:'gravityField',counter:false},rushSkill:{warp:true,drive:0,pull:80},super:{pattern:'moonPrison',active:.8,hits:5,interval:.16,damage:9},superRush:{warp:true,drive:0,reach:230,pull:230},superRise:{projectile:true,pattern:'moonPrison',lift:0,launch:0,damage:11},superStorm:{pattern:'moonRain'},superFinish:{projectile:true,pattern:'moonPrison',damage:8}},
  },
  pink:{name:'绯绫流',theme:'ribbon',colors:['#fff1f6','#ffb4d5','#dd648e'],range:135,
    mechanic:'丝带远端打击留下绯印，第三层引爆并回血；回旋心弹飞回时可再命中。',
    route:['jab','kick','link','special','superFinish'],recipe:'J → K → J → L → I',
    names:['绯绫掌','绕指肘','绯花绽放','飞绫踢','绯线指','绫尾扫','空绫掌','花落踢','飞花撞','绯绫滑','花旋升龙','绫缚投','绯花双舞','回旋心弹','双心回旋','绯绫牵引','飞绫穿心','空花散瓣','千绫花葬','绯花连舞','花雨升空','落英缤纷','绯绫·绽放','绯绫绞击','绕背牵绫','绯花结界','花蕾重踢'],
    overrides:{jab:{reach:145,mark:true},jab2:{reach:155,mark:true},kick:{reach:178,mark:true},branch:{reach:178,mark:true,pull:140},link:{reach:180,mark:true,pull:210,stun:.42},ender:{reach:180,mark:true,hits:2,interval:.13,active:.28,damage:7},uppercut:{mark:true,reach:150,launch:570,lift:590},grab:{throwArc:200,throwDistance:280,throwDuration:.72,mark:true},special:{pattern:'boomerang'},powerWave:{pattern:'heartPair'},pulse:{posture:null,projectile:true,pattern:'ribbonField'},stance:{projectile:true,pattern:'ribbonField',counter:false},rushSkill:{drive:850,mark:true,pull:110},super:{pattern:'ribbonStorm',active:.65,hits:5,interval:.13,damage:9},superRush:{mark:true,pull:60,drive:810,hits:6,interval:.1,active:.61,damage:7},superRise:{mark:true,hits:4,interval:.115,active:.47,damage:10},superStorm:{pattern:'petalRain'},superFinish:{projectile:true,pattern:'ribbonStorm',damage:8}},
  },
  blue:{name:'冰镜流',theme:'ice',colors:['#edfdff','#a3e5ff','#4c9bd5'],range:130,
    mechanic:'冰掌叠加霜印，三层冻结；冰镜阻挡飞行物，冰棱与滑行封锁地面。',
    route:['jab','jab2','ender','special','superRise'],recipe:'J → J → K → L → 下 I',
    names:['霜刃掌','冰镜肘','碎冰击','冰轮踢','寒指','冰面扫','空霜掌','冰坠踢','冰棱撞','冰面疾滑','冰棱升龙','冰镜背摔','冰轮双旋','冰晶飞针','冰针扇阵','冰棱封路','冰镜滑袭','空棱散射','冰镜牢笼','冰轮追击','冰龙升腾','极地冰雨','冰镜·破封','霜裂回踢','冰钩掌','凝霜冰镜','碎镜重踢'],
    overrides:{jab:{reach:130,frost:true},jab2:{reach:140,frost:true},kick:{reach:165,frost:true},branch:{frost:true,reach:170},link:{frost:true,pull:120,reach:165},ender:{frost:true,damage:13,launch:360},slide:{drive:850,frost:true},uppercut:{frost:true,reach:155,lift:510,launch:670},grab:{frost:true,throwArc:150,throwDistance:250,throwDuration:.68},rushSkill:{drive:950,frost:true},special:{pattern:'iceNeedle'},powerWave:{pattern:'iceFan'},pulse:{posture:null,projectile:true,pattern:'iceSpikes',active:.45,hits:3,interval:.16},stance:{projectile:true,pattern:'iceWall',counter:false},super:{pattern:'iceCage',active:.8,hits:5,interval:.16,damage:9},superRush:{frost:true,drive:900,hits:4,interval:.15,active:.62,damage:10},superRise:{frost:true,lift:690,launch:760},superStorm:{pattern:'iceRain'},superFinish:{projectile:true,pattern:'iceCage',damage:8}},
  },
});

export const EXTRA_MOVES={
  branch:{name:'分支追击',startup:.08,active:.14,recovery:.2,damage:10,reach:155,top:172,bottom:55,level:'mid',stun:.36,push:45,meter:9,rank:2.3,drive:240},
  link:{name:'回身追击',startup:.08,active:.13,recovery:.2,damage:8,reach:155,top:167,bottom:55,level:'mid',stun:.38,push:25,meter:8,rank:2.6,drive:180},
  stance:{name:'战术架势',startup:.12,active:.5,recovery:.22,damage:12,reach:170,top:180,bottom:40,level:'mid',stun:.38,push:80,cost:20,meter:3,rank:4,counter:true},
  ender:{name:'连击终结',startup:.11,active:.18,recovery:.26,damage:12,reach:170,top:185,bottom:35,level:'mid',stun:.44,push:70,meter:10,rank:3,drive:260},
};
const slots=[...Object.keys(MOVES),...Object.keys(EXTRA_MOVES)];
const scaled=data=>Object.fromEntries(Object.entries(data).map(([key,value])=>[key,['reach','top','bottom','push'].includes(key)?value*WORLD.fighterScale:value]));
export const MOVESETS=Object.freeze(Object.fromEntries(CHARACTERS.map(character=>{
  const style=STYLES[character.id];
  return [character.id,Object.freeze(Object.fromEntries(slots.map((slot,i)=>{
    const base=MOVES[slot]||scaled(EXTRA_MOVES[slot]),override=scaled(style.overrides[slot]||{});
    return [slot,Object.freeze({...base,...override,name:style.names[i],theme:style.theme,colors:style.colors})];
  })))];
})));
export const styleOf=character=>STYLES[typeof character==='string'?character:character.id]||STYLES.classic;
export const moveFor=(character,slot)=>MOVESETS[typeof character==='string'?character:character.id]?.[slot];
