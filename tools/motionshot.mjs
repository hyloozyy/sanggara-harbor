// Renders the vehicle lab (game/debug/motion.html) and saves a screenshot.
// usage: node tools/carshot.mjs "<query>" out.png [width] [height]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const npx = '/root/.npm/_npx';
const dir = readdirSync(npx).map((d) => `${npx}/${d}/node_modules/playwright-core`).find((p) => { try { require.resolve(p); return true; } catch { return false; } });
const { chromium } = require(dir);
const [query = '', out = '/tmp/motion.png', w = '1280', h = '720'] = process.argv.slice(2);
const port = 8500 + Math.floor(Math.random() * 400);
const server = spawn('/root/bounty/node-dl/node22', ['serve.ts', '--port', String(port)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
for (let i = 0; i < 40; i++) { try { await fetch(`http://localhost:${port}/`); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
const browser = await chromium.launch({
  executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
  page.on('console', (m) => { if (m.type() !== 'log' || /lab/.test(m.text())) console.log('[console]', m.type(), m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  const t = Date.now();
  await page.goto(`http://localhost:${port}/debug/motion.html${query}`, { waitUntil: 'commit', timeout: 120000 });
  await page.waitForFunction(() => window.__labReady === true, null, { timeout: 600000, polling: 500 });
  console.log('ready after', ((Date.now() - t) / 1000).toFixed(1), 's', await page.evaluate(() => document.getElementById('info').textContent));
  await page.screenshot({ path: out, type: out.endsWith('.png') ? 'png' : 'jpeg', timeout: 300000 });
  console.log('saved', out);
} catch (e) {
  console.log('capture failed:', e.message);
} finally {
  await browser.close();
  server.kill();
}
