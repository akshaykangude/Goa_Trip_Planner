// A small in-memory imitation of the Google Apps Script services that backend/Code.gs uses,
// so the real backend code can be tested (and used as a local mock server) without Google.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function createBackend({ passcode = 'goa2026', placesKey = 'test-key', placesHandler } = {}) {
  let idn = 0;
  const nid = (p) => p + (++idn);
  const props = { TRIP_PASSCODE: passcode };
  if (placesKey) props.PLACES_API_KEY = placesKey;
  const byId = new Map();

  class Blob {
    constructor(data, name) { this.data = data; this.name = name; }
    getDataAsString() { return String(this.data); }
    setName(n) { this.name = n; return this; }
  }
  class File {
    constructor(name, content, mime, parent) { this.id = nid('file'); this.name = name; this.content = content; this.mime = mime; this.parent = parent; this.trashed = false; byId.set(this.id, this); }
    getId() { return this.id; } getName() { return this.name; }
    getBlob() { return new Blob(this.content, this.name); }
    setContent(t) { this.content = t; return this; }
    moveTo(f) { this.parent = f; f.files.push(this); return this; }
    setTrashed(v) { this.trashed = v; }
  }
  class Folder {
    constructor(name, parent) { this.id = nid('folder'); this.name = name; this.parent = parent; this.folders = []; this.files = []; this.desc = ''; this.created = new Date(Date.now() + idn); this.trashed = false; byId.set(this.id, this); }
    getId() { return this.id; } getName() { return this.name; } getUrl() { return 'https://drive.fake/' + this.id; }
    isTrashed() { return this.trashed; } setTrashed(v) { this.trashed = v; }
    createFolder(n) { const f = new Folder(n, this); this.folders.push(f); return f; }
    createFile(a, b, c) { const f = a instanceof Blob ? new File(a.name, a.data, 'blob', this) : new File(a, b, c, this); this.files.push(f); return f; }
    getFolders() { const l = this.folders.filter(f => !f.trashed); let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; }
    getFilesByName(n) { const l = this.files.filter(f => f.name === n && !f.trashed); let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; }
    getParents() { const l = this.parent ? [this.parent] : []; let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; }
    setDescription(d) { this.desc = d; } getDescription() { return this.desc; } getDateCreated() { return this.created; }
  }
  const driveRoot = new Folder('My Drive', null);

  class Range {
    constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); }
    setValues(v) { for (let i = 0; i < v.length; i++) this.sh.rows[this.r - 1 + i] = v[i].slice(); return this; }
    setFontWeight() { return this; } setBackground() { return this; }
  }
  class Sheet {
    constructor(name) { this.name = name; this.rows = []; }
    getName() { return this.name; } clearContents() { this.rows = []; }
    getRange(r, c, nr, nc) { return new Range(this, r, c, nr, nc); }
    setFrozenRows() { } getLastRow() { return this.rows.length; } appendRow(r) { this.rows.push(r); }
  }
  class Spreadsheet {
    constructor(name) { this.id = nid('sheet'); this.name = name; this.sheets = [new Sheet('Sheet1')]; byId.set(this.id, new File(name, '', 'sheet', null)); this.fileId = this.id; spreadsheets.set(this.id, this); }
    getId() { return this.id; } getUrl() { return 'https://sheets.fake/' + this.id; }
    getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
    insertSheet(n, i) { const s = new Sheet(n); this.sheets.splice(i == null ? this.sheets.length : i, 0, s); return s; }
    getSheets() { return this.sheets; } deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); }
  }
  const spreadsheets = new Map();
  const cache = new Map();
  const triggers = [];
  const fetchLog = [];

  const G = {
    console: { log() { }, warn() { }, error() { } },
    Logger: { log() { } },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); },
      setProperties: o => { for (const k in o) props[k] = String(o[k]); }, deleteProperty: k => { delete props[k]; }
    }) },
    DriveApp: {
      createFolder: n => driveRoot.createFolder(n),
      getFolderById: id => { const f = byId.get(id); if (!(f instanceof Folder)) throw new Error('No folder ' + id); return f; },
      getFileById: id => { const f = byId.get(id); if (!f) throw new Error('No file ' + id); return f; }
    },
    SpreadsheetApp: {
      create: n => new Spreadsheet(n),
      openById: id => { const s = spreadsheets.get(id); if (!s) throw new Error('no sheet'); return s; },
      flush() { }
    },
    LockService: { getScriptLock: () => ({ waitLock() { }, releaseLock() { } }) },
    ContentService: { createTextOutput: s => ({ content: s, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    MimeType: { CSV: 'text/csv', PLAIN_TEXT: 'text/plain' },
    Utilities: {
      formatDate: (d, tz, f) => {
        const p = n => String(n).padStart(2, '0');
        return f.replace('yyyy', d.getFullYear()).replace('MM', p(d.getMonth() + 1)).replace('dd', p(d.getDate()))
          .replace('HH', p(d.getHours())).replace('mm', p(d.getMinutes())).replace('ss', p(d.getSeconds()))
          .replace('MMM', 'Sep').replace('hh', p(d.getHours() % 12 || 12)).replace(' a', d.getHours() < 12 ? ' AM' : ' PM');
      },
      DigestAlgorithm: { MD5: 'md5' },
      computeDigest: (a, s) => [...crypto.createHash('md5').update(s).digest()],
      base64EncodeWebSafe: b => Buffer.from(Array.isArray(b) ? b : String(b)).toString('base64url')
    },
    CacheService: { getScriptCache: () => ({ get: k => cache.get(k) || null, put: (k, v) => cache.set(k, v) }) },
    ScriptApp: {
      getOAuthToken: () => 'tok', getProjectTriggers: () => triggers.slice(),
      deleteTrigger: t => triggers.splice(triggers.indexOf(t), 1),
      newTrigger: fn => ({ timeBased: () => ({ everyHours: h => ({ create: () => { const t = { fn, h, getHandlerFunction: () => fn }; triggers.push(t); return t; } }) }) })
    },
    UrlFetchApp: {
      fetch: (url, opts = {}) => {
        fetchLog.push({ url, opts });
        if (/docs\.google\.com\/spreadsheets/.test(url)) return { getBlob: () => new Blob('XLSX', 'x.xlsx'), getResponseCode: () => 200 };
        if (placesHandler) {
          const r = placesHandler(url, opts);
          if (r) return { getResponseCode: () => r.code || 200, getContentText: () => (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)), getHeaders: () => r.headers || {} };
        }
        return { getResponseCode: () => 404, getContentText: () => 'not mocked', getHeaders: () => ({}) };
      }
    }
  };
  const ctx = vm.createContext(G);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'backend/TripData.gs'), 'utf8'), ctx, { filename: 'TripData.gs' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'backend/Code.gs'), 'utf8'), ctx, { filename: 'Code.gs' });

  return {
    ctx, props, triggers, fetchLog, spreadsheets, driveRoot,
    post(body) { return JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).content); },
    get(params) { return JSON.parse(ctx.doGet({ parameter: params || {} }).content); },
    run(fn, ...a) { return ctx[fn](...a); },
    sheetRows(name) { const ss = [...spreadsheets.values()][0]; const s = ss && ss.getSheetByName(name); return s ? s.rows : null; },
    snapFolders() { const id = props.SNAP_FOLDER_ID; return id ? byId.get(id).folders.filter(f => !f.trashed) : []; }
  };
}
