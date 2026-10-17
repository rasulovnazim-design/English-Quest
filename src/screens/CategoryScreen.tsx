import { useState } from 'react';
import { categories, lessonKey, mapEntries } from '../data';
import { BLOCK_COLOURS } from './MapScreen';
import { useStore } from '../engine/store';
import { bossUnlocked, categoryUnlocked } from '../engine/progress';
import { GrammarView, MistakesView, Modal } from '../components/common';
import { href } from '../router';
import { t } from '../locale';

export function CategoryScreen({ id }: { id: string }) {
  const cat = categories[id];
  const s = useStore((x) => x);
  const [grammar, setGrammar] = useState(false);
  if (!cat || !categoryUnlocked(s, id)) {
    return (
      <div className="page">
        <a href={href({ name: 'map' })}>← {t('nav.map')}</a>
      </div>
    );
  }
  const bossOpen = bossUnlocked(s, cat);
  const boss = s.bosses[id];
  return (
    <div className="page">
      <div className="lesson-top">
        <a className="iconbtn" href={href({ name: 'map' })} aria-label={t('nav.back')}>
          ←
        </a>
        <span className="small muted">{t('map.stage', { n: cat.stage })}</span>
      </div>
      <div className="cat-head">
        <div className="emoji" aria-hidden="true" style={{ background: BLOCK_COLOURS[Math.max(0, mapEntries.findIndex((e) => e.id === id)) % BLOCK_COLOURS.length] }}>
          {cat.emoji}
        </div>
        <div>
          <h1 style={{ margin: 0 }}>{cat.title}</h1>
          <div className="muted">{cat.titleEn}</div>
        </div>
      </div>
      <p>{cat.description}</p>
      <div className="row" style={{ marginBottom: 14 }}>
        <span className="chip">{t('category.words', { n: cat.words.length + (cat.letters?.length ?? 0) })}</span>
        <span className="chip">{t('category.phrases', { n: cat.phrases.length })}</span>
        <span className="chip primary">📘 {cat.grammar.titleEn.split(':')[0]}</span>
      </div>

      <h2>{t('category.lessons')}</h2>
      {cat.lessons.map((l, i) => {
        const done = !!s.lessons[lessonKey(id, l.id)];
        return (
          <a key={l.id} className={`lesson-btn ${done ? 'done' : ''}`} href={href({ name: 'lesson', id, lesson: l.id })} data-testid={`lesson-${l.id}`}>
            <span className="n">{done ? '✓' : i + 1}</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontWeight: 700 }}>{l.title}</span>
              <span className="small muted">
                {l.titleEn} · {t('category.minutes')}
              </span>
            </span>
            <span className="lesson-stars" aria-label={t('map.stars', { n: s.stars[lessonKey(id, l.id)] ?? 0 })}>
              {[1, 2, 3].map((n) => (n <= (s.stars[lessonKey(id, l.id)] ?? 0) ? '⭐' : '☆')).join('')}
            </span>
          </a>
        );
      })}
      {bossOpen ? (
        <a className="lesson-btn boss" href={href({ name: 'boss', id })} data-testid="boss">
          <span className="n">{cat.boss.avatar}</span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 700 }}>
              {t('category.boss')} {boss?.passed ? '🏆' : ''}
            </span>
            <span className="small muted">{t('category.bossDesc', { character: cat.boss.character, role: cat.boss.role })}</span>
          </span>
          <span className="muted">›</span>
        </a>
      ) : (
        <div className="lesson-btn boss" aria-disabled="true">
          <span className="n">🔒</span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 700 }}>{t('category.boss')}</span>
            <span className="small muted">{t('category.bossLocked')}</span>
          </span>
        </div>
      )}

      <div className="row" style={{ margin: '18px 0' }}>
        <button className="btn" style={{ flex: 1 }} onClick={() => setGrammar(true)}>
          📘 {t('category.grammar')}
        </button>
        <a className="btn" style={{ flex: 1 }} href={href({ name: 'phrasebook', id })}>
          📖 {t('category.phrasebook')}
        </a>
      </div>

      <div className="card">
        <h2>⚠️ {t('category.mistakes')}</h2>
        <MistakesView list={cat.mistakes} />
      </div>

      {grammar && (
        <Modal title={cat.grammar.title} onClose={() => setGrammar(false)}>
          <GrammarView g={cat.grammar} />
        </Modal>
      )}
    </div>
  );
}
