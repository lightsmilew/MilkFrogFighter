/** Native fullscreen where available; a viewport-sized immersion otherwise.
 *
 * iPhone Safari exposes no Element fullscreen at all (requestFullscreen is
 * iPad-only), so every iPhone tap must land in the fallback. The fallback also
 * has to survive three iOS quirks:
 *   - `requestFullscreen` may exist but return a promise that never settles;
 *   - `visualViewport` reports stale sizes during rotation;
 *   - the address bar can collapse/expand after we measured the viewport.
 * It therefore races the native request against a timeout, re-measures a few
 * times after every resize/orientation change, and locks the page scroll. */

const REQUEST_TIMEOUT = 900;
const SETTLE_DELAYS = [0, 80, 240, 520];

export class FullscreenController {
  constructor(element, onChange = () => {}, options = {}) {
    this.element = element;
    this.onChange = onChange;
    this.onUnavailable = options.onUnavailable || (() => {});
    this.pseudo = false;
    this.scrollY = 0;
    this.settleTimers = [];
    this.measureFrame = 0;
    this.refresh = () => this.measure();
    this.changed = () => this.handleChange();
    document.addEventListener('fullscreenchange', this.changed);
    document.addEventListener('webkitfullscreenchange', this.changed);
    window.addEventListener('resize', this.refresh);
    window.addEventListener('orientationchange', this.refresh);
    window.visualViewport?.addEventListener('resize', this.refresh);
    window.visualViewport?.addEventListener('scroll', this.refresh);
    screen.orientation?.addEventListener?.('change', this.refresh);
    this.orientation = window.matchMedia('(orientation: portrait)');
    this.orientation.addEventListener?.('change', this.refresh);
  }

  get native() { return document.fullscreenElement || document.webkitFullscreenElement; }
  get active() { return Boolean(this.native || this.pseudo); }
  get portrait() {
    const viewport = window.visualViewport;
    return (viewport?.height || innerHeight) > (viewport?.width || innerWidth);
  }

  handleChange() {
    if (this.native && this.pseudo) this.exitPseudo();
    this.measure();
    this.onChange(this.active);
  }

  /** Re-read the visible viewport. `visualViewport` is stale for a moment
   *  after an iPhone rotation or address-bar change, so measure repeatedly. */
  measure() {
    if (!this.pseudo) return;
    const apply = () => {
      if (!this.pseudo) return;
      const viewport = window.visualViewport;
      this.element.style.setProperty('--immersive-width', `${Math.round(viewport?.width || innerWidth)}px`);
      this.element.style.setProperty('--immersive-height', `${Math.round(viewport?.height || innerHeight)}px`);
      this.element.style.setProperty('--immersive-top', `${Math.round(viewport?.offsetTop || 0)}px`);
      this.element.style.setProperty('--immersive-left', `${Math.round(viewport?.offsetLeft || 0)}px`);
      this.element.classList.toggle('is-immersive-portrait', this.portrait);
    };
    apply();
    cancelAnimationFrame(this.measureFrame);
    this.measureFrame = requestAnimationFrame(apply);
    this.settleTimers.forEach(clearTimeout);
    this.settleTimers = SETTLE_DELAYS.map(delay => setTimeout(apply, delay));
  }

  async toggle() {
    if (this.active) { await this.exit(); return; }
    const request = this.element.requestFullscreen || this.element.webkitRequestFullscreen;
    let entered = false;
    if (request) {
      entered = await this.requestNative(request);
    }
    if (!entered) {
      this.enterPseudo();
      this.onUnavailable();
    }
    this.measure();
    this.onChange(this.active);
  }

  /** Some WebKit builds hand back a promise that never resolves when the
   *  request is silently ignored; never let that strand the fullscreen button. */
  async requestNative(request) {
    let timer;
    try {
      const result = request.call(this.element, { navigationUI: 'hide' });
      if (result && typeof result.then === 'function') {
        await Promise.race([
          result,
          new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error('Fullscreen request timed out')), REQUEST_TIMEOUT); }),
        ]);
      }
      // Old WebKit returns nothing from webkitRequestFullscreen; give the
      // browser one frame to flag the element before declaring failure.
      if (!this.native) await new Promise(resolve => setTimeout(resolve, 120));
      return Boolean(this.native);
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  enterPseudo() {
    if (this.pseudo) return;
    this.pseudo = true;
    this.scrollY = window.scrollY;
    this.previousBody = {
      position: document.body.style.position, top: document.body.style.top, left: document.body.style.left,
      width: document.body.style.width, height: document.body.style.height, overflow: document.body.style.overflow,
    };
    Object.assign(document.body.style, {
      position: 'fixed', top: `-${this.scrollY}px`, left: '0', width: '100%', height: '100%', overflow: 'hidden',
    });
    document.body.classList.add('immersive-active');
    document.documentElement.classList.add('immersive-root');
    this.element.classList.add('is-immersive');
    this.lockOrientation();
    this.measure();
  }

  exitPseudo() {
    if (!this.pseudo) return;
    this.pseudo = false;
    this.settleTimers.forEach(clearTimeout);
    this.settleTimers = [];
    cancelAnimationFrame(this.measureFrame);
    if (this.previousBody) Object.assign(document.body.style, this.previousBody);
    document.body.classList.remove('immersive-active');
    document.documentElement.classList.remove('immersive-root');
    this.element.classList.remove('is-immersive', 'is-immersive-portrait');
    this.unlockOrientation();
    window.scrollTo(0, this.scrollY);
  }

  /** Best effort only: iOS rejects orientation locks outside native fullscreen. */
  lockOrientation() {
    if (!matchMedia('(pointer: coarse)').matches || !this.portrait) return;
    try { screen.orientation?.lock?.('landscape')?.catch?.(() => {}); } catch { /* iPhone: not available */ }
  }

  unlockOrientation() {
    try { screen.orientation?.unlock?.(); } catch { /* Nothing was locked. */ }
  }

  async exit() {
    if (this.pseudo) this.exitPseudo();
    if (this.native) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      try { await exit?.call(document); } catch { /* Keep the in-page exit control available. */ }
    }
    this.onChange(this.active);
  }
}
