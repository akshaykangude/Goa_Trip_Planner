// Live shared mode (planner published as a Claude page): several phones, one shared store.
// The Claude page's `db` is simulated by a tiny in-memory store on a local server.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium, devices } from 'playwright';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
execFileSync('python3', [path.join(ROOT, 'scripts/build-artifact.py')]);
const page = fs.readFileSync(path.join(ROOT, 'artifact/goa-trip-planner.html'), 'utf8');
const html = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + page + '</body></html>';
const store = new Map(); let writes = 0;
const server = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x');
  if (u.pathname === '/') { r.writeHead(200, { 'Content-Type': 'text/html' }); return r.end(html); }
  if (u.pathname === '/db') {
    if (q.method === 'POST') { let b = ''; q.on('data', c => b += c); q.on('end', () => { const m = JSON.parse(b); writes++;
      if (m.op === 'set') store.set(m.path, m.data); else store.delete(m.path); r.end('{}'); }); return; }
    const doc = u.searchParams.get('doc'), col = u.searchParams.get('col');
    if (doc) return r.end(JSON.stringify(store.has(doc) ? { exists: true, data: store.get(doc) } : { exists: false }));
    const docs = [...store.entries()].filter(([k]) => k.startsWith(col + '/') && k.split('/').length === col.split('/').length + 1).map(([k, v]) => ({ id: k.split('/').pop(), data: v }));
    return r.end(JSON.stringify(docs));
  }
  r.writeHead(404); r.end();
}).listen(0);
const base = `http://localhost:${server.address().port}/`;
const FAKE = (readonly) => `(() => { const RO=${readonly};
  const post = m => fetch('/db',{method:'POST',body:JSON.stringify(m)}).then(()=>{});
  const deny = () => Promise.reject({code:'invalid_argument',message:'not allowed'});
  const docRef = p => ({ id:p.split('/').pop(), path:p,
    get: async()=>{ const d=await (await fetch('/db?doc='+p)).json(); return {id:p.split('/').pop(),exists:d.exists,data:()=>d.data,metadata:{fromCache:false,hasPendingWrites:false}}; },
    set: d => RO?deny():post({op:'set',path:p,data:d}), update: d => RO?deny():post({op:'set',path:p,data:d}), delete: () => RO?deny():post({op:'del',path:p}),
    onSnapshot(next){ let last=null; const tick=async()=>{ const d=await (await fetch('/db?doc='+p)).text(); if(d!==last){ last=d; const j=JSON.parse(d); next({id:p.split('/').pop(),exists:j.exists,data:()=>j.data,metadata:{fromCache:false,hasPendingWrites:false}}); } };
      tick(); const t=setInterval(tick,250); return ()=>clearInterval(t); } });
  const colRef = p => ({ path:p, doc: id => docRef(p+'/'+(id||Math.random().toString(36).slice(2))),
    onSnapshot(next){ let last=null; const tick=async()=>{ const d=await (await fetch('/db?col='+p)).text(); if(d!==last){ last=d; const docs=JSON.parse(d).map(x=>({id:x.id,exists:true,data:()=>x.data,metadata:{}}));
      next({docs,size:docs.length,empty:!docs.length,docChanges:()=>[],metadata:{fromCache:false,hasPendingWrites:false}}); } };
      tick(); const t=setInterval(tick,250); return ()=>clearInterval(t); } });
  const db = { doc: docRef, collection: colRef };
  const user = { can: async()=>!RO, name: async()=>'', isOwner: async()=>false, canEdit: async()=>!RO };
  window.claude = { use: async n => n==='db'?db : n==='user'?user : null };
})();`;
const browser = await chromium.launch(); const errors = []; let pass = 0;
const step = n => { pass++; console.log('  ✓ ' + n); };
async function phone(who, readonly = false) {
  const c = await browser.newContext({ ...devices['Pixel 7'] }); await c.route(/fonts\.g/, r => r.abort());
  await c.addInitScript(FAKE(readonly)); await c.addInitScript(n => { try { localStorage.setItem('goaTripPlanner.v1.user', n); localStorage.setItem('goaTripPlanner.v1.view', 'pc'); } catch (e) { } }, who);
  const p = await c.newPage(); p.on('pageerror', e => errors.push(`[${who}] ${e.message}`));
  await p.goto(base); await p.waitForSelector('#planTbl tbody tr'); return { c, p };
}
const pill = p => p.textContent('.ts-pill');
const until = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise(r => setTimeout(r, 150)); } return false; };
const bills = p => p.evaluate(() => JSON.parse(localStorage.getItem('goaTripPlanner.v1')).expenses.map(e => e.desc).sort().join('|'));
async function bill(p, cell, amt, desc) { await p.click(`[data-bill="${cell}"]`); await p.fill('.billin', amt); await p.fill('.billdesc', desc); await p.click('.billok'); }
console.log('live shared mode (Claude page)');
try {
  const A = await phone('Akshay');
  assert.ok(await until(() => store.has('trip/plan')), 'first phone uploads the plan');
  assert.ok(await until(async () => /Shared live/.test(await pill(A.p))));
  step('first phone starts the shared trip and shows “Shared live”');
  const W = await phone('Wife');
  assert.equal(await W.p.locator('#planTbl tbody tr').count(), 9);
  await Promise.all([bill(A.p, '1,3', '1200', 'Lunch at Brittos'), bill(W.p, '1,7', '3000', 'Dinner Thalassa')]);
  assert.ok(await until(async () => (await bills(A.p)) === 'Dinner Thalassa|Lunch at Brittos' && (await bills(W.p)) === 'Dinner Thalassa|Lunch at Brittos'), 'both bills on both phones');
  assert.equal([...store.keys()].filter(k => k.startsWith('bills/')).length, 2);
  step('two people add bills at the same moment → both phones show both bills');
  await A.p.click('.c[data-r="2"][data-c="3"]'); await A.p.keyboard.press('End'); await A.p.keyboard.type(' at Mikeys'); await A.p.click('h2');
  assert.ok(await until(async () => /Mikeys/.test(await W.p.textContent('.c[data-r="2"][data-c="3"]'))));
  step('a timetable edit on one phone appears on the other');
  await W.p.evaluate(() => document.querySelector('.tab[data-v="money"]').click());
  await W.p.click('#expTbl [data-ed]'); await W.p.click('#ask-yes');
  assert.ok(await until(async () => (await bills(A.p)).split('|').length === 1));
  step('deleting a bill (with the in-page “Are you sure?”) removes it for everyone');
  const V = await phone('Guest', true);
  assert.ok(await until(async () => /View only/.test(await pill(V.p))));
  const before = writes; await bill(V.p, '3,3', '999', 'should not save'); await V.p.waitForTimeout(1200);
  assert.equal(writes, before); assert.equal([...store.keys()].filter(k => k.startsWith('bills/')).length, 1);
  step('a view-only visitor sees the plan but cannot change shared data');
  await A.c.clearCookies(); await A.p.evaluate(() => localStorage.clear()); await A.p.reload(); await A.p.waitForSelector('#planTbl tbody tr');
  assert.ok(await until(async () => (await A.p.evaluate(() => JSON.parse(localStorage.getItem('goaTripPlanner.v1') || '{"expenses":[]}').expenses.length)) === 1));
  assert.ok(await until(async () => /Mikeys/.test(await A.p.textContent('.c[data-r="2"][data-c="3"]'))));
  step('phone storage wiped → everything comes back from the shared store');
  assert.deepEqual(errors, []); step('no JavaScript errors');
  console.log(`  ${pass} passed`);
} catch (e) { console.error('  ✗ FAILED after', pass, 'steps:', e.message); if (errors.length) console.error(errors); process.exitCode = 1; }
finally { await browser.close(); server.close(); }
