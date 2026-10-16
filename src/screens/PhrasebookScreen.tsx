import { useMemo, useState } from 'react';
import { categories } from '../data';
import type { Category, Item } from '../engine/types';
import { useStore } from '../engine/store';
import { categoryUnlocked, unlockedCategories } from '../engine/progress';
import { englishOf } from '../engine/exercises';
import { normalizeRu, basicClean } from '../engine/normalize';
import { GrammarView, MistakesView, PlayButtons } from '../components/common';
import { href } from '../router';
import { t } from '../locale';

function ItemRow({ item, accent }: { item: Item; accent: 'gb' | 'us' }) {
  const en = englishOf(item, accent);
  return (
    <div className="pb-item">
      <span className="emoji" aria-hidden="true">
        {item.emoji ?? ''}
      </span>
      <div className="txt">
        <div className="en">
          {en}
          {item.us && accent === 'gb' && <span className="small muted"> · US: {item.us}</span>}
        </div>
        <div className="ru">{item.ru}</div>
        {item.ipa && <div className="ipa">{item.ipa}</div>}
      </div>
      <PlayButtons text={item.say ?? en} size="mini" />
    </div>
  );
}

function CategoryBook({ cat, accent }: { cat: Category; accent: 'gb' | 'us' }) {
  return (
    <div className="card">
      <h2>
        {cat.emoji} {cat.title} <span className="muted small">· {cat.titleEn}</span>
      </h2>
      {cat.letters && (
        <>
          <h3>🔤 {t('phrasebook.letters')}</h3>
          <div className="pb-list">
            {cat.letters.map((i) => (
              <ItemRow key={i.id} item={i} accent={accent} />
            ))}
          </div>
        </>
      )}
      <h3 style={{ marginTop: 12 }}>{t('phrasebook.words')}</h3>
      <div className="pb-list">
        {cat.words.map((i) => (
          <ItemRow key={i.id} item={i} accent={accent} />
        ))}
      </div>
      <h3 style={{ marginTop: 12 }}>{t('phrasebook.phrases')}</h3>
      <div className="pb-list">
        {cat.phrases.map((i) => (
          <ItemRow key={i.id} item={i} accent={accent} />
        ))}
      </div>
    </div>
  );
}

export function PhrasebookScreen({ id }: { id?: string }) {
  const s = useStore((x) => x);
  const accent = s.settings.accent;
  const [q, setQ] = useState('');
  const cats = unlockedCategories(s);
  const single = id && categories[id] && categoryUnlocked(s, id) ? categories[id] : undefined;

  const results = useMemo(() => {
    const query = q.trim();
    if (!query) return null;
    const ru = normalizeRu(query);
    const en = basicClean(query);
    const out: { cat: Category; item: Item }[] = [];
    for (const cat of cats) {
      for (const item of [...(cat.letters ?? []), ...cat.words, ...cat.phrases]) {
        const hay = [item.en, item.us ?? '', ...(item.alt ?? [])].map(basicClean).join(' | ');
        if (hay.includes(en) || normalizeRu(item.ru).includes(ru)) out.push({ cat, item });
      }
    }
    return out;
  }, [q, cats]);

  if (single) {
    return (
      <div className="page">
        <div className="lesson-top no-print">
          <a className="iconbtn" href={href({ name: 'category', id: single.id })} aria-label={t('nav.back')}>
            ←
          </a>
          <h1 style={{ margin: 0, flex: 1 }}>{t('phrasebook.title')}</h1>
          <button className="btn small" onClick={() => window.print()}>
            🖨️ {t('phrasebook.print')}
          </button>
        </div>
        <div className="print-only">
          <h1>English Quest — {t('phrasebook.title')}</h1>
        </div>
        <CategoryBook cat={single} accent={accent} />
        <div className="card">
          <h2>📘 {single.grammar.title}</h2>
          <GrammarView g={single.grammar} />
        </div>
        <div className="card">
          <h2>⚠️ {t('category.mistakes')}</h2>
          <MistakesView list={single.mistakes} />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="row no-print" style={{ marginBottom: 10 }}>
        <h1 style={{ margin: 0, flex: 1 }}>📖 {t('phrasebook.title')}</h1>
        <button className="btn small" onClick={() => window.print()}>
          🖨️ {t('phrasebook.print')}
        </button>
      </div>
      <div className="print-only">
        <h1>English Quest — {t('phrasebook.title')}</h1>
      </div>
      <div className="search no-print" style={{ marginBottom: 12 }}>
        <input
          className="input"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('phrasebook.search')}
          aria-label={t('phrasebook.search')}
          data-testid="pb-search"
        />
      </div>
      <p className="small muted no-print">{t('phrasebook.onlyUnlocked')}</p>
      {results ? (
        <div className="card" data-testid="pb-results">
          {results.length === 0 && <p className="muted">{t('phrasebook.empty')}</p>}
          {results.map(({ cat, item }) => (
            <div key={cat.id + item.id}>
              <ItemRow item={item} accent={accent} />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="row no-print" style={{ marginBottom: 12 }}>
            {cats.map((c) => (
              <a key={c.id} className="chip" href={href({ name: 'phrasebook', id: c.id })} style={{ textDecoration: 'none', minHeight: 32 }}>
                {c.emoji} {c.title}
              </a>
            ))}
          </div>
          {cats.map((c) => (
            <CategoryBook key={c.id} cat={c} accent={accent} />
          ))}
        </>
      )}
    </div>
  );
}
