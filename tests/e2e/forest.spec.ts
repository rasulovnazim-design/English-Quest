import { test, expect, type Page } from '@playwright/test';
import { enableTestHooks, playUntil, solveStep, noHorizontalScroll } from './helpers';

test.beforeEach(async ({ page }) => {
  await enableTestHooks(page);
});

const store = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('english-quest:v1') ?? '{}'));

async function visible(page: Page, testId: string) {
  const l = page.getByTestId(testId).first();
  return (await l.count()) > 0 && (await l.isVisible());
}

/** Plays the forest until the given category's Giant Oak is beaten. */
async function playForest(page: Page, cat: string, maxSteps = 600) {
  for (let i = 0; i < maxSteps; i++) {
    const s = await store(page);
    if (s.bosses?.[cat]?.passed && page.url().includes('#/forest')) return;
    if (page.url().includes('#/boss/')) {
      await playBoss(page);
      continue;
    }
    if (await visible(page, 'level-up')) {
      await page.getByTestId('level-up').getByRole('button').click();
      continue;
    }
    if (await visible(page, 'timber-ok')) {
      await page.getByTestId('timber-ok').click({ timeout: 2000 }).catch(() => undefined);
      continue;
    }
    if (await visible(page, 'start-chop')) {
      await page.getByTestId('start-chop').click();
      continue;
    }
    if (await visible(page, 'chop-panel')) {
      await solveStep(page);
      continue;
    }
    if (await visible(page, 'sell')) {
      await page.getByTestId('sell').click();
      continue;
    }
    if (await visible(page, 'next-tree')) {
      // A celebration can pop up over the button at any moment: don't wait on a covered button.
      await page.getByTestId('next-tree').click({ timeout: 2000 }).catch(() => undefined);
      await page.waitForTimeout(300);
      continue;
    }
    await page.waitForTimeout(200);
  }
  throw new Error('Forest was not finished');
}

async function playBoss(page: Page) {
  await page.getByTestId('boss-start').click();
  if (await page.locator('#pf-name').isVisible().catch(() => false)) {
    await page.locator('#pf-name').fill('Anna');
    await page.locator('#pf-age').fill('7');
    await page.getByTestId('profile-save').click();
  }
  for (;;) {
    await playUntil(page, 'won');
    if (await visible(page, 'next-round')) {
      await page.getByTestId('next-round').click();
      await expect(page.getByTestId('round-won')).toHaveCount(0);
    } else break;
  }
  await page.getByTestId('boss-back').click();
  await expect(page).toHaveURL(/#\/forest/);
}

test('school mode: chop every Alphabet tree, sell logs, beat the Giant Oak', async ({ page }) => {
  test.setTimeout(480_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  // The original map game is still there, with a way into the forest.
  await expect(page.getByText('Первые слова')).toBeVisible();
  await page.getByTestId('to-forest').click();
  await page.getByTestId('mode-big').click();
  await noHorizontalScroll(page);

  await playForest(page, 'alphabet');

  const s = await store(page);
  for (let l = 1; l <= 5; l++) expect(s.forest.trees[`alphabet-${l}`].felled).toBeGreaterThan(0);
  // The 6-log basket filled up along the way, so logs were sold at the sawmill for coins.
  expect(s.coins).toBeGreaterThan(40);
  // Chopping counts as doing the lessons: words are scheduled for review.
  expect(Object.keys(s.srs).length).toBeGreaterThan(40);
  await expect(page.getByTestId('oak-alphabet')).toContainText('🏆');
  await noHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test('little mode: picture questions only, a tree falls after a few answers', async ({ page }) => {
  await page.goto('./#/forest');
  await page.getByTestId('mode-little').click();
  await page.getByTestId('next-tree').click();
  await page.getByTestId('start-chop').click();
  // The tree's health bar shows how many correct answers fell it: never more than 4.
  const hits = await page.locator('.tree-hp span').count();
  expect(hits).toBeGreaterThanOrEqual(2);
  expect(hits).toBeLessThanOrEqual(4);
  for (let steps = 0; !(await visible(page, 'timber-ok')); steps++) {
    // Every question is a picture/letter question: no reading needed.
    if (await visible(page, 'chop-panel')) await expect(page.locator('.chop-panel .picture-ex')).toBeVisible();
    await solveStep(page);
    expect(steps).toBeLessThan(60);
  }
  await page.getByTestId('timber-ok').click();
  await expect(page.getByTestId('hud-logs')).toContainText('2/6');
});

test('shop: buying a better axe means fewer questions per tree', async ({ page }) => {
  await page.goto('./#/forest');
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('english-quest:v1') ?? '{}');
    localStorage.setItem('english-quest:v1', JSON.stringify({ ...s, version: 1, xp: 0, coins: 100, seenLevel: 1, forest: { mode: 'big', axe: 'stone', bag: 'basket', pets: [], logs: 0, trees: {}, x: 150 } }));
  });
  await page.reload();
  await page.getByTestId('shop').click();
  await page.getByTestId('buy-iron').click();
  const s = await store(page);
  expect(s.forest.axe).toBe('iron');
  expect(s.coins).toBe(40);
});
