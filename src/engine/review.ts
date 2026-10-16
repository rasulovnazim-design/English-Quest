// Builds a review (Повторение) session from items that are due.

import { categories, findItem, allItems, itemKey, groupOf } from '../data';
import type { Exercise, ItemRef } from './exercises';
import { acceptedFor, englishOf, shuffle } from './exercises';
import type { SrsCard } from './srs';

export interface ReviewTask {
  key: string;
  ex: Exercise;
}

function ref(key: string): ItemRef | undefined {
  const f = findItem(key);
  if (!f) return undefined;
  return { key, item: f.item, group: groupOf(f.cat, f.item.id) };
}

function options(target: ItemRef, by: (r: ItemRef) => string): string[] {
  const [catId] = target.key.split(':');
  const cat = categories[catId];
  const pool = allItems(cat)
    .map((i) => ({ key: itemKey(catId, i.id), item: i, group: groupOf(cat, i.id) }))
    .filter((r) => r.group === target.group && r.key !== target.key);
  const seen = new Set([by(target)]);
  const out: string[] = [];
  for (const r of shuffle(pool)) {
    const v = by(r);
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
    if (out.length === 3) break;
  }
  return shuffle([by(target), ...out]);
}

/** Harder exercises for items the learner knows better. */
export function reviewExercise(key: string, card: SrsCard, accent: 'gb' | 'us'): Exercise | undefined {
  const r = ref(key);
  if (!r) return undefined;
  const en = englishOf(r.item, accent);
  const audio = r.item.say ?? en;
  if (card.box <= 1 || r.group === 'letter') {
    return Math.random() < 0.5 || r.group === 'letter'
      ? { kind: 'choice', mode: 'listen', audio, options: options(r, (x) => englishOf(x.item, accent)), answer: en, ref: r }
      : { kind: 'choice', mode: 'meaning', prompt: en, audio, options: options(r, (x) => x.item.ru), answer: r.item.ru, ref: r };
  }
  if (card.box <= 3) {
    return { kind: 'type', mode: 'translate', prompt: r.item.ru, accepted: acceptedFor(r.item), ref: r };
  }
  return { kind: 'type', mode: 'dictation', prompt: r.item.ru, audio, accepted: acceptedFor(r.item), ref: r };
}

export function buildReview(keys: string[], cards: Record<string, SrsCard>, accent: 'gb' | 'us'): ReviewTask[] {
  return keys
    .map((k) => ({ key: k, ex: reviewExercise(k, cards[k], accent) }))
    .filter((x): x is ReviewTask => !!x.ex);
}
