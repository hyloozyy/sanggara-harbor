// Renders the game in headless Chromium (software WebGL) and saves a screenshot.
// usage: node tools/capture.mjs "<query>" out.jpg [timeoutSec] [quality]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const npx = '/root/.npm/_npx';
const dir = readdirSync(npx).map((d) => `${npx}/${d}/node_modules/playwright-core`).find((p) => { try { require.resolve(p); return true; } catch { return false; } });
const { chromium } = require(dir);
const [query = '', out = '/tmp/shot.jpg', timeoutSec = '600', quality = '88'] = process.argv.slice(2);
const port = 8090 + Math.floor(Math.random() * 400);
const server = spawn('/root/bounty/node-dl/node22', ['serve.ts', '--port', String(port)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
for (let i = 0; i < 40; i++) { try { await fetch(`http://localhost:${port}/`); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
const browser = await chromium.launch({
  executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => console.log('[console]', m.type(), m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  const t = Date.now();
  await page.goto(`http://localhost:${port}/${query}`, { waitUntil: 'commit', timeout: 120000 });
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: Number(timeoutSec) * 1000, polling: 500 });
  console.log('ready after', ((Date.now() - t) / 1000).toFixed(1), 's');
  await page.screenshot({ path: out, type: 'jpeg', quality: Number(quality), timeout: 300000 });
  console.log('saved', out);
} catch (e) {
  console.log('capture failed:', e.message);
} finally {
  await browser.close();
  server.kill();
}
