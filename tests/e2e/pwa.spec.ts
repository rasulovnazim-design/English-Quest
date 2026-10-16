import { test, expect } from '@playwright/test';

test('has an installable web app manifest with icons', async ({ page, request, baseURL }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifestUrl = new URL(href!, baseURL).toString();
  const res = await request.get(manifestUrl);
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m.name).toContain('English Quest');
  expect(m.display).toBe('standalone');
  expect(m.start_url).toBeTruthy();
  const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');
  for (const icon of m.icons) {
    const r = await request.get(new URL(icon.src, manifestUrl).toString());
    expect(r.ok(), icon.src).toBe(true);
  }
  const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect((await request.get(new URL(apple!, baseURL).toString())).ok()).toBe(true);
});

test('works offline after the first load', async ({ page, context }) => {
  await page.goto('./');
  await expect(page.getByText('Первые слова')).toBeVisible();
  // Wait until the service worker controls the page and has cached the app.
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Первые слова')).toBeVisible();
  await page.getByTestId('tile-greetings').click();
  await page.getByTestId('lesson-1').click();
  await expect(page.getByText('Новые слова и фразы')).toBeVisible();
  await context.setOffline(false);
});
