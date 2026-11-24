// Drives the on-screen controller with real touch events (CDP Input.dispatchTouchEvent) on a
// phone-sized touch viewport and reports what each control did. usage: node tools/touchtest.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const npx = '/root/.npm/_npx';
const dir = readdirSync(npx).map((d) => `${npx}/${d}/node_modules/playwright-core`).find((p) => { try { require.resolve(p); return true; } catch { return false; } });
const { chromium } = require(dir);
const port = 8600 + Math.floor(Math.random() * 300);
const server = spawn('/root/bounty/node-dl/node22', ['serve.ts', '--port', String(port)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
for (let i = 0; i < 40; i++) { try { await fetch(`http://localhost:${port}/`); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
const browser = await chromium.launch({ executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
const ok = (name, pass, info = '') => { results.push([name, pass]); console.log(pass ? 'PASS' : 'FAIL', name, info); };
let page, cdp;
const frames = (n) => page.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const center = (sel) => page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }, sel);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i })) });
async function tap(sel, holdFrames = 1) {
  const c = await center(sel);
  if (!c) throw new Error('missing ' + sel);
  await touch('touchStart', [c]); await frames(holdFrames); await touch('touchEnd', []);
  await frames(1);
  return c;
}
async function hold(sel, n) { const c = await center(sel); await touch('touchStart', [c]); await frames(n); return c; }
const release = () => touch('touchEnd', []);
const G = (fn, arg) => page.evaluate(fn, arg);
try {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  page = await ctx.newPage();
  cdp = await ctx.newCDPSession(page);
  await page.addInitScript(() => { if (!sessionStorage.getItem('tt')) { sessionStorage.setItem('tt', '1'); localStorage.clear(); localStorage.setItem('pelabuhan-sanggara-settings-v1', JSON.stringify({ quality: 'low' })); } });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.type(), m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'commit', timeout: 120000 });
  await page.waitForSelector('#title-menu button', { timeout: 400000 });
  console.log('title shown');
  const newBtn = await G(() => { const b = [...document.querySelectorAll('#title-menu button')].findIndex((x) => x.textContent.includes('NEW STORY')); return b; });
  await tap(`#title-menu button:nth-of-type(${newBtn + 1})`);
  await page.waitForFunction(() => window.__game?.session?.running !== false && !document.getElementById('touch-ui').classList.contains('hidden'), null, { timeout: 200000 }).catch(() => {});
  await frames(3);
  ok('touch UI visible in game', await G(() => !document.getElementById('touch-ui').classList.contains('hidden')));
  // Overlap check: no two visible controls' boxes intersect.
  const overlaps = await G(() => { const els = [...document.querySelectorAll('#touch-ui .tc:not(.tc-off):not(.tc-hide)')].map((e) => [e.dataset.ctl, e.getBoundingClientRect()]); const o = []; for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) { const a = els[i][1], b = els[j][1]; if (a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2) o.push(els[i][0] + '/' + els[j][0]); } return o; });
  ok('no overlapping controls', overlaps.length === 0, overlaps.join(','));
  await G(() => { window.__game.session.dialogue?.clear?.(); });

  // Stick: drag up and hold, the player walks.
  const p0 = await G(() => { const p = window.__game.session.player.pos; return [p.x, p.z]; });
  const st = await center('#touch-ui .tc-stick');
  await touch('touchStart', [st]); await touch('touchMove', [{ x: st.x, y: st.y - st.h * 0.45 }]); await frames(20); await release(); await frames(2);
  const p1 = await G(() => { const p = window.__game.session.player.pos; return [p.x, p.z]; });
  ok('stick moves the player', Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 0.5, JSON.stringify([p0, p1]));

  // Camera drag on the right side.
  const yaw0 = await G(() => window.__game.session.cameraRig.yaw);
  await touch('touchStart', [{ x: 600, y: 150 }]); await touch('touchMove', [{ x: 650, y: 160 }]); await frames(2); await touch('touchMove', [{ x: 700, y: 170 }]); await frames(2); await release(); await frames(1);
  const yaw1 = await G(() => window.__game.session.cameraRig.yaw);
  ok('right-side drag turns the camera', Math.abs(yaw1 - yaw0) > 0.02, `${yaw0} -> ${yaw1}`);

  // Cross tap = jump.
  await G(() => { window.__maxVy = 0; const b = window.__game.session.player.body; const f = () => { window.__maxVy = Math.max(window.__maxVy, b.vy); if (window.__watch) requestAnimationFrame(f); }; window.__watch = true; f(); });
  await tap('#touch-ui .tc-cross'); await frames(6);
  ok('cross tap jumps', await G(() => window.__maxVy > 1));
  // Cross hold = sprint while moving.
  await touch('touchStart', [st, { ...(await center('#touch-ui .tc-cross')), id: 1 }]); await touch('touchMove', [{ x: st.x, y: st.y - st.h * 0.45, id: 0 }, { ...(await center('#touch-ui .tc-cross')), id: 1 }]); await frames(12);
  const spd = await G(() => Math.hypot(window.__game.session.player.body.vel.x, window.__game.session.player.body.vel.z));
  await release(); await frames(2);
  ok('stick + cross hold sprints', spd > 4.5, spd.toFixed(2));

  // Circle = punch.
  await tap('#touch-ui .tc-circle', 2);
  ok('circle punches', await G(() => window.__game.session.player.body.punchT < 1.2));

  // Weapons: give a pistol and an SMG, D-pad right cycles.
  await G(() => { const a = window.__game.session.player.arsenal; a.give('pistol', 60); a.give('smg', 90); });
  const w0 = await G(() => window.__game.session.player.arsenal.current);
  await tap('#touch-ui .tc-dpad .tc-right', 2); await frames(3);
  const w1 = await G(() => window.__game.session.player.arsenal.current);
  ok('d-pad right switches weapon', w0 !== w1, `${w0} -> ${w1}`);
  await tap('#touch-ui .tc-dpad .tc-left', 2); await frames(3);
  ok('d-pad left switches back', (await G(() => window.__game.session.player.arsenal.current)) === w0);
  await tap('#touch-ui .tc-dpad .tc-right', 2); await frames(12);

  // L hold = aim, R while aiming = shoot.
  const lc = await hold('#touch-ui .tc-l', 4);
  const aiming = await G(() => window.__game.session.player.body.aiming);
  const ammo0 = await G(() => window.__game.session.player.arsenal.ammoInMag?.() ?? JSON.stringify(window.__game.session.player.arsenal.mag ?? window.__game.session.player.arsenal));
  await touch('touchStart', [lc, { ...(await center('#touch-ui .tc-r')), id: 1 }]); await frames(3); await touch('touchEnd', [lc]); await frames(2); await release(); await frames(2);
  const ammo1 = await G(() => window.__game.session.player.arsenal.ammoInMag?.() ?? JSON.stringify(window.__game.session.player.arsenal.mag ?? window.__game.session.player.arsenal));
  ok('L aims', aiming);
  ok('R shoots', ammo0 !== ammo1, `${String(ammo0).slice(0, 80)} -> ${String(ammo1).slice(0, 80)}`);
  await tap('#touch-ui .tc-square', 2); await frames(2);
  ok('square reloads', await G(() => window.__game.session.player.arsenal.reloading > 0));
  await frames(40);

  // Triangle near a car: walk to the door and get in; cross accelerates; triangle again gets out.
  await G(() => { const s = window.__game.session; const v = s.vehicles.list.find((c) => !c.wrecked && !c.spec.twoWheel && !c.driverModel) || s.vehicles.list[0]; window.__car = v; const b = s.player.body; b.pos.set(v.pos.x - Math.cos(v.heading) * 3, v.y || 0, v.pos.z + Math.sin(v.heading) * 3); b.vel.set(0, 0, 0); v.vel?.set?.(0, 0, 0); });
  await tap('#touch-ui .tc-triangle', 2);
  await page.waitForFunction(() => !!window.__game.session.player.vehicle, null, { timeout: 120000, polling: 500 }).catch(() => {});
  ok('triangle enters a car (animated walk to door)', await G(() => !!window.__game.session.player.vehicle));
  await frames(3);
  const capVeh = await G(() => document.querySelector('#touch-ui .tc-cross .tc-cap').textContent);
  ok('captions switch in vehicle', /accel/i.test(capVeh), capVeh);
  await hold('#touch-ui .tc-cross', 25);
  const vs = await G(() => { const v = window.__game.session.player.vehicle; return v ? Math.hypot(v.vel.x, v.vel.z) : -1; });
  await release(); await frames(2);
  ok('cross accelerates the car', vs > 1, vs.toFixed?.(2));
  await hold('#touch-ui .tc-square', 25); await release();
  await tap('#touch-ui .tc-triangle', 2); await frames(4);
  ok('triangle leaves the car', await G(() => !window.__game.session.player.vehicle));

  // Select = map, tap close.
  await tap('#touch-ui .tc-select', 2); await frames(3);
  ok('select opens the map', await G(() => !document.getElementById('big-map').classList.contains('hidden')));
  await tap('#map-close'); await frames(3);
  ok('map close button closes it', await G(() => document.getElementById('big-map').classList.contains('hidden')));

  // Start = pause; navigate by touch: settings -> layout editor -> drag, reset, done -> back -> resume.
  await tap('#touch-ui .tc-start', 2); await frames(3);
  ok('start pauses', await G(() => !document.getElementById('pause-screen').classList.contains('hidden')));
  const idx = (txt) => G((txt) => [...document.querySelectorAll('#pause-menu button')].findIndex((x) => x.textContent.includes(txt)) + 1, txt);
  await tap(`#pause-menu button:nth-of-type(${await idx('SETTINGS')})`); await frames(3);
  ok('settings open by touch', await G(() => !document.getElementById('settings-screen').classList.contains('hidden')));
  await tap('#set-layout'); await frames(3);
  ok('layout editor opens', await G(() => !!document.querySelector('.tc-editor')));
  const before = await G(() => window.__game.touch.layout.controls.triangle.x);
  const tri = await center('#touch-ui .tc-triangle');
  await touch('touchStart', [tri]); await touch('touchMove', [{ x: tri.x - 40, y: tri.y }]); await frames(2); await touch('touchMove', [{ x: tri.x - 80, y: tri.y }]); await frames(2); await release(); await frames(2);
  const after = await G(() => window.__game.touch.layout.controls.triangle.x);
  ok('drag moves a control in the editor', Math.abs(after - before) > 0.03, `${before} -> ${after}`);
  await tap('#tce-reset'); await frames(2);
  ok('reset restores default', Math.abs((await G(() => window.__game.touch.layout.controls.triangle.x)) - before) < 0.001);
  await tap('#tce-done'); await frames(3);
  ok('done closes editor and saves', await G(() => !document.querySelector('.tc-editor') && !!localStorage.getItem('pelabuhan-sanggara-touch-v2') && !document.getElementById('settings-screen').classList.contains('hidden')));
  await tap('#set-back'); await frames(3);
  await tap(`#pause-menu button:nth-of-type(${await idx('RESUME')})`); await frames(4);
  ok('resume by touch', await G(() => document.getElementById('pause-screen').classList.contains('hidden')));

  // TALK: stand next to a pedestrian, the TALK button appears; tap it and pick a choice.
  await G(() => { const s = window.__game.session; const p = s.peds.list.find((q) => q.alive && q.ai && (q.ai.mode === 'walk' || q.ai.mode === 'idle')); window.__ped = p; s.player.body.pos.set(p.pos.x + 1.2, p.pos.y, p.pos.z); s.player.body.vel.set(0, 0, 0); });
  await frames(4);
  const talkVisible = await G(() => !document.querySelector('#touch-ui .tc-talk').classList.contains('tc-hide'));
  ok('TALK button appears near a person', talkVisible);
  if (talkVisible) { await tap('#touch-ui .tc-talk', 2); await frames(3); ok('TALK starts a conversation', await G(() => !!window.__game.session.talk.partner)); }
  await page.waitForFunction(() => !!document.querySelector('#dialogue-choices button, .dialogue-choices button') || !window.__game.session.talk.partner, null, { timeout: 120000, polling: 500 }).catch(() => {});
  const choiceSel = await G(() => { const p = window.__game.session.talk.panel; if (!p || p.classList.contains('hidden')) return null; p.id ||= 'tt-choices'; return '#' + p.id + ' button'; });
  if (choiceSel) { await tap(choiceSel); await frames(2); ok('dialogue choice by touch', await G(() => !window.__game.session.talk.choices)); }
  else ok('dialogue choices shown', false);
  await page.screenshot({ path: '/tmp/touch.jpg', type: 'jpeg', quality: 70 });
} catch (e) { console.log('touchtest failed:', e.message); }
finally {
  console.log(`${results.filter((r) => r[1]).length}/${results.length} passed`);
  await browser.close(); server.kill();
}
