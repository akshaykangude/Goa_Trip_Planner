// Tests the real backend/Code.gs + TripData.gs in a fake Apps Script environment.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createBackend } from './fake-gas.mjs';
import { seedState } from './util.mjs';

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log('  ✓ ' + name); };
console.log('backend (Code.gs)');

t('TripData.gs is an exact copy of assets/tripdata.js', () => {
  assert.equal(fs.readFileSync(new URL('../backend/TripData.gs', import.meta.url), 'utf8'),
    fs.readFileSync(new URL('../assets/tripdata.js', import.meta.url), 'utf8'),
    'Run: cp assets/tripdata.js backend/TripData.gs');
});

const B = createBackend({
  placesHandler: (url, opts) => {
    if (url.includes('searchText')) {
      const q = JSON.parse(opts.payload).textQuery;
      return { body: { places: [{ id: 'p1', displayName: { text: q.replace(', Goa', '') }, rating: 4.6, userRatingCount: 900, reviews: [{ rating: 5, text: { text: 'Amazing sunset view, friendly staff' }, publishTime: '2026-09-01T00:00:00Z' }] }] } };
    }
    if (url.includes('searchNearby')) return { body: { places: [{ id: 'n1', displayName: { text: 'Better Cafe' }, rating: 4.8, userRatingCount: 2000, location: { latitude: 15.6, longitude: 73.74 } }] } };
    if (url.includes('maps.app.goo.gl')) return { code: 302, body: '', headers: { Location: 'https://www.google.com/maps/place/Thalassa/@15.599,73.739,17z' } };
    return null;
  }
});

t('rejects a wrong passcode', () => {
  const r = B.post({ action: 'get', key: 'nope' });
  assert.equal(r.ok, false); assert.equal(r.auth, false);
});
t('ping via GET works without passcode (health check)', () => { assert.equal(B.get({ action: 'ping' }).ok, true); });
t('setup() creates folder, sheet and a 2-hour trigger', () => {
  B.run('setup');
  assert.ok(B.props.FOLDER_ID && B.props.SNAP_FOLDER_ID && B.props.SHEET_ID);
  assert.equal(B.triggers.length, 1); assert.equal(B.triggers[0].h, 2);
  B.run('setup'); assert.equal(B.triggers.length, 1, 'running setup twice keeps one trigger');
});

const s0 = seedState();
t('empty backend returns rev 0 and no state', () => {
  const r = B.post({ action: 'get', key: 'goa2026' }); assert.equal(r.rev, 0); assert.equal(r.state, null);
});
t('first save → rev 1, live sheet written', () => {
  const r = B.post({ action: 'save', key: 'goa2026', baseRev: 0, state: s0, user: 'Akshay' });
  assert.equal(r.ok, true); assert.equal(r.rev, 1);
  assert.ok(B.sheetRows('Expenses')); assert.ok(B.sheetRows('Plan').length > 5);
  assert.equal(B.sheetRows('Summary')[3][1], 'Akshay');
});
t('get with same rev says unchanged', () => {
  const r = B.post({ action: 'get', key: 'goa2026', sinceRev: 1 }); assert.equal(r.unchanged, true);
});
t('stale save is rejected as a conflict with the current state', () => {
  const s1 = structuredClone(s0); s1.expenses.push({ id: 'a', date: '2026-09-26', amt: 100, desc: 'x', by: 0, split: [0], cat: 'food' });
  assert.equal(B.post({ action: 'save', key: 'goa2026', baseRev: 1, state: s1, user: 'Wife' }).rev, 2);
  const s2 = structuredClone(s0); s2.expenses.push({ id: 'b', date: '2026-09-26', amt: 50, desc: 'y', by: 1, split: [1], cat: 'food' });
  const r = B.post({ action: 'save', key: 'goa2026', baseRev: 1, state: s2, user: 'Friend' });
  assert.equal(r.conflict, true); assert.equal(r.rev, 2); assert.equal(r.state.expenses.length, 1);
});
t('guard: refuses to wipe most bills unless forced', () => {
  const cur = B.post({ action: 'get', key: 'goa2026' }).state;
  for (let i = 0; i < 8; i++) cur.expenses.push({ id: 'g' + i, date: '2026-09-27', amt: 10, desc: 'g', by: 0, split: [0], cat: 'misc' });
  const r1 = B.post({ action: 'save', key: 'goa2026', baseRev: 2, state: cur, user: 'Akshay' }); assert.equal(r1.rev, 3);
  const wiped = structuredClone(cur); wiped.expenses = [];
  const r2 = B.post({ action: 'save', key: 'goa2026', baseRev: 3, state: wiped, user: 'Akshay' });
  assert.equal(r2.guard, true);
  const r3 = B.post({ action: 'save', key: 'goa2026', baseRev: 3, state: cur, user: 'Akshay' }); assert.equal(r3.rev, 4);
});
t('invalid data is never saved', () => {
  assert.equal(B.post({ action: 'save', key: 'goa2026', baseRev: 4, state: { hello: 1 } }).ok, false);
  assert.equal(B.post({ action: 'get', key: 'goa2026' }).rev, 4);
});
t('export returns CSVs for every table', () => {
  const r = B.post({ action: 'export', key: 'goa2026' });
  assert.deepEqual(Object.keys(r.csv), ['Expenses', 'Spend by day', 'Plan', 'Places', 'Budget', 'Balances']);
  assert.match(r.csv.Expenses, /^Date,Day,Time slot,Description/);
});
t('snapshot job writes CSV + JSON + XLSX, skips when unchanged', () => {
  const a = B.run('snapshot_', false, 'auto');
  assert.ok(a.id); const f = B.snapFolders()[0];
  const names = f.files.map(x => x.name).sort();
  assert.ok(names.includes('trip.json') && names.includes('Expenses.csv') && names.some(n => n.endsWith('.xlsx')), names.join());
  assert.equal(B.run('snapshot_', false, 'auto').skipped, true);
  assert.ok(B.run('snapshot_', true, 'manual').id, 'forced snapshot always runs');
});
t('snapshots list + restore a snapshot', () => {
  const list = B.post({ action: 'snapshots', key: 'goa2026' }).list; assert.ok(list.length >= 2);
  const snap = B.post({ action: 'snapshot', key: 'goa2026', id: list[0].id });
  assert.equal(snap.ok, true); assert.equal(snap.state.expenses.length, 9);
  assert.equal(B.post({ action: 'snapshot', key: 'goa2026', id: B.props.FOLDER_ID }).ok, false, 'only snapshot folders can be read');
});
t('place search returns slim places with reviews', () => {
  const r = B.post({ action: 'place', key: 'goa2026', q: 'Thalassa' });
  assert.equal(r.ok, true); assert.equal(r.places[0].name, 'Thalassa'); assert.equal(r.places[0].reviews.length, 1);
  assert.equal(B.post({ action: 'place', key: 'goa2026', q: 'Thalassa' }).cached, true);
});
t('short Google Maps link is expanded and searched by name', () => {
  const r = B.post({ action: 'place', key: 'goa2026', q: 'https://maps.app.goo.gl/abc123' });
  assert.equal(r.ok, true); assert.equal(r.resolved.name, 'Thalassa'); assert.equal(r.resolved.lat, 15.599);
});
t('nearby search for better options', () => {
  const r = B.post({ action: 'nearby', key: 'goa2026', lat: 15.6, lng: 73.74, kind: 'cafe' });
  assert.equal(r.ok, true); assert.equal(r.places[0].name, 'Better Cafe');
  const body = JSON.parse(B.fetchLog.filter(x => x.url.includes('searchNearby')).pop().opts.payload);
  assert.deepEqual(body.includedTypes, ['cafe', 'bakery']);
});
t('without a Places key the search says so clearly', () => {
  const nb = createBackend({ placesKey: null });
  assert.equal(nb.post({ action: 'place', key: 'goa2026', q: 'x y' }).error, 'no_places_key');
});
console.log(`  ${pass} passed`);
