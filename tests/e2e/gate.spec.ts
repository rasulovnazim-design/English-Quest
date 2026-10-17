import { test, expect } from '@playwright/test';

// Runs only against a deployment with the key gate switched on:
// GATE_URL=http://localhost:8787/ GATE_ADMIN=<admin password> npx playwright test gate
const GATE_URL = process.env.GATE_URL;
const ADMIN = process.env.GATE_ADMIN;
test.skip(!GATE_URL || !ADMIN, 'Key gate not configured for this run');
// Start every gate test locked, even when the other tests run unlocked.
test.use({ baseURL: GATE_URL, storageState: { cookies: [], origins: [] } });

async function newKey(request: import('@playwright/test').APIRequestContext): Promise<string> {
  const r = await request.post('/api/admin/keys', { data: { password: ADMIN, count: 1, note: 'e2e' } });
  expect(r.ok()).toBe(true);
  return (await r.json()).keys[0];
}

test('a one-time key unlocks the game once, on one device only', async ({ page, request, browser }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'English Quest' })).toBeVisible();
  await expect(page.getByText('Первые слова')).toHaveCount(0);

  // A wrong key is explained in Russian.
  await page.getByLabel('Ключ доступа').fill('EQ-AAAA-AAAA');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByText('Такого ключа нет')).toBeVisible();

  const key = await newKey(request);
  await page.getByLabel('Ключ доступа').fill(key.toLowerCase().replace(/-/g, ''));
  await expect(page.getByLabel('Ключ доступа')).toHaveValue(key);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByText('Первые слова')).toBeVisible();

  // Coming back later: still unlocked, no key needed.
  await page.reload();
  await expect(page.getByText('Первые слова')).toBeVisible();

  // The same key on another device is refused.
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto(GATE_URL!);
  await p2.getByLabel('Ключ доступа').fill(key);
  await p2.getByRole('button', { name: 'Войти' }).click();
  await expect(p2.getByText('уже использован')).toBeVisible();
  await other.close();
});

test('the admin page creates keys only with the right password', async ({ page }) => {
  await page.goto('./admin');
  await page.getByLabel('Пароль').fill('wrong');
  await page.getByRole('button', { name: 'Создать ключи' }).click();
  await expect(page.getByText('Неверный пароль')).toBeVisible();
  await page.getByLabel('Пароль').fill(ADMIN!);
  await page.getByLabel('Сколько ключей').selectOption('5');
  await page.getByRole('button', { name: 'Создать ключи' }).click();
  await expect(page.locator('code')).toHaveCount(5);
});
