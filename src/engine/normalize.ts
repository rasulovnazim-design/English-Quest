// Text normalisation shared by the answer checker and the phrasebook search.

const APOSTROPHES = /[‘’ʼ`´]/g;

/** British ↔ American spelling pairs. Both sides normalise to the British form. */
export const SPELLING_VARIANTS: Record<string, string> = {
  color: 'colour',
  colors: 'colours',
  favorite: 'favourite',
  favorites: 'favourites',
  gray: 'grey',
  center: 'centre',
  theater: 'theatre',
  meter: 'metre',
  meters: 'metres',
  liter: 'litre',
  traveler: 'traveller',
  travelers: 'travellers',
  traveling: 'travelling',
  realize: 'realise',
  organize: 'organise',
  apologize: 'apologise',
  neighbor: 'neighbour',
  neighbors: 'neighbours',
  mom: 'mum',
  okay: 'ok',
  'o.k.': 'ok',
  program: 'programme',
  jewelry: 'jewellery',
  pajamas: 'pyjamas',
  catalog: 'catalogue',
  dialog: 'dialogue',
  check: 'cheque', // only as spelling of the payment document
  tire: 'tyre',
  mustache: 'moustache',
  donut: 'doughnut',
  practise: 'practice',
  canceled: 'cancelled',
  fiber: 'fibre',
  harbor: 'harbour',
  humor: 'humour',
  labor: 'labour',
  flavor: 'flavour'
};
// "check" means something else in many sentences (check in, check the bill); remove it from
// automatic spelling mapping — American "check" (bill) is handled by item alternatives.
delete SPELLING_VARIANTS.check;

const CONTRACTIONS: [RegExp, string][] = [
  [/\bcan't\b/g, 'can not'],
  [/\bcannot\b/g, 'can not'],
  [/\bwon't\b/g, 'will not'],
  [/\bshan't\b/g, 'shall not'],
  [/\bain't\b/g, 'is not'],
  [/\blet's\b/g, 'let us'],
  [/\b(\w+)n't\b/g, '$1 not'],
  [/\bi'm\b/g, 'i am'],
  [/\b(\w+)'re\b/g, '$1 are'],
  [/\b(\w+)'ve\b/g, '$1 have'],
  [/\b(\w+)'ll\b/g, '$1 will'],
  [/\b(\w+)'d\b/g, '$1 would'],
  // he's got / she's got / it's got → has got
  [/\b(\w+)'s got\b/g, '$1 has got'],
  [/\b(he|she|it|that|what|who|where|how|there|here|this|name|when|why)'s\b/g, '$1 is']
];

const UNITS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** Converts number words (0–100) to digits: "thirty four" → "34", "a hundred" → "100". */
function numberWordsToDigits(s: string): string {
  let out = s.replace(/\b(a|one) hundred\b/g, '100');
  out = out.replace(
    new RegExp(`\\b(${TENS.slice(2).join('|')})(?: (one|two|three|four|five|six|seven|eight|nine))?\\b`, 'g'),
    (_m, t: string, u?: string) => String(TENS.indexOf(t) * 10 + (u ? UNITS.indexOf(u) : 0))
  );
  out = out.replace(new RegExp(`\\b(${UNITS.join('|')})\\b`, 'g'), (m) => String(UNITS.indexOf(m)));
  return out;
}

export function numberToWords(n: number): string {
  if (n < 20) return UNITS[n];
  if (n === 100) return 'a hundred';
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u ? `${TENS[t]}-${UNITS[u]}` : TENS[t];
}

/** Lower case, unify apostrophes, strip punctuation. Keeps apostrophes inside words. */
export function basicClean(s: string): string {
  return s
    .toLowerCase()
    .replace(APOSTROPHES, "'")
    .replace(/[–—-]/g, ' ')
    .replace(/[.,!?;:"«»()[\]{}…/\\]/g, ' ')
    .replace(/(^|\s)'+|'+(\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface NormOptions {
  /** Convert number words to digits (default true). */
  numbers?: boolean;
}

/** Full normalisation used for comparing answers. */
export function normalize(s: string, opts: NormOptions = {}): string {
  let out = ' ' + basicClean(s) + ' ';
  out = out.replace(/ o'clock /g, ' oclock ');
  for (const [re, rep] of CONTRACTIONS) out = out.replace(re, rep);
  out = out
    .split(' ')
    .map((w) => SPELLING_VARIANTS[w] ?? w)
    .join(' ');
  if (opts.numbers !== false) out = numberWordsToDigits(out);
  return out.replace(/'/g, '').replace(/\s+/g, ' ').trim();
}

/** Normalisation for Russian search: lower case, ё → е, no punctuation. */
export function normalizeRu(s: string): string {
  return basicClean(s).replace(/ё/g, 'е');
}

export function tokens(s: string): string[] {
  return s ? s.split(' ').filter(Boolean) : [];
}
