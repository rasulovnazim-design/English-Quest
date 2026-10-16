import { describe, it, expect } from 'vitest';
import { categories, mapEntries, allItems } from '../../src/data';
import { compilePattern } from '../../src/engine/patterns';
import { buildLesson } from '../../src/engine/exercises';
import { checkFree, fill, profileVars } from '../../src/engine/boss';
import { checkAnswer } from '../../src/engine/checker';
import type { Category } from '../../src/engine/types';

const cats = Object.values(categories) as Category[];

describe('content files', () => {
  it('has at least one category', () => {
    expect(cats.length).toBeGreaterThan(0);
  });

  for (const cat of cats) {
    describe(cat.id, () => {
      it('is listed on the map', () => {
        expect(mapEntries.find((e) => e.id === cat.id)?.stage).toBe(cat.stage);
      });
      it('has 15–25 words, 8–12 phrases and 3–5 lessons', () => {
        expect(cat.words.length).toBeGreaterThanOrEqual(15);
        expect(cat.words.length).toBeLessThanOrEqual(25);
        expect(cat.phrases.length).toBeGreaterThanOrEqual(8);
        expect(cat.phrases.length).toBeLessThanOrEqual(12);
        expect(cat.lessons.length).toBeGreaterThanOrEqual(3);
        expect(cat.lessons.length).toBeLessThanOrEqual(5);
      });
      it('has unique item ids, all with English, Russian and IPA', () => {
        const items = allItems(cat);
        const ids = items.map((i) => i.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const i of items) {
          expect(i.en, i.id).toBeTruthy();
          expect(i.ru, i.id).toBeTruthy();
          expect(i.ipa, i.id).toMatch(/^\/.+\/$/);
        }
      });
      it('introduces every word and phrase in some lesson', () => {
        const taught = new Set(cat.lessons.flatMap((l) => l.items));
        for (const i of [...cat.words, ...cat.phrases]) expect(taught.has(i.id), i.id).toBe(true);
      });
      it('builds every lesson', () => {
        for (const l of cat.lessons) {
          const ex = buildLesson(cat, l, { accent: 'gb', speaking: true });
          expect(ex.length, l.id).toBeGreaterThan(5);
        }
      });
      it('has valid authored exercises', () => {
        for (const l of cat.lessons) {
          for (const s of l.steps) {
            if (typeof s === 'string') continue;
            if (s.type === 'gap') {
              expect(s.en, s.en).toContain('___');
              expect(s.options, s.en).not.toContain(s.answer);
            }
            if (s.type === 'choose') expect(s.options).not.toContain(s.answer);
            if (s.type === 'translate' || s.type === 'tiles') {
              expect(checkAnswer(s.en, [s.en, ...(s.alt ?? [])]).status).toBe('correct');
            }
          }
        }
      });
      it('has a grammar point and typical mistakes', () => {
        expect(cat.grammar.explanation.length).toBeGreaterThan(0);
        expect(cat.grammar.examples.length).toBeGreaterThan(0);
        expect(cat.mistakes.length).toBeGreaterThanOrEqual(3);
      });
      it('has a boss with a valid conversation graph', () => {
        const ids = new Set(cat.boss.nodes.map((n) => n.id));
        expect(ids.has(cat.boss.start)).toBe(true);
        expect(cat.boss.nodes.some((n) => n.end)).toBe(true);
        for (const n of cat.boss.nodes) {
          if (n.next) expect(ids.has(n.next), `${n.id} → ${n.next}`).toBe(true);
          if (!n.end && !n.next) expect(n.reply?.answers.every((a) => a.next), n.id).toBe(true);
          for (const a of n.reply?.answers ?? []) {
            if (a.next) expect(ids.has(a.next), `${n.id} → ${a.next}`).toBe(true);
            for (const p of a.patterns ?? []) expect(() => compilePattern(p)).not.toThrow();
          }
          if (n.reply) {
            const vars = profileVars({ name: 'Anna', age: '34', country: 'Russia', city: 'Kazan', job: 'engineer' });
            for (const a of n.reply.answers) {
              const r = checkFree(n.reply, fill(a.say, vars), vars);
              expect(r.check.status, `${n.id}: "${a.say}"`).toBe('correct');
              expect(r.answer, `${n.id}: "${a.say}" picks its branch`).toBe(a);
            }
            for (const w of n.reply.wrong ?? []) {
              expect(checkFree(n.reply, fill(w, vars), vars).check.status, `${n.id}: wrong option "${w}" must be rejected`).toBe('wrong');
            }
            expect(n.reply.hint).toBeTruthy();
            expect((n.reply.wrong ?? []).length, n.id).toBeGreaterThanOrEqual(2);
          }
        }
      });
    });
  }
});
