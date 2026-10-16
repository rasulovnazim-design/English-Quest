// The answer checker: compares a learner's English answer with the accepted answers.
// - ignores capitals and punctuation
// - treats contractions and full forms as equal (I'm = I am)
// - accepts British and American spellings and number words or digits
// - allows small typos on longer words, reporting the right spelling
// - explains common mistakes in Russian

import { normalize, tokens } from './normalize';
import { t } from '../locale';

export type CheckStatus = 'correct' | 'typo' | 'wrong';

export interface CheckResult {
  status: CheckStatus;
  /** The accepted answer closest to what the learner wrote, as written in the data. */
  expected: string;
  /** For typos: the words that were misspelt and how to spell them. */
  typos?: { wrong: string; right: string }[];
  /** Russian explanation when the answer is wrong. */
  why?: string;
}

/** Damerau–Levenshtein distance (optimal string alignment). */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

/** Pairs of real words that must never be accepted as typos of each other. */
const CONFUSABLE: string[][] = [
  ['three', 'there'],
  ['form', 'from'],
  ['quite', 'quiet'],
  ['then', 'than'],
  ['were', 'where'],
  ['ship', 'sheep'],
  ['sit', 'seat'],
  ['live', 'leave'],
  ['this', 'these'],
  ['that', 'what'],
  ['he', 'she'],
  ['his', 'her'],
  ['want', 'went'],
  ['thirteen', 'thirty'],
  ['fourteen', 'forty'],
  ['fifteen', 'fifty'],
  ['sixteen', 'sixty'],
  ['seventeen', 'seventy'],
  ['eighteen', 'eighty'],
  ['nineteen', 'ninety'],
  ['son', 'sun'],
  ['wine', 'vine'],
  ['west', 'vest'],
  ['think', 'sink'],
  ['bad', 'bed'],
  ['man', 'men'],
  ['woman', 'women'],
  ['does', 'dose'],
  ['now', 'know'],
  ['hear', 'here'],
  ['right', 'write'],
  ['meet', 'meat'],
  ['week', 'weak'],
  ['buy', 'by'],
  ['your', 'you']
];
const CONFUSABLE_SET = new Set(CONFUSABLE.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]));

/** How many letter mistakes are allowed in a word of this length. */
export function allowedTypos(len: number): number {
  if (len >= 8) return 2;
  if (len >= 4) return 1;
  return 0;
}

function tokenTypo(answer: string, expected: string, loose: boolean): boolean {
  if (answer === expected) return true;
  if (/\d/.test(answer) || /\d/.test(expected)) return false;
  if (CONFUSABLE_SET.has(`${answer}|${expected}`)) return false;
  const limit = allowedTypos(expected.length) + (loose ? 1 : 0);
  return limit > 0 && editDistance(answer, expected) <= limit;
}

interface Compare {
  status: CheckStatus;
  typos: { wrong: string; right: string }[];
  distance: number;
}

function compareOne(answer: string, target: string, loose: boolean): Compare {
  const na = normalize(answer);
  const nt = normalize(target);
  if (na === nt) return { status: 'correct', typos: [], distance: 0 };
  if (na.replace(/ /g, '') === nt.replace(/ /g, '')) {
    return { status: 'typo', typos: [{ wrong: answer.trim(), right: target }], distance: 1 };
  }
  const ta = tokens(na);
  const tt = tokens(nt);
  if (ta.length === tt.length) {
    const typos: { wrong: string; right: string }[] = [];
    let ok = true;
    for (let i = 0; i < tt.length; i++) {
      if (ta[i] === tt[i]) continue;
      if (tokenTypo(ta[i], tt[i], loose)) typos.push({ wrong: ta[i], right: tt[i] });
      else {
        ok = false;
        break;
      }
    }
    if (ok) return { status: 'typo', typos, distance: typos.length };
  }
  return { status: 'wrong', typos: [], distance: editDistance(na, nt) };
}

export interface CheckOptions {
  /** More generous typo tolerance, e.g. for speech recognition results. */
  loose?: boolean;
  /** Specific explanation from the data, shown when the answer is wrong. */
  why?: string;
}

/** Checks an answer against one or more accepted answers. The first accepted answer is the main one. */
export function checkAnswer(answer: string, accepted: string[], opts: CheckOptions = {}): CheckResult {
  const list = accepted.filter((a) => a && a.trim());
  let best: { target: string; cmp: Compare } | null = null;
  for (const target of list) {
    const cmp = compareOne(answer, target, !!opts.loose);
    if (cmp.status === 'correct') return { status: 'correct', expected: target };
    if (
      !best ||
      (cmp.status === 'typo' && best.cmp.status !== 'typo') ||
      (cmp.status === best.cmp.status && cmp.distance < best.cmp.distance)
    ) {
      best = { target, cmp };
    }
  }
  if (!best) return { status: 'wrong', expected: '' };
  if (best.cmp.status === 'typo') {
    return { status: 'typo', expected: best.target, typos: best.cmp.typos };
  }
  const main = list[0];
  const diagnosed = explainMistake(answer, best.cmp.distance < normalize(main).length ? best.target : main);
  const why = [diagnosed, opts.why].filter(Boolean).join(' ') || t('why.generic');
  return { status: 'wrong', expected: best.target, why };
}

const ARTICLES = new Set(['a', 'an', 'the']);
const BE = new Set(['am', 'is', 'are']);
const QUESTION_START = new Set(['do', 'does', 'did', 'am', 'is', 'are', 'can', 'have', 'has', 'was', 'were', 'what', 'where', 'how', 'who', 'when', 'why', 'which']);

function sameMultiset(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return [...a].sort().join(' ') === [...b].sort().join(' ');
}

function isSubsequence(short: string[], long: string[]): boolean {
  let i = 0;
  for (const w of long) if (w === short[i]) i++;
  return i === short.length;
}

function missing(short: string[], long: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  for (const w of long) {
    if (w === short[i]) i++;
    else out.push(w);
  }
  return out;
}

/** Returns a Russian explanation of a typical mistake, or undefined if nothing specific is found. */
export function explainMistake(answer: string, expected: string): string | undefined {
  const a = tokens(normalize(answer));
  const e = tokens(normalize(expected));
  if (!a.length) return undefined;

  if (/\bi have \d+ years?\b/.test(a.join(' ')) || /\b(have|has) \d+ years?\b/.test(a.join(' '))) {
    return t('why.ageHave');
  }

  if (sameMultiset(a, e)) {
    return QUESTION_START.has(e[0]) || expected.trim().endsWith('?') ? t('why.wordOrderQuestion') : t('why.wordOrder');
  }

  const aNoArt = a.filter((w) => !ARTICLES.has(w));
  const eNoArt = e.filter((w) => !ARTICLES.has(w));
  if (aNoArt.join(' ') === eNoArt.join(' ')) {
    const aArt = a.filter((w) => ARTICLES.has(w));
    const eArt = e.filter((w) => ARTICLES.has(w));
    if (aArt.length < eArt.length) return t('why.missingArticle');
    if (aArt.some((w) => w === 'a' || w === 'an') && eArt.some((w) => w === 'a' || w === 'an')) {
      return t('why.aAn');
    }
    return t('why.article');
  }

  if (a.length + 1 === e.length && isSubsequence(a, e)) {
    const [word] = missing(a, e);
    if (BE.has(word)) return t('why.missingBe');
    if ((word === 'do' || word === 'does') && e[0] === word) return t('why.missingDo');
    return t('why.missingWord', { word });
  }

  if (a.length === e.length) {
    const diffs: number[] = [];
    for (let i = 0; i < e.length; i++) if (a[i] !== e[i]) diffs.push(i);
    if (diffs.length === 1) {
      const i = diffs[0];
      const aw = a[i];
      const ew = e[i];
      const prev = e[i - 1];
      const before = e.slice(Math.max(0, i - 3), i);
      if ((before.includes('does') || before.includes('did')) && (aw === ew + 's' || aw === ew + 'es')) return t('why.doesS');
      if (aw + 's' === ew || aw + 'es' === ew || (aw.endsWith('y') && aw.slice(0, -1) + 'ies' === ew)) {
        return ['he', 'she', 'it'].includes(prev) ? t('why.thirdPersonS') : t('why.plural');
      }
      if ((aw === 'a' && ew === 'an') || (aw === 'an' && ew === 'a')) return t('why.aAn');
      return t('why.wrongWord', { wrong: aw, right: ew });
    }
  }

  if (a.length === e.length + 1 && isSubsequence(e, a)) {
    const [word] = missing(e, a);
    return t('why.extraWord', { word });
  }
  return undefined;
}

/** Checks a word typed into a gap. */
export function checkGap(answer: string, accepted: string[], why?: string): CheckResult {
  return checkAnswer(answer, accepted, { why });
}
