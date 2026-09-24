// Tests scripts/backup.py (the every-2-hours GitHub backup) against the real backend code.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createBackend } from './fake-gas.mjs';
import { serve, seedState, ROOT } from './util.mjs';

const run = promisify(execFile);
console.log('backup (scripts/backup.py)');
const b = createBackend(); b.run('setup');
const s = seedState();
s.expenses.push({ id: 'z1', date: '2026-09-26', cat: 'food', amt: 1850, desc: 'Lunch, "shack" at Anjuna', by: 0, split: [0, 1], slot: 3, place: 'Anjuna Beach', addedBy: 'Akshay' });
b.post({ action: 'save', key: 'goa2026', baseRev: 0, state: s, user: 'Akshay' });
const { server, base } = await serve(b);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trip-bk-'));
fs.mkdirSync(path.join(dir, 'scripts')); fs.copyFileSync(path.join(ROOT, 'scripts/backup.py'), path.join(dir, 'scripts/backup.py'));
const env = { ...process.env, TRIP_API_URL: base + '/api', TRIP_PASSCODE: 'goa2026', NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost' };
try {
  const r1 = (await run('python3', ['scripts/backup.py'], { env, cwd: dir })).stdout;
  assert.match(r1, /Backed up rev 1/);
  const latest = path.join(dir, 'backups/latest');
  for (const f of ['Expenses.csv', 'Plan.csv', 'Places.csv', 'Budget.csv', 'Balances.csv', 'trip.json', 'rev.txt', 'INFO.md']) assert.ok(fs.existsSync(path.join(latest, f)), f);
  assert.match(fs.readFileSync(path.join(latest, 'Expenses.csv'), 'utf8'), /"Lunch, ""shack"" at Anjuna"/);
  console.log('  ✓ writes CSV / JSON (+ Excel when openpyxl is installed) into backups/latest and backups/history');
  const r2 = (await run('python3', ['scripts/backup.py'], { env, cwd: dir })).stdout;
  assert.match(r2, /No changes/);
  console.log('  ✓ skips when nothing changed');
  const r3 = (await run('python3', ['scripts/backup.py'], { env: { ...env, TRIP_API_URL: '' }, cwd: dir })).stdout;
  assert.match(r3, /not set/);
  console.log('  ✓ exits cleanly when secrets are not configured yet');
} finally { server.close(); }
