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

/** A fingerprint of what is on screen, used to wait until an action has taken effect. */
async function signature(page: Page): Promise<string> {
  return page.evaluate(() =>
    [
      location.hash,
      document.querySelector('[data-testid="feedback"]')?.getAttribute('data-status') ?? '',
      !!document.querySelector('[data-testid="lesson-done"]'),
      !!document.querySelector('[data-testid="round-won"]'),
      document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow') ?? '',
      document.querySelectorAll('.bubble').length,
      document.querySelector('.ex-title')?.textContent ?? '',
      document.querySelector('.flash .front')?.textContent ?? '',
      document.querySelector('.exercise')?.getAttribute('data-answer') ?? '',
      document.querySelectorAll('.tree-hp .on').length,
      !!document.querySelector('[data-testid="timber"]')
    ].join('|')
  );
}

/** Runs an action and waits until the screen changes (the app re-renders asynchronously). */
async function act(page: Page, action: () => Promise<unknown>) {
  const before = await signature(page);
  await action();
  for (let i = 0; i < 50; i++) {
    if ((await signature(page)) !== before) return;
    await page.waitForTimeout(100);
  }
}

async function visible(page: Page, selector: string) {
  const l = page.locator(selector).first();
  return (await l.count()) > 0 && (await l.isVisible());
}

async function buildTiles(page: Page, root: string, answer: string) {
  for (const w of tilesOf(answer)) {
    await page.locator(`${root} button[data-tile="${w.replace(/"/g, '\\"')}"]:not(.used):not([disabled])`).first().click({ timeout: 3000 });
  }
  await page.locator(`${root} [data-testid="check"]`).click({ timeout: 3000 });
}

/** Answers whatever exercise is on screen. Returns false when there is nothing to do. */
export async function solveStep(page: Page): Promise<'lesson-done' | 'won' | 'step'> {
  if (await visible(page, '[data-testid="lesson-done"]')) return 'lesson-done';
  if (await visible(page, '[data-testid="round-won"]')) return 'won';
  if (await visible(page, '[data-testid="feedback"]')) {
    await act(page, () => page.locator('[data-testid="feedback"] [data-testid="continue"]').click());
    return 'step';
  }
  if (await visible(page, '[data-pair]')) {
    const n = await page.locator('.match .col').first().locator('[data-pair]').count();
    await act(page, async () => {
      for (let i = 0; i < n; i++) {
        const left = page.locator('.match .col').nth(0).locator(`[data-pair="${i}"]:not([disabled])`);
        if ((await left.count()) === 0) continue;
        await left.click();
        await page.locator('.match .col').nth(1).locator(`[data-pair="${i}"]`).click();
      }
    });
    return 'step';
  }
  if (await visible(page, '[data-testid="flip"]')) {
    await page.getByTestId('flip').click();
    await act(page, () => page.getByTestId('remembered').click());
    return 'step';
  }
  if (await visible(page, '[data-testid="remembered"]')) {
    await act(page, () => page.getByTestId('remembered').click());
    return 'step';
  }
  if (await visible(page, '[data-testid="cant-speak"]')) {
    await act(page, () => page.getByTestId('cant-speak').click());
    return 'step';
  }
  if (await visible(page, 'button[data-correct="1"]')) {
    await act(page, () => page.locator('button[data-correct="1"]').first().click());
    return 'step';
  }
  const ex = page.locator('[data-answer]').last();
  if ((await ex.count()) > 0 && (await ex.isVisible())) {
    const answer = (await ex.getAttribute('data-answer'))!;
    if ((await ex.locator('[data-option]').count()) > 0) {
      // Between questions (the chop animation), options are briefly disabled: wait for the next one.
      if ((await ex.locator('[data-option]:not([disabled])').count()) === 0) {
        await page.waitForTimeout(150);
        return 'step';
      }
      // If the question changes under us, give up this tap and look at the screen again.
      await act(page, () => ex.locator(`[data-option="${answer.replace(/"/g, '\\"')}"]`).click({ timeout: 3000 }).catch(() => undefined));
      return 'step';
    }
    if ((await ex.locator('button[data-tile]').count()) > 0) {
      await act(page, () => buildTiles(page, '[data-answer]:visible', answer).catch(() => undefined));
      return 'step';
    }
    if ((await ex.locator('[data-testid="answer-input"]').count()) > 0) {
      await ex.locator('[data-testid="answer-input"]').fill(answer, { timeout: 3000 }).catch(() => undefined);
      await act(page, () => ex.locator('[data-testid="check"]').click({ timeout: 3000 }).catch(() => undefined));
      return 'step';
    }
  }
  if (await visible(page, '[data-testid="continue"]')) {
    await act(page, () => page.locator('[data-testid="continue"]').first().click());
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
