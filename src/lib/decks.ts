import type { FeedCaption } from './database.types';

export type DeckSlide = { id: string; created_at: string; my_vote: boolean | null };
export type DeckMonth = { month: string; total: number; voted: number };
export type LatestCaption = { id: string; created_at: string; month: string };
export type DeckSnapshot = { months: DeckMonth[]; month: string | null; slides: DeckSlide[]; latest: LatestCaption | null; new_count: number };

export function monthKey(date: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit' }).formatToParts(new Date(date));
  return `${parts.find(part => part.type === 'year')!.value}-${parts.find(part => part.type === 'month')!.value}`;
}
export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'long' }).format(new Date(`${month}-15T12:00:00Z`));
}
export function votedCount(slides: DeckSlide[]): number { return slides.filter(slide => slide.my_vote !== null).length; }
export function nextUnvoted(slides: DeckSlide[], currentId: string | null): string | null {
  const current = slides.findIndex(slide => slide.id === currentId);
  for (let step = 1; step <= slides.length; step++) {
    const slide = slides[(current + step + slides.length) % slides.length];
    if (slide.my_vote === null) return slide.id;
  }
  return null;
}
export function keepActiveId(snapshot: DeckSnapshot, currentId: string | null): string | null {
  return snapshot.slides.some(slide => slide.id === currentId) ? currentId : snapshot.slides[0]?.id || null;
}
export function applySavedVote(snapshot: DeckSnapshot, caption: FeedCaption): { snapshot: DeckSnapshot; completed: boolean } {
  const previous = snapshot.slides.find(slide => slide.id === caption.id);
  const slides = snapshot.slides.map(slide => slide.id === caption.id ? { ...slide, my_vote: caption.my_vote } : slide);
  const completed = !!previous && previous.my_vote === null && slides.length > 0 && votedCount(slides) === slides.length;
  const months = snapshot.months.map(month => month.month === snapshot.month ? { ...month, total: slides.length, voted: votedCount(slides) } : month);
  return { snapshot: { ...snapshot, slides, months }, completed };
}
export function manifestPage(slides: DeckSlide[], filter: 'all' | 'unvoted', page: number, size = 24): DeckSlide[] {
  const filtered = filter === 'unvoted' ? slides.filter(slide => slide.my_vote === null) : slides;
  return filtered.slice(page * size, (page + 1) * size);
}

// One burst may yield only one navigation. Momentum keeps extending the quiet
// window; a new gesture is accepted only after the previous burst is quiet.
export function wheelStep(state: { last: number; amount: number; locked: boolean }, dx: number, dy: number, now: number): -1 | 0 | 1 {
  if (now - state.last > 350) { state.amount = 0; state.locked = false; }
  state.last = now;
  if (Math.abs(dx) < Math.abs(dy) * 1.7 || Math.abs(dx) < 2) return 0;
  if (state.locked) return 0;
  state.amount += dx;
  if (Math.abs(state.amount) < 70) return 0;
  state.locked = true;
  return state.amount > 0 ? 1 : -1;
}
export function touchStep(dx: number, dy: number): -1 | 0 | 1 {
  return Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.7 ? (dx < 0 ? 1 : -1) : 0;
}
