import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
const dist = resolve('dist');
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname.replace(/^\/PLM-DB\//, '');
  const path = resolve(dist, pathname.endsWith('/') || !pathname ? 'index.html' : pathname);
  if (!path.startsWith(dist + '/')) {
    res.writeHead(404).end();
    return;
  }
  try {
    const content = await readFile(path);
    res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(5189, '127.0.0.1', resolve));
const external = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = await chromium.launch({
  headless: true,
  ...(external
    ? {
        executablePath: external,
        args: ['--no-sandbox', '--no-zygote', '--single-process', '--disable-dev-shm-usage', '--disable-gpu'],
      }
    : {}),
});
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto('http://127.0.0.1:5189/PLM-DB/');
  await page.waitForSelector('.sidebar');
  await page.evaluate(async () => {
    await caches.open('another-app-cache');
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const names = await page.evaluate(() => caches.keys());
  assert.ok(names.includes('another-app-cache'));
  assert.ok(names.some((n) => n.startsWith('mc-plan:http://127.0.0.1:5189/PLM-DB/:')));
  await context.setOffline(true);
  await page.evaluate(() => {
    location.hash = '#/ketten';
  });
  await page.getByRole('button', { name: 'Duplizieren', exact: true }).first().waitFor();
  await page.reload();
  await page.getByRole('button', { name: 'Duplizieren', exact: true }).first().waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS production build under /PLM-DB/, scoped cache, lazy route and reload offline');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
