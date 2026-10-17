// Cloudflare Worker in front of the game: a one-time key is needed to enter.
//
// - Every key works once: the first device that enters it is unlocked (for a year); the key is then used up.
// - Without a valid access cookie, only the key page is served — the game's files are not sent at all.
// - /admin (password = the ADMIN_PASSWORD secret) creates keys and shows which are used.
//
// Bindings (wrangler.jsonc): ASSETS (the built game), KEYS (a KV namespace). Secret: ADMIN_PASSWORD.

export interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts?: { prefix?: string; cursor?: string; limit?: number }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}

export interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> };
  KEYS?: KV;
  ADMIN_PASSWORD?: string;
}

export interface KeyRecord {
  created: string;
  note?: string;
  usedAt?: string;
  device?: string;
  revoked?: boolean;
}

const COOKIE = 'eq_access';
const YEAR = 365 * 24 * 3600;
// No 0/O, 1/I/L: easy to read out and type.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Files that may be fetched without a key (so the key page and the install icon look right). */
const PUBLIC = /^\/(favicon\.svg|apple-touch-icon\.png|icon-[\w-]+\.png|manifest\.webmanifest)$/;

export function normaliseKey(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^EQ/, '');
}

export function formatKey(raw: string): string {
  return `EQ-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

export function newKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

function b64url(buf: ArrayBuffer): string {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(`eq-session:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
}

/** Access cookie: "<key>.<expires>.<signature>" signed with the admin password. */
export async function makeToken(secret: string, key: string, now = Date.now()): Promise<string> {
  const exp = Math.floor(now / 1000) + YEAR;
  return `${key}.${exp}.${await hmac(secret, `${key}.${exp}`)}`;
}

export async function readToken(secret: string, token: string | undefined, now = Date.now()): Promise<string | null> {
  if (!token) return null;
  const [key, exp, sig] = token.split('.');
  if (!key || !exp || !sig) return null;
  if (Number(exp) * 1000 < now) return null;
  const expected = await hmac(secret, `${key}.${exp}`);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? key : null;
}

function cookieValue(req: Request, name: string): string | undefined {
  const m = (req.headers.get('cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m?.[1];
}

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
}

function html(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'DENY' } });
}

function adminOk(req: Request, env: Env, body?: { password?: string }): boolean {
  const pw = env.ADMIN_PASSWORD;
  if (!pw) return false;
  const given = body?.password ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return given === pw;
}

async function redeem(req: Request, env: Env): Promise<Response> {
  if (!env.KEYS || !env.ADMIN_PASSWORD) return json({ error: 'not-configured' }, 503);
  let body: { key?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }
  const key = normaliseKey(body.key ?? '');
  if (key.length !== 8) return json({ error: 'invalid' }, 400);
  const raw = await env.KEYS.get(`key:${key}`);
  if (!raw) return json({ error: 'invalid' }, 400);
  const rec = JSON.parse(raw) as KeyRecord;
  if (rec.revoked) return json({ error: 'invalid' }, 400);
  if (rec.usedAt) return json({ error: 'used' }, 409);
  rec.usedAt = new Date().toISOString();
  rec.device = (req.headers.get('user-agent') ?? '').slice(0, 160);
  await env.KEYS.put(`key:${key}`, JSON.stringify(rec));
  const token = await makeToken(env.ADMIN_PASSWORD, key);
  return json({ ok: true }, 200, { 'set-cookie': `${COOKIE}=${token}; Path=/; Max-Age=${YEAR}; HttpOnly; Secure; SameSite=Lax` });
}

async function adminKeys(req: Request, env: Env): Promise<Response> {
  if (!env.KEYS) return json({ error: 'not-configured' }, 503);
  if (req.method === 'POST') {
    const body = (await req.json().catch(() => ({}))) as { password?: string; count?: number; note?: string; revoke?: string };
    if (!adminOk(req, env, body)) return json({ error: 'forbidden' }, 403);
    if (body.revoke) {
      const k = normaliseKey(body.revoke);
      const raw = await env.KEYS.get(`key:${k}`);
      if (!raw) return json({ error: 'not-found' }, 404);
      await env.KEYS.put(`key:${k}`, JSON.stringify({ ...(JSON.parse(raw) as KeyRecord), revoked: true }));
      return json({ ok: true });
    }
    const count = Math.max(1, Math.min(100, Math.floor(body.count ?? 1)));
    const keys: string[] = [];
    for (let i = 0; i < count; i++) {
      let k = newKey();
      while (await env.KEYS.get(`key:${k}`)) k = newKey();
      const rec: KeyRecord = { created: new Date().toISOString(), note: body.note?.slice(0, 80) };
      await env.KEYS.put(`key:${k}`, JSON.stringify(rec));
      keys.push(formatKey(k));
    }
    return json({ keys });
  }
  if (!adminOk(req, env)) return json({ error: 'forbidden' }, 403);
  const out: ({ key: string } & KeyRecord)[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.KEYS.list({ prefix: 'key:', cursor, limit: 1000 });
    for (const { name } of page.keys) {
      const raw = await env.KEYS.get(name);
      if (raw) out.push({ key: formatKey(name.slice(4)), ...(JSON.parse(raw) as KeyRecord) });
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  out.sort((a, b) => (a.created < b.created ? 1 : -1));
  return json({ keys: out });
}

export async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === '/api/redeem' && req.method === 'POST') return redeem(req, env);
  if (path === '/api/admin/keys') return adminKeys(req, env);
  if (path === '/admin') return html(ADMIN_PAGE);
  if (path === '/api/logout') {
    return new Response(null, { status: 302, headers: { location: '/', 'set-cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` } });
  }
  if (PUBLIC.test(path)) return env.ASSETS.fetch(req);

  // Not set up yet (no KV or no password): keep the game open rather than locking everyone out.
  if (!env.KEYS || !env.ADMIN_PASSWORD) return env.ASSETS.fetch(req);

  const key = await readToken(env.ADMIN_PASSWORD, cookieValue(req, COOKIE));
  if (key) {
    // On page loads, also make sure the key has not been revoked.
    if (req.mode === 'navigate' || (req.headers.get('accept') ?? '').includes('text/html')) {
      const raw = await env.KEYS.get(`key:${key}`);
      if (!raw || (JSON.parse(raw) as KeyRecord).revoked) return html(GATE_PAGE, 403);
    }
    return env.ASSETS.fetch(req);
  }
  const wantsPage = (req.headers.get('accept') ?? '').includes('text/html') || path === '/' || path.endsWith('.html');
  return wantsPage ? html(GATE_PAGE, 401) : new Response('Key required', { status: 401, headers: { 'cache-control': 'no-store' } });
}

export default { fetch: handle };

// ---------------- pages ----------------

const STYLE = `
*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:16px;
font-family:'Nunito','Arial Rounded MT Bold',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-weight:700;color:#1f2a44;
background:linear-gradient(180deg,#5ec8ff 0,#b8ecff 60%,#e9f7ff 100%)}
.card{width:100%;max-width:420px;background:#fff;border-radius:26px;padding:24px 20px;box-shadow:0 8px 0 rgba(16,32,72,.2);text-align:center}
h1{font-size:1.6rem;margin:6px 0 4px;font-weight:900}p{color:#56627d;margin:0 0 16px}
.logo{font-size:3rem}input,select{width:100%;font:inherit;font-size:1.3rem;text-align:center;letter-spacing:.08em;padding:14px;border-radius:16px;border:3px solid #c9d6ee;outline:none;text-transform:uppercase}
input:focus{border-color:#2f80ff}button{width:100%;margin-top:12px;min-height:56px;border:0;border-radius:16px;font:inherit;font-size:1.15rem;font-weight:900;color:#fff;background:#22c55e;box-shadow:0 5px 0 #15803d;cursor:pointer}
button:active{transform:translateY(4px);box-shadow:0 1px 0 #15803d}button:disabled{opacity:.5}
.msg{min-height:1.4em;margin-top:12px;font-weight:800}.bad{color:#b91c1c}.ok{color:#15803d}
table{width:100%;border-collapse:collapse;font-size:.85rem;margin-top:12px;text-align:left}td,th{padding:6px 4px;border-bottom:1px solid #e3e9f5}
code{font-size:1rem;font-weight:900;letter-spacing:.04em}.wide{max-width:760px}.row{display:flex;gap:8px}.row>*{flex:1}
@media (prefers-color-scheme:dark){body{background:linear-gradient(180deg,#0b1a3d,#1c2f63);color:#e8efff}.card{background:#1b2a52}p{color:#a9b8de}input,select{background:#24376a;color:#e8efff;border-color:#34497f}td,th{border-color:#34497f}}`;

const GATE_PAGE = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>English Quest — вход</title><meta name="robots" content="noindex"><link rel="icon" href="/favicon.svg"><link rel="manifest" href="/manifest.webmanifest">
<style>${STYLE}</style></head><body><form class="card" id="f" autocomplete="off">
<div class="logo">🗺️🌲</div><h1>English Quest</h1><p>Введите ключ доступа. Каждый ключ работает один раз — на одном устройстве.</p>
<input id="k" name="key" placeholder="EQ-XXXX-XXXX" maxlength="14" inputmode="text" autocapitalize="characters" spellcheck="false" aria-label="Ключ доступа" required>
<button id="b" type="submit">Войти</button><div class="msg" id="m" role="status"></div></form>
<script>
const f=document.getElementById('f'),k=document.getElementById('k'),b=document.getElementById('b'),m=document.getElementById('m');
k.addEventListener('input',()=>{let v=k.value.toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/^EQ/,'').slice(0,8);k.value=v.length?'EQ-'+v.slice(0,4)+(v.length>4?'-'+v.slice(4):''):'';});
f.addEventListener('submit',async e=>{e.preventDefault();b.disabled=true;m.className='msg';m.textContent='Проверяем…';
try{const r=await fetch('/api/redeem',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key:k.value})});
if(r.ok){m.className='msg ok';m.textContent='Готово! Открываем игру…';location.replace('/');return;}
const d=await r.json().catch(()=>({}));m.className='msg bad';
m.textContent=d.error==='used'?'Этот ключ уже использован на другом устройстве.':d.error==='not-configured'?'Вход ещё не настроен.':'Такого ключа нет. Проверьте, нет ли опечатки.';}
catch{m.className='msg bad';m.textContent='Нет интернета. Попробуйте ещё раз.';}b.disabled=false;});
</script></body></html>`;

const ADMIN_PAGE = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>English Quest — ключи</title><meta name="robots" content="noindex"><style>${STYLE}</style></head><body>
<div class="card wide"><div class="logo">🔑</div><h1>Ключи доступа</h1><p>Создавайте одноразовые ключи и смотрите, какие уже использованы.</p>
<input id="pw" type="password" placeholder="Пароль администратора" style="text-transform:none;letter-spacing:0" aria-label="Пароль">
<div class="row"><select id="n" aria-label="Сколько ключей"><option>1</option><option>5</option><option>10</option><option>25</option></select>
<input id="note" placeholder="Для кого (необязательно)" style="text-transform:none;letter-spacing:0;font-size:1rem" aria-label="Заметка"></div>
<button id="make">Создать ключи</button><button id="load" style="background:#2f80ff;box-shadow:0 5px 0 #1652b8">Показать все ключи</button>
<div class="msg" id="m" role="status"></div><div id="out"></div></div>
<script>
const $=id=>document.getElementById(id),m=$('m'),out=$('out');
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function load(){m.textContent='';const r=await fetch('/api/admin/keys',{headers:{authorization:'Bearer '+$('pw').value}});
if(!r.ok){m.className='msg bad';m.textContent=r.status===403?'Неверный пароль.':'Ошибка '+r.status;return;}
const d=await r.json();const used=d.keys.filter(k=>k.usedAt).length;
out.innerHTML='<p style="margin-top:12px">Всего: '+d.keys.length+' · использовано: '+used+'</p><table><tr><th>Ключ</th><th>Для кого</th><th>Статус</th><th></th></tr>'+
d.keys.map(k=>'<tr><td><code>'+esc(k.key)+'</code></td><td>'+esc(k.note)+'</td><td>'+(k.revoked?'⛔ отозван':k.usedAt?'✅ '+new Date(k.usedAt).toLocaleDateString('ru-RU'):'🟢 свободен')+'</td><td>'+(k.revoked?'':'<a href="#" data-r="'+esc(k.key)+'">отозвать</a>')+'</td></tr>').join('')+'</table>';}
$('load').onclick=load;
out.onclick=async e=>{const k=e.target.dataset&&e.target.dataset.r;if(!k)return;e.preventDefault();if(!confirm('Отозвать ключ '+k+'? Устройство с этим ключом потеряет доступ.'))return;
await fetch('/api/admin/keys',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:$('pw').value,revoke:k})});load();};
$('make').onclick=async()=>{m.textContent='';const r=await fetch('/api/admin/keys',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:$('pw').value,count:Number($('n').value),note:$('note').value})});
if(!r.ok){m.className='msg bad';m.textContent=r.status===403?'Неверный пароль.':'Ошибка '+r.status;return;}
const d=await r.json();m.className='msg ok';m.textContent='Готово! Новые ключи:';out.innerHTML='<table>'+d.keys.map(k=>'<tr><td><code>'+esc(k)+'</code></td></tr>').join('')+'</table>';};
</script></body></html>`;
