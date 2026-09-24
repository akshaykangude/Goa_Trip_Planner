/**
 * ═══════════════════════════════════════════════════════════════════════
 *  Goa Trip Planner — backend (Google Apps Script)
 * ═══════════════════════════════════════════════════════════════════════
 *  What it does
 *   • Stores the ONE shared copy of the trip (a JSON file in your Google Drive).
 *   • Every save is checked against the revision the phone started from, so two
 *     people editing at once never silently overwrite each other (the phones
 *     merge and retry automatically).
 *   • Keeps a live Google Sheet ("Goa Trip — Live Sheet") updated on every save:
 *     Summary · Expenses · Spend by day · Plan · Places · Budget · Balances · Log.
 *   • Every 2 hours: saves a snapshot folder with CSV files + trip.json + an
 *     Excel (.xlsx) copy into Drive → "Goa Trip Planner / Snapshots (every 2h)".
 *     The website's History tab can preview and restore any snapshot.
 *   • Optional: proxies Google Places search for the "Should I go?" search engine
 *     (your API key stays secret in Script properties).
 *
 *  Files in this Apps Script project
 *   Code.gs      ← this file
 *   TripData.gs  ← paste the contents of assets/tripdata.js (same code as the website)
 *
 *  Script properties (Project Settings → Script properties)
 *   TRIP_PASSCODE   (required) the passcode everyone types once on their phone
 *   PLACES_API_KEY  (optional) Google Places API (New) key for live reviews
 *
 *  Then run setup() once from the editor and deploy as a Web app
 *  (Execute as: Me · Who has access: Anyone). Full steps: docs/SETUP.md
 * ═══════════════════════════════════════════════════════════════════════
 */

var CFG = {
  FOLDER_NAME: 'Goa Trip Planner',
  SNAP_FOLDER_NAME: 'Snapshots (every 2h)',
  SHEET_NAME: 'Goa Trip — Live Sheet',
  STATE_FILE: 'trip-state.json',
  SNAPSHOT_EVERY_HOURS: 2,          // allowed: 1, 2, 4, 6, 8, 12
  SNAPSHOT_ONLY_IF_CHANGED: true,   // skip a snapshot when nobody edited since the last one
  KEEP_SNAPSHOTS: 250,              // oldest ones go to Drive trash after this
  PLACES_DAILY_LIMIT: 300,          // live searches per day (protects your Google bill)
  TZ: 'Asia/Kolkata'
};

/* ───────────────────────── HTTP entry points ───────────────────────── */

function doGet(e) {
  var a = (e && e.parameter && e.parameter.action) || '';
  if (a === 'ping') {
    return json_({ ok: true, service: 'goa-trip', rev: getRev_(), updatedAt: P_().getProperty('UPDATED_AT') || null });
  }
  return json_({ ok: true, service: 'goa-trip', hint: 'This is the trip backend. Open the website instead.' });
}

function doPost(e) {
  var body;
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_({ ok: false, error: 'Bad request (not JSON)' }); }
  var pass = P_().getProperty('TRIP_PASSCODE');
  if (!pass) return json_({ ok: false, error: 'Backend not set up: add TRIP_PASSCODE in Script properties, then run setup().' });
  if (String(body.key || '') !== String(pass)) return json_({ ok: false, auth: false, error: 'Wrong trip passcode' });
  try {
    switch (body.action) {
      case 'ping': return json_({ ok: true, rev: getRev_() });
      case 'get': return json_(apiGet_(body));
      case 'save': return json_(apiSave_(body));
      case 'export': return json_(apiExport_());
      case 'snapshots': return json_({ ok: true, list: listSnapshots_() });
      case 'snapshot': return json_(apiSnapshot_(body.id));
      case 'snapshotNow': return json_({ ok: true, snap: snapshot_(true, body.user) });
      case 'place': return json_(apiPlace_(body.q, body.lat, body.lng));
      case 'nearby': return json_(apiNearby_(body.lat, body.lng, body.kind));
      default: return json_({ ok: false, error: 'Unknown action: ' + body.action });
    }
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

/* ───────────────────────── API actions ───────────────────────── */

function apiGet_(body) {
  var rev = getRev_(), p = P_();
  var meta = { ok: true, rev: rev, updatedAt: p.getProperty('UPDATED_AT'), updatedBy: p.getProperty('UPDATED_BY') };
  if (rev > 0 && body.sinceRev != null && Number(body.sinceRev) === rev) { meta.unchanged = true; return meta; }
  meta.state = rev > 0 ? readState_() : null;
  return meta;
}

function apiSave_(body) {
  var s = body.state;
  if (!s || !Array.isArray(s.days) || !Array.isArray(s.expenses) || !Array.isArray(s.cols)) {
    return { ok: false, error: 'Invalid trip data — not saved.' };
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  var rev, who = String(body.user || 'someone').slice(0, 40), now = new Date().toISOString();
  try {
    rev = getRev_();
    if (rev > 0 && Number(body.baseRev) !== rev) {
      return { ok: false, conflict: true, rev: rev, state: readState_(), updatedBy: P_().getProperty('UPDATED_BY') };
    }
    if (rev > 0 && !body.force) {
      var cur = readState_();
      if (cur && cur.days && cur.days.length && !s.days.length) {
        return { ok: false, guard: true, error: 'This would delete the whole day-by-day plan.' };
      }
      if (cur && cur.expenses && cur.expenses.length >= 6 && s.expenses.length < cur.expenses.length / 2) {
        return { ok: false, guard: true, error: 'This would delete ' + (cur.expenses.length - s.expenses.length) + ' of ' + cur.expenses.length + ' bills.' };
      }
    }
    writeState_(s);
    rev = rev + 1;
    P_().setProperties({ REV: String(rev), UPDATED_AT: now, UPDATED_BY: who });
  } finally {
    lock.releaseLock();
  }
  try { writeSheet_(s, rev, who); } catch (err) { console.warn('Sheet update failed: ' + err); }
  return { ok: true, rev: rev, updatedAt: now, updatedBy: who };
}

function apiExport_() {
  var s = readState_();
  if (!s) return { ok: true, rev: 0, state: null, csv: {} };
  var T = TripData.tables(s), csv = {};
  Object.keys(T).forEach(function (n) { csv[n] = TripData.toCSV(T[n]); });
  var p = P_();
  return { ok: true, rev: getRev_(), updatedAt: p.getProperty('UPDATED_AT'), updatedBy: p.getProperty('UPDATED_BY'), state: s, csv: csv };
}

function apiSnapshot_(id) {
  if (!id) return { ok: false, error: 'Missing snapshot id' };
  var folder = DriveApp.getFolderById(String(id));
  var parents = folder.getParents(), okParent = false, snapId = snapFolder_().getId();
  while (parents.hasNext()) if (parents.next().getId() === snapId) okParent = true;
  if (!okParent) return { ok: false, error: 'Not a trip snapshot' };
  var files = folder.getFilesByName('trip.json');
  if (!files.hasNext()) return { ok: false, error: 'Snapshot has no trip.json' };
  var state = JSON.parse(files.next().getBlob().getDataAsString('UTF-8'));
  return { ok: true, name: folder.getName(), meta: parseMeta_(folder.getDescription()), state: state };
}

/* ───────────────────────── Snapshots (every 2 hours) ───────────────────────── */

/** Called by the time trigger that setup() installs. */
function snapshotJob() { snapshot_(false, 'auto (every ' + CFG.SNAPSHOT_EVERY_HOURS + 'h)'); }

/** Run by hand from the editor any time you want a snapshot right now. */
function snapshotNow() { Logger.log(JSON.stringify(snapshot_(true, 'manual'))); }

function snapshot_(force, by) {
  var rev = getRev_();
  if (!rev) return null;
  var p = P_(), last = Number(p.getProperty('LAST_SNAP_REV') || 0);
  if (!force && CFG.SNAPSHOT_ONLY_IF_CHANGED && last === rev) return { skipped: true, reason: 'no changes since rev ' + rev };
  var s = readState_();
  var stamp = Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH.mm');
  var folder = snapFolder_().createFolder(stamp + ' · rev ' + rev);
  var T = TripData.tables(s);
  Object.keys(T).forEach(function (n) {
    folder.createFile(n.replace(/[^\w\- ]/g, '') + '.csv', '﻿' + TripData.toCSV(T[n]), MimeType.CSV);
  });
  folder.createFile('trip.json', JSON.stringify(s), 'application/json');
  try { // Excel copy of the live sheet
    var ss = writeSheet_(s, rev, p.getProperty('UPDATED_BY') || '');
    SpreadsheetApp.flush();
    var url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx';
    var blob = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } }).getBlob();
    folder.createFile(blob.setName('Goa-Trip-' + stamp.replace(' ', '_') + '.xlsx'));
  } catch (err) { console.warn('xlsx export failed: ' + err); }
  var sum = TripData.summary(s);
  folder.setDescription(JSON.stringify({ rev: rev, at: new Date().toISOString(), by: by || '', total: sum.total, bills: sum.bills, places: sum.places, lastEditBy: p.getProperty('UPDATED_BY') || '' }));
  p.setProperty('LAST_SNAP_REV', String(rev));
  prune_();
  return { id: folder.getId(), name: folder.getName(), url: folder.getUrl() };
}

function listSnapshots_() {
  var it = snapFolder_().getFolders(), out = [];
  while (it.hasNext()) {
    var f = it.next();
    out.push({ id: f.getId(), name: f.getName(), created: f.getDateCreated().toISOString(), meta: parseMeta_(f.getDescription()), url: f.getUrl() });
  }
  out.sort(function (a, b) { return a.created < b.created ? 1 : -1; });
  return out.slice(0, 120);
}

function prune_() {
  var list = [], it = snapFolder_().getFolders();
  while (it.hasNext()) list.push(it.next());
  if (list.length <= CFG.KEEP_SNAPSHOTS) return;
  list.sort(function (a, b) { return a.getDateCreated() - b.getDateCreated(); });
  list.slice(0, list.length - CFG.KEEP_SNAPSHOTS).forEach(function (f) { f.setTrashed(true); });
}

function parseMeta_(d) { try { return d ? JSON.parse(d) : {}; } catch (e) { return {}; } }

/* ───────────────────────── Live Google Sheet ───────────────────────── */

function sheet_() {
  var p = P_(), id = p.getProperty('SHEET_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) { /* deleted → recreate */ } }
  var ss = SpreadsheetApp.create(CFG.SHEET_NAME);
  DriveApp.getFileById(ss.getId()).moveTo(rootFolder_());
  p.setProperty('SHEET_ID', ss.getId());
  return ss;
}

function writeSheet_(s, rev, who) {
  var ss = sheet_(), T = TripData.tables(s), sum = TripData.summary(s);
  var summary = [['Goa Trip — live data', ''], ['Revision', rev], ['Last saved', Utilities.formatDate(new Date(), CFG.TZ, 'dd MMM yyyy, hh:mm a')],
    ['Saved by', who || ''], ['Bills', sum.bills], ['Total spent (₹)', sum.total], ['Budget (₹)', sum.budget],
    ['Left (₹)', Math.round((sum.budget - sum.total) * 100) / 100], ['Days', sum.days], ['Places', sum.places],
    ['', ''], ['Tip', 'This sheet is rebuilt on every save from the website. Edit the trip on the website, not here.']];
  var order = [['Summary', summary]].concat(Object.keys(T).map(function (k) { return [k, T[k]]; }));
  order.forEach(function (pair, i) {
    var name = pair[0], rows = pair[1];
    var sh = ss.getSheetByName(name) || ss.insertSheet(name, i);
    var w = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 1);
    rows = rows.map(function (r) { r = r.slice(); while (r.length < w) r.push(''); return r; });
    sh.clearContents();
    if (rows.length) {
      sh.getRange(1, 1, rows.length, w).setValues(rows);
      sh.getRange(1, 1, 1, w).setFontWeight('bold').setBackground('#fde7d6');
      sh.setFrozenRows(1);
    }
  });
  var def = ss.getSheetByName('Sheet1'); if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  var log = ss.getSheetByName('Log') || ss.insertSheet('Log');
  if (log.getLastRow() === 0) log.appendRow(['Time', 'Revision', 'Saved by', 'Bills', 'Total spent (₹)']);
  log.appendRow([Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm:ss'), rev, who || '', sum.bills, sum.total]);
  return ss;
}

/* ───────────────────────── Live place search (optional) ───────────────────────── */

var PLACE_FIELDS = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.rating', 'places.userRatingCount',
  'places.priceLevel', 'places.reviews', 'places.editorialSummary', 'places.currentOpeningHours',
  'places.googleMapsUri', 'places.location', 'places.primaryTypeDisplayName', 'places.businessStatus',
  'places.outdoorSeating', 'places.liveMusic', 'places.servesCocktails', 'places.goodForGroups',
  'places.reservable', 'places.servesVegetarianFood'
].join(',');

function apiPlace_(q, lat, lng) {
  var key = P_().getProperty('PLACES_API_KEY');
  q = String(q || '').trim();
  var resolved = null;
  if (isMapsUrl_(q)) {                       // a pasted Google Maps link
    resolved = resolveMapsUrl_(q);
    if (resolved.lat != null) { lat = resolved.lat; lng = resolved.lng; }
    if (!key) return { ok: false, error: 'no_places_key', resolved: resolved };
    if (!resolved.name) {
      if (lat == null) return { ok: false, error: 'Could not read that Maps link — copy the place name instead.', resolved: resolved };
      var near = apiNearby_(lat, lng, 'any', 80);
      return near.ok ? { ok: true, resolved: resolved, places: near.places.slice(0, 3) } : near;
    }
    q = resolved.name;
  }
  if (!key) return { ok: false, error: 'no_places_key' };
  q = q.slice(0, 120);
  if (q.length < 2) return { ok: false, error: 'Type a longer name' };
  var cache = CacheService.getScriptCache();
  var hasLL = lat != null && lng != null && isFinite(+lat) && isFinite(+lng);
  var ck = 'pl:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, q.toLowerCase() + (hasLL ? '@' + (+lat).toFixed(3) + ',' + (+lng).toFixed(3) : '')));
  var hit = cache.get(ck);
  if (hit) return { ok: true, cached: true, resolved: resolved, places: JSON.parse(hit) };
  var quota = useQuota_(); if (quota) return quota;
  var res = UrlFetchApp.fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': PLACE_FIELDS },
    payload: JSON.stringify({
      textQuery: /goa/i.test(q) ? q : q + ', Goa', maxResultCount: 5, languageCode: 'en', regionCode: 'IN',
      locationBias: { circle: { center: hasLL ? { latitude: +lat, longitude: +lng } : { latitude: 15.35, longitude: 73.95 }, radius: hasLL ? 2000 : 50000 } }
    })
  });
  if (res.getResponseCode() !== 200) return { ok: false, error: 'Google Places error ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300) };
  var places = (JSON.parse(res.getContentText()).places || []).map(slimPlace_);
  try { cache.put(ck, JSON.stringify(places), 6 * 3600); } catch (e) { /* too big to cache */ }
  return { ok: true, resolved: resolved, places: places };
}

/** Popular places of one kind around a point — used for "better options nearby". */
var KIND_TYPES = {
  cafe: ['cafe', 'bakery'], restaurant: ['restaurant'], bar: ['bar', 'night_club'],
  sight: ['tourist_attraction'], any: null
};
function apiNearby_(lat, lng, kind, radius) {
  var key = P_().getProperty('PLACES_API_KEY');
  if (!key) return { ok: false, error: 'no_places_key' };
  if (lat == null || lng == null || !isFinite(+lat) || !isFinite(+lng)) return { ok: false, error: 'Missing location' };
  kind = KIND_TYPES.hasOwnProperty(kind) ? kind : 'restaurant';
  radius = Math.min(Math.max(+radius || 3000, 50), 10000);
  var cache = CacheService.getScriptCache();
  var ck = 'nb:' + kind + ':' + (+lat).toFixed(3) + ',' + (+lng).toFixed(3) + ':' + radius;
  var hit = cache.get(ck); if (hit) return { ok: true, cached: true, places: JSON.parse(hit) };
  var quota = useQuota_(); if (quota) return quota;
  var body = { maxResultCount: 10, rankPreference: kind === 'any' ? 'DISTANCE' : 'POPULARITY', languageCode: 'en', regionCode: 'IN',
    locationRestriction: { circle: { center: { latitude: +lat, longitude: +lng }, radius: radius } } };
  if (KIND_TYPES[kind]) body.includedTypes = KIND_TYPES[kind];
  var res = UrlFetchApp.fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': PLACE_FIELDS }, payload: JSON.stringify(body)
  });
  if (res.getResponseCode() !== 200) return { ok: false, error: 'Google Places error ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300) };
  var places = (JSON.parse(res.getContentText()).places || []).map(slimPlace_);
  try { cache.put(ck, JSON.stringify(places), 6 * 3600); } catch (e) { }
  return { ok: true, places: places };
}

function useQuota_() {
  var day = 'PLACES_' + Utilities.formatDate(new Date(), CFG.TZ, 'yyyyMMdd');
  var n = Number(P_().getProperty(day) || 0);
  if (n >= CFG.PLACES_DAILY_LIMIT) return { ok: false, error: 'Daily live-search limit reached (' + CFG.PLACES_DAILY_LIMIT + ').' };
  P_().setProperty(day, String(n + 1));
  return null;
}

/* ── Google Maps links (full or short maps.app.goo.gl) ── */
function isMapsUrl_(s) { return /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|g\.co\/kgs)/i.test(String(s || '').trim()); }
function resolveMapsUrl_(url) {
  url = String(url).trim();
  for (var i = 0; i < 5; i++) {
    var info = parseMapsUrl_(url);
    if (info.name || info.lat != null) { info.url = url; return info; }
    var r = UrlFetchApp.fetch(url, { followRedirects: false, muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0' } });
    var loc = r.getHeaders()['Location'] || r.getHeaders()['location'];
    if (!loc) {                      // final page: try its <meta og:title>
      var html = r.getContentText();
      var m = html.match(/property="og:title"\s+content="([^"]+)"/) || html.match(/<title>([^<]+)<\/title>/);
      var name = m ? m[1].replace(/\s*[·-]\s*Google Maps\s*$/i, '').split(' · ')[0].trim() : '';
      return { url: url, name: name && !/^google maps$/i.test(name) ? name : '', lat: null, lng: null };
    }
    var cont = loc.match(/[?&]continue=([^&]+)/);  // consent.google.com redirect
    url = cont ? decodeURIComponent(cont[1]) : loc;
  }
  return parseMapsUrl_(url);
}
function parseMapsUrl_(url) {
  var out = { name: '', lat: null, lng: null };
  var m = url.match(/\/maps\/place\/([^\/@?]+)/);
  if (m) out.name = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim();
  var q = url.match(/[?&](?:q|query)=([^&]+)/);
  if (!out.name && q) {
    var v = decodeURIComponent(q[1].replace(/\+/g, ' '));
    var ll = v.match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/);
    if (ll) { out.lat = +ll[1]; out.lng = +ll[2]; } else out.name = v;
  }
  var d = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (d) { out.lat = +d[1]; out.lng = +d[2]; }
  return out;
}

function slimPlace_(p) {
  var oh = p.currentOpeningHours || {};
  return {
    id: p.id, name: p.displayName && p.displayName.text, address: p.formattedAddress, rating: p.rating, count: p.userRatingCount,
    price: p.priceLevel, maps: p.googleMapsUri, lat: p.location && p.location.latitude, lng: p.location && p.location.longitude,
    type: p.primaryTypeDisplayName && p.primaryTypeDisplayName.text, summary: p.editorialSummary && p.editorialSummary.text,
    status: p.businessStatus, openNow: oh.openNow, hours: oh.weekdayDescriptions || [],
    attrs: { outdoorSeating: p.outdoorSeating, liveMusic: p.liveMusic, servesCocktails: p.servesCocktails, goodForGroups: p.goodForGroups, reservable: p.reservable, servesVegetarianFood: p.servesVegetarianFood },
    reviews: (p.reviews || []).map(function (r) {
      return { rating: r.rating, text: String((r.text && r.text.text) || (r.originalText && r.originalText.text) || '').slice(0, 700), when: r.relativePublishTimeDescription, time: r.publishTime, author: r.authorAttribution && r.authorAttribution.displayName };
    }).sort(function (a, b) { return String(b.time || '').localeCompare(String(a.time || '')); })
  };
}

/* ───────────────────────── One-time setup & helpers ───────────────────────── */

/** Run once from the editor (▶ Run → setup). Safe to run again. */
function setup() {
  if (!P_().getProperty('TRIP_PASSCODE')) {
    throw new Error('First add a Script property named TRIP_PASSCODE (Project Settings ⚙️ → Script properties).');
  }
  var root = rootFolder_(); snapFolder_(); var ss = sheet_();
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'snapshotJob') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('snapshotJob').timeBased().everyHours(CFG.SNAPSHOT_EVERY_HOURS).create();
  Logger.log('✅ Setup complete.\nDrive folder: ' + root.getUrl() + '\nLive sheet:   ' + ss.getUrl() +
    '\nSnapshots every ' + CFG.SNAPSHOT_EVERY_HOURS + ' h.\nNext: Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).');
}

/** Optional check that the Places key works: ▶ Run → testPlaces, then look at the log. */
function testPlaces() { Logger.log(JSON.stringify(apiPlace_('Thalassa Vagator'), null, 1).slice(0, 3000)); }

/** Emergency: put a snapshot back as the live version (editor → run restoreLatestSnapshot). */
function restoreLatestSnapshot() {
  var list = listSnapshots_(); if (!list.length) throw new Error('No snapshots yet');
  var snap = apiSnapshot_(list[0].id);
  var r = apiSave_({ state: snap.state, baseRev: getRev_(), force: true, user: 'restore: ' + list[0].name });
  Logger.log('Restored ' + list[0].name + ' → rev ' + r.rev);
}

function P_() { return PropertiesService.getScriptProperties(); }
function getRev_() { return Number(P_().getProperty('REV') || 0); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function rootFolder_() {
  var p = P_(), id = p.getProperty('FOLDER_ID');
  if (id) { try { var f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { } }
  var folder = DriveApp.createFolder(CFG.FOLDER_NAME);
  p.setProperty('FOLDER_ID', folder.getId());
  return folder;
}
function snapFolder_() {
  var p = P_(), id = p.getProperty('SNAP_FOLDER_ID');
  if (id) { try { var f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { } }
  var folder = rootFolder_().createFolder(CFG.SNAP_FOLDER_NAME);
  p.setProperty('SNAP_FOLDER_ID', folder.getId());
  return folder;
}
function readState_() {
  var id = P_().getProperty('STATE_FILE_ID');
  if (!id) return null;
  var txt = DriveApp.getFileById(id).getBlob().getDataAsString('UTF-8');
  return txt ? JSON.parse(txt) : null;
}
function writeState_(s) {
  var p = P_(), id = p.getProperty('STATE_FILE_ID'), txt = JSON.stringify(s);
  if (id) { try { DriveApp.getFileById(id).setContent(txt); return; } catch (e) { /* recreate below */ } }
  var f = rootFolder_().createFile(CFG.STATE_FILE, txt, 'application/json');
  p.setProperty('STATE_FILE_ID', f.getId());
}
