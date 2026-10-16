import { describe, it, expect } from 'vitest';
import { newCard, review, dueKeys, addDays } from '../../src/engine/srs';
import { scoreExercise, levelFromXp, rankForLevel } from '../../src/engine/xp';

const D = '2026-01-10';

describe('spaced repetition', () => {
  it('schedules a new item for tomorrow', () => {
    expect(newCard(D).due).toBe('2026-01-11');
  });
  it('increases the interval when remembered', () => {
    let c = newCard(D);
    c = review(c, 'good', '2026-01-11');
    expect(c.box).toBe(2);
    expect(c.due).toBe(addDays('2026-01-11', 3));
    c = review(c, 'good', c.due);
    expect(c.box).toBe(3);
  });
  it('brings forgotten items back sooner', () => {
    let c = { box: 4, due: D, seen: 5, lapses: 0 };
    c = review(c, 'again', D);
    expect(c.box).toBe(0);
    expect(c.due).toBe(D);
    expect(c.lapses).toBe(1);
  });
  it('keeps the box after a hint', () => {
    const c = review({ box: 3, due: D, seen: 3, lapses: 0 }, 'hard', D);
    expect(c.box).toBe(3);
  });
  it('lists due items weakest first', () => {
    const keys = dueKeys(
      {
        a: { box: 3, due: '2026-01-01', seen: 1, lapses: 0 },
        b: { box: 0, due: '2026-01-09', seen: 1, lapses: 2 },
        c: { box: 1, due: '2026-02-01', seen: 1, lapses: 0 }
      },
      D
    );
    expect(keys).toEqual(['b', 'a']);
  });
});

describe('xp', () => {
  it('gives bonuses for first try and no hints', () => {
    expect(scoreExercise({ correct: true, firstTry: true, hints: 0 })).toBe(20);
    expect(scoreExercise({ correct: true, firstTry: false, hints: 0 })).toBe(15);
    expect(scoreExercise({ correct: true, firstTry: true, hints: 1 })).toBe(12);
    expect(scoreExercise({ correct: false, firstTry: false, hints: 0 })).toBe(0);
  });
  it('computes levels and ranks', () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(200).level).toBe(2);
    expect(rankForLevel(1).en).toBe('Beginner');
    expect(rankForLevel(25).en).toBe('Conversationalist');
  });
});
