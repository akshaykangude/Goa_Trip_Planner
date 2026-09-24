// End-to-end browser test: two people editing at once, offline, history, Maps links, Explore.
// Runs the REAL backend code (tests/fake-gas.mjs) behind a local server.
//   npm test   (needs: npm i && npx playwright install chromium)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { createBackend } from './fake-gas.mjs';
import { serve, ROOT } from './util.mjs';

const SHOTS = process.env.SHOTS || '';
const places = (q) => {
  const name = q.replace(/, Goa$/, '');
  return [{ id: 'pid-' + name, displayName: { text: name }, rating: name === 'Thalassa' ? 4.5 : 4.1, userRatingCount: 3200, primaryTypeDisplayName: { text: 'Greek Restaurant' },
    formattedAddress: 'Vagator, Goa', location: { latitude: 15.599, longitude: 73.739 }, googleMapsUri: 'https://maps.google.com/?cid=1',
    currentOpeningHours: { openNow: true }, outdoorSeating: true, servesCocktails: true,
    reviews: [
      { rating: 5, text: { text: 'Amazing sunset view and friendly staff, must visit' }, relativePublishTimeDescription: '2 days ago', publishTime: '2026-09-20T10:00:00Z', authorAttribution: { displayName: 'Riya' } },
      { rating: 4, text: { text: 'Delicious food but a bit slow on a busy night' }, relativePublishTimeDescription: 'a week ago', publishTime: '2026-09-15T10:00:00Z', authorAttribution: { displayName: 'Sam' } }] }];
};
const backend = createBackend({
  placesHandler: (url, opts) => {
    if (url.includes('searchText')) return { body: { places: places(JSON.parse(opts.payload).textQuery) } };
    if (url.includes('searchNearby')) return { body: { places: [
      { id: 'n1', displayName: { text: 'Sunset Greek Taverna' }, rating: 4.8, userRatingCount: 5100, location: { latitude: 15.601, longitude: 73.741 }, currentOpeningHours: { openNow: true }, reviews: [{ rating: 5, text: { text: 'Best view, delicious and fresh' }, publishTime: '2026-09-21T00:00:00Z' }] },
      { id: 'n2', displayName: { text: 'Average Diner' }, rating: 3.9, userRatingCount: 300, location: { latitude: 15.61, longitude: 73.75 } }] } };
    if (url.includes('maps.app.goo.gl')) return { code: 302, body: '', headers: { Location: 'https://www.google.com/maps/place/Thalassa/@15.599,73.739,17z' } };
    return null;
  }
});
backend.run('setup');

const { server, base } = await serve(backend);
const browser = await chromium.launch();
const errors = [];
let pass = 0;
const step = (n) => { pass++; console.log('  ✓ ' + n); };
const shot = async (page, name, opts) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, ...opts }); };

async function phone(name, { mobile = false } = {}) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`[${name}] ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) errors.push(`[${name}] console: ${m.text()}`); });
  page.on('dialog', d => d.accept());
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  return { ctx, page };
}
async function login(page, who, pass = 'goa2026') {
  await page.waitForSelector('.ts-modal.on');
  const opts = await page.$$eval('#tsUser option', o => o.map(x => x.textContent));
  if (opts.includes(who)) await page.selectOption('#tsUser', { label: who });
  else { await page.selectOption('#tsUser', '__other'); await page.fill('#tsOther', who); }
  await page.fill('#tsKey', pass);
  await page.click('#tsSave');
}
const synced = (page) => page.waitForFunction(() => /ts-synced/.test(document.querySelector('.ts-pill')?.className || ''), null, { timeout: 15000 });
const state = () => backend.post({ action: 'get', key: 'goa2026' }).state;

console.log('browser smoke test');
try {
  // ── 1. Akshay connects first: his copy seeds the shared backend
  const A = await phone('Akshay');
  await A.page.goto(base + '/index.html');
  await login(A.page, 'Akshay');
  await synced(A.page);
  assert.equal(backend.post({ action: 'get', key: 'goa2026' }).rev, 1);
  step('first phone connects with passcode and uploads the plan');
  await shot(A.page, '01-planner');

  // ── 2. Wife connects on a phone-sized screen
  const W = await phone('Wife', { mobile: true });
  await W.page.goto(base + '/index.html');
  await login(W.page, 'Wife');
  await synced(W.page);
  assert.equal(await W.page.evaluate(() => document.documentElement.scrollWidth), 390, 'no sideways scroll on phone');
  step('second phone joins, loads the shared plan, fits a phone screen');
  await shot(W.page, '02-wife-phone');

  // ── 3. wrong passcode is refused
  const X = await phone('Stranger');
  await X.page.goto(base + '/index.html');
  await login(X.page, 'Stranger', 'wrong');
  await X.page.waitForFunction(() => /Wrong passcode/.test(document.querySelector('#tsErr')?.textContent || ''));
  step('wrong passcode is refused');
  await X.ctx.close();

  // ── 4. both add a bill at the same moment
  const cell = A.page.locator('td.cell[data-r="1"][data-c="3"]');
  await cell.hover(); await A.page.click('[data-bill="1,3"]');
  await A.page.fill('.billin', '1850');
  assert.ok((await A.page.inputValue('.billdesc')).length > 0, 'description is pre-filled');
  await A.page.fill('.billdesc', 'Lunch at Anjuna shack');
  await W.page.evaluate(() => document.querySelector('#pmPanel').scrollIntoView());
  await W.page.fill('#pm-amt', '640'); await W.page.fill('#pm-desc', 'Coconut water + snacks'); await W.page.selectOption('#pm-day', '1');
  await Promise.all([A.page.click('.billok'), W.page.click('#pm-add')]);
  await A.page.waitForFunction(() => JSON.parse(localStorage.getItem('goaTripPlanner.v1')).expenses.length === 2, null, { timeout: 20000 });
  await W.page.waitForFunction(() => JSON.parse(localStorage.getItem('goaTripPlanner.v1')).expenses.length === 2, null, { timeout: 20000 });
  const ex = state().expenses;
  assert.equal(ex.length, 2);
  assert.deepEqual(ex.map(e => e.addedBy).sort(), ['Akshay', 'Wife']);
  assert.equal(ex.find(e => e.addedBy === 'Wife').by, 1, 'paid-by defaults to the person using the phone');
  assert.ok(ex.find(e => e.desc === 'Lunch at Anjuna shack' && e.amt === 1850 && e.slot === 3));
  step('two people add bills at the same time → both saved, each tagged with who added it');

  // ── 5. empty bill description is not allowed
  await cell.hover(); await A.page.click('[data-bill="1,3"]');
  await A.page.fill('.billin', '99'); await A.page.fill('.billdesc', '');
  await A.page.click('.billok');
  assert.equal(await A.page.evaluate(() => JSON.parse(localStorage.getItem('goaTripPlanner.v1')).expenses.length), 2);
  await A.page.keyboard.press('Escape');
  step('a bill needs a “where / what” description');

  // ── 6. pasting a Google Maps link into a slot tags the place
  const c = W.page.locator('.c[data-r="2"][data-c="3"]');
  await W.page.evaluate(() => document.querySelector('.c[data-r="2"][data-c="3"]').scrollIntoView({ block: 'center', inline: 'center' }));
  await c.click(); await W.page.keyboard.press('Control+A');
  await W.page.keyboard.type('🍽️ Lunch https://www.google.com/maps/place/Como+Agua/@15.6,73.74,17z');
  await W.page.locator('.c[data-r="2"][data-c="4"]').click();
  await W.page.waitForFunction(() => { const s = JSON.parse(localStorage.getItem('goaTripPlanner.v1')); return s.days[2].place[3] === 'Como Agua'; });
  await A.page.waitForFunction(() => { const s = JSON.parse(localStorage.getItem('goaTripPlanner.v1')); return s.days[2].place[3] === 'Como Agua' && /maps\/place\/Como/.test(s.days[2].plink[3]); }, null, { timeout: 20000 });
  assert.match(await A.page.locator('td.cell[data-r="2"][data-c="3"] .plc').getAttribute('href'), /maps\/place\/Como\+Agua/);
  step('Google Maps link pasted in a slot → place tagged, exact pin kept, synced to the other phone');

  // ── 7. offline: edits wait on the phone, then sync
  await W.ctx.setOffline(true);
  await W.page.fill('#pm-amt', '300'); await W.page.fill('#pm-desc', 'Parking'); await W.page.click('#pm-add');
  await W.page.waitForFunction(() => /ts-(offline|pending|error)/.test(document.querySelector('.ts-pill').className));
  assert.equal(state().expenses.length, 2);
  await W.ctx.setOffline(false);
  await W.page.evaluate(() => window.dispatchEvent(new Event('online')));
  await W.page.waitForFunction(() => /ts-synced/.test(document.querySelector('.ts-pill').className), null, { timeout: 20000 });
  assert.equal(state().expenses.length, 3);
  step('offline edits are kept on the phone and upload when back online');

  // ── 8. history: snapshot now, preview, restore
  await A.page.waitForFunction(() => JSON.parse(localStorage.getItem('goaTripPlanner.v1')).expenses.length === 3, null, { timeout: 20000 });
  await A.page.click('.tab[data-v="history"]');
  await A.page.click('#hxSnapNow');
  await A.page.waitForSelector('[data-hxcloud]');
  assert.ok(backend.snapFolders().length >= 1);
  await shot(A.page, '03-history');
  await A.page.click('[data-hxcloud]');
  await A.page.waitForSelector('#hxModal.on');
  assert.match(await A.page.textContent('#hx-bills'), /Parking/);
  await shot(A.page, '04-history-preview');
  await A.page.click('#hxModal [data-close]');
  const csv = await Promise.all([A.page.waitForEvent('download'), A.page.click('[data-hxcsv="Expenses"]')]).then(([d]) => d.path()).then(p => fs.readFileSync(p, 'utf8'));
  assert.match(csv, /Lunch at Anjuna shack/); assert.match(csv, /Added by/);
  step('History: cloud snapshot, preview, CSV download');

  // ── 9. Explore: search by name → verdict + reviews, compare, add better option
  await A.page.goto(base + '/explore.html?q=Thalassa&day=4&slot=7');
  await A.page.waitForSelector('.result .verdict');
  const txt = await A.page.textContent('#results');
  assert.match(txt, /Newest Google reviews/); assert.match(txt, /Riya/);
  await A.page.waitForSelector('#cmpAlt [data-use]', { timeout: 15000 });
  assert.match(await A.page.textContent('#cmpAlt'), /Sunset Greek Taverna/);
  assert.doesNotMatch(await A.page.textContent('#cmpAlt'), /Average Diner/, 'worse places are not suggested');
  await shot(A.page, '05-explore-search', { fullPage: false });
  await A.page.click('#cmpAlt [data-use="Sunset Greek Taverna"]');
  await A.page.waitForFunction(() => JSON.parse(localStorage.getItem('goaTripPlanner.v1')).days[4].place[7] === 'Sunset Greek Taverna');
  await synced(A.page);
  assert.equal(state().days[4].place[7], 'Sunset Greek Taverna');
  step('Explore: name search → verdict, newest reviews, better option nearby → added to the chosen slot');

  // ── 10. Explore: short Google Maps link
  await A.page.fill('#q', 'https://maps.app.goo.gl/abc123');
  await A.page.click('#qForm button');
  await A.page.waitForFunction(() => /From your link/.test(document.querySelector('#results').textContent));
  assert.match(await A.page.textContent('#results'), /Thalassa/);
  step('Explore: pasted maps.app.goo.gl link is opened, reviewed and planned');

  // ── 11. Explore guide works on a phone, day picks render
  await W.page.goto(base + '/explore.html');
  await W.page.waitForSelector('#grid .card');
  assert.ok(await W.page.locator('#days .day').count() >= 5);
  assert.equal(await W.page.evaluate(() => document.documentElement.scrollWidth), 390);
  await shot(W.page, '06-explore-phone');
  step('Explore guide + day-by-day picks on a phone');

  // ── 12. live sheet has the data
  const rows = backend.sheetRows('Expenses');
  assert.ok(rows.length >= 4 && rows[0][3].startsWith('Description'));
  step('live Google Sheet “Expenses” tab updated on every save');

  // ── 13. before the backend is set up, the site still works (phone-only mode)
  const plain = await serve(backend, { withApi: false });
  const L = await phone('Local');
  await L.page.goto(plain.base + '/index.html');
  await L.page.waitForSelector('#planTbl tbody tr');
  assert.equal(await L.page.locator('.ts-modal.on').count(), 0, 'no popup covers the plan when sync is off');
  assert.equal(await L.page.locator('#planTbl tbody tr').count(), 9, 'all 9 days of the timetable are shown');
  await L.page.locator('td.cell[data-r="0"][data-c="7"]').hover(); await L.page.click('[data-bill="0,7"]');
  await L.page.fill('.billin', '500'); await L.page.fill('.billdesc', 'Dinner at Baga'); await L.page.click('.billok');
  await L.page.reload(); await L.page.waitForSelector('#planTbl .cost');
  assert.match(await L.page.textContent('.ts-pill'), /Saved on this phone/);
  await L.page.goto(plain.base + '/explore.html?q=Vinayak');
  await L.page.waitForSelector('.result .verdict');
  assert.match(await L.page.textContent('#results'), /Google Maps reviews/);
  plain.server.close(); await L.ctx.close();
  step('without the backend: works on one phone, data survives reload, Explore falls back to links');

  // ── 14. no JavaScript errors anywhere
  assert.deepEqual(errors, []);
  step('no JavaScript errors on any page');
  console.log(`  ${pass} passed`);
} catch (e) {
  console.error('  ✗ FAILED after', pass, 'steps:', e.message);
  if (errors.length) console.error('  page errors:', errors);
  process.exitCode = 1;
} finally {
  await browser.close(); server.close();
}
