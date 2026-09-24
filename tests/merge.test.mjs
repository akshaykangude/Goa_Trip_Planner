// Tests the 3-way merge that lets several phones edit at once without losing anything.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { seedState } from './util.mjs';

const win = { TRIP_CONFIG: {} };
const ctx = vm.createContext({ window: win, localStorage: { getItem: () => null, setItem() { }, removeItem() { } }, document: {}, navigator: {}, setTimeout, clearTimeout, console });
vm.runInContext(fs.readFileSync(new URL('../assets/sync.js', import.meta.url), 'utf8'), ctx);
const merge3 = (...a) => JSON.parse(JSON.stringify(win.TripSync.merge3(...a)));

let pass = 0; const t = (n, f) => { f(); pass++; console.log('  ✓ ' + n); };
console.log('merge (sync.js)');
const base = seedState();
const bill = (id, amt) => ({ id, date: '2026-09-26', cat: 'food', amt, desc: 'bill ' + id, by: 0, split: [0, 1], mode: 'UPI', slot: 3 });

t('two phones add different bills at the same time → both kept', () => {
  const a = structuredClone(base); a.expenses.push(bill('A', 100));
  const b = structuredClone(base); b.expenses.push(bill('B', 200));
  const m = merge3(base, a, b);
  assert.deepEqual(m.expenses.map(e => e.id).sort(), ['A', 'B']);
});
t('one phone edits a slot, another adds a bill → both kept', () => {
  const a = structuredClone(base); a.days[1].cells[3] = '🍽️ Lunch at Como Agua';
  const b = structuredClone(base); b.expenses.push(bill('B', 50));
  const m = merge3(base, a, b);
  assert.equal(m.days[1].cells[3], '🍽️ Lunch at Como Agua'); assert.equal(m.expenses.length, 1);
});
t('deleting a bill on one phone is respected', () => {
  const b0 = structuredClone(base); b0.expenses.push(bill('X', 10), bill('Y', 20));
  const a = structuredClone(b0); a.expenses = a.expenses.filter(e => e.id !== 'X');
  const r = structuredClone(b0); r.places.push({ name: 'Como Agua', type: 'Food', note: '', visited: false });
  const m = merge3(b0, a, r);
  assert.deepEqual(m.expenses.map(e => e.id), ['Y']); assert.ok(m.places.some(p => p.name === 'Como Agua'));
});
t('same field edited on both phones → the phone saving now wins, nothing crashes', () => {
  const a = structuredClone(base); a.days[0].cells[8] = 'A';
  const b = structuredClone(base); b.days[0].cells[8] = 'B';
  assert.equal(merge3(base, a, b).days[0].cells[8], 'A');
});
t('different slots on the same day edited on both phones → both kept', () => {
  const a = structuredClone(base); a.days[2].cells[0] = 'Coffee'; a.days[2].place = { ...a.days[2].place, 0: 'G-Shot' };
  const b = structuredClone(base); b.days[2].cells[9] = 'Late snack'; b.days[2].span = { 1: 2 };
  const m = merge3(base, a, b);
  assert.equal(m.days[2].cells[0], 'Coffee'); assert.equal(m.days[2].cells[9], 'Late snack');
  assert.equal(m.days[2].place[0], 'G-Shot'); assert.deepEqual(m.days[2].span, { 1: 2 });
});
t('bill edited on one phone while another adds a new bill', () => {
  const b0 = structuredClone(base); b0.expenses.push(bill('E', 100));
  const a = structuredClone(b0); a.expenses[0].amt = 150; a.expenses[0].desc = 'Dinner at Thalassa';
  const r = structuredClone(b0); r.expenses.push(bill('F', 70));
  const m = merge3(b0, a, r);
  assert.equal(m.expenses.find(e => e.id === 'E').amt, 150); assert.ok(m.expenses.find(e => e.id === 'F'));
});
console.log(`  ${pass} passed`);
