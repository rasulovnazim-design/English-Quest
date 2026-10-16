// Turns a lesson's steps into concrete exercises.

import type { AuthoredExercise, Category, GrammarPoint, Item, Lesson, Step } from './types';
import { allItems, itemKey, groupOf, type ItemGroup } from '../data';
import { speakingEnabled } from './speech';

export interface ItemRef {
  key: string;
  item: Item;
  group: ItemGroup;
}

export type Exercise =
  | { kind: 'intro'; items: ItemRef[] }
  | { kind: 'grammar'; grammar: GrammarPoint }
  | { kind: 'match'; pairs: { ref: ItemRef; side: string }[] }
  | {
      kind: 'choice';
      mode: 'listen' | 'meaning' | 'gap' | 'choose';
      prompt?: string;
      promptRu?: string;
      audio?: string;
      options: string[];
      answer: string;
      accepted?: string[];
      why?: string;
      ref?: ItemRef;
    }
  | { kind: 'flash'; dir: 'en' | 'ru'; refs: ItemRef[] }
  | {
      kind: 'type';
      mode: 'dictation' | 'translate';
      prompt: string;
      audio?: string;
      accepted: string[];
      why?: string;
      ref?: ItemRef;
    }
  | { kind: 'tiles'; en: string; ru: string; tiles: string[]; accepted: string[]; why?: string }
  | { kind: 'speak'; text: string; ru: string; accepted: string[]; ref?: ItemRef };

export function shuffle<T>(arr: T[], rnd = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The English text to show and speak, honouring the American setting. */
export function englishOf(item: Item, accent: 'gb' | 'us'): string {
  return accent === 'us' && item.us ? item.us : item.en;
}

/** Everything that counts as a correct English answer for an item. */
export function acceptedFor(item: Item): string[] {
  return [item.en, ...(item.us ? [item.us] : []), ...(item.alt ?? [])];
}

export function refsFor(cat: Category, ids: string[]): ItemRef[] {
  const all = allItems(cat);
  return ids.map((id) => {
    const item = all.find((x) => x.id === id);
    if (!item) throw new Error(`Lesson refers to unknown item "${id}" in ${cat.id}`);
    return { key: itemKey(cat.id, id), item, group: groupOf(cat, id) };
  });
}

function distractors(target: ItemRef, pool: ItemRef[], n: number, by: (r: ItemRef) => string): string[] {
  const seen = new Set([by(target).toLowerCase()]);
  const same = pool.filter((r) => r.group === target.group);
  const out: string[] = [];
  for (const r of shuffle(same.length >= n + 1 ? same : pool)) {
    const v = by(r);
    if (!seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
    if (out.length >= n) break;
  }
  return out;
}

/** Splits a sentence into word tiles (keeping contractions like I'm together). */
export function toTiles(sentence: string): string[] {
  return sentence
    .replace(/[.,!?]+$/g, '')
    .split(/\s+/)
    .map((w) => w.replace(/[.,!?;:]+$/g, ''))
    .filter(Boolean);
}

export function buildAuthored(ex: AuthoredExercise): Exercise {
  switch (ex.type) {
    case 'gap':
      return {
        kind: 'choice',
        mode: 'gap',
        prompt: ex.en,
        promptRu: ex.ru,
        options: shuffle(Array.from(new Set([ex.answer, ...ex.options]))),
        answer: ex.answer,
        accepted: [ex.answer, ...(ex.alt ?? [])],
        why: ex.why,
        audio: ex.en.replace(/_{2,}/, ex.answer)
      };
    case 'choose':
      return {
        kind: 'choice',
        mode: 'choose',
        prompt: ex.prompt,
        promptRu: undefined,
        audio: ex.promptEn,
        options: shuffle(Array.from(new Set([ex.answer, ...ex.options]))),
        answer: ex.answer,
        why: ex.why
      };
    case 'tiles': {
      const words = toTiles(ex.en);
      return {
        kind: 'tiles',
        en: ex.en,
        ru: ex.ru,
        tiles: shuffle([...words, ...(ex.extra ?? [])]),
        accepted: [ex.en, ...(ex.alt ?? [])],
        why: ex.why
      };
    }
    case 'dictation':
      return { kind: 'type', mode: 'dictation', prompt: ex.ru, audio: ex.say, accepted: [ex.en, ...(ex.alt ?? [])] };
    case 'translate':
      return { kind: 'type', mode: 'translate', prompt: ex.ru, accepted: [ex.en, ...(ex.alt ?? [])], why: ex.why };
  }
}

export interface BuildOptions {
  accent: 'gb' | 'us';
  speaking?: boolean;
}

export function buildLesson(cat: Category, lesson: Lesson, opts: BuildOptions): Exercise[] {
  const refs = refsFor(cat, lesson.items);
  const pool = refsFor(cat, allItems(cat).map((i) => i.id));
  const en = (r: ItemRef) => englishOf(r.item, opts.accent);
  const canSpeak = opts.speaking ?? speakingEnabled();
  const cursors: Record<string, ItemRef[]> = {};
  const next = (step: string, filter: (r: ItemRef) => boolean = () => true): ItemRef => {
    if (!cursors[step]?.length) {
      const pick = refs.filter(filter);
      cursors[step] = shuffle(pick.length ? pick : refs);
    }
    return cursors[step].shift()!;
  };
  const out: Exercise[] = [];
  for (const step of lesson.steps as Step[]) {
    if (typeof step !== 'string') {
      out.push(buildAuthored(step));
      continue;
    }
    switch (step) {
      case 'intro':
        out.push({ kind: 'intro', items: refs });
        break;
      case 'grammar':
        out.push({ kind: 'grammar', grammar: cat.grammar });
        break;
      case 'match': {
        const pick = shuffle(refs).slice(0, 5);
        const allEmoji = pick.every((r) => r.item.emoji);
        out.push({
          kind: 'match',
          pairs: pick.map((r) => ({ ref: r, side: allEmoji ? `${r.item.emoji}` : r.item.ru }))
        });
        break;
      }
      case 'listen': {
        const r = next('listen');
        out.push({
          kind: 'choice',
          mode: 'listen',
          audio: r.item.say ?? en(r),
          options: shuffle([en(r), ...distractors(r, pool, 3, en)]),
          answer: en(r),
          ref: r
        });
        break;
      }
      case 'meaning': {
        const r = next('meaning');
        out.push({
          kind: 'choice',
          mode: 'meaning',
          prompt: en(r),
          audio: r.item.say ?? en(r),
          options: shuffle([r.item.ru, ...distractors(r, pool, 3, (x) => x.item.ru)]),
          answer: r.item.ru,
          ref: r
        });
        break;
      }
      case 'flash-en':
      case 'flash-ru':
        out.push({ kind: 'flash', dir: step === 'flash-en' ? 'en' : 'ru', refs: shuffle(refs).slice(0, 5) });
        break;
      case 'dictation': {
        const r = next('dictation');
        out.push({ kind: 'type', mode: 'dictation', prompt: r.item.ru, audio: r.item.say ?? en(r), accepted: acceptedFor(r.item), ref: r });
        break;
      }
      case 'speak': {
        const r = next('speak', (x) => !x.item.say);
        if (canSpeak) out.push({ kind: 'speak', text: en(r), ru: r.item.ru, accepted: acceptedFor(r.item), ref: r });
        else out.push({ kind: 'type', mode: 'translate', prompt: r.item.ru, accepted: acceptedFor(r.item), ref: r });
        break;
      }
    }
  }
  return out;
}

/** True for exercises that are answered (and can be repeated if wrong). */
export function isScored(ex: Exercise): boolean {
  return ex.kind !== 'intro' && ex.kind !== 'grammar';
}
