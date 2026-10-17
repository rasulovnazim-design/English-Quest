import { request } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/** With BASE_URL and GATE_ADMIN set, creates a test key, redeems it and saves the unlocked cookie. */
export default async function globalSetup() {
  const base = process.env.BASE_URL;
  const admin = process.env.GATE_ADMIN;
  if (!base || !admin) return;
  const ctx = await request.newContext({ baseURL: base });
  const made = await ctx.post('/api/admin/keys', { data: { password: admin, count: 1, note: 'automatic test' } });
  if (!made.ok()) {
    // Gate not switched on yet: nothing to unlock.
    await ctx.dispose();
    mkdirSync('test-results', { recursive: true });
    await (await request.newContext()).storageState({ path: 'test-results/unlocked.json' });
    return;
  }
  const key = (await made.json()).keys[0];
  const r = await ctx.post('/api/redeem', { data: { key } });
  if (!r.ok()) throw new Error(`Could not redeem the test key: ${r.status()}`);
  mkdirSync('test-results', { recursive: true });
  await ctx.storageState({ path: 'test-results/unlocked.json' });
  await ctx.dispose();
}
