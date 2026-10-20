import { KEYMAPS } from './config.js';

export class Input {
  constructor(onShortcut) {
    this.enabled = false;
    this.keys = new Set();
    this.edges = new Set();
    this.touch = new Map();
    this.touchEdges = new Set();
    this.stickHeld = new Set();
    this.stickEdges = new Set();
    this.stickPointer = null;
    this.previousPads = [new Set(), new Set()];
    this.onShortcut = onShortcut;
    window.addEventListener('keydown', event => {
      if (event.target.closest('input, select, textarea, dialog')) return;
      if (['Escape', 'KeyP', 'Enter'].includes(event.code) && !event.repeat) {
        if (this.onShortcut(event.code)) event.preventDefault();
      }
      if (!this.enabled) return;
      if (KEYMAPS.some(map => map[event.code])) {
        event.preventDefault();
        if (!this.keys.has(event.code)) this.edges.add(event.code);
        this.keys.add(event.code);
      }
    });
    window.addEventListener('keyup', event => {
      if (this.enabled && KEYMAPS.some(map => map[event.code])) event.preventDefault();
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => this.clear());
  }

  clear() {
    this.keys.clear(); this.edges.clear(); this.touch.clear(); this.touchEdges.clear();
    this.resetStick();
    document.querySelectorAll('[data-action].is-held').forEach(button => button.classList.remove('is-held'));
  }

  bindTouch(root) {
    this.bindStick(root.querySelector('#joystick'));
    root.querySelectorAll('[data-action]').forEach(button => {
      button.addEventListener('pointerdown', event => {
        event.preventDefault();
        if (!this.enabled) return;
        button.setPointerCapture(event.pointerId);
        this.touch.set(event.pointerId, button.dataset.action);
        this.touchEdges.add(button.dataset.action);
        button.classList.add('is-held');
      });
      const release = event => {
        this.touch.delete(event.pointerId);
        button.classList.remove('is-held');
      };
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
      button.addEventListener('contextmenu', event => event.preventDefault());
    });
  }

  bindStick(stick) {
    if(!stick)return;
    this.stickElement=stick;
    const move=event=>{
      if(event.pointerId!==this.stickPointer)return;
      event.preventDefault();
      const rect=stick.getBoundingClientRect(),radius=rect.width*.34;
      let x=event.clientX-(rect.left+rect.width/2),y=event.clientY-(rect.top+rect.height/2);
      const distance=Math.hypot(x,y);
      if(distance>radius){x*=radius/distance;y*=radius/distance;}
      stick.style.setProperty('--stick-x',`${x}px`);stick.style.setProperty('--stick-y',`${y}px`);
      const held=new Set(),nx=x/radius,ny=y/radius;
      // Radial dead zone avoids drift; horizontal + vertical thresholds retain
      // diagonals. Jump is an edge, so holding up never causes auto bunny hops.
      if(distance>radius*.22){
        if(nx<-.28)held.add('left');if(nx>.28)held.add('right');
        if(ny<-.52)held.add('jump');if(ny>.48)held.add('down');
      }
      held.forEach(action=>{if(!this.stickHeld.has(action))this.stickEdges.add(action);});
      this.stickHeld=held;
    };
    stick.addEventListener('pointerdown',event=>{
      event.preventDefault();
      if(!this.enabled||this.stickPointer!==null)return;
      this.stickPointer=event.pointerId;stick.setPointerCapture(event.pointerId);stick.classList.add('active');move(event);
    });
    stick.addEventListener('pointermove',move);
    const release=event=>{if(event.pointerId===this.stickPointer)this.resetStick();};
    stick.addEventListener('pointerup',release);stick.addEventListener('pointercancel',release);stick.addEventListener('lostpointercapture',release);
    stick.addEventListener('contextmenu',event=>event.preventDefault());
  }

  resetStick() {
    this.stickPointer=null;this.stickHeld.clear();this.stickEdges.clear();
    if(this.stickElement){this.stickElement.classList.remove('active');this.stickElement.style.setProperty('--stick-x','0px');this.stickElement.style.setProperty('--stick-y','0px');}
  }

  read() {
    const inputs = KEYMAPS.map((map, index) => {
      const held = new Set([...this.keys].map(code => map[code]).filter(Boolean));
      const pressed = new Set([...this.edges].map(code => map[code]).filter(Boolean));
      if (index === 0) {
        this.touch.forEach(action => held.add(action));
        this.touchEdges.forEach(action => pressed.add(action));
        this.stickHeld.forEach(action=>held.add(action));
        this.stickEdges.forEach(action=>pressed.add(action));
      }
      return { held, pressed };
    });
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean).slice(0, 2) : [];
    pads.forEach((pad, index) => {
      const down = new Set();
      const button = n => pad.buttons[n]?.pressed;
      if (pad.axes[0] < -.35 || button(14)) down.add('left');
      if (pad.axes[0] > .35 || button(15)) down.add('right');
      if (pad.axes[1] < -.5 || button(12)) down.add('jump');
      if (pad.axes[1] > .5 || button(13)) down.add('down');
      ['jab', 'kick', 'special', 'super'].forEach((action, n) => { if (button(n)) down.add(action); });
      if (button(4) || button(5)) down.add('guard');
      down.forEach(action => {
        inputs[index].held.add(action);
        if (!this.previousPads[index].has(action)) inputs[index].pressed.add(action);
      });
      this.previousPads[index] = down;
    });
    if (!pads.length) this.previousPads = [new Set(), new Set()];
    this.edges.clear(); this.touchEdges.clear();this.stickEdges.clear();
    return inputs;
  }
}
