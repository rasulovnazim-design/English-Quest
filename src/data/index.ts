// Loads all content files. To add a category, drop a JSON file into ./categories and
// list its id in stages.json — no engine changes needed.

import stagesData from './stages.json';
import type { Category, Item, Stage } from '../engine/types';

const files = import.meta.glob<Category>('./categories/*.json', { eager: true, import: 'default' });

export const categories: Record<string, Category> = {};
for (const cat of Object.values(files)) categories[cat.id] = cat;

export interface MapEntry {
  id: string;
  stage: number;
  title: string;
  titleEn: string;
  emoji: string;
}

export const stages: Stage[] = stagesData.stages;
export const mapEntries: MapEntry[] = stagesData.map;

export function categoryEntries(stage: number): MapEntry[] {
  return mapEntries.filter((e) => e.stage === stage);
}

export function itemKey(catId: string, itemId: string) {
  return `${catId}:${itemId}`;
}

export function allItems(cat: Category): Item[] {
  return [...(cat.letters ?? []), ...cat.words, ...cat.phrases];
}

export type ItemGroup = 'letter' | 'word' | 'phrase';

export function groupOf(cat: Category, id: string): ItemGroup {
  if (cat.phrases.some((p) => p.id === id)) return 'phrase';
  if (cat.letters?.some((l) => l.id === id)) return 'letter';
  return 'word';
}

export function findItem(key: string): { cat: Category; item: Item; isPhrase: boolean } | undefined {
  const [catId, itemId] = key.split(':');
  const cat = categories[catId];
  if (!cat) return undefined;
  const word = cat.words.find((w) => w.id === itemId);
  if (word) return { cat, item: word, isPhrase: false };
  const phrase = cat.phrases.find((p) => p.id === itemId);
  if (phrase) return { cat, item: phrase, isPhrase: true };
  const letter = cat.letters?.find((l) => l.id === itemId);
  if (letter) return { cat, item: letter, isPhrase: false };
  return undefined;
}

export function lessonKey(catId: string, lessonId: string) {
  return `${catId}/${lessonId}`;
}
