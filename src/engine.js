import { WORLD, MOVES, DIFFICULTIES, characterById } from './config.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const neutral = () => ({ held: new Set(), pressed: new Set() });
const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class Fighter {
  constructor(id, index) {
    this.character = characterById(id);
    this.index = index;
    this.reset();
  }

  reset() {
    Object.assign(this, { x: this.index === 0 ? 350 : 930, y: WORLD.floor, vx: 0, vy: 0, facing: this.index === 0 ? 1 : -1,
      hp: 100, trailHp: 100, energy: 25, state: 'idle', stateTime: 0, attack: null, stun: 0, slow: 0,
      combo: 0, comboTimer: 0, maxCombo: 0, landed: 0, blocking: false, crouching: false, flash: 0, invincible: 0,
      buffer: null, previousMove: null, cancelTime: 0, aiThink: 0, aiHeld: new Set(), aiPressed: new Set(), hasHit: false, stunKind: 'hurt', tauntTime: 0 });
  }

  get grounded() { return this.y >= WORLD.floor - .5; }
  get hurtbox() {
    return { x: this.x - 42, y: this.y - (this.crouching ? 112 : 205), w: 84, h: this.crouching ? 112 : 205 };
  }
}

/** Pure combat simulation. Rendering, audio and browser input live outside this class. */
export class Game {
  constructor({ onEvent = () => {}, random = Math.random } = {}) {
    this.onEvent = onEvent;
    this.random = random;
    this.mode = 'ai';
    this.difficulty = 'normal';
    this.fighters = [new Fighter('classic', 0), new Fighter('green', 1)];
    this.phase = 'attract';
    this.time = 0;
    this.round = 1;
    this.wins = [0, 0];
    this.projectiles = [];
    this.effects = [];
    this.roundTime = 60;
    this.hitstop = 0;
    this.shake = 0;
    this.phaseTime = 0;
    this.practiceGuard = false;
    this.matchWinner = null;
    this.lastWinner = null;
    this.matchStats = [{ hits: 0, maxCombo: 0 }, { hits: 0, maxCombo: 0 }];
  }

  emit(type, data = {}) { this.onEvent({ type, ...data }); }

  start({ p1 = 'classic', p2 = 'green', mode = 'ai', difficulty = 'normal', practiceGuard = false } = {}) {
    this.mode = mode;
    this.difficulty = difficulty;
    this.practiceGuard = practiceGuard;
    this.fighters = [new Fighter(p1, 0), new Fighter(p2, 1)];
    this.wins = [0, 0];
    this.round = 1;
    this.matchWinner = null;
    this.lastWinner = null;
    this.matchStats = [{ hits: 0, maxCombo: 0 }, { hits: 0, maxCombo: 0 }];
    this.newRound();
  }

  newRound() {
    this.fighters.forEach(fighter => fighter.reset());
    this.projectiles = [];
    this.effects = [];
    this.roundTime = 60;
    this.hitstop = 0;
    this.shake = 0;
    this.phase = this.mode === 'practice' ? 'fight' : 'intro';
    this.phaseTime = 0;
    if (this.mode === 'practice') this.fighters.forEach(fighter => { fighter.energy = 100; });
    this.emit('round', { round: this.round });
  }

  preview(p1, p2) {
    if (this.phase !== 'attract') return;
    this.fighters = [new Fighter(p1, 0), new Fighter(p2, 1)];
    this.fighters[0].x = 825;
    this.fighters[1].x = 1080;
  }

  toAttract() {
    this.phase = 'attract';
    this.projectiles = [];
    this.effects = [];
  }

  tick(dt, inputs = [neutral(), neutral()]) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 30);
    this.updateEffects(dt);
    if (this.phase === 'attract' || this.phase === 'matchOver') return;
    if (this.hitstop > 0) {
      // A strike briefly freezes the scene, but hands keep moving. Preserve
      // attack presses during this pause so a hit-confirmed combo is reliable.
      if (this.phase === 'fight') inputs.forEach((input, index) => {
        for (const move of ['super', 'special', 'kick', 'jab']) {
          if (input?.pressed.has(move)) { this.fighters[index].buffer = { move, ttl: .16 }; break; }
        }
      });
      this.hitstop -= dt;
      return;
    }
    this.phaseTime += dt;
    if (this.phase === 'intro') {
      if (this.phaseTime >= 2.2) { this.phase = 'fight'; this.phaseTime = 0; this.emit('fight'); }
      return;
    }
    if (this.phase === 'roundOver') {
      for (const fighter of this.fighters) { fighter.stateTime += dt; this.physics(fighter, dt); }
      if (this.phaseTime >= 2.8) {
        if (this.wins.some(wins => wins >= 2)) {
          this.phase = 'matchOver'; this.matchWinner = this.wins[0] >= 2 ? 0 : 1;
          this.emit('matchEnd', { winner: this.matchWinner, wins: [...this.wins] });
        } else { this.round++; this.newRound(); }
      }
      return;
    }

    if (this.mode !== 'practice') this.roundTime = Math.max(0, this.roundTime - dt);
    const [a, b] = this.fighters;
    if (!a.attack) a.facing = a.x <= b.x ? 1 : -1;
    if (!b.attack) b.facing = b.x >= a.x ? -1 : 1;
    if (this.mode === 'ai') inputs[1] = this.ai(b, a, dt);
    if (this.mode === 'practice') inputs[1] = { held: new Set(this.practiceGuard ? ['guard'] : []), pressed: new Set() };

    for (let i = 0; i < 2; i++) this.updateFighter(this.fighters[i], inputs[i] || neutral(), dt);
    this.resolvePush(a, b);
    for (const fighter of this.fighters) this.resolveAttack(fighter, this.fighters[1 - fighter.index]);
    this.updateProjectiles(dt);

    if (this.mode === 'practice') {
      for (const fighter of this.fighters) {
        fighter.energy = 100;
        if (fighter.hp <= 0 || (fighter.stun <= 0 && fighter.comboTimer <= 0)) fighter.hp = 100;
      }
    } else if (a.hp <= 0 || b.hp <= 0 || this.roundTime <= 0) this.endRound();
  }

  updateFighter(fighter, input, dt) {
    const { held, pressed } = input;
    fighter.stateTime += dt;
    fighter.flash = Math.max(0, fighter.flash - dt);
    fighter.invincible = Math.max(0, fighter.invincible - dt);
    fighter.slow = Math.max(0, fighter.slow - dt);
    fighter.stun = Math.max(0, fighter.stun - dt);
    fighter.cancelTime = Math.max(0, fighter.cancelTime - dt);
    fighter.comboTimer = Math.max(0, fighter.comboTimer - dt);
    fighter.trailHp += (fighter.hp - fighter.trailHp) * Math.min(1, dt * 3.5);
    fighter.energy = clamp(fighter.energy + dt * 3, 0, 100);
    if (fighter.comboTimer === 0) fighter.combo = 0;
    fighter.blocking = false;

    for (const move of ['super', 'special', 'kick', 'jab']) {
      if (pressed.has(move)) { fighter.buffer = { move, ttl: .16 }; break; }
    }
    if (fighter.buffer) { fighter.buffer.ttl -= dt; if (fighter.buffer.ttl <= 0) fighter.buffer = null; }

    if (fighter.stun > 0) {
      fighter.state = fighter.hp <= 0 ? 'ko' : fighter.stunKind;
      fighter.attack = null;
      fighter.crouching = false;
      this.physics(fighter, dt);
      return;
    }

    if (fighter.attack) {
      fighter.attack.time += dt;
      const attack = fighter.attack;
      if (!attack.spawned && attack.time >= attack.config.startup && (attack.move === 'special' || attack.move === 'super')) {
        attack.spawned = true;
        this.spawnSpecial(fighter, attack);
      }
      const cancel = fighter.buffer && fighter.hasHit && fighter.cancelTime > 0 &&
        ((attack.move === 'jab' && ['kick', 'special', 'super'].includes(fighter.buffer.move)) ||
        (attack.move === 'kick' && ['special', 'super'].includes(fighter.buffer.move)) ||
        (attack.move === 'special' && fighter.buffer.move === 'super'));
      if (cancel) {
        const move = fighter.buffer.move;
        if (fighter.energy >= (MOVES[move].cost || 0)) { fighter.attack = null; this.beginAttack(fighter, move); }
      } else if (attack.time >= attack.config.startup + attack.config.active + attack.config.recovery) {
        fighter.attack = null; fighter.state = 'idle'; fighter.stateTime = 0;
      }
      this.physics(fighter, dt);
      return;
    }

    fighter.crouching = held.has('down') && fighter.grounded;
    const movingBack = (fighter.facing === 1 && held.has('left')) || (fighter.facing === -1 && held.has('right'));
    fighter.blocking = fighter.grounded && (held.has('guard') || movingBack);
    if (pressed.has('taunt') && fighter.grounded && fighter.tauntTime <= 0) {
      fighter.tauntTime = 1.8; fighter.stateTime = 0;
      this.emit('laugh', { index: fighter.index });
    }
    if (fighter.buffer || pressed.has('jump') || held.has('left') || held.has('right') || held.has('guard')) fighter.tauntTime = 0;
    if (fighter.tauntTime > 0) {
      fighter.tauntTime = Math.max(0, fighter.tauntTime - dt);
      fighter.state = 'taunt'; fighter.vx = 0; fighter.blocking = false;
      this.physics(fighter, dt); return;
    }
    if (fighter.buffer && !held.has('guard')) this.beginAttack(fighter, fighter.buffer.move);
    if (!fighter.attack) {
      if (pressed.has('jump') && fighter.grounded) {
        fighter.vy = -fighter.character.jump;
        fighter.crouching = false; fighter.blocking = false; fighter.stateTime = 0;
        this.emit('jump', { index: fighter.index });
      }
      let direction = Number(held.has('right')) - Number(held.has('left'));
      if (fighter.crouching || held.has('guard')) direction = 0;
      const speed = fighter.character.speed * (fighter.slow > 0 ? .58 : 1);
      fighter.vx += (direction * speed - fighter.vx) * Math.min(1, dt * (fighter.grounded ? 20 : 6));
      fighter.state = !fighter.grounded ? 'jump' : fighter.crouching ? 'crouch' : held.has('guard') ? 'guard' : direction ? 'walk' : 'idle';
    }
    this.physics(fighter, dt);
  }

  physics(fighter, dt) {
    fighter.x = clamp(fighter.x + fighter.vx * dt, WORLD.left, WORLD.right);
    if (!fighter.grounded || fighter.vy < 0) {
      fighter.vy += WORLD.gravity * dt;
      fighter.y += fighter.vy * dt;
      if (fighter.y >= WORLD.floor) {
        fighter.y = WORLD.floor; fighter.vy = 0;
        this.effect('dust', fighter.x, WORLD.floor, '#f5e1ba', 8);
        this.emit('land', { index: fighter.index });
      }
    }
    if (fighter.attack || fighter.stun > 0) fighter.vx *= Math.exp(-dt * 8);
  }

  beginAttack(fighter, move) {
    const config = MOVES[move];
    if (!config || fighter.energy + .001 < (config.cost || 0)) {
      if (fighter.buffer) this.emit('noEnergy', { index: fighter.index });
      fighter.buffer = null;
      return false;
    }
    fighter.energy = clamp(fighter.energy - (config.cost || 0), 0, 100);
    fighter.attack = { move, config, time: 0, connected: false, spawned: false, aerial: !fighter.grounded };
    fighter.state = move;
    fighter.stateTime = 0;
    fighter.buffer = null;
    fighter.hasHit = false;
    fighter.blocking = false;
    fighter.vx *= .25;
    this.emit('attack', { move, index: fighter.index, character: fighter.character.id });
    if (move === 'super') {
      fighter.invincible = .55;
      this.shake = 10;
      this.effect('super', fighter.x, fighter.y - 120, fighter.character.accent, 1, .9);
      this.emit('super', { index: fighter.index, name: fighter.character.superName });
    }
    return true;
  }

  resolvePush(a, b) {
    if (Math.abs(a.y - b.y) > 160) return;
    const distance = b.x - a.x;
    if (Math.abs(distance) < 88) {
      const push = (88 - Math.abs(distance)) / 2;
      const sign = distance >= 0 ? 1 : -1;
      a.x = clamp(a.x - sign * push, WORLD.left, WORLD.right);
      b.x = clamp(b.x + sign * push, WORLD.left, WORLD.right);
    }
  }

  resolveAttack(attacker, defender) {
    const attack = attacker.attack;
    if (!attack || attack.connected || ['special', 'super'].includes(attack.move)) return;
    const { config, time } = attack;
    if (time < config.startup || time > config.startup + config.active) return;
    const reach = config.reach;
    const top = attacker.crouching ? 93 : attack.move === 'jab' ? 185 : 160;
    const height = attacker.crouching ? 75 : attack.move === 'jab' ? 70 : 120;
    const box = { x: attacker.facing === 1 ? attacker.x : attacker.x - reach, y: attacker.y - top, w: reach, h: height };
    if (intersects(box, defender.hurtbox) && defender.invincible <= 0) {
      attack.connected = true;
      this.hit(attacker, defender, config, attack.move);
    }
  }

  spawnSpecial(fighter, attack) {
    const isSuper = attack.move === 'super';
    const kind = fighter.character.special;
    if (kind === 'dash') {
      fighter.vx = fighter.facing * (isSuper ? 1150 : 950);
      fighter.invincible = isSuper ? .4 : .14;
    }
    const direction = fighter.facing;
    this.projectiles.push({ owner: fighter.index, x: fighter.x + direction * 80, y: fighter.y - (kind === 'stomp' ? 30 : 125),
      vx: direction * (kind === 'dash' ? 820 : kind === 'bubble' ? 450 : kind === 'stomp' ? 590 : 640),
      radius: isSuper ? 76 : kind === 'stomp' ? 45 : 32, life: isSuper ? 1.8 : 2.1, age: 0,
      damage: attack.config.damage, config: attack.config, kind, super: isSuper, color: fighter.character.accent,
      slow: kind === 'bubble', visual: kind === 'dash' ? 'slash' : kind === 'stomp' ? 'ground' : 'orb' });
    this.emit('projectile', { index: fighter.index, super: isSuper });
  }

  updateProjectiles(dt) {
    for (const projectile of this.projectiles) {
      projectile.life -= dt;
      projectile.age += dt;
      projectile.x += projectile.vx * dt;
      const defender = this.fighters[1 - projectile.owner];
      const box = { x: projectile.x - projectile.radius, y: projectile.y - projectile.radius, w: projectile.radius * 2, h: projectile.radius * 2 };
      if (projectile.life > 0 && defender.invincible <= 0 && intersects(box, defender.hurtbox)) {
        this.hit(this.fighters[projectile.owner], defender, projectile.config, projectile.super ? 'super' : 'special', projectile);
        projectile.life = 0;
      }
      if (projectile.x < -100 || projectile.x > WORLD.width + 100) projectile.life = 0;
    }
    // Opposing projectiles cancel, while a super can overpower a normal wave.
    for (let i = 0; i < this.projectiles.length; i++) for (let j = i + 1; j < this.projectiles.length; j++) {
      const a = this.projectiles[i], b = this.projectiles[j];
      if (a.owner !== b.owner && a.life > 0 && b.life > 0 && Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius) {
        if (!a.super || b.super) a.life = 0;
        if (!b.super || a.super) b.life = 0;
        this.effect('spark', (a.x + b.x) / 2, (a.y + b.y) / 2, '#fff2c1', 14);
        this.emit('clash');
      }
    }
    this.projectiles = this.projectiles.filter(projectile => projectile.life > 0);
  }

  hit(attacker, defender, config, move, projectile = null) {
    if (defender.invincible > 0 || defender.hp <= 0) return;
    const direction = projectile ? Math.sign(projectile.vx) : attacker.facing;
    const front = Math.sign(attacker.x - defender.x) === defender.facing;
    const blocked = defender.blocking && front && defender.grounded && !defender.attack && defender.stun <= 0;
    const damage = config.damage * attacker.character.power * (attacker.combo > 1 ? .8 : 1);
    defender.hp = Math.max(0, defender.hp - (blocked ? damage * .12 : damage));
    defender.vx = direction * config.push * (blocked ? .38 : 1);
    const hitY = Math.max(defender.y - 120, Math.min(attacker.y - 110, defender.y - 30));
    if (blocked) {
      defender.stun = .11;
      defender.stunKind = 'guard';
      defender.state = 'guard';
      defender.energy = clamp(defender.energy + 7, 0, 100);
      this.effect('block', defender.x - defender.facing * -42, hitY, '#b1e7e2', 8);
      this.hitstop = .025;
      this.emit('block', { index: defender.index });
    } else {
      defender.stun = config.stun;
      defender.stunKind = 'hurt';
      defender.state = defender.hp <= 0 ? 'ko' : 'hurt';
      defender.stateTime = 0;
      defender.tauntTime = 0;
      defender.attack = null;
      defender.flash = .14;
      defender.crouching = false;
      if (projectile?.slow) defender.slow = projectile.super ? 2.1 : 1.2;
      defender.energy = clamp(defender.energy + 8, 0, 100);
      if (move === 'super') defender.vy = -320;
      attacker.combo++;
      attacker.comboTimer = config.stun + .33;
      attacker.maxCombo = Math.max(attacker.maxCombo, attacker.combo);
      attacker.landed++;
      this.matchStats[attacker.index].hits++;
      this.matchStats[attacker.index].maxCombo = Math.max(this.matchStats[attacker.index].maxCombo, attacker.combo);
      attacker.hasHit = true;
      attacker.cancelTime = .3;
      attacker.energy = clamp(attacker.energy + (config.meter || 0), 0, 100);
      this.hitstop = move === 'super' ? .12 : move === 'kick' ? .065 : .045;
      this.shake = move === 'super' ? 18 : move === 'kick' ? 7 : 4;
      this.effect('spark', defender.x - direction * 30, hitY, move === 'super' ? '#ffce62' : '#fff1b8', move === 'super' ? 26 : 13);
      this.effect('ring', defender.x - direction * 30, hitY, '#fff2d3', 1, .32);
      this.effect('impact', defender.x - direction * 30, hitY, attacker.character.accent, 1, move === 'super' ? .36 : .19);
      this.emit('hit', { index: attacker.index, target: defender.index, move, damage, combo: attacker.combo });
    }
  }

  endRound() {
    const [a, b] = this.fighters;
    const winner = a.hp === b.hp ? null : a.hp > b.hp ? 0 : 1;
    this.lastWinner = winner;
    if (winner !== null) this.wins[winner]++;
    this.phase = 'roundOver'; this.phaseTime = 0; this.projectiles = [];
    for (const fighter of this.fighters) {
      fighter.attack = null; fighter.blocking = false;
      fighter.state = fighter.index === winner ? 'victory' : fighter.hp <= 0 ? 'ko' : 'idle';
      fighter.stateTime = 0;
      fighter.vx = 0;
    }
    this.emit('roundEnd', { winner, knockout: a.hp <= 0 || b.hp <= 0 });
  }

  ai(fighter, opponent, dt) {
    const level = DIFFICULTIES[this.difficulty] || DIFFICULTIES.normal;
    fighter.aiThink -= dt;
    const pressed = new Set();
    if (fighter.aiThink <= 0) {
      fighter.aiThink = level.reaction * (.8 + this.random() * .5);
      const held = new Set();
      const distance = Math.abs(fighter.x - opponent.x);
      const towards = opponent.x < fighter.x ? 'left' : 'right';
      const away = towards === 'left' ? 'right' : 'left';
      const danger = opponent.attack || this.projectiles.some(projectile => projectile.owner !== fighter.index && Math.abs(projectile.x - fighter.x) < 320);
      if (danger && this.random() < level.block) held.add('guard');
      else {
        if (distance > 145) held.add(towards);
        if (distance < 100 && this.random() < .3) held.add(away);
        if (!fighter.attack && fighter.stun <= 0 && this.random() < level.aggression) {
          if (fighter.energy >= 100 && distance < 600) pressed.add('super');
          else if (fighter.energy >= 25 && distance > 220 && this.random() < .65) pressed.add('special');
          else if (distance < 165 * level.accuracy + 40) pressed.add(this.random() < .58 ? 'jab' : 'kick');
          if (distance > 180 && distance < 450 && fighter.grounded && this.random() < .13) pressed.add('jump');
        }
      }
      fighter.aiHeld = held;
    }
    return { held: fighter.aiHeld, pressed };
  }

  effect(type, x, y, color, count, duration = .48) {
    for (let i = 0; i < count; i++) {
      const angle = this.random() * Math.PI * 2;
      const speed = 75 + this.random() * 280;
      this.effects.push({ type, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, color, life: duration, duration, size: 2 + this.random() * 6 });
    }
    if (this.effects.length > 240) this.effects.splice(0, this.effects.length - 240);
  }

  updateEffects(dt) {
    for (const effect of this.effects) {
      effect.life -= dt;
      if (['spark', 'dust'].includes(effect.type)) {
        effect.x += effect.vx * dt; effect.y += effect.vy * dt;
        effect.vy += dt * (effect.type === 'dust' ? -180 : 550);
      }
    }
    this.effects = this.effects.filter(effect => effect.life > 0);
  }
}
