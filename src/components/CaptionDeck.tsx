'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { FeedCaption } from '@/lib/database.types';
import { applySavedVote, keepActiveId, manifestPage, monthLabel, nextUnvoted, touchStep, votedCount, wheelStep, type DeckSnapshot } from '@/lib/decks';
async function getJson(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal, cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load captions.');
  return data;
}
export default function CaptionDeck({ initial }: { initial: DeckSnapshot }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [active, setActive] = useState<string | null>(initial.slides[0]?.id || null);
  const [loadedSlide, setSlide] = useState<{ item: FeedCaption; imageUrl: string } | null>(null);
  const [items, setItems] = useState<Record<string, FeedCaption>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [changing, setChanging] = useState(false);
  const [completion, setCompletion] = useState('');
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unvoted'>('all');
  const [page, setPage] = useState(0);
  const slide = loadedSlide?.item.id === active ? loadedSlide : null;
  const root = useRef<HTMLDivElement>(null);
  const state = useRef({ snapshot, active, busy, changing });
  const cursor = useRef(initial.latest);
  const refreshVersion = useRef(0);
  const refreshAbort = useRef<AbortController | null>(null);
  useEffect(() => { state.current = { snapshot, active, busy, changing }; }, [snapshot, active, busy, changing]);
  useEffect(() => {
    const id = window.location.hash.replace('#caption-', '');
    const timer = setTimeout(() => { if (initial.slides.some(slide => slide.id === id)) setActive(id); }, 0);
    return () => clearTimeout(timer);
  }, [initial]);
  async function refresh(month?: string, latest = false) {
    const version = ++refreshVersion.current;
    refreshAbort.current?.abort();
    const controller = new AbortController();
    refreshAbort.current = controller;
    const params = new URLSearchParams();
    if (month) params.set('month', month);
    params.set('seen', cursor.current?.created_at || '1970-01-01T00:00:00Z');
    if (cursor.current) params.set('id', cursor.current.id);
    let data: DeckSnapshot;
    try { data = await getJson(`/api/decks?${params}`, AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])); }
    catch (error) { if (controller.signal.aborted) return; throw error; }
    if (version !== refreshVersion.current || state.current.busy) return;
    if (latest) { cursor.current = data.latest; data.new_count = 0; }
    setSnapshot(data);
    setActive(id => latest || month !== state.current.snapshot.month ? data.slides[0]?.id || null : keepActiveId(data, id));
    setCompletion('');
  }
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; });
  useEffect(() => {
    let stopped = false;
    const timer = window.setInterval(() => {
      if (!stopped && !document.hidden && !state.current.busy && !state.current.changing) {
        refreshRef.current(state.current.snapshot.month || undefined).catch(error => { if (!stopped) setError(error.message); });
      }
    }, 20000);
    const invalidate = () => { refreshVersion.current++; refreshAbort.current?.abort(); };
    return () => { stopped = true; clearInterval(timer); invalidate(); };
  }, []);
  useEffect(() => {
    if (!active || busy) return;
    const controller = new AbortController();
    const load = () => { const version = refreshVersion.current; return getJson(`/api/decks/items?ids=${active}&image=1`, controller.signal).then(data => { if (controller.signal.aborted || version !== refreshVersion.current) return; setError(''); setSlide(data); setItems(items => ({ ...items, [data.item.id]: data.item })); }).catch(error => { if (!controller.signal.aborted) setError(error.message); }); };
    load();
    // Renew short-lived image access without moving the slide.
    const timer = setInterval(load, 240000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [active, busy, snapshot]);
  const total = snapshot.slides.length;
  const voted = votedCount(snapshot.slides);
  const index = snapshot.slides.findIndex(slide => slide.id === active);
  const complete = total > 0 && voted === total;
  const filteredTotal = filter === 'all' ? total : total - voted;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filteredTotal / 24) - 1));
  const visible = manifestPage(snapshot.slides, filter, currentPage);
  const visibleKey = visible.map(slide => slide.id).join(',');

  useEffect(() => {
    if (!open || !visibleKey) return;
    const controller = new AbortController();
    getJson(`/api/decks/items?ids=${visibleKey}`, controller.signal).then((data: FeedCaption[]) => setItems(items => ({ ...items, ...Object.fromEntries(data.map(item => [item.id, item])) }))).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [open, visibleKey]);
  function move(direction: number) {
    const current = state.current;
    const i = current.snapshot.slides.findIndex(slide => slide.id === current.active);
    const next = current.snapshot.slides[i + direction];
    if (next && !current.changing) { state.current.active = next.id; setActive(next.id); }
  }
  const moveRef = useRef(move);
  useEffect(() => { moveRef.current = move; });
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const wheel = { last: 0, amount: 0, locked: false };
    let start: { x: number; y: number } | null = null;
    const editable = (target: EventTarget | null) => target instanceof HTMLElement && !!target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
    function key(event: KeyboardEvent) {
      if (editable(event.target) || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.repeat) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); moveRef.current(event.key === 'ArrowRight' ? 1 : -1); }
    }
    function scroll(event: WheelEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || editable(event.target)) return;
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element!.clientWidth : 1;
      const dx = event.deltaX * scale, dy = event.deltaY * scale;
      const direction = wheelStep(wheel, dx, dy, performance.now());
      if ((Math.abs(wheel.amount) >= 20 || wheel.locked) && Math.abs(dx) > Math.abs(dy) * 1.7) event.preventDefault();
      if (direction) moveRef.current(direction);
    }
    function touchStart(event: TouchEvent) { start = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null; }
    function touchMove(event: TouchEvent) {
      if (!start || event.touches.length !== 1) { start = null; return; }
      const dx = event.touches[0].clientX - start.x, dy = event.touches[0].clientY - start.y;
      if (Math.abs(dy) > 20 && Math.abs(dy) > Math.abs(dx)) { start = null; return; }
      const direction = touchStep(dx, dy);
      if (direction) { event.preventDefault(); moveRef.current(direction); start = null; }
    }
    function touchEnd() { start = null; }
    element.addEventListener('keydown', key);
    element.addEventListener('wheel', scroll, { passive: false });
    const surface = element.querySelector('.deck-slide')!;
    surface.addEventListener('touchstart', touchStart as EventListener, { passive: true });
    surface.addEventListener('touchmove', touchMove as EventListener, { passive: false });
    surface.addEventListener('touchend', touchEnd); surface.addEventListener('touchcancel', touchEnd);
    return () => { element.removeEventListener('keydown', key); element.removeEventListener('wheel', scroll); surface.removeEventListener('touchstart', touchStart as EventListener); surface.removeEventListener('touchmove', touchMove as EventListener); surface.removeEventListener('touchend', touchEnd); surface.removeEventListener('touchcancel', touchEnd); };
  }, []);
  async function vote(value: boolean) {
    if (!slide || busy) return;
    const id = slide.item.id;
    state.current.busy = true; setBusy(true); setError(''); refreshVersion.current++; refreshAbort.current?.abort();
    try {
      const response = await fetch('/api/votes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ captionId: id, value }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Your vote could not be saved.');
      refreshVersion.current++;
      const updated = applySavedVote(state.current.snapshot, data.caption);
      state.current.snapshot = updated.snapshot; setSnapshot(updated.snapshot);
      setItems(items => ({ ...items, [id]: data.caption }));
      setSlide(slide => slide?.item.id === id ? { ...slide, item: data.caption } : slide);
      if (updated.completed) setCompletion('You rated every caption in this month.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save your vote.'); }
    finally { state.current.busy = false; setBusy(false); }
  }
  async function selectMonth(month?: string, latest = false) {
    setChanging(true); state.current.changing = true; setError('');
    try { await refresh(month, latest); setPage(0); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not load this month.'); }
    finally { state.current.changing = false; setChanging(false); }
  }
  return <>
    {snapshot.new_count > 0 && <div className="new-captions"><span>{snapshot.new_count} new captions</span><span aria-hidden="true"> · </span><button className="text-link" disabled={busy || changing} onClick={() => selectMonth(undefined, true)}>View latest</button></div>}
    <label className="month-picker">Month<select value={snapshot.month || ''} disabled={busy || changing || !total} onChange={event => selectMonth(event.target.value)}>{snapshot.months.map(month => <option key={month.month} value={month.month}>{monthLabel(month.month)} · {month.total} captions · {month.voted} voted</option>)}</select></label>
    <div ref={root} className="deck" tabIndex={0} role="region" aria-label="Monthly caption deck" aria-busy={changing}>
      <div className="deck-slide">
        <div className="deck-image" onClick={() => root.current?.focus({ preventScroll: true })}>{slide ? <Image key={slide.item.id} src={slide.imageUrl} alt="Photo submitted for this caption" fill unoptimized sizes="(max-width: 700px) 100vw, 600px" /> : <span>{total ? error ? 'Image unavailable' : 'Loading caption…' : 'No captions yet.'}</span>}</div>
        <div className="deck-caption">{slide && <><p className="caption-text">{slide.item.caption}</p><div className="vote-row" aria-label="Rate this caption" aria-busy={busy}>{[true, false].map(value => <button key={String(value)} className={`vote ${slide.item.my_vote === value ? 'selected' : ''}`} aria-pressed={slide.item.my_vote === value} disabled={busy} onClick={() => vote(value)}>{value ? 'Funny' : 'Not Funny'} <span>{value ? slide.item.funny_count : slide.item.not_funny_count}</span></button>)}</div><p className="muted vote-status">{busy ? 'Saving vote…' : slide.item.my_vote !== null ? 'Vote saved' : 'Choose Funny or Not Funny.'}</p></>}</div>
      </div>
      <div className="deck-progress"><span>Slide {index + 1} of {total}</span><span>Voted on {voted} of {total}</span></div>
      <div className="deck-controls"><button className="button button-outline" disabled={index <= 0 || changing} onClick={() => move(-1)}>Previous</button><button className="button button-outline" disabled={index >= total - 1 || changing} onClick={() => move(1)}>Next</button><span className={`unvoted-control ${complete ? 'completed' : ''}`} tabIndex={complete ? 0 : undefined} aria-describedby={complete ? 'completion-help' : undefined} title={complete ? 'You have voted on every caption in this month. You can still browse and change votes.' : undefined}><button className="button" disabled={complete || !total || changing} aria-describedby={complete ? 'completion-help' : undefined} onClick={() => setActive(nextUnvoted(snapshot.slides, active))}>Next unvoted</button></span></div>
      {complete && <p id="completion-help" className="completion-help">All captions rated <span>— You can still browse and change your votes.</span></p>}
      <p className="completion-announcement" role="status" aria-live="polite">{completion}</p>
      {error && <p className="error" role="alert">{error} <button className="text-link" onClick={() => selectMonth(snapshot.month || undefined)}>Retry</button></p>}
    </div>
    <details className="browse-all" open={open} onToggle={event => setOpen(event.currentTarget.open)}><summary>Browse all</summary>
      <div className="browse-filters" aria-label="Caption filters">{(['all', 'unvoted'] as const).map(value => <button key={value} className="button button-outline" aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(0); }}>{value === 'all' ? 'All' : 'Unvoted'} ({value === 'all' ? total : total - voted})</button>)}</div>
      {open && <><div className="deck-thumbnails">{visible.map(item => <button className={`deck-thumbnail ${item.id === active ? 'current' : ''}`} key={item.id} aria-current={item.id === active ? 'true' : undefined} onClick={() => { setActive(item.id); root.current?.focus({ preventScroll: true }); root.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); }}><span className="thumbnail-image"><Image src={`/api/decks/thumbnail?id=${item.id}`} alt="" fill unoptimized sizes="200px" loading="lazy" /></span><span className="thumbnail-caption">{items[item.id]?.caption || 'Loading caption…'}</span><span className={`thumbnail-state ${item.my_vote !== null ? 'rated' : ''}`}>{item.my_vote === null ? 'Unvoted' : item.my_vote ? '✓ Funny' : '✓ Not Funny'}</span></button>)}</div>{!visible.length && <p className="muted">No unvoted captions.</p>}<div className="pagination"><button className="button button-outline" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous page</button><span className="muted">{filteredTotal ? `${currentPage * 24 + 1}–${Math.min((currentPage + 1) * 24, filteredTotal)} of ${filteredTotal}` : '0 captions'}</span><button className="button button-outline" disabled={(currentPage + 1) * 24 >= filteredTotal} onClick={() => setPage(currentPage + 1)}>Next page</button></div></>}
    </details>
  </>;
}
