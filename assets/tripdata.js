/*
 * tripdata.js — pure data helpers shared by:
 *   • the web pages (index.html, explore.html)
 *   • the Google Apps Script backend (copy this file into the script project as TripData.gs)
 *   • the tests (Node)
 * No DOM access here, so it runs everywhere.
 */
var TripData = (function () {
  'use strict';

  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function num(n) { n = +n; return isFinite(n) ? Math.round(n * 100) / 100 : 0; }
  function dayName(iso) {
    var p = String(iso || '').split('-').map(Number);
    if (p.length !== 3) return '';
    return DOW[new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()];
  }
  function catLabel(S, id) {
    var c = ((S.budget && S.budget.cats) || []).filter(function (x) { return x.id === id; })[0];
    return c ? c.label : (id || '');
  }
  function person(S, i) { return (S.people || [])[i] || ('Person ' + (i + 1)); }
  function spanAt(d, c) { return Math.max(1, +((d.span || {})[c]) || 1); }
  function clean(t) { return String(t == null ? '' : t).replace(/\*\*/g, ''); }

  /** Who paid what, who owes what. */
  function balances(S) {
    var P = S.people || [];
    var paid = P.map(function () { return 0; }), share = P.map(function () { return 0; });
    (S.expenses || []).forEach(function (e) {
      var amt = +e.amt || 0;
      if (e.by < P.length) paid[e.by] += amt;
      var sp = (e.split || []).filter(function (i) { return i < P.length; });
      sp.forEach(function (i) { share[i] += amt / sp.length; });
    });
    var bal = P.map(function (_, i) { return paid[i] - share[i]; });
    // minimal settle-up transfers
    var cred = [], debt = [];
    bal.forEach(function (b, i) { if (b > 0.5) cred.push({ i: i, b: b }); else if (b < -0.5) debt.push({ i: i, b: -b }); });
    cred.sort(function (a, b) { return b.b - a.b; }); debt.sort(function (a, b) { return b.b - a.b; });
    var tx = [], ci = 0, di = 0;
    while (ci < cred.length && di < debt.length) {
      var m = Math.min(cred[ci].b, debt[di].b);
      tx.push({ from: debt[di].i, to: cred[ci].i, amt: num(m) });
      cred[ci].b -= m; debt[di].b -= m;
      if (cred[ci].b < 0.5) ci++; if (debt[di].b < 0.5) di++;
    }
    return { paid: paid.map(num), share: share.map(num), bal: bal.map(num), tx: tx };
  }

  function summary(S) {
    var ex = S.expenses || [];
    var total = ex.reduce(function (s, e) { return s + (+e.amt || 0); }, 0);
    return {
      bills: ex.length, total: num(total),
      budget: num(S.budget && S.budget.total),
      days: (S.days || []).length, places: (S.places || []).length
    };
  }

  /** All tables as arrays of rows (first row = header). Used for CSV, the live Google Sheet and Excel. */
  function tables(S) {
    S = S || {};
    var cols = S.cols || [], days = S.days || [], ex = S.expenses || [];
    var byDate = {}; days.forEach(function (d) { byDate[d.date] = d; });

    var expenses = [['Date', 'Day', 'Time slot', 'Description (where / what)', 'Place', 'Category', 'Amount (₹)',
      'Paid by', 'Split between', 'Share each (₹)', 'Mode', 'Added by', 'Added at', 'ID']];
    ex.slice().sort(function (a, b) {
      return String(a.date).localeCompare(String(b.date)) || ((a.slot == null ? 99 : a.slot) - (b.slot == null ? 99 : b.slot));
    }).forEach(function (e) {
      var sp = (e.split || []);
      expenses.push([e.date, dayName(e.date), e.slot != null ? (cols[e.slot] || '') : 'Whole day', e.desc || '', e.place || '',
        catLabel(S, e.cat), num(e.amt), person(S, e.by), sp.map(function (i) { return person(S, i); }).join(' + '),
        sp.length ? num(e.amt / sp.length) : '', e.mode || '', e.addedBy || '', e.addedAt || '', e.id || '']);
    });

    var plan = [['Date', 'Day', 'Stay'].concat(cols).concat(['Spent that day (₹)'])];
    days.forEach(function (d) {
      var st = (S.stays || [])[d.stay];
      var row = [d.date, dayName(d.date), st ? (st.name + ' — ' + st.location) : ''];
      var c = 0;
      while (c < cols.length) {
        var n = Math.min(spanAt(d, c), cols.length - c);
        var place = (d.place || {})[c], note = (d.note || {})[c];
        var cell = clean(d.cells[c]) + (place ? ' 📍' + place : '') + (note ? ' (' + note + ')' : '');
        row.push(cell);
        for (var k = 1; k < n; k++) row.push('↔ (merged with previous)');
        c += n;
      }
      row.push(num(ex.filter(function (e) { return e.date === d.date; }).reduce(function (s, e) { return s + (+e.amt || 0); }, 0)));
      plan.push(row);
    });

    var places = [['Place', 'Type', 'Scheduled', 'Note', 'Visited', 'Spent there (₹)', 'Google Maps']];
    (S.places || []).forEach(function (p) {
      var lc = String(p.name).toLowerCase(), when = [];
      days.forEach(function (d) {
        Object.keys(d.place || {}).forEach(function (c) {
          if (String(d.place[c]).toLowerCase() === lc) when.push(d.date + ' ' + (cols[c] || ''));
        });
      });
      var spent = ex.filter(function (e) { return String(e.place || '').toLowerCase() === lc; })
        .reduce(function (s, e) { return s + (+e.amt || 0); }, 0);
      places.push([p.name, p.type || '', when.join('; '), p.note || '', p.visited ? 'Yes' : '', num(spent),
        'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(/goa|pune/i.test(p.name) ? p.name : p.name + ', Goa')]);
    });

    var budget = [['Category', 'Budget (₹)', 'Spent (₹)', 'Left (₹)', 'Bills']];
    var cats = (S.budget && S.budget.cats) || [];
    cats.forEach(function (c) {
      var list = ex.filter(function (e) { return e.cat === c.id; });
      var sp = list.reduce(function (s, e) { return s + (+e.amt || 0); }, 0);
      budget.push([c.label, num(c.amt), num(sp), num((+c.amt || 0) - sp), list.length]);
    });
    var sum = summary(S);
    budget.push(['TOTAL', sum.budget, sum.total, num(sum.budget - sum.total), sum.bills]);

    var b = balances(S);
    var bal = [['Person', 'Paid (₹)', 'Fair share (₹)', 'Balance (₹)', '']];
    (S.people || []).forEach(function (p, i) {
      bal.push([p, b.paid[i], b.share[i], b.bal[i], b.bal[i] > 0.5 ? 'gets back' : (b.bal[i] < -0.5 ? 'owes' : 'settled')]);
    });
    bal.push(['', '', '', '', '']);
    bal.push(['Settle up: who pays whom', '', '', '', '']);
    b.tx.forEach(function (t) { bal.push([person(S, t.from) + ' → ' + person(S, t.to), '', '', t.amt, '']); });

    var perDay = [['Date', 'Day'].concat(cats.map(function (c) { return c.label; })).concat(['Total (₹)'])];
    days.forEach(function (d) {
      var list = ex.filter(function (e) { return e.date === d.date; });
      var row = [d.date, dayName(d.date)];
      cats.forEach(function (c) {
        row.push(num(list.filter(function (e) { return e.cat === c.id; }).reduce(function (s, e) { return s + (+e.amt || 0); }, 0)));
      });
      row.push(num(list.reduce(function (s, e) { return s + (+e.amt || 0); }, 0)));
      perDay.push(row);
    });

    return { Expenses: expenses, 'Spend by day': perDay, Plan: plan, Places: places, Budget: budget, Balances: bal };
  }

  function toCSV(rows) {
    return rows.map(function (r) {
      return r.map(function (v) {
        v = v == null ? '' : String(v);
        return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',');
    }).join('\r\n');
  }

  /* ---------- "Should I spend my time there?" scoring ---------- */
  var POS = ['amazing', 'excellent', 'delicious', 'fresh', 'friendly', 'beautiful', 'view', 'sunset', 'ambience', 'ambiance',
    'vibe', 'cozy', 'cosy', 'must visit', 'must-visit', 'worth', 'lovely', 'live music', 'romantic', 'clean', 'value for money',
    'great food', 'best', 'perfect', 'tasty', 'attentive', 'recommend'];
  var NEG = ['overpriced', 'over priced', 'rude', 'slow', 'dirty', 'cold food', 'worst', 'bad service', 'disappoint', 'not worth',
    'crowded', 'waited', 'stale', 'unhygienic', 'cockroach', 'rip off', 'ripoff', 'overrated', 'tourist trap', 'bland',
    'avoid', 'pathetic', 'terrible', 'horrible', 'cheated', 'extra charge', 'hidden charge'];
  var AMB = ['view', 'sunset', 'romantic', 'cozy', 'cosy', 'rooftop', 'garden', 'beach', 'river', 'live music', 'quiet', 'lively',
    'music', 'decor', 'candle', 'sea view', 'breeze'];

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  /**
   * p: { rating, count, reviews:[{rating,text,time}], status, openNow, curatedScore }
   * returns { score (0–10), verdict, emoji, tone, reasons[], loves[], complaints[], ambience[] }
   */
  function worth(p) {
    p = p || {};
    var reasons = [], loves = {}, complaints = {}, amb = {};
    if (p.status === 'CLOSED_PERMANENTLY') {
      return { score: 0, verdict: 'Permanently closed', emoji: '⛔', tone: 'bad', reasons: ['Google lists this place as permanently closed.'], loves: [], complaints: [], ambience: [] };
    }
    var score;
    if (p.rating == null) {
      score = p.curatedScore != null ? +p.curatedScore : 6;
      reasons.push('Curated pick — tap “Live check” for today’s Google rating & newest reviews.');
    } else {
      var R = +p.rating, n = +p.count || 0, C = 4.3, m = 150;
      var bay = (n * R + m * C) / (n + m);
      score = clamp((bay - 3.7) / (4.8 - 3.7) * 10, 0, 10);
      reasons.push('★ ' + R.toFixed(1) + ' from ' + n.toLocaleString('en-IN') + ' Google reviews');
      if (n < 40) { score = score * 0.7 + 6 * 0.3; reasons.push('Only a few reviews — less reliable.'); }
      else if (n > 2000) reasons.push('Very popular — expect a crowd at peak hours.');
    }
    var rv = (p.reviews || []).filter(function (r) { return r && (r.text || r.rating); });
    if (rv.length) {
      var rated = rv.filter(function (r) { return r.rating; });
      if (rated.length && p.rating != null) {
        var avg = rated.reduce(function (s, r) { return s + r.rating; }, 0) / rated.length;
        if (avg < p.rating - 0.7) { score -= 1; reasons.push('Newest reviews (' + avg.toFixed(1) + '★ avg) are worse than the overall rating.'); }
        else if (avg >= p.rating) { score += 0.3; reasons.push('Newest reviews hold up (' + avg.toFixed(1) + '★ avg).'); }
        var low = rated.filter(function (r) { return r.rating <= 2; }).length;
        if (low >= 2) { score -= 0.6; reasons.push(low + ' of the latest reviews are 1–2★.'); }
      }
      var ph = 0, nh = 0;
      rv.forEach(function (r) {
        var t = String(r.text || '').toLowerCase();
        POS.forEach(function (w) { if (t.indexOf(w) >= 0) { loves[w] = (loves[w] || 0) + 1; ph++; } });
        NEG.forEach(function (w) { if (t.indexOf(w) >= 0) { complaints[w] = (complaints[w] || 0) + 1; nh++; } });
        AMB.forEach(function (w) { if (t.indexOf(w) >= 0) amb[w] = (amb[w] || 0) + 1; });
      });
      score += Math.min(ph, 6) * 0.12 - Math.min(nh, 6) * 0.35;
    }
    var top = function (o) { return Object.keys(o).sort(function (a, b) { return o[b] - o[a]; }).slice(0, 4); };
    var L = top(loves), X = top(complaints);
    if (L.length) reasons.push('People mention: ' + L.join(', '));
    if (X.length) reasons.push('Complaints: ' + X.join(', '));
    if (p.status === 'CLOSED_TEMPORARILY') { score = Math.min(score, 3); reasons.unshift('Temporarily closed right now.'); }
    if (p.openNow === false) reasons.push('Closed at this moment — check the hours.');
    score = Math.round(clamp(score, 0, 10) * 10) / 10;
    var v = score >= 8 ? ['Go — worth your time', '✅', 'great'] :
      score >= 6.5 ? ['Good pick', '👍', 'good'] :
        score >= 5 ? ['Only if nearby', '🤔', 'meh'] : ['Skip it', '⛔', 'bad'];
    return { score: score, verdict: v[0], emoji: v[1], tone: v[2], reasons: reasons, loves: L, complaints: X, ambience: top(amb) };
  }

  /* ---------- Google Maps links ---------- */
  var MAPS_RE = /https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|(?:www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|g\.co\/kgs)\S*/i;
  function findMapsUrl(s) { var m = String(s || '').match(MAPS_RE); return m ? m[0] : ''; }
  function isMapsUrl(s) { s = String(s || '').trim(); var u = findMapsUrl(s); return !!u && u === s; }
  /** Reads the place name / coordinates out of a full Google Maps link. Short links (maps.app.goo.gl) need the backend. */
  function parseMapsUrl(url) {
    url = String(url || ''); var out = { name: '', lat: null, lng: null, short: /goo\.gl|g\.co\//i.test(url) };
    var m = url.match(/\/maps\/place\/([^\/@?]+)/);
    if (m) { try { out.name = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim(); } catch (e) { out.name = m[1].replace(/\+/g, ' '); } }
    var q = url.match(/[?&](?:q|query)=([^&]+)/);
    if (!out.name && q) {
      var v; try { v = decodeURIComponent(q[1].replace(/\+/g, ' ')); } catch (e) { v = q[1]; }
      var ll = v.match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/);
      if (ll) { out.lat = +ll[1]; out.lng = +ll[2]; } else out.name = v;
    }
    var d = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (d) { out.lat = +d[1]; out.lng = +d[2]; }
    return out;
  }
  function distanceKm(a, b) {
    if (!a || !b || a.lat == null || b.lat == null) return null;
    var R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)) * 10) / 10;
  }

  return { tables: tables, toCSV: toCSV, summary: summary, balances: balances, worth: worth, dayName: dayName,
    findMapsUrl: findMapsUrl, isMapsUrl: isMapsUrl, parseMapsUrl: parseMapsUrl, distanceKm: distanceKm };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = TripData;
