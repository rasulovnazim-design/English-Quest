import ru from './ru.json';

type Dict = { [k: string]: string | Dict };

/** Looks up a Russian interface string by dotted key and fills {placeholders}. */
export function t(key: string, vars: Record<string, string | number> = {}): string {
  let node: string | Dict | undefined = ru as Dict;
  for (const part of key.split('.')) {
    node = typeof node === 'object' ? node[part] : undefined;
  }
  if (typeof node !== 'string') return key;
  return node.replace(/\{(\w+)\}/g, (_m, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
