// Plays the real game through the title menu with keyboard and mouse in headless Chromium and
// reports page errors; saves a screenshot of the end state. usage: node tools/playtest.mjs out.jpg
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const npx = '/root/.npm/_npx';
const dir = readdirSync(npx).map((d) => `${npx}/${d}/node_modules/playwright-core`).find((p) => { try { require.resolve(p); return true; } catch { return false; } });
const { chromium } = require(dir);
const out = process.argv[2] || '/tmp/play.jpg';
const port = 8600 + Math.floor(Math.random() * 300);
const server = spawn('/root/bounty/node-dl/node22', ['serve.ts', '--port', String(port)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
for (let i = 0; i < 40; i++) { try { await fetch(`http://localhost:${port}/`); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
const browser = await chromium.launch({ executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let page;
const clickText = (sel, text) => page.evaluate(([sel, text]) => { const b = [...document.querySelectorAll(sel + ' button')].find((x) => x.textContent.includes(text)); if (!b) throw new Error('no button ' + text); b.click(); }, [sel, text]);
try {
  page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(() => { if (!localStorage.getItem('pt-init')) { localStorage.clear(); localStorage.setItem('pt-init', '1'); localStorage.setItem('pelabuhan-sanggara-settings-v1', JSON.stringify({ quality: 'low' })); } });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.type(), m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'commit', timeout: 120000 });
  await page.waitForSelector('#title-menu button', { timeout: 300000 });
  console.log('title shown');
  await wait(3000);
  await clickText('#title-menu', 'NEW STORY');
  console.log('started');
  await wait(20000);
  const state = async () => page.evaluate(() => [document.getElementById('mission-title').textContent, document.getElementById('mission-objective').textContent, (document.querySelector('#dialogue-box .dlg-text')?.textContent || '')].join(' | '));
  console.log('state', await state());
  await page.mouse.click(640, 400); await wait(1000);
  await page.keyboard.down('KeyW'); await wait(15000); await page.keyboard.up('KeyW');
  console.log('after walking', await state());
  await page.keyboard.press('Escape'); await wait(4000);
  console.log('paused visible', await page.evaluate(() => !document.getElementById('pause-screen').classList.contains('hidden')));
  await clickText('#pause-menu', 'SAVE GAME'); await wait(2000);
  await clickText('#pause-menu', 'SETTINGS'); await wait(2000);
  await page.evaluate(() => { for (const [id, v] of [['set-weather', 'storm'], ['set-time', 'night']]) { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change')); } }); await wait(1000);
  await page.evaluate(() => document.getElementById('set-back').click()); await wait(2000);
  await clickText('#pause-menu', 'RESUME'); await wait(3000);
  await page.keyboard.press('Escape'); await wait(4000);
  await clickText('#pause-menu', 'LOAD GAME'); await wait(6000);
  console.log('player pos', await page.evaluate(() => document.getElementById('street-name').textContent));
  console.log('after load', await state());
  await page.keyboard.press('KeyF'); await wait(3000);
  await page.keyboard.down('KeyW'); await wait(8000); await page.keyboard.up('KeyW');
  console.log('in vehicle', await page.evaluate(() => !document.getElementById('vehicle-panel').classList.contains('hidden')), await state());
  await page.keyboard.press('KeyM'); await wait(3000);
  console.log('map visible', await page.evaluate(() => !document.getElementById('big-map').classList.contains('hidden')));
  await page.keyboard.press('KeyM'); await wait(2000);
  await page.screenshot({ path: out, type: 'jpeg', quality: 80 });
  console.log('saved', out);
} catch (e) { console.log('playtest failed:', e.message); }
finally { await browser.close(); server.kill(); }
