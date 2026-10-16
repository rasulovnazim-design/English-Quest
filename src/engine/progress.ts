// Unlocking rules: stage 1 is open; each later stage opens when every category of the
// previous stage has its conversation boss passed.

import { categories, categoryEntries, lessonKey, stages } from '../data';
import type { State } from './store';
import type { Category } from './types';

export function lessonsDone(s: State, cat: Category): number {
  return cat.lessons.filter((l) => s.lessons[lessonKey(cat.id, l.id)]).length;
}

export function categoryDone(s: State, id: string): boolean {
  return !!s.bosses[id]?.passed;
}

export function bossUnlocked(s: State, cat: Category): boolean {
  return lessonsDone(s, cat) === cat.lessons.length;
}

export function stageComplete(s: State, stage: number): boolean {
  const entries = categoryEntries(stage);
  return entries.length > 0 && entries.every((e) => categories[e.id] && categoryDone(s, e.id));
}

export function stageUnlocked(s: State, stage: number): boolean {
  if (stage <= 1) return true;
  return stageComplete(s, stage - 1);
}

export function categoryUnlocked(s: State, id: string): boolean {
  const cat = categories[id];
  return !!cat && stageUnlocked(s, cat.stage);
}

export function finalBossUnlocked(s: State): boolean {
  return stages.every((st) => stageComplete(s, st.id));
}

/** Categories whose items the learner may search in the master phrasebook. */
export function unlockedCategories(s: State): Category[] {
  return Object.values(categories)
    .filter((c) => stageUnlocked(s, c.stage))
    .sort((a, b) => a.stage - b.stage || a.order - b.order);
}
