/** Optional browser regression suite. Run `npx playwright install chromium` once. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const root = process.cwd();
const output = resolve(process.env.PLM_QA_OUTPUT || 'test-results');
await mkdir(output, { recursive: true });
const server = await createServer({
  root,
  server: { host: '127.0.0.1', port: 5187, strictPort: true },
  logLevel: 'error',
});
await server.listen();
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
const context = await browser.newContext({
  viewport: { width: 1440, height: 1120 },
  acceptDownloads: true,
  reducedMotion: 'reduce',
});
const page = await context.newPage();
page.setDefaultTimeout(8000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const KEY = 'planlauf-management.data.v1';
const url = 'http://127.0.0.1:5187/';
const data = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
const open = async (hash) => {
  await page.goto(url + hash);
  await page.waitForSelector('.sidebar');
};
const closeDialog = async () => {
  await page.locator('dialog[open]').last().getByRole('button', { name: 'Schließen', exact: true }).click();
};
const checks = [];
const check = async (name, action) => {
  await action();
  checks.push(name);
  console.log('PASS', name);
};
try {
  await open('#/dashboard');
  await page.evaluate(() => document.fonts.ready);
  let initial;
  await check('Dashboard, existing data and desktop layout', async () => {
    await page.getByRole('heading', { name: 'Alles im Blick.' }).waitFor();
    initial = await data();
    assert.ok(initial.projects.length > 0 && initial.runs.length > 0);
    await page.screenshot({ path: resolve(output, '01-dashboard-desktop.png') });
  });
  await check('Global search, keyboard shortcut, focus containment and navigation', async () => {
    await page.keyboard.press('Control+k');
    await page
      .getByLabel('Alle Projekte und Pläne durchsuchen')
      .fill(initial.documents.find((d) => d.kind === 'plan').nummer);
    assert.ok(await page.locator('.search-result').count());
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      assert.ok(await page.evaluate(() => !!document.activeElement.closest('dialog')));
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog[open]').count(), 0);
  });
  await check('Dashboard urgency filter opens the matching deadline list', async () => {
    await page.locator('.dashboard-stats .card').nth(1).click();
    await page.waitForURL(/filter=ueberfaellig/);
    await page.locator('.segmented button.active').filter({ hasText: 'Überfällig' }).waitFor();
  });
  await check('All project tabs and management pages render without runtime errors', async () => {
    for (const tab of ['uebersicht', 'plaene', 'pakete', 'adressbuch', 'ketten', 'einstellungen']) {
      await open(`#/projekt/${initial.projects[0].id}/${tab}`);
      await page.locator('.project-heading').waitFor();
      await page.locator('.tabs button[aria-current=page]').waitFor();
      if (tab === 'plaene') await page.screenshot({ path: resolve(output, '02-planliste-desktop.png') });
    }
    for (const view of ['projekte', 'ketten', 'rollen', 'vorlagen', 'fristen']) {
      await open(`#/${view}`);
      await page.waitForFunction(() => !document.querySelector('.page-loading'));
      assert.ok((await page.locator('.content-inner').innerText()).length > 100);
    }
  });
  let project;
  await check('Create project with its full role set atomically', async () => {
    await open('#/projekte');
    await page.getByRole('button', { name: 'Neues Projekt', exact: true }).click();
    await page.getByLabel('Projektnummer', { exact: true }).fill('QA-2026');
    await page.getByLabel('Projektname', { exact: true }).fill('Testprojekt Durchgängigkeit');
    await page.getByLabel('Beschreibung', { exact: true }).fill('Automatisierter Funktionstest');
    await page.getByRole('button', { name: 'Projekt anlegen', exact: true }).click();
    await page.waitForFunction(
      (key) => JSON.parse(localStorage.getItem(key)).projects.some((p) => p.nummer === 'QA-2026'),
      KEY,
    );
    const d = await data();
    project = d.projects.find((p) => p.nummer === 'QA-2026');
    assert.equal(d.roles.filter((r) => r.projectId === project.id).length, d.standardRollen.length);
    assert.ok(d.contacts.some((c) => c.projectId === project.id && c.eigen));
  });
  let run;
  await check('Create a plan and start a workflow', async () => {
    await open(`#/projekt/${project.id}/plaene`);
    await page.getByRole('button', { name: 'Neuer Eintrag', exact: true }).first().click();
    await page.getByLabel('Plancodierung', { exact: true }).fill('QA-KIB-001');
    await page.getByLabel('Titel', { exact: true }).fill('Testplan Überbau');
    await page.getByLabel('Gewerk', { exact: true }).first().fill('KIB');
    await page.getByRole('button', { name: 'Anlegen und Planlauf starten', exact: true }).click();
    await page.waitForFunction(
      (key) => JSON.parse(localStorage.getItem(key)).documents.some((d) => d.nummer === 'QA-KIB-001'),
      KEY,
    );
    const d = await data();
    const doc = d.documents.find((x) => x.nummer === 'QA-KIB-001');
    run = d.runs.find((r) => r.documentId === doc.id);
    assert.ok(run && run.steps.length > 0);
  });
  await check('Complete a workflow step and preserve it after reload', async () => {
    await open(`#/projekt/${project.id}/planlauf/${run.id}`);
    await page.getByRole('button', { name: 'Erledigt', exact: true }).first().click();
    await page.waitForFunction(
      ({ key, id }) =>
        JSON.parse(localStorage.getItem(key))
          .runs.find((r) => r.id === id)
          .steps.some((s) => s.status === 'erledigt'),
      { key: KEY, id: run.id },
    );
    if (await page.locator('dialog[open]').count()) await closeDialog();
    await page.reload();
    await page.waitForSelector('.sidebar');
    assert.ok((await data()).runs.find((r) => r.id === run.id).steps.some((s) => s.status === 'erledigt'));
    await page.locator('.step-row').first().waitFor();
    await page.screenshot({ path: resolve(output, '03-planlauf-desktop.png') });
  });
  await check('CSV import creates separate runs even for repeated plan codes', async () => {
    await open(`#/projekt/${project.id}/plaene`);
    await page.getByRole('button', { name: 'Excel-Import', exact: true }).click();
    const workflow = initial.templates[0].name;
    const csv = `Art;Plancodierung;Titel;Gewerk;Workflow;Planlauf\nPlan;QA-CSV;CSV erster Plan;KIB;${workflow};starten\nPlan;QA-CSV;CSV zweiter Plan;LST;${workflow};starten`;
    await page
      .locator('dialog input[type=file]')
      .setInputFiles({ name: 'qa.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.locator('dialog .modal-footer button.btn-primary').click();
    await page.waitForFunction(
      (key) =>
        JSON.parse(localStorage.getItem(key)).documents.filter((d) => d.nummer === 'QA-CSV').length === 2,
      KEY,
    );
    const d = await data();
    const ids = d.documents.filter((d) => d.nummer === 'QA-CSV').map((d) => d.id);
    assert.equal(new Set(d.runs.filter((r) => ids.includes(r.documentId)).map((r) => r.documentId)).size, 2);
  });
  await check('Excel export creates a readable workbook', async () => {
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Excel', exact: true }).click();
    const file = await download;
    assert.ok(file.suggestedFilename().endsWith('.xlsx'));
    await file.saveAs(resolve(output, 'export.xlsx'));
    const roundtrip = await page.evaluate(async () => {
      const { xlsxErzeugen } = await import('/src/lib/xlsx.ts');
      const { xlsxLesen } = await import('/src/lib/xlsxLesen.ts');
      const file = new File(
        [
          xlsxErzeugen([
            {
              name: 'Prüfung',
              zeilen: [
                ['Titel', 'Text'],
                ['Überbau', '=1+1'],
              ],
            },
          ]),
        ],
        'test.xlsx',
      );
      return xlsxLesen(file);
    });
    assert.deepEqual(roundtrip[0].zeilen, [
      ['Titel', 'Text'],
      ['Überbau', '=1+1'],
    ]);
  });
  await check('Workflow duplication preserves valid links across reload', async () => {
    await open('#/ketten');
    await page.getByRole('button', { name: 'Duplizieren', exact: true }).first().click();
    await page.waitForFunction(
      (key) => JSON.parse(localStorage.getItem(key)).templates.some((t) => t.name.includes('(Kopie)')),
      KEY,
    );
    await page.reload();
    await page.waitForSelector('.sidebar');
    assert.equal(await page.locator('.recovery-screen').count(), 0);
  });
  await check('Backup validation, preview and confirmed restoration', async () => {
    await page.getByRole('button', { name: 'Daten & Sicherung', exact: true }).click();
    const input = page.locator('dialog input[type=file]');
    await input.setInputFiles({
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{broken'),
    });
    await page.locator('dialog [role=alert]').waitFor();
    assert.ok((await data()).projects.some((p) => p.id === project.id));
    await input.setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(initial)),
    });
    await page.getByRole('button', { name: 'Sicherung übernehmen', exact: true }).click();
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Sichern und wiederherstellen', exact: true }).click();
    await dl;
    await page.waitForFunction(
      ({ key, count }) => JSON.parse(localStorage.getItem(key)).projects.length === count,
      { key: KEY, count: initial.projects.length },
    );
    await page.reload();
    await page.waitForSelector('.sidebar');
  });
  await check('Mobile navigation, layout and dialog at 390px', async () => {
    await open('#/dashboard');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().right <= 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: resolve(output, '04-dashboard-mobile.png') });
    await page.getByRole('button', { name: 'Menü öffnen', exact: true }).click();
    await page.locator('.sidebar.open').waitFor();
    await page.locator('.sidebar').getByRole('button', { name: 'Projekte', exact: false }).first().click();
    await page.waitForURL(/projekte/);
    await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().right <= 0);
    await page.getByRole('button', { name: 'Neues Projekt', exact: true }).click();
    const rect = await page.locator('dialog[open]').boundingBox();
    assert.ok(rect.x >= 0 && rect.x + rect.width <= 390);
    await page.screenshot({ path: resolve(output, '05-dialog-mobile.png') });
    await closeDialog();
  });
  await check('Conflicting browser tab changes are visible', async () => {
    await page.setViewportSize({ width: 1440, height: 1120 });
    const other = await context.newPage();
    await other.goto(url);
    await other.waitForSelector('.sidebar');
    await other.evaluate((key) => {
      const d = JSON.parse(localStorage.getItem(key));
      d.bearbeiter.name = 'Anderer Tab';
      localStorage.setItem(key, JSON.stringify(d));
    }, KEY);
    await page.locator('.storage-warning').waitFor();
    await page.getByRole('button', { name: 'Erneut speichern', exact: true }).click();
    assert.equal((await data()).bearbeiter.name, 'Anderer Tab');
    await page.reload();
    await page.waitForSelector('.sidebar');
  });
  await check('Corrupt data opens recovery without overwriting the raw data', async () => {
    await page.evaluate((key) => localStorage.setItem(key, '{damaged'), KEY);
    await page.reload();
    await page.getByRole('heading', { name: 'Ihr Datenbestand bleibt erhalten.' }).waitFor();
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), KEY), '{damaged');
    await page.screenshot({ path: resolve(output, '06-recovery.png') });
  });
  // The recovery test intentionally throws inside React; the boundary handles it.
  const unexpected = errors.filter((e) => !e.includes('kein gültiges JSON'));
  assert.deepEqual(unexpected, []);
  await writeFile(
    resolve(output, 'browser-results.json'),
    JSON.stringify({ passed: checks.length, checks, unexpectedErrors: unexpected }, null, 2),
  );
  console.log(`${checks.length} browser checks passed.`);
} catch (error) {
  await page.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
  console.error((await page.locator('body').innerText()).slice(-3500));
  throw error;
} finally {
  await browser.close();
  await server.close();
}
