import { describe, it, expect, beforeEach } from 'vitest';
import { handle, makeToken, readToken, normaliseKey, type Env, type KV } from '../../src/worker/index';

class MemoryKV implements KV {
  data = new Map<string, string>();
  async get(k: string) {
    return this.data.get(k) ?? null;
  }
  async put(k: string, v: string) {
    this.data.set(k, v);
  }
  async delete(k: string) {
    this.data.delete(k);
  }
  async list(opts: { prefix?: string } = {}) {
    return { keys: [...this.data.keys()].filter((k) => k.startsWith(opts.prefix ?? '')).map((name) => ({ name })), list_complete: true };
  }
}

const GAME = '<html>the game</html>';
let env: Env;
const BASE = 'https://english-quest.example.workers.dev';

function req(path: string, init: RequestInit & { cookie?: string; html?: boolean } = {}) {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set('cookie', init.cookie);
  if (init.html) headers.set('accept', 'text/html');
  return new Request(BASE + path, { ...init, headers });
}

async function createKeys(count = 1): Promise<string[]> {
  const r = await handle(req('/api/admin/keys', { method: 'POST', body: JSON.stringify({ password: 'secret', count }) }), env);
  expect(r.status).toBe(200);
  return ((await r.json()) as { keys: string[] }).keys;
}

async function redeem(key: string) {
  return handle(req('/api/redeem', { method: 'POST', body: JSON.stringify({ key }) }), env);
}

function cookieFrom(r: Response): string {
  return (r.headers.get('set-cookie') ?? '').split(';')[0];
}

beforeEach(() => {
  env = { ASSETS: { fetch: async () => new Response(GAME) }, KEYS: new MemoryKV(), ADMIN_PASSWORD: 'secret' };
});

describe('one-time keys', () => {
  it('shows the key page, not the game, without a key', async () => {
    const r = await handle(req('/', { html: true }), env);
    expect(r.status).toBe(401);
    const body = await r.text();
    expect(body).toContain('ключ');
    expect(body).not.toContain('the game');
    expect((await handle(req('/assets/index.js'), env)).status).toBe(401);
  });

  it('unlocks the device with a fresh key and keeps it unlocked', async () => {
    const [key] = await createKeys();
    expect(key).toMatch(/^EQ-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const r = await redeem(key);
    expect(r.status).toBe(200);
    const cookie = cookieFrom(r);
    expect(cookie).toMatch(/^eq_access=/);
    expect(r.headers.get('set-cookie')).toContain('HttpOnly');
    expect(await (await handle(req('/', { html: true, cookie }), env)).text()).toBe(GAME);
    expect((await handle(req('/assets/index.js', { cookie }), env)).status).toBe(200);
  });

  it('refuses a key that was already used on another device', async () => {
    const [key] = await createKeys();
    expect((await redeem(key)).status).toBe(200);
    const again = await redeem(key);
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: 'used' });
  });

  it('accepts keys typed loosely (lower case, no dashes)', async () => {
    const [key] = await createKeys();
    expect((await redeem(key.toLowerCase().replace(/-/g, ' '))).status).toBe(200);
    expect(normaliseKey('eq-ab12-cd34')).toBe('AB12CD34');
  });

  it('rejects made-up keys and forged cookies', async () => {
    expect((await redeem('EQ-AAAA-BBBB')).status).toBe(400);
    const forged = `eq_access=AAAABBBB.${Math.floor(Date.now() / 1000) + 1000}.fakesignature`;
    expect((await handle(req('/', { html: true, cookie: forged }), env)).status).toBe(401);
    const otherSecret = await makeToken('another-password', 'AAAABBBB');
    expect((await handle(req('/', { html: true, cookie: `eq_access=${otherSecret}` }), env)).status).toBe(401);
  });

  it('expires access after a year', async () => {
    const token = await makeToken('secret', 'AAAABBBB', Date.now() - 400 * 24 * 3600 * 1000);
    expect(await readToken('secret', token)).toBeNull();
  });

  it('locks a device again when its key is revoked', async () => {
    const [key] = await createKeys();
    const cookie = cookieFrom(await redeem(key));
    await handle(req('/api/admin/keys', { method: 'POST', body: JSON.stringify({ password: 'secret', revoke: key }) }), env);
    expect((await handle(req('/', { html: true, cookie }), env)).status).toBe(403);
  });

  it('protects the admin API with the password', async () => {
    const bad = await handle(req('/api/admin/keys', { method: 'POST', body: JSON.stringify({ password: 'wrong', count: 3 }) }), env);
    expect(bad.status).toBe(403);
    expect((await handle(req('/api/admin/keys'), env)).status).toBe(403);
    await createKeys(3);
    const list = await handle(req('/api/admin/keys', { headers: { authorization: 'Bearer secret' } }), env);
    expect(((await list.json()) as { keys: unknown[] }).keys).toHaveLength(3);
  });

  it('serves icons and the manifest without a key, so the key page looks right', async () => {
    expect((await handle(req('/favicon.svg'), env)).status).toBe(200);
    expect((await handle(req('/manifest.webmanifest'), env)).status).toBe(200);
  });

  it('stays open (instead of locking everyone out) until keys storage and password are set up', async () => {
    const r = await handle(req('/', { html: true }), { ASSETS: env.ASSETS });
    expect(await r.text()).toBe(GAME);
  });
});
