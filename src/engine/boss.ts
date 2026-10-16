// Conversation boss logic: filling templates, building options and tiles, checking free replies.

import type { Boss, BossAnswer, BossNode, BossReply, Profile, Slot } from './types';
import { checkAnswer, type CheckResult } from './checker';
import { matchAnyPattern, findCountry } from './patterns';
import { shuffle, toTiles } from './exercises';

export type Vars = Record<string, string>;

function article(word: string): string {
  return /^[aeiou]/i.test(word.trim()) && !/^(uni|eu|one|use)/i.test(word.trim()) ? 'an' : 'a';
}

const titleCase = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

/** Template variables from the learner's profile, with sensible defaults. */
export function profileVars(p: Profile): Vars {
  const country = findCountry(p.country || 'Russia');
  const job = (p.job || 'manager').trim().toLowerCase().replace(/^(a|an) /, '');
  return {
    name: titleCase(p.name.trim() || 'Alex'),
    age: String(p.age || '30').trim(),
    country: country?.en ?? titleCase(p.country.trim()),
    city: titleCase(p.city.trim() || 'Moscow'),
    job,
    a_job: `${article(job)} ${job}`,
    nationality: country?.nationality[0] ?? 'Russian',
    language: country?.language[0] ?? 'Russian'
  };
}

export function fill(template: string, vars: Vars): string {
  return template.replace(/\{(\w+)\}/g, (_m, k: string) => vars[k] ?? `{${k}}`);
}

/** Updates variables from slot values the learner gave in a free answer. */
export function varsFromSlots(values: Partial<Record<Slot, string>>, vars: Vars): Vars {
  const out = { ...vars };
  if (values.name) out.name = titleCase(values.name);
  if (values.age) out.age = values.age;
  if (values.city) out.city = titleCase(values.city);
  if (values.country) {
    const c = findCountry(values.country);
    out.country = c?.en ?? titleCase(values.country);
    if (c) {
      out.nationality = c.nationality[0];
      out.language = c.language[0];
    }
  }
  if (values.job) {
    out.job = values.job;
    out.a_job = `${article(values.job)} ${values.job}`;
  }
  return out;
}

export function nodeById(boss: Boss, id: string): BossNode {
  const n = boss.nodes.find((x) => x.id === id);
  if (!n) throw new Error(`Boss node "${id}" not found`);
  return n;
}

export interface Option {
  text: string;
  answer?: BossAnswer;
}

/** Round 1: correct replies and wrong options, shuffled. */
export function replyOptions(reply: BossReply, vars: Vars): Option[] {
  const right = reply.answers.map((a) => ({ text: fill(a.say, vars), answer: a }));
  const wrong = (reply.wrong ?? []).map((w) => ({ text: fill(w, vars) }));
  return shuffle([...right, ...wrong.slice(0, Math.max(1, 4 - right.length))]);
}

/** Round 2: tiles for the first answer plus wrong tiles. */
export function replyTiles(reply: BossReply, vars: Vars): { tiles: string[]; target: string; answer: BossAnswer } {
  const answer = reply.answers[0];
  const target = fill(answer.say, vars);
  return { tiles: shuffle([...toTiles(target), ...(reply.extraTiles ?? [])]), target, answer };
}

export interface FreeResult {
  check: CheckResult;
  answer?: BossAnswer;
  vars: Vars;
}

/** Round 3: checks a typed or spoken reply against every accepted answer form. */
export function checkFree(reply: BossReply, input: string, vars: Vars, loose = false): FreeResult {
  for (const a of reply.answers) {
    if (a.patterns?.length) {
      const m = matchAnyPattern(input, a.patterns);
      if (m) return { check: { status: 'correct', expected: fill(a.say, vars) }, answer: a, vars: varsFromSlots(m.values, vars) };
    }
  }
  let best: FreeResult | null = null;
  for (const a of reply.answers) {
    const accepted = [fill(a.say, vars), ...(a.accept ?? []).map((x) => fill(x, vars))];
    const check = checkAnswer(input, accepted, { loose, why: reply.why });
    if (check.status === 'correct') return { check, answer: a, vars };
    if (check.status === 'typo' && (!best || best.check.status !== 'typo')) best = { check, answer: a, vars };
    if (!best) best = { check, vars };
  }
  return best ?? { check: { status: 'wrong', expected: fill(reply.answers[0].say, vars), why: reply.why }, vars };
}

/** The next node after a reply (or after an NPC-only line). */
export function nextNode(node: BossNode, answer?: BossAnswer): string | undefined {
  return answer?.next ?? node.next;
}

/** Number of learner turns on the main path (for the progress bar). */
export function countTurns(boss: Boss): number {
  let id: string | undefined = boss.start;
  let n = 0;
  const seen = new Set<string>();
  while (id && !seen.has(id)) {
    seen.add(id);
    const node = nodeById(boss, id);
    if (node.reply) n++;
    if (node.end) break;
    id = nextNode(node, node.reply?.answers[0]);
  }
  return n;
}
