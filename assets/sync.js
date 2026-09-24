/*
 * sync.js — keeps every phone in the group on the same trip data.
 *
 *  • Each phone always saves to its own browser storage first (works offline).
 *  • When the backend (Google Apps Script) is configured, changes are pushed with
 *    the revision they were based on. If someone else saved in between, the two
 *    versions are merged field-by-field (3-way merge) and saved again — so a bill
 *    your wife adds and a place your friend adds at the same minute are BOTH kept.
 *  • Other people's changes are pulled every POLL_SECONDS (and when the app is
 *    re-opened), but never while you're in the middle of typing.
 *  • On-phone restore points are kept too (History tab).
 *
 * Public API (window.TripSync):
 *   start({get, set, people, toast})  get(): current state · set(state, why): replace state
 *   dirty()                           call after every local save
 *   api(action, payload)              raw backend call (Promise)
 *   configured(), user(), status()
 *   localVersions(), download(name, text, mime), merge3(base, local, remote)
 */
(function () {
  'use strict';
  var CFG = Object.assign({ API_URL: '', POLL_SECONDS: 30, LOCAL_VERSION_MINUTES: 10, LOCAL_VERSIONS_KEEP: 20 }, window.TRIP_CONFIG || {});
  var NS = 'goaTripPlanner.v1';
  var K = {
    key: NS + '.passcode', user: NS + '.user', base: NS + '.base', rev: NS + '.rev', pending: NS + '.pending',
    versions: NS + '.versions', last: NS + '.lastSync', client: NS + '.client', offline: NS + '.offlineOnly'
  };
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsJSON(k) { try { return JSON.parse(lsGet(k)); } catch (e) { return null; } }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }

  /* ---------------- 3-way merge ---------------- */
  function keyOf(x) {
    if (!isObj(x)) return null;
    if (x.id != null) return 'id:' + x.id;
    if (x.date != null && Array.isArray(x.cells)) return 'day:' + x.date;
    if (x.name != null) return 'name:' + String(x.name).toLowerCase();
    if (x.date != null && x.from != null) return 'leg:' + x.date + '|' + x.from + '|' + x.to;
    if (x.t != null) return 'todo:' + x.t;
    return null;
  }
  function merge3(base, local, remote) {
    if (eq(local, remote)) return clone(local);
    if (eq(local, base)) return clone(remote);
    if (eq(remote, base)) return clone(local);
    if (isObj(local) && isObj(remote)) {
      var b = isObj(base) ? base : {}, out = {}, seen = {};
      Object.keys(remote).concat(Object.keys(local), Object.keys(b)).forEach(function (k) {
        if (seen[k]) return; seen[k] = 1;
        var inL = k in local, inR = k in remote, inB = k in b;
        if (inL && inR) out[k] = merge3(b[k], local[k], remote[k]);
        else if (inL) { if (!(inB && eq(b[k], local[k]))) out[k] = clone(local[k]); }   // remote deleted it
        else if (inR) { if (!(inB && eq(b[k], remote[k]))) out[k] = clone(remote[k]); } // we deleted it
      });
      return out;
    }
    if (Array.isArray(local) && Array.isArray(remote)) {
      var B = Array.isArray(base) ? base : [];
      var all = local.concat(remote, B);
      if (all.length && all.every(function (x) { return keyOf(x) !== null; })) {
        var bm = {}, lm = {}, rm = {}, order = [], has = {};
        B.forEach(function (x) { bm[keyOf(x)] = x; });
        local.forEach(function (x) { lm[keyOf(x)] = x; });
        remote.forEach(function (x) { rm[keyOf(x)] = x; });
        remote.forEach(function (x) { var k = keyOf(x); if (!has[k]) { has[k] = 1; order.push(k); } });
        local.forEach(function (x, i) {
          var k = keyOf(x); if (has[k]) return; has[k] = 1;
          var prev = i > 0 ? keyOf(local[i - 1]) : null, pi = prev ? order.indexOf(prev) : -1;
          order.splice(pi + 1, 0, k);
        });
        var res = [];
        order.forEach(function (k) {
          var inL = k in lm, inR = k in rm, inB = k in bm;
          if (inL && inR) res.push(merge3(bm[k], lm[k], rm[k]));
          else if (inL) { if (!(inB && eq(bm[k], lm[k]))) res.push(clone(lm[k])); }
          else if (inR) { if (!(inB && eq(bm[k], rm[k]))) res.push(clone(rm[k])); }
        });
        return res;
      }
      if (B.length === local.length && B.length === remote.length) {
        return local.map(function (x, i) { return merge3(B[i], x, remote[i]); });
      }
      return clone(local);
    }
    return clone(local); // same field edited on both phones: the latest save wins
  }

  /* ---------------- state ---------------- */
  var st = {
    rev: +lsGet(K.rev) || 0, base: lsJSON(K.base), pending: lsGet(K.pending) === '1',
    seq: 0, busy: false, again: false, timer: null, pushT: null, status: 'local', last: +lsGet(K.last) || 0,
    updatedBy: '', updatedAt: '', error: '', started: false
  };
  var hooks = { get: function () { return null; }, set: function () {}, people: function () { return []; }, toast: function () {} };

  function configured() { return !!CFG.API_URL && lsGet(K.offline) !== '1'; }
  function key() { return lsGet(K.key) || ''; }
  function user() { return lsGet(K.user) || ''; }
  function clientId() { var c = lsGet(K.client); if (!c) { c = Math.random().toString(36).slice(2, 10); lsSet(K.client, c); } return c; }
  function setBase(state, rev) { st.base = clone(state); st.rev = rev; lsSet(K.base, JSON.stringify(state)); lsSet(K.rev, String(rev)); }
  function setPending(v) { st.pending = v; lsSet(K.pending, v ? '1' : null); }

  function api(action, payload) {
    if (!CFG.API_URL) return Promise.reject(new Error('Sync is not set up (API_URL is empty in assets/config.js)'));
    var body = JSON.stringify(Object.assign({ action: action, key: key(), user: user() || 'someone', client: clientId() }, payload || {}));
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, 30000);
    // text/plain body = "simple" CORS request → no preflight, which Apps Script can't answer.
    return fetch(CFG.API_URL, { method: 'POST', body: body, redirect: 'follow', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        clearTimeout(t);
        if (j && j.auth === false) { setStatus('auth', j.error); var e = new Error(j.error || 'Wrong trip passcode'); e.auth = true; throw e; }
        return j;
      }, function (e) { clearTimeout(t); throw e; });
  }

  function isEditing() {
    var a = document.activeElement;
    if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return true;
    return !!document.querySelector('.modal.on');
  }

  function ok(r) {
    st.last = Date.now(); lsSet(K.last, String(st.last)); st.error = '';
    if (r && r.updatedBy) st.updatedBy = r.updatedBy;
    if (r && r.updatedAt) st.updatedAt = r.updatedAt;
    setStatus(st.pending ? 'pending' : 'synced');
  }
  function fail(e) {
    if (e && e.auth) return;
    st.error = (e && e.message) || String(e);
    setStatus(navigator.onLine === false ? 'offline' : 'error', st.error);
  }

  function pull(first) {
    if (!configured() || !key()) return Promise.resolve();
    if (st.busy) return Promise.resolve();
    if (navigator.onLine === false) { setStatus('offline'); return Promise.resolve(); }
    if (!first && (isEditing() || st.pending)) return Promise.resolve();
    st.busy = true; setStatus('checking');
    var next = null;
    return api('get', { sinceRev: first ? -1 : st.rev }).then(function (r) {
      if (!r || !r.ok) throw new Error((r && r.error) || 'Could not load trip data');
      if (r.unchanged) { ok(r); return; }
      if (!r.state) { next = 'push'; setPending(true); return; } // empty backend → upload ours
      if (st.pending && st.base) {
        var merged = merge3(st.base, hooks.get(), r.state);
        setBase(r.state, r.rev); hooks.set(merged, 'merge'); next = 'push'; return;
      }
      var changed = r.rev !== st.rev || first;
      setBase(r.state, r.rev);
      if (changed) {
        hooks.set(clone(r.state), first ? 'load' : 'remote');
        if (!first && r.updatedBy && r.updatedBy !== user()) hooks.toast('🔄 Updated by ' + r.updatedBy);
      }
      ok(r);
    }).catch(fail).then(function () {
      st.busy = false;
      if (next === 'push') return push();
    });
  }

  function push(force) {
    if (!configured() || !key()) { setStatus(CFG.API_URL ? 'auth' : 'local'); return Promise.resolve(); }
    if (st.busy) { st.again = true; return Promise.resolve(); }
    if (navigator.onLine === false) { setStatus('offline'); return Promise.resolve(); }
    st.busy = true; setStatus('saving');
    var tries = 0;
    function attempt() {
      tries++;
      var seq = st.seq, state = clone(hooks.get());
      return api('save', { baseRev: st.rev, state: state, force: !!force }).then(function (r) {
        if (r && r.ok) {
          setBase(state, r.rev);
          if (st.seq === seq) setPending(false); else st.again = true;
          ok(r); return;
        }
        if (r && r.conflict && tries < 5) {
          var merged = merge3(st.base || {}, hooks.get(), r.state);
          setBase(r.state, r.rev); hooks.set(merged, 'merge');
          return attempt();
        }
        if (r && r.guard) {
          st.busy = false;
          if (window.confirm('⚠️ ' + r.error + '\n\nPress OK to save anyway, or Cancel to reload the shared version.')) return push(true);
          setPending(false); return pull(true);
        }
        throw new Error((r && r.error) || 'Save failed');
      });
    }
    return attempt().catch(fail).then(function () {
      st.busy = false;
      if (st.again) { st.again = false; if (st.pending) schedulePush(300); }
    });
  }
  function schedulePush(ms) { clearTimeout(st.pushT); st.pushT = setTimeout(push, ms == null ? 1200 : ms); }

  function dirty() {
    st.seq++;
    saveLocalVersion();
    if (!configured()) { setStatus('local'); return; }
    setPending(true); setStatus('pending'); schedulePush();
  }

  /* ---------------- on-phone restore points ---------------- */
  function localVersions() { return lsJSON(K.versions) || []; }
  function saveLocalVersion(force) {
    var s = hooks.get(); if (!s) return;
    var list = localVersions(), last = list[0];
    var gap = (CFG.LOCAL_VERSION_MINUTES || 10) * 60000;
    if (!force && last && Date.now() - last.t < gap) return;
    if (last && eq(last.state, s)) return;
    var sum = window.TripData ? TripData.summary(s) : {};
    list.unshift({ t: Date.now(), by: user() || 'this phone', bills: sum.bills, total: sum.total, state: clone(s) });
    list = list.slice(0, CFG.LOCAL_VERSIONS_KEEP || 20);
    while (list.length && !lsSet(K.versions, JSON.stringify(list))) list.pop(); // storage full → drop oldest
  }

  function download(name, text, mime) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: mime || 'text/plain' }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }

  /* ---------------- UI: status pill + sync dialog ---------------- */
  var LABEL = {
    local: ['📱', 'Saved on this phone'], synced: ['✅', 'Synced'], saving: ['⏳', 'Saving…'], checking: ['🔄', 'Checking…'],
    pending: ['🕓', 'Waiting to sync'], offline: ['📴', 'Offline — saved on phone'], error: ['⚠️', 'Sync problem — tap'],
    auth: ['🔒', 'Enter trip passcode']
  };
  var pill, dlg;
  function ago(t) {
    if (!t) return 'never'; var s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago'; return new Date(t).toLocaleString();
  }
  function setStatus(s, msg) {
    st.status = s; if (msg) st.error = msg;
    if (!pill) return;
    var l = LABEL[s] || LABEL.local;
    pill.className = 'ts-pill ts-' + s;
    pill.innerHTML = '<span>' + l[0] + '</span><span class="ts-t">' + l[1] +
      (s === 'synced' ? ' · ' + ago(st.last) : '') + (user() ? ' · ' + esc(user()) : '') + '</span>';
    pill.title = s === 'error' ? st.error : 'Tap for sync details';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function injectUI() {
    if (pill) return;
    var css = document.createElement('style');
    css.textContent =
      '.ts-pill{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line,#ddd);background:var(--surface,#fff);color:var(--ink,#222);' +
      'border-radius:999px;padding:6px 12px;font:600 12px Inter,system-ui,sans-serif;cursor:pointer;white-space:nowrap;max-width:100%}' +
      '.ts-pill .ts-t{overflow:hidden;text-overflow:ellipsis}.ts-float{position:fixed;left:12px;bottom:12px;z-index:45;box-shadow:0 4px 16px rgba(0,0,0,.15)}' +
      '.ts-synced{border-color:#2a9d8f}.ts-error,.ts-auth{border-color:#d64545;color:#d64545}.ts-offline,.ts-pending{border-color:#e9a23b}' +
      '.ts-modal{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:60;padding:16px}' +
      '.ts-modal.on{display:flex}.ts-dlg{background:var(--surface,#fff);color:var(--ink,#222);border-radius:18px;padding:20px;width:100%;max-width:440px;max-height:90vh;overflow:auto;font:14px Inter,system-ui,sans-serif}' +
      '.ts-dlg h3{margin:0 0 6px;font:700 20px Fraunces,Georgia,serif}.ts-dlg label{display:block;font-size:12px;color:var(--muted,#666);margin:12px 0 4px}' +
      '.ts-dlg input,.ts-dlg select{width:100%;padding:10px;border-radius:10px;border:1px solid var(--line,#ddd);background:var(--bg,#fafafa);color:var(--ink,#222);font:15px Inter,system-ui,sans-serif;box-sizing:border-box}' +
      '.ts-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;justify-content:flex-end}.ts-dlg button{border:1px solid var(--line,#ddd);background:var(--surface,#fff);color:var(--ink,#222);border-radius:10px;padding:9px 14px;font:600 14px Inter,system-ui,sans-serif;cursor:pointer}' +
      '.ts-dlg button.pri{background:var(--sea,#0f8b8d);border-color:var(--sea,#0f8b8d);color:#fff}.ts-note{font-size:13px;color:var(--muted,#666);line-height:1.5;margin:6px 0}' +
      '.ts-err{color:#d64545;font-size:13px;margin-top:8px;min-height:1em}.ts-kv{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:13px;margin-top:10px;padding:10px;border-radius:10px;background:var(--surface-2,#f4f4f4)}';
    document.head.appendChild(css);
    pill = document.createElement('button'); pill.type = 'button';
    var slot = document.getElementById('syncSlot');
    if (slot) slot.appendChild(pill); else { pill.classList.add('ts-float'); document.body.appendChild(pill); }
    pill.addEventListener('click', openDialog);
    dlg = document.createElement('div'); dlg.className = 'ts-modal';
    dlg.addEventListener('click', function (e) { if (e.target === dlg) closeDialog(); });
    document.body.appendChild(dlg);
    setStatus(st.status);
    setInterval(function () { if (st.status === 'synced') setStatus('synced'); }, 30000);
  }

  function openDialog(first) {
    var people = (hooks.people() || []).filter(Boolean);
    var me = user();
    var known = people.indexOf(me) >= 0;
    var setupNote = !CFG.API_URL
      ? '<p class="ts-note">Sharing is <b>not switched on yet</b> — edits are saved on this phone only. The trip owner follows <b>docs/SETUP.md</b> (≈20 min) and pastes the backend URL into <code>assets/config.js</code>.</p>'
      : (lsGet(K.offline) === '1' ? '<p class="ts-note">This phone is in <b>offline-only</b> mode.</p>' : '');
    dlg.innerHTML = '<div class="ts-dlg" role="dialog" aria-label="Trip sync">' +
      '<h3>' + (first === true ? '👋 Welcome to the trip planner' : '☁️ Trip sync') + '</h3>' +
      (first === true ? '<p class="ts-note">Everyone in the group edits the same plan. Pick your name so we know who added what.</p>' : '') +
      setupNote +
      '<label>Who is using this phone?</label><select id="tsUser">' +
      people.map(function (p) { return '<option ' + (p === me ? 'selected' : '') + '>' + esc(p) + '</option>'; }).join('') +
      '<option value="__other" ' + (me && !known ? 'selected' : '') + '>Someone else…</option></select>' +
      '<input id="tsOther" placeholder="Your name" value="' + (me && !known ? esc(me) : '') + '" style="margin-top:6px;display:' + (me && !known ? 'block' : 'none') + '">' +
      (CFG.API_URL ? '<label>Trip passcode</label><input id="tsKey" type="password" autocomplete="current-password" placeholder="Ask Akshay" value="' + esc(key()) + '">' : '') +
      '<div class="ts-err" id="tsErr">' + (st.status === 'error' || st.status === 'auth' ? esc(st.error) : '') + '</div>' +
      (CFG.API_URL ? '<div class="ts-kv"><span>Status</span><b>' + (LABEL[st.status] || LABEL.local).join(' ') + '</b>' +
        '<span>Last sync</span><span>' + ago(st.last) + '</span>' +
        '<span>Version</span><span>rev ' + st.rev + (st.updatedBy ? ' · last saved by ' + esc(st.updatedBy) : '') + '</span>' +
        '<span>Unsynced</span><span>' + (st.pending ? 'yes — will upload automatically' : 'none') + '</span></div>' : '') +
      '<div class="ts-row">' +
      (CFG.API_URL ? '<button id="tsOff">' + (lsGet(K.offline) === '1' ? 'Go online' : 'Use offline only') + '</button>' : '') +
      '<button id="tsClose">' + (first === true ? 'Later' : 'Close') + '</button>' +
      (CFG.API_URL ? '<button id="tsSync">Sync now</button>' : '') +
      '<button class="pri" id="tsSave">Save</button></div></div>';
    dlg.classList.add('on');
    var sel = dlg.querySelector('#tsUser'), other = dlg.querySelector('#tsOther');
    sel.onchange = function () { other.style.display = sel.value === '__other' ? 'block' : 'none'; if (sel.value === '__other') other.focus(); };
    var cl = dlg.querySelector('#tsClose'); if (cl) cl.onclick = closeDialog;
    var off = dlg.querySelector('#tsOff');
    if (off) off.onclick = function () {
      lsSet(K.offline, lsGet(K.offline) === '1' ? null : '1'); closeDialog();
      if (configured()) { loops(); pull(true); } else setStatus('local');
    };
    var sy = dlg.querySelector('#tsSync'); if (sy) sy.onclick = function () { saveForm(true); };
    dlg.querySelector('#tsSave').onclick = function () { saveForm(false); };
  }
  function closeDialog() { if (dlg) dlg.classList.remove('on'); }
  function saveForm(syncNow) {
    var sel = dlg.querySelector('#tsUser'), other = dlg.querySelector('#tsOther'), k = dlg.querySelector('#tsKey'), err = dlg.querySelector('#tsErr');
    var name = sel.value === '__other' ? other.value.trim() : sel.value;
    if (!name) { err.textContent = 'Please enter your name.'; return; }
    lsSet(K.user, name);
    if (!k) { closeDialog(); setStatus(st.status); return; }
    var pass = k.value.trim();
    if (!pass) { err.textContent = 'Enter the trip passcode (ask the trip owner).'; return; }
    var changed = pass !== key(); lsSet(K.key, pass);
    err.textContent = 'Checking…';
    api('ping').then(function (r) {
      if (!r || !r.ok) throw new Error((r && r.error) || 'Backend did not answer');
      closeDialog();
      hooks.toast('✅ Connected as ' + name);
      loops();
      if (changed || syncNow || !st.started2) { st.started2 = true; return st.pending ? push() : pull(true); }
    }).catch(function (e) { err.textContent = (e && e.auth) ? '❌ Wrong passcode.' : '⚠️ ' + ((e && e.message) || e); });
  }

  /* ---------------- start ---------------- */
  function start(opts) {
    if (st.started) return; st.started = true;
    hooks = Object.assign(hooks, opts || {});
    injectUI();
    if (!configured()) { setStatus('local'); return; } // sharing not set up: no popup, the plan shows straight away
    if (!key() || !user()) { setStatus('auth', 'Enter the trip passcode'); openDialog(true); return; }
    st.started2 = true;
    loops();
    pull(true);
  }
  /** Background sync: poll for others' edits, react to network + app switching. Started once. */
  function loops() {
    if (st.loops) return; st.loops = true;
    setInterval(function () { if (document.visibilityState !== 'hidden') { if (st.pending) push(); else pull(false); } }, (CFG.POLL_SECONDS || 30) * 1000);
    window.addEventListener('online', function () { if (st.pending) push(); else pull(false); });
    window.addEventListener('offline', function () { setStatus('offline'); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { if (st.pending) push(); else pull(false); } });
  }

  window.TripSync = {
    start: start, dirty: dirty, api: api, pull: pull, push: push, merge3: merge3,
    configured: configured, user: user, status: function () { return st.status; }, rev: function () { return st.rev; },
    localVersions: localVersions, saveLocalVersion: saveLocalVersion, download: download, openDialog: openDialog, config: CFG
  };
})();
