// iPhone feedback regression: fullscreen fallback, rotation, install hint and
// gesture-bound Web Audio. Runs against a browser with no Fullscreen API, the
// way iPhone Safari behaves. Set MOBILE_ENGINE=webkit to use Playwright WebKit.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const mobileEngine = process.env.MOBILE_ENGINE === 'webkit' ? 'webkit' : 'chromium';
const engine = playwright[mobileEngine];
const launchOptions = { headless: true };
if (mobileEngine === 'chromium' && process.env.BROWSER_EXECUTABLE) launchOptions.executablePath = process.env.BROWSER_EXECUTABLE;
const browser = await engine.launch(launchOptions);
const base = process.env.TEST_URL || 'http://localhost:4173/';
const report = { engine: mobileEngine, checks: [] };
const errors = [];
await mkdir('artifacts', { recursive: true });
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  });
  await context.addInitScript(() => {
    // iPhone Safari exposes no element fullscreen at all.
    delete Element.prototype.requestFullscreen; delete Element.prototype.webkitRequestFullscreen;
    delete Document.prototype.exitFullscreen; delete Document.prototype.webkitExitFullscreen;
    window.__audioBorn = [];
    const Native = window.AudioContext;
    if (Native) {
      window.AudioContext = class extends Native {
        constructor(...args) { super(...args); window.__audioBorn.push({ active: navigator.userActivation?.isActive, state: this.state }); }
      };
      window.webkitAudioContext = window.AudioContext;
    }
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(base);
  await page.locator('#start-button:enabled').waitFor();

  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.href;
    const icon = document.querySelector('link[rel="apple-touch-icon"]')?.href;
    if (!href || !icon) return { href, icon };
    return { href, icon, manifestStatus: (await fetch(href)).status, iconStatus: (await fetch(icon)).status };
  });
  assert.ok(manifest.href && manifest.icon, 'page should link a manifest and an apple touch icon');
  assert.equal(manifest.manifestStatus, 200);
  assert.equal(manifest.iconStatus, 200);
  report.checks.push({ check: 'manifest and apple-touch-icon are served', ...manifest });

  const hasWebAudio = await page.evaluate(() => Boolean(window.AudioContext || window.webkitAudioContext));
  assert.equal(await page.evaluate(() => window.__audioBorn.length), 0, 'no AudioContext may be created before a gesture');
  await page.locator('#start-button').tap();
  await page.waitForTimeout(700);
  if (!hasWebAudio) {
    // Playwright WebKit on Windows ships without Web Audio; the fallback must
    // still keep the game playable, so only record the engine limitation here.
    report.checks.push({ check: 'Web Audio missing in this engine: game still starts', note: 'engine has no AudioContext' });
  } else {
    const audio = await page.evaluate(async () => {
      const { audio } = await import('./src/app.js');
      const analyser = audio.context.createAnalyser();
      audio.master.connect(analyser);
      const before = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(before);
      audio.sfx('hit', { move: 'jab' });
      await new Promise(resolve => setTimeout(resolve, 120));
      const after = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(after);
      analyser.disconnect();
      return {
        born: window.__audioBorn, running: audio.running, state: audio.context?.state,
        musicScheduled: Boolean(audio.timer), peakBefore: Math.max(...before.map(Math.abs)), peakAfter: Math.max(...after.map(Math.abs)),
      };
    });
    assert.ok(audio.born.length > 0, 'the start tap must create the AudioContext');
    assert.equal(audio.born[0].active, true, 'AudioContext must be created inside the tap gesture');
    assert.equal(audio.running, true, 'AudioContext must be running after the tap');
    assert.equal(audio.musicScheduled, true, 'background music must be scheduled once the mixer runs');
    assert.ok(audio.peakAfter > 0.001, 'mixer output must carry a signal');
    report.checks.push({ check: 'Web Audio unlocked inside the tap, music scheduled and audible', born: audio.born, peakAfter: audio.peakAfter });
  }

  await page.locator('#fullscreen-button').tap();
  await page.waitForTimeout(400);
  const full = await page.evaluate(() => ({
    cls: document.getElementById('arcade').className,
    rect: document.getElementById('arcade').getBoundingClientRect().toJSON(),
    vv: { width: visualViewport.width, height: visualViewport.height },
    body: { position: getComputedStyle(document.body).position, overflow: getComputedStyle(document.body).overflow },
    rotateHint: !document.getElementById('rotate-hint').hidden,
    tip: !document.getElementById('fullscreen-tip').hidden,
    label: document.getElementById('fullscreen-button').getAttribute('aria-label'),
    scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth,
  }));
  assert.ok(full.cls.includes('is-immersive'), 'iPhone must fall back to the immersive layout');
  assert.ok(Math.round(full.rect.width) === Math.round(full.vv.width) && Math.round(full.rect.height) === Math.round(full.vv.height), 'immersive layout must fill the visual viewport');
  assert.equal(full.body.position, 'fixed');
  assert.equal(full.body.overflow, 'hidden');
  assert.equal(full.rotateHint, true, 'portrait immersive play should ask for landscape');
  assert.equal(full.tip, true, 'iPhone should explain how to install for true fullscreen');
  assert.equal(full.label, '退出全屏');
  assert.ok(full.scrollWidth <= full.clientWidth, 'immersive layout must not overflow horizontally');
  await page.screenshot({ path: 'artifacts/verify-iphone-portrait.png' });
  report.checks.push({ check: 'immersive fallback fills the iPhone viewport and explains portrait play', rect: full.rect, vv: full.vv });

  await page.locator('#fullscreen-tip-close').tap();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('milkfrog-fullscreen-tip'))), true, 'the one-time install hint must persist');

  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(600);
  const rotated = await page.evaluate(() => ({
    rect: document.getElementById('arcade').getBoundingClientRect().toJSON(),
    vv: { width: visualViewport.width, height: visualViewport.height },
    rotateHint: !document.getElementById('rotate-hint').hidden,
    tip: !document.getElementById('fullscreen-tip').hidden,
  }));
  assert.equal(rotated.rotateHint, false, 'landscape should drop the rotate hint');
  assert.equal(rotated.tip, false, 'landscape should drop the install card so the HUD stays visible');
  assert.ok(Math.round(rotated.rect.width) === 844 && Math.round(rotated.rect.height) === 390, `immersive cabinet should follow rotation ${JSON.stringify(rotated.rect)}`);
  await page.screenshot({ path: 'artifacts/verify-iphone-landscape.png' });
  report.checks.push({ check: 'rotation re-fits the immersive cabinet and clears the hints', rect: rotated.rect });

  await page.locator('#fullscreen-button').tap();
  await page.waitForTimeout(300);
  const exited = await page.evaluate(() => ({
    cls: document.getElementById('arcade').className,
    body: { position: getComputedStyle(document.body).position, overflow: getComputedStyle(document.body).overflow },
    label: document.getElementById('fullscreen-button').getAttribute('aria-label'),
  }));
  assert.equal(exited.cls.includes('is-immersive'), false);
  assert.notEqual(exited.body.position, 'fixed');
  assert.equal(exited.label, '切换全屏');
  report.checks.push({ check: 'exit restores body scrolling and the button label', ...exited });

  assert.deepEqual(errors, []);
  report.errors = errors;
  report.passed = true;
  await writeFile('artifacts/mobile-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ engine: report.engine, passed: true, checks: report.checks.map(check => check.check) }));
} finally {
  await browser.close();
}
