// XP, levels and ranks.

export const XP = {
  correct: 10,
  firstTry: 5,
  noHint: 5,
  hintCost: 3,
  flashcard: 5,
  bossRound: 30,
  bossPassed: 100,
  lessonDone: 20
};

/** XP needed to go from level n to n+1. */
export function levelStep(n: number): number {
  return 200 + 50 * (n - 1);
}

export function levelFromXp(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let rest = xp;
  while (rest >= levelStep(level)) {
    rest -= levelStep(level);
    level++;
  }
  return { level, into: rest, need: levelStep(level) };
}

export const RANKS = [
  { key: 'beginner', en: 'Beginner', minLevel: 1, emoji: '🌱' },
  { key: 'explorer', en: 'Explorer', minLevel: 6, emoji: '🧭' },
  { key: 'traveller', en: 'Traveller', minLevel: 12, emoji: '🎒' },
  { key: 'speaker', en: 'Speaker', minLevel: 18, emoji: '🗣️' },
  { key: 'conversationalist', en: 'Conversationalist', minLevel: 25, emoji: '🏆' }
] as const;

export function rankForLevel(level: number) {
  let r: (typeof RANKS)[number] = RANKS[0];
  for (const rank of RANKS) if (level >= rank.minLevel) r = rank;
  return r;
}

export const DAILY_GOALS = { easy: 100, normal: 200, serious: 400 };

export interface ScoreInput {
  correct: boolean;
  firstTry: boolean;
  hints: number;
}

/** XP for one exercise. Hints cost XP but the total never goes below zero. */
export function scoreExercise({ correct, firstTry, hints }: ScoreInput): number {
  if (!correct) return 0;
  let xp = XP.correct;
  if (firstTry) xp += XP.firstTry;
  if (hints === 0) xp += XP.noHint;
  xp -= hints * XP.hintCost;
  return Math.max(0, xp);
}
