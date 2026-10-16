import { expect, type Page } from '@playwright/test';

/** Splits a sentence into tiles the same way the app does. */
function tilesOf(sentence: string): string[] {
  return sentence
    .replace(/[.,!?]+$/g, '')
    .split(/\s+/)
    .map((w) => w.replace(/[.,!?;:]+$/g, ''))
    .filter(Boolean);
}

export async function enableTestHooks(page: Page) {
  await page.addInitScript(() => localStorage.setItem('eq-e2e', '1'));
}

async function visible(page: Page, selector: string) {
  const l = page.locator(selector).first();
  return (await l.count()) > 0 && (await l.isVisible());
}

async function buildTiles(page: Page, root: string, answer: string) {
  for (const w of tilesOf(answer)) {
    await page.locator(`${root} button[data-tile="${w.replace(/"/g, '\\"')}"]:not(.used):not([disabled])`).first().click();
  }
  await page.locator(`${root} [data-testid="check"]`).click();
}

/** Answers whatever exercise is on screen. Returns false when there is nothing to do. */
export async function solveStep(page: Page): Promise<'lesson-done' | 'won' | 'step'> {
  if (await visible(page, '[data-testid="lesson-done"]')) return 'lesson-done';
  if (await visible(page, '[data-testid="round-won"]')) return 'won';
  if (await visible(page, '[data-testid="feedback"]')) {
    await page.locator('[data-testid="feedback"] [data-testid="continue"]').click();
    return 'step';
  }
  if (await visible(page, '[data-pair]')) {
    const n = (await page.locator('.match .col').first().locator('[data-pair]').count());
    for (let i = 0; i < n; i++) {
      await page.locator('.match .col').nth(0).locator(`[data-pair="${i}"]`).click();
      await page.locator('.match .col').nth(1).locator(`[data-pair="${i}"]`).click();
    }
    return 'step';
  }
  if (await visible(page, '[data-testid="flip"]')) {
    await page.getByTestId('flip').click();
    await page.getByTestId('remembered').click();
    return 'step';
  }
  if (await visible(page, '[data-testid="remembered"]')) {
    await page.getByTestId('remembered').click();
    return 'step';
  }
  if (await visible(page, '[data-testid="cant-speak"]')) {
    await page.getByTestId('cant-speak').click();
    return 'step';
  }
  if (await visible(page, 'button[data-correct="1"]')) {
    await page.locator('button[data-correct="1"]').first().click();
    return 'step';
  }
  const ex = page.locator('[data-answer]').last();
  if ((await ex.count()) > 0 && (await ex.isVisible())) {
    const answer = (await ex.getAttribute('data-answer'))!;
    if ((await ex.locator('[data-option]').count()) > 0) {
      await ex.locator(`[data-option="${answer.replace(/"/g, '\\"')}"]`).click();
      return 'step';
    }
    if ((await ex.locator('button[data-tile]').count()) > 0) {
      await buildTiles(page, '[data-answer]:visible', answer);
      return 'step';
    }
    if ((await ex.locator('[data-testid="answer-input"]').count()) > 0) {
      await ex.locator('[data-testid="answer-input"]').fill(answer);
      await ex.locator('[data-testid="check"]').click();
      return 'step';
    }
  }
  if (await visible(page, '[data-testid="continue"]')) {
    await page.locator('[data-testid="continue"]').first().click();
    return 'step';
  }
  await page.waitForTimeout(150);
  return 'step';
}

export async function playUntil(page: Page, until: 'lesson-done' | 'won', maxSteps = 200) {
  for (let i = 0; i < maxSteps; i++) {
    const r = await solveStep(page);
    if (r === until) return;
  }
  throw new Error(`Did not reach ${until}`);
}

export async function noHorizontalScroll(page: Page) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  expect(sw).toBeLessThanOrEqual(iw);
}
