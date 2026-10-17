// Rules of the forest game: tools, how many correct answers fell a tree, logs and coins,
// and which questions a tree asks (short, and picture/audio-only for little children).

import zoneData from '../data/zones/green-forest.json';
import { categories, lessonKey } from '../data';
import { buildLesson, englishOf, shuffle, refsFor, type Exercise, type ItemRef } from './exercises';
import type { ForestState, State } from './store';

export interface ZoneTree {
  id: string;
  cat: string;
  lesson: string;
  size: 'small' | 'medium';
  x: number;
}

export interface Zone {
  id: string;
  title: string;
  titleEn: string;
  width: number;
  shop: { x: number };
  sawmill: { x: number };
  golden: { x: number };
  trees: ZoneTree[];
  oaks: { cat: string; x: number }[];
  gate: { x: number; title: string; titleEn: string };
}

export const zone = zoneData as Zone;

export interface Tool {
  id: string;
  name: string; // Russian
  emoji: string;
  price: number;
}

export interface Axe extends Tool {
  /** Damage per correct answer. */
  power: number;
  /** Extra logs per felled tree. */
  bonus: number;
  colour: string;
}

export const AXES: Axe[] = [
  { id: 'stone', name: 'Каменный топор', emoji: '🪨', price: 0, power: 2, bonus: 0, colour: '#8d99ae' },
  { id: 'iron', name: 'Железный топор', emoji: '⚙️', price: 60, power: 3, bonus: 1, colour: '#cfd8e3' },
  { id: 'gold', name: 'Золотой топор', emoji: '🥇', price: 200, power: 4, bonus: 2, colour: '#ffd32a' },
  { id: 'diamond', name: 'Алмазный топор', emoji: '💎', price: 500, power: 4, bonus: 4, colour: '#5ce1e6' }
];

export interface Bag extends Tool {
  capacity: number;
}

export const BAGS: Bag[] = [
  { id: 'basket', name: 'Корзинка', emoji: '🧺', price: 0, capacity: 6 },
  { id: 'backpack', name: 'Рюкзак', emoji: '🎒', price: 40, capacity: 12 },
  { id: 'cart', name: 'Тележка', emoji: '🛒', price: 150, capacity: 30 }
];

export interface Pet extends Tool {
  /** Description of the bonus, in Russian. */
  perk: string;
}

export const PETS: Pet[] = [
  { id: 'beaver', name: 'Бобёр', emoji: '🦫', price: 120, perk: '+1 бревно с каждого дерева' },
  { id: 'owl', name: 'Сова', emoji: '🦉', price: 250, perk: '+1 монетка за каждый верный ответ' }
];

/** Tree "health": a small tree needs 3 correct answers with the stone axe, a medium one 4. */
const HP = { small: 6, medium: 8, golden: 6 };
const BASE_LOGS = { small: 2, medium: 3, golden: 6 };
export const COINS_PER_LOG = 3;
/** Felled trees grow back after this long, ready to be chopped (and practised) again. */
export const REGROW_MS = 90_000;

export function axeOf(f: ForestState): Axe {
  return AXES.find((a) => a.id === f.axe) ?? AXES[0];
}

export function bagOf(f: ForestState): Bag {
  return BAGS.find((b) => b.id === f.bag) ?? BAGS[0];
}

/** Correct answers needed to fell a tree: never fewer than 2, never more than 4. */
export function hitsNeeded(size: keyof typeof HP, f: ForestState): number {
  return Math.min(4, Math.max(2, Math.ceil(HP[size] / axeOf(f).power)));
}

export function logsFor(size: keyof typeof BASE_LOGS, f: ForestState): number {
  return BASE_LOGS[size] + axeOf(f).bonus + (f.pets.includes('beaver') ? 1 : 0);
}

/** A tree can be chopped once the tree before it has been felled at least once. */
export function treeUnlocked(s: State, index: number): boolean {
  if (index === 0) return true;
  return (s.forest.trees[zone.trees[index - 1].id]?.felled ?? 0) > 0;
}

export function treeGrowing(s: State, id: string, now = Date.now()): boolean {
  const t = s.forest.trees[id];
  return !!t && t.regrowAt > now;
}

/** The Giant Oak of a category opens when all its trees have been felled once. */
export function oakUnlocked(s: State, cat: string): boolean {
  return zone.trees.filter((t) => t.cat === cat).every((t) => (s.forest.trees[t.id]?.felled ?? 0) > 0);
}

export function lessonKeyOf(t: ZoneTree) {
  return lessonKey(t.cat, t.lesson);
}

// ---------- questions ----------

/** Words that make a clear picture question (an emoji that cannot be confused with another). */
export function pictureable(r: ItemRef): boolean {
  return r.group === 'word' && !!r.item.emoji && r.item.pic !== false;
}

/** For 3–6 year olds: hear a word, tap the picture. No reading needed. */
function pictureQuestion(target: ItemRef, pool: ItemRef[], accent: 'gb' | 'us'): Exercise {
  const others = shuffle(pool.filter((r) => r.key !== target.key && r.item.emoji !== target.item.emoji)).slice(0, 2);
  return {
    kind: 'choice',
    mode: 'picture',
    audio: target.item.say ?? englishOf(target.item, accent),
    options: shuffle([target.item.emoji!, ...others.map((o) => o.item.emoji!)]),
    answer: target.item.emoji!,
    ref: target
  };
}

/** Letters for little ones: hear a letter, tap it (letters are shapes, not reading). */
function letterQuestion(target: ItemRef, pool: ItemRef[]): Exercise {
  const others = shuffle(pool.filter((r) => r.group === 'letter' && r.key !== target.key)).slice(0, 2);
  return {
    kind: 'choice',
    mode: 'picture',
    audio: target.item.say ?? target.item.en,
    options: shuffle([target.item.en, ...others.map((o) => o.item.en)]),
    answer: target.item.en,
    ref: target
  };
}

/** Exercises that suit chopping: quick ones, no long matching or self-graded flashcards. */
function quick(ex: Exercise): boolean {
  return ex.kind === 'choice' || ex.kind === 'tiles' || ex.kind === 'type' || ex.kind === 'speak';
}

/**
 * Questions for one tree. Returns a few more than needed so a wrong answer can be followed
 * by a fresh question. Little children get picture/letter questions only.
 */
export function treeQuestions(t: ZoneTree, mode: 'little' | 'big', accent: 'gb' | 'us', count: number): Exercise[] {
  const cat = categories[t.cat];
  const lesson = cat.lessons.find((l) => l.id === t.lesson)!;
  if (mode === 'little') {
    const refs = refsFor(cat, lesson.items);
    const catRefs = refsFor(cat, [...(cat.letters ?? []), ...cat.words].map((i) => i.id));
    let targets = refs.filter((r) => r.group === 'letter' || pictureable(r));
    if (targets.length < 3) targets = catRefs.filter((r) => r.group === 'letter' || pictureable(r));
    const picturePool = catRefs.filter(pictureable);
    return shuffle(targets)
      .slice(0, count + 3)
      .map((r) => (r.group === 'letter' ? letterQuestion(r, catRefs) : pictureQuestion(r, picturePool, accent)));
  }
  const all = buildLesson(cat, lesson, { accent }).filter(quick);
  // Keep the order easy → harder, but pick a random spread from across the lesson.
  const picked = shuffle(all.map((ex, i) => ({ ex, i })))
    .slice(0, count + 3)
    .sort((a, b) => a.i - b.i);
  // At most one typing question per tree, so it stays quick.
  let typed = 0;
  return picked
    .map((p) => p.ex)
    .filter((ex) => ex.kind !== 'type' || typed++ < 1);
}

export function newWordsFor(t: ZoneTree): ItemRef[] {
  const cat = categories[t.cat];
  const lesson = cat.lessons.find((l) => l.id === t.lesson)!;
  return refsFor(cat, lesson.items);
}
