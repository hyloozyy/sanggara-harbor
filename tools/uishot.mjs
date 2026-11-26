// Plays the real game in headless Chromium and screenshots the UI moments: title, a conversation
// (dialogue box with portraits), MISSION PASSED, WASTED, a district title. Works at phone sizes
// with touch emulation. usage: node tools/uishot.mjs <prefix> <width> <height> [touch=0|1]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const npx = '/root/.npm/_npx';
const dir = readdirSync(npx).map((d) => `${npx}/${d}/node_modules/playwright-core`).find((p) => { try { require.resolve(p); return true; } catch { return false; } });
const { chromium } = require(dir);
const [prefix = '/tmp/ui', w = '1280', h = '720', touch = '0'] = process.argv.slice(2);
const port = 8090 + Math.floor(Math.random() * 400);
const server = spawn('/root/bounty/node-dl/node22', ['serve.ts', '--port', String(port)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
for (let i = 0; i < 40; i++) { try { await fetch(`http://localhost:${port}/`); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
const browser = await chromium.launch({
  executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
try {
  const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, hasTouch: touch === '1', isMobile: touch === '1' });
  await ctx.addInitScript(() => localStorage.setItem('pelabuhan-sanggara-settings-v1', JSON.stringify({ quality: 'low' })));
  const page = await ctx.newPage();
  page.setDefaultTimeout(900000);
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') log('[console]', m.type(), m.text().slice(0, 300)); });
  page.on('pageerror', (e) => log('[pageerror]', e.message));
  page.on('request', (r) => { if (!r.url().startsWith(`http://localhost:${port}/`) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) log('[EXTERNAL REQUEST]', r.url()); });
  await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'commit', timeout: 120000 });
  await page.waitForFunction(() => window.__game && document.getElementById('loading-screen').classList.contains('hidden'), null, { timeout: 900000, polling: 1000 });
  log('loaded');
  const frames = (n) => page.evaluate((n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const shot = async (name) => { await frames(2); await page.waitForTimeout(400); await page.screenshot({ path: `${prefix}-${name}.png`, timeout: 300000 }); log('saved', name); };
  await shot('title');
  await page.evaluate(() => [...document.querySelectorAll('#title-menu button')].find((b) => /FREE ROAM/i.test(b.textContent)).click());
  await frames(5);
  // A conversation with the nearest townsperson.
  await page.evaluate(() => {
    const s = window.__game.session, b = s.player.body;
    const near = s.peds.list.filter((p) => p.alive && p.ai).map((p) => [p, Math.hypot(p.pos.x - b.pos.x, p.pos.z - b.pos.z)]).sort((a, c) => a[1] - c[1]);
    const p = near[0][0];
    b.pos.set(p.pos.x + Math.sin(p.heading) * 1.5, p.pos.y, p.pos.z + Math.cos(p.heading) * 1.5);
    b.heading = p.heading + Math.PI;
    s.talk.begin(p);
  });
  await frames(12);
  await shot('talk-raka');
  for (let k = 0; k < 40 && !(await page.evaluate(() => window.__game.session.dialogue.line?.speaker === 'warga')); k++) await frames(10);
  await frames(16);
  await shot('talk-npc');
  for (let k = 0; k < 40 && !(await page.evaluate(() => window.__game.session.talk.choosing)); k++) await frames(10);
  await frames(4);
  await shot('talk-choices');
  await page.evaluate(() => { const s = window.__game.session; s.talk.end(true); s.dialogue.clear(); });
  await frames(20);
  // Story mission giver: a cast portrait.
  await page.evaluate(() => { const s = window.__game.session; s.dialogue.say('dimas', 'Rak, the job is simple. In, out, nobody gets hurt. Probably.'); });
  await frames(30);
  await shot('phone');
  await page.evaluate(() => window.__game.session.dialogue.clear());
  await frames(10);
  await page.evaluate(() => { const s = window.__game.session; s.hud.missionResult(true, s.missions.nextMission); });
  await page.waitForTimeout(2500);
  await shot('passed');
  await page.waitForTimeout(5000); await frames(40);
  await page.evaluate(() => { const s = window.__game.session; s.hud.banner.hideBig(); s.hud.banner.district('KOTA LAMA', 'JL. PEMUDA'); });
  await page.waitForTimeout(1800);
  await shot('district');
  await page.evaluate(() => window.__game.session.player.body.die(null, 'bullet'));
  await page.waitForTimeout(2500);
  await shot('wasted');
  await page.evaluate(() => { window.__game.session.wastedTimer = 0.01; });
  await frames(30);
  await page.evaluate(() => { const s = window.__game.session; s.busted = true; s.wastedTimer = 4; });
  await page.waitForTimeout(2500);
  await shot('busted');
  log('done');
} catch (e) {
  log('failed:', e.message);
} finally {
  await browser.close();
  server.kill();
}
