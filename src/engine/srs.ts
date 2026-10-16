// Spaced repetition (Leitner boxes). Each item moves up a box when recalled well and
// drops back to the first box when forgotten, so weak items come back sooner.

export const INTERVALS_DAYS = [0, 1, 3, 7, 14, 30, 60];

export interface SrsCard {
  box: number; // 0..INTERVALS_DAYS.length-1
  due: string; // YYYY-MM-DD
  seen: number;
  lapses: number;
}

export type Grade = 'good' | 'hard' | 'again';

export function today(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return today(dt);
}

export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/** A new card after the item is learned in a lesson: first review tomorrow. */
export function newCard(now = today()): SrsCard {
  return { box: 1, due: addDays(now, INTERVALS_DAYS[1]), seen: 1, lapses: 0 };
}

/**
 * Updates a card after a review.
 * good  – correct at first try: next box, longer interval
 * hard  – correct with a hint or typo: same box, same interval again
 * again – wrong: back to box 0, due again today (and tomorrow at the latest)
 */
export function review(card: SrsCard, grade: Grade, now = today()): SrsCard {
  if (grade === 'again') {
    return { box: 0, due: now, seen: card.seen + 1, lapses: card.lapses + 1 };
  }
  const box = grade === 'good' ? Math.min(card.box + 1, INTERVALS_DAYS.length - 1) : Math.max(card.box, 1);
  return { box, due: addDays(now, Math.max(1, INTERVALS_DAYS[box])), seen: card.seen + 1, lapses: card.lapses };
}

export function isDue(card: SrsCard, now = today()): boolean {
  return card.due <= now;
}

/** Due cards, weakest and most overdue first. */
export function dueKeys(cards: Record<string, SrsCard>, now = today(), limit = 15): string[] {
  return Object.entries(cards)
    .filter(([, c]) => isDue(c, now))
    .sort(([, a], [, b]) => a.box - b.box || (a.due < b.due ? -1 : a.due > b.due ? 1 : 0) || b.lapses - a.lapses)
    .slice(0, limit)
    .map(([k]) => k);
}
