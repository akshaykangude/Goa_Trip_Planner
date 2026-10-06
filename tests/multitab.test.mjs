// Regression test for the "bills disappeared" bug (Oct 2026):
// stale tabs must never overwrite newer data; bills from other phones can be added; lost bills can be recovered.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { chromium, devices } from 'playwright';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const server = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : 'text/javascript' }); fs.createReadStream(f).pipe(r); }).listen(0);
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch(); const errors = []; let pass = 0;
const step = n => { pass++; console.log('  ✓ ' + n); };
const n = p => p.evaluate(() => JSON.parse(localStorage.getItem('goaTripPlanner.v1')).expenses.length);
async function phone() { const c = await browser.newContext({ ...devices['Pixel 7'], acceptDownloads: true }); await c.route(/fonts\.g/, r => r.abort());
  const p = await c.newPage(); p.on('pageerror', e => errors.push(e.message)); await p.goto(base + '/index.html'); await p.waitForSelector('#planTbl tbody tr'); return { c, p }; }
async function bill(p, cell, amt, desc) { await p.click(`[data-bill="${cell}"]`); await p.fill('.billin', amt); await p.fill('.billdesc', desc); await p.click('.billok'); await p.waitForTimeout(200); }
console.log('multi-tab safety');
try {
  const { c, p } = await phone();
  const old = await c.newPage(); await old.goto(base + '/index.html'); await old.waitForSelector('#planTbl tbody tr');
  await bill(p, '1,3', '900', 'Lunch'); await bill(p, '1,7', '500', 'Dinner');
  await old.bringToFront(); await old.click('.tab[data-v="notes"]'); await old.fill('#notes', 'x'); await old.click('#addCheckBtn'); await old.waitForTimeout(300);
  assert.equal(await n(old), 2); step('an old tab saving a small change keeps the bills added in a newer tab');
  const ex = await c.newPage(); await ex.goto(base + '/explore.html'); await ex.waitForSelector('#grid [data-plan]');
  await p.bringToFront(); await p.click('.tab[data-v="plan"]'); await bill(p, '2,3', '700', 'Snacks');
  await ex.bringToFront(); await ex.click('#grid [data-plan]'); await ex.click('#pm-list'); await ex.waitForTimeout(300);
  assert.equal(await n(ex), 3); step('a stale Explore tab adding a place keeps all bills');
  await c.close();
  const A = await phone(), W = await phone();
  await bill(A.p, '1,3', '1200', 'Lunch A'); await bill(W.p, '2,8', '4000', 'Club W'); await bill(W.p, '2,3', '800', 'Lunch W');
  const [dl] = await Promise.all([W.p.waitForEvent('download'), W.p.click('#exportBtn')]); const f = path.join(os.tmpdir(), 'wife-bills.json'); await dl.saveAs(f);
  await A.p.setInputFiles('#importFile', f); await A.p.waitForTimeout(400); await A.p.setInputFiles('#importFile', f); await A.p.waitForTimeout(400);
  assert.equal(await n(A.p), 3); assert.equal(await A.p.locator('#planTbl tbody tr').count(), 10);
  step('bills from another phone are added (not replaced), duplicates skipped');
  const R = await phone(); await bill(R.p, '1,3', '500', 'Snacks'); await bill(R.p, '3,7', '2500', 'Dinner');
  await R.p.evaluate(() => { const K = 'goaTripPlanner.v1', s = JSON.parse(localStorage.getItem(K));
    localStorage.setItem(K + '.versions', JSON.stringify([{ t: Date.now() - 3600e3, by: 'old', bills: 2, total: 3000, state: JSON.parse(JSON.stringify(s)) }]));
    localStorage.removeItem(K + '.billVault'); s.expenses = []; localStorage.setItem(K, JSON.stringify(s)); });
  await R.p.reload(); await R.p.waitForSelector('#planTbl tbody tr');
  await R.p.evaluate(() => document.querySelector('.tab[data-v="history"]').click()); await R.p.click('#rescueScan'); await R.p.click('#rescueAdd'); await R.p.waitForTimeout(300);
  assert.equal(await n(R.p), 2); step('🛟 Recover lost bills restores bills wiped by the old bug');
  const O = await phone();   // a browser that saved the plan BEFORE 4 Oct was added
  await O.p.evaluate(() => { const K = 'goaTripPlanner.v1', s = JSON.parse(document.getElementById('seed').textContent); s.savedAt = Date.now();
    s.days = s.days.filter(d => d.date !== '2026-10-04'); delete s.planRev; s.subtitle = s.subtitle.replace('4 Oct', '3 Oct');
    s.days[0].cells[0] = 'MY EDIT'; s.expenses = [{ id: 'keep1', date: '2026-09-26', cat: 'food', amt: 450, desc: 'Kept bill', by: 0, split: [0, 1], mode: 'UPI', slot: 3 }];
    localStorage.setItem(K, JSON.stringify(s)); });
  await O.p.reload(); await O.p.waitForSelector('#planTbl tbody tr');
  assert.equal(await O.p.locator('#planTbl tbody tr').count(), 10);
  assert.match(await O.p.textContent('#planTbl'), /MY EDIT/); assert.match(await O.p.textContent('#subtitle'), /4 Oct/);
  assert.equal(await n(O.p), 1);
  step('an older saved copy gets the new 4 Oct day; its own edits and bills are kept');
  assert.deepEqual(errors, []); step('no JavaScript errors');
  console.log(`  ${pass} passed`);
} catch (e) { console.error('  ✗ FAILED after', pass, 'steps:', e.message); if (errors.length) console.error(errors); process.exitCode = 1; }
finally { await browser.close(); server.close(); }
