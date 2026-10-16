import { test, expect } from '@playwright/test';
import { enableTestHooks, noHorizontalScroll, playUntil } from './helpers';

test.beforeEach(async ({ page }) => {
  await enableTestHooks(page);
});

test('plays the whole first category: 5 lessons and the 3-round conversation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('./');
  await expect(page.getByText('Первые слова')).toBeVisible();
  await noHorizontalScroll(page);

  await page.getByTestId('tile-alphabet').click();
  await expect(page.getByRole('heading', { name: 'Алфавит и звуки' })).toBeVisible();
  await expect(page.getByText('Сначала пройдите все уроки')).toBeVisible();
  await noHorizontalScroll(page);

  await page.getByTestId('lesson-1').click();
  for (let lesson = 1; lesson <= 5; lesson++) {
    await playUntil(page, 'lesson-done');
    await expect(page.getByText('Урок пройден!')).toBeVisible();
    await noHorizontalScroll(page);
    if (lesson < 5) await page.getByTestId('next-lesson').click();
  }

  // The boss is unlocked after the last lesson.
  await page.getByTestId('to-boss').click();
  await expect(page.getByText('Emma')).toBeVisible();
  await page.getByTestId('boss-start').click();

  // First time: the profile form asks for the learner's details.
  await page.locator('#pf-name').fill('Anna');
  await page.locator('#pf-age').fill('34');
  await page.locator('#pf-country').fill('Russia');
  await page.locator('#pf-city').fill('Kazan');
  await page.locator('#pf-job').fill('engineer');
  await page.getByTestId('profile-save').click();

  for (let round = 1; round <= 3; round++) {
    await expect(page.getByText(`Раунд ${round} из 3`)).toBeVisible();
    await playUntil(page, 'won');
    await noHorizontalScroll(page);
    if (round < 3) await page.getByTestId('next-round').click();
  }
  await expect(page.getByText('Разговор пройден! 🏆')).toBeVisible();
  await page.getByTestId('boss-back').click();

  // Back on the category page the boss shows as passed, and XP was earned.
  await expect(page.getByTestId('boss')).toContainText('🏆');
  const xp = await page.evaluate(() => JSON.parse(localStorage.getItem('english-quest:v1')!).xp);
  expect(xp).toBeGreaterThan(500);

  // Words learned in the lessons are now scheduled for review.
  const srs = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('english-quest:v1')!).srs).length);
  expect(srs).toBeGreaterThan(40);
  expect(errors).toEqual([]);
});

test('accepts a personal answer typed freely in round 3', async ({ page }) => {
  await page.goto('./');
  // Unlock the boss by marking the lessons as done.
  await page.evaluate(() => {
    const s = {
      version: 1, xp: 0, daily: { date: '', xp: 0 }, streak: { count: 0, last: '' },
      lessons: Object.fromEntries(['1', '2', '3', '4'].map((l) => [`greetings/${l}`, { done: true, best: 100, date: '2026-01-01' }])),
      bosses: { greetings: { rounds: [1, 2], passed: false } }, srs: {},
      settings: { accent: 'gb', theme: 'auto', goal: 'normal', speaking: false, voiceURI: '' },
      profile: { name: 'Anna', age: '34', country: 'Russia', city: 'Kazan', job: 'engineer' }, seenLevel: 1
    };
    localStorage.setItem('english-quest:v1', JSON.stringify(s));
  });
  await page.goto('./#/boss/greetings');
  await page.reload();
  await page.getByTestId('round-3').click();
  const input = page.getByTestId('answer-input');
  await input.fill('hello, my name is Olga');
  await page.getByTestId('check').click();
  // Tom repeats the name the learner actually gave.
  await expect(page.getByText('Nice to meet you, Olga.')).toBeVisible();

  // A typical Russian-speaker mistake is explained in Russian.
  await input.fill('nice meet you');
  await page.getByTestId('check').click();
  await expect(page.getByTestId('feedback')).toContainText('Пропущено слово «to»');
});
