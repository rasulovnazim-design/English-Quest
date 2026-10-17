import { describe, it, expect } from 'vitest';
import { AXES, BAGS, hitsNeeded, logsFor, treeQuestions, zone } from '../../src/engine/forest';
import { categories } from '../../src/data';
import { initialState } from '../../src/engine/store';

const forest = initialState().forest;

describe('Green Forest zone', () => {
  it('every tree points at a real lesson, and every lesson of its categories has a tree', () => {
    for (const tr of zone.trees) {
      expect(categories[tr.cat]?.lessons.some((l) => l.id === tr.lesson), tr.id).toBe(true);
    }
    for (const cat of new Set(zone.trees.map((t) => t.cat))) {
      for (const l of categories[cat].lessons) expect(zone.trees.some((t) => t.cat === cat && t.lesson === l.id)).toBe(true);
      expect(zone.oaks.some((o) => o.cat === cat)).toBe(true);
    }
  });
  it('places everything inside the world, left to right', () => {
    const xs = zone.trees.map((t) => t.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    for (const x of [...xs, ...zone.oaks.map((o) => o.x), zone.gate.x]) expect(x).toBeLessThan(zone.width);
  });
});

describe('chopping rules', () => {
  it('needs only 2–4 correct answers per tree with any axe', () => {
    for (const axe of AXES) {
      for (const size of ['small', 'medium'] as const) {
        const n = hitsNeeded(size, { ...forest, axe: axe.id });
        expect(n).toBeGreaterThanOrEqual(2);
        expect(n).toBeLessThanOrEqual(4);
      }
    }
  });
  it('better axes and the beaver give more logs', () => {
    expect(logsFor('small', { ...forest, axe: 'gold' })).toBeGreaterThan(logsFor('small', forest));
    expect(logsFor('small', { ...forest, pets: ['beaver'] })).toBe(logsFor('small', forest) + 1);
  });
  it('bigger bags hold more', () => {
    expect(BAGS.map((b) => b.capacity)).toEqual([...BAGS.map((b) => b.capacity)].sort((a, b) => a - b));
  });
});

describe('tree questions', () => {
  it('little mode asks only picture or letter questions, with clear pictures', () => {
    for (const tr of zone.trees) {
      for (let run = 0; run < 5; run++) {
        const qs = treeQuestions(tr, 'little', 'gb', 4);
        expect(qs.length, tr.id).toBeGreaterThanOrEqual(4);
        for (const q of qs) {
          expect(q.kind).toBe('choice');
          if (q.kind !== 'choice') continue;
          expect(q.mode).toBe('picture');
          expect(new Set(q.options).size).toBe(q.options.length);
          expect(q.options).toContain(q.answer);
        }
      }
    }
  });
  it('school mode gives enough short questions, with at most one typing question', () => {
    for (const tr of zone.trees) {
      const qs = treeQuestions(tr, 'big', 'gb', 4);
      expect(qs.length, tr.id).toBeGreaterThanOrEqual(4);
      expect(qs.filter((q) => q.kind === 'type').length).toBeLessThanOrEqual(1);
      expect(qs.some((q) => q.kind === 'match' || q.kind === 'flash' || q.kind === 'intro')).toBe(false);
    }
  });
});
