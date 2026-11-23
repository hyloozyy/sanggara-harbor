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
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.type(), m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'commit', timeout: 120000 });
  await page.waitForSelector('#title-menu button', { timeout: 300000 });
  console.log('title shown');
  await wait(3000);
  await page.click('#title-menu button:has-text("CERITA BARU")');
  console.log('started');
  await wait(20000);
  const state = async () => page.evaluate(() => [document.getElementById('mission-title').textContent, document.getElementById('mission-objective').textContent, document.getElementById('dialogue-text').textContent].join(' | '));
  console.log('state', await state());
  await page.keyboard.down('KeyW'); await wait(15000); await page.keyboard.up('KeyW');
  console.log('after walking', await state());
  await page.keyboard.press('Escape'); await wait(4000);
  console.log('paused visible', await page.evaluate(() => !document.getElementById('pause-screen').classList.contains('hidden')));
  await page.click('#pause-menu button:has-text("LANJUTKAN")'); await wait(3000);
  await page.keyboard.press('KeyM'); await wait(3000);
  console.log('map visible', await page.evaluate(() => !document.getElementById('big-map').classList.contains('hidden')));
  await page.keyboard.press('KeyM'); await wait(2000);
  await page.screenshot({ path: out, type: 'jpeg', quality: 80 });
  console.log('saved', out);
} catch (e) { console.log('playtest failed:', e.message); }
finally { await browser.close(); server.kill(); }
