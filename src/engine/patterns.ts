// Pattern matching for personal answers in conversation bosses.
//
// Pattern syntax (written in the data files):
//   [i am|my name is]   a group of alternatives
//   [years old|years]?  "?" after a group or slot makes it optional
//   {name}              a slot: name, age, country, city, job, nationality, language, number, phone, any
//   plain words         must appear as written
// Patterns are normalised like answers, so "i'm" and "i am" are the same.
// Example: "[i am|my name is]? {name}" accepts "I'm Anna", "My name's Anna" and "Anna".

import { normalize } from './normalize';
import countries from '../data/countries.json';
import type { Slot } from './types';

interface CountryEntry {
  en: string;
  ru: string;
  names: string[];
  nationality: string[];
  language: string[];
}
const COUNTRY_LIST = countries as CountryEntry[];

function alternation(list: string[]): string {
  const uniq = Array.from(new Set(list.map((x) => normalize(x)).filter(Boolean)));
  uniq.sort((a, b) => b.length - a.length);
  return uniq.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
}

const WORD = "[\\p{L}][\\p{L}'-]*";
const COUNTRY_RE = alternation(COUNTRY_LIST.flatMap((c) => c.names));
const NATIONALITY_RE = alternation(COUNTRY_LIST.flatMap((c) => c.nationality));
const LANGUAGE_RE = alternation(COUNTRY_LIST.flatMap((c) => c.language).concat(['english', 'russian']));

export const SLOT_RE: Record<Slot, string> = {
  name: `(${WORD}(?: ${WORD}){0,2})`,
  age: '(\\d{1,3})',
  country: `((?:the )?(?:${COUNTRY_RE}))`,
  city: `(${WORD}(?: ${WORD}){0,3})`,
  job: `(${WORD}(?: ${WORD}){0,3})`,
  nationality: `(${NATIONALITY_RE})`,
  language: `(${LANGUAGE_RE})`,
  number: '(\\d{1,3})',
  phone: '((?:\\d|oh|o|double|triple| )+)',
  any: '(.+?)'
};

/** Words that can never be a name/city/job on their own (avoids "I am" matching {name}). */
const STOP = new Set(['i', 'am', 'is', 'are', 'my', 'name', 'a', 'an', 'the', 'from', 'in', 'live', 'work', 'not', 'yes', 'no']);

interface Compiled {
  re: RegExp;
  slots: Slot[];
}

const cache = new Map<string, Compiled>();

export function compilePattern(pattern: string): Compiled {
  const hit = cache.get(pattern);
  if (hit) return hit;
  const slots: Slot[] = [];
  const parts: string[] = [];
  const re = /\[([^\]]+)\](\?)?|\{(\w+)\}(\?)?|([^\s[{]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pattern))) {
    if (m[1] !== undefined) {
      const alts = m[1].split('|').map((a) => normalize(a)).filter((a) => a.length > 0);
      const body = `(?:${alts.map((a) => a.replace(/[.*+?^${}()|\\]/g, '\\$&')).join('|')})`;
      parts.push(m[2] ? `(?:${body} )?` : `${body} `);
    } else if (m[3] !== undefined) {
      const slot = m[3] as Slot;
      if (!(slot in SLOT_RE)) throw new Error(`Unknown slot {${slot}} in pattern "${pattern}"`);
      slots.push(slot);
      parts.push(m[4] ? `(?:${SLOT_RE[slot]} )?` : `${SLOT_RE[slot]} `);
    } else if (m[5] !== undefined) {
      const w = normalize(m[5]);
      if (w) parts.push(`${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} `);
    }
  }
  const compiled = { re: new RegExp(`^${parts.join('')}$`, 'u'), slots };
  cache.set(pattern, compiled);
  return compiled;
}

export interface PatternMatch {
  values: Partial<Record<Slot, string>>;
}

function validSlot(slot: Slot, value: string | undefined): boolean {
  if (value === undefined) return true;
  const v = value.trim();
  if (slot === 'age') {
    const n = Number(v);
    return n >= 1 && n <= 120;
  }
  if (slot === 'name' || slot === 'city') return !v.split(' ').some((w) => STOP.has(w));
  if (slot === 'job') {
    const words = v.split(' ');
    return !STOP.has(words[0]) && !STOP.has(words[words.length - 1]);
  }
  return v.length > 0;
}

/** Tries to match a free answer against one pattern. Returns the captured slot values. */
export function matchPattern(answer: string, pattern: string): PatternMatch | null {
  const { re, slots } = compilePattern(pattern);
  const m = re.exec(normalize(answer) + ' ');
  if (!m) return null;
  const values: Partial<Record<Slot, string>> = {};
  for (let i = 0; i < slots.length; i++) {
    const v = m[i + 1];
    if (!validSlot(slots[i], v)) return null;
    if (v !== undefined) values[slots[i]] = v.trim();
  }
  return { values };
}

export function matchAnyPattern(answer: string, patterns: string[]): PatternMatch | null {
  for (const p of patterns) {
    const r = matchPattern(answer, p);
    if (r) return r;
  }
  return null;
}

/** Looks up a country by any name in English or Russian. */
export function findCountry(name: string): CountryEntry | undefined {
  const n = normalize(name).replace(/^the /, '');
  return COUNTRY_LIST.find(
    (c) => c.names.some((x) => normalize(x).replace(/^the /, '') === n) || c.ru.toLowerCase() === name.trim().toLowerCase()
  );
}

export { COUNTRY_LIST };
