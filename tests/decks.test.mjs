import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/lib/decks.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const d = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const slides = Array.from({ length: 1205 }, (_, i) => ({ id: String(i), created_at: '', my_vote: i === 1204 ? null : false }));
const snapshot = { month: '2026-10', months: [{ month: '2026-10', total: 1205, voted: 1204 }], slides };
test('New York month boundaries including standard/daylight saving time', () => {
  for (const [date, month] of [['2026-11-01T03:59:59Z','2026-10'],['2026-11-01T04:00:00Z','2026-11'],['2026-01-01T04:59:59Z','2025-12'],['2026-01-01T05:00:00Z','2026-01']]) assert.equal(d.monthKey(date), month);
  assert.equal(d.monthLabel('2026-10'), 'October 2026');
});
test('whole-month unvoted navigation skips false votes and wraps', () => {
  assert.equal(d.votedCount(slides), 1204);
  assert.equal(d.nextUnvoted(slides, '0'), '1204');
  assert.equal(d.nextUnvoted([{id:'a',my_vote:null},{id:'b',my_vote:false}], 'b'), 'a');
  assert.equal(d.nextUnvoted([{id:'a',my_vote:false}], 'a'), null);
});
test('completion occurs only on first successful final vote; changes retain completion', () => {
  const result = d.applySavedVote(snapshot, {id:'1204',my_vote:false});
  assert.equal(result.completed, true);
  assert.equal(result.snapshot.months[0].voted, 1205);
  assert.equal(d.nextUnvoted(result.snapshot.slides, '0'), null);
  assert.equal(d.applySavedVote(result.snapshot, {id:'1204',my_vote:true}).completed, false);
  assert.equal(snapshot.slides[1204].my_vote, null);
});
test('new captions preserve current ID, change totals and re-enable unvoted navigation', () => {
  const complete = d.applySavedVote(snapshot, {id:'1204',my_vote:true}).snapshot;
  const refreshed = {...complete, slides:[{id:'new',my_vote:null}, ...complete.slides]};
  assert.equal(d.keepActiveId(refreshed, '700'), '700');
  assert.equal(d.nextUnvoted(refreshed.slides, '700'), 'new');
  assert.equal(d.keepActiveId(refreshed, 'removed'), 'new');
});
test('manifest paging covers more than one page and the complete month', () => {
  assert.equal(d.manifestPage(slides,'all',50).length, 5);
  assert.equal(d.manifestPage(slides,'unvoted',0)[0].id, '1204');
  const ids = Array.from({length:51},(_,i)=>d.manifestPage(slides,'all',i)).flat().map(s=>s.id);
  assert.equal(new Set(ids).size, 1205);
});
test('trackpad threshold, momentum lock, quiet reset and vertical movement', () => {
  const state = {last:0,amount:0,locked:false};
  assert.equal(d.wheelStep(state,40,0,1000),0);
  assert.equal(d.wheelStep(state,40,0,1020),1);
  for(let i=1;i<=10;i++) assert.equal(d.wheelStep(state,100,0,1020+i*100),0);
  assert.equal(d.wheelStep(state,-80,0,2400),-1);
  assert.equal(d.wheelStep(state,80,100,2800),0);
  assert.equal(d.touchStep(-65,5),1);
  assert.equal(d.touchStep(65,5),-1);
  assert.equal(d.touchStep(20,100),0);
});
