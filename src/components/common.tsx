import { useEffect, useState, type ReactNode } from 'react';
import { speak, ttsSupported } from '../engine/speech';
import { t } from '../locale';
import type { GrammarPoint, Mistake } from '../engine/types';

/** Test hook: with localStorage "eq-e2e" = "1", exercises expose their answers for Playwright. */
export const E2E = (() => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('eq-e2e') === '1';
  } catch {
    return false;
  }
})();

export function e2e(value: string | undefined): Record<string, string> {
  return E2E && value !== undefined ? { 'data-answer': value } : {};
}

export function PlayButtons({ text, size = 'normal', autoLabel }: { text: string; size?: 'normal' | 'big' | 'mini'; autoLabel?: string }) {
  if (!ttsSupported) return <span className="small muted">{t('lesson.noAudio')}</span>;
  const cls = size === 'big' ? 'play big' : size === 'mini' ? 'play mini' : 'play';
  return (
    <span className="audio-row">
      <button type="button" className={cls} onClick={() => speak(text)} aria-label={autoLabel ?? t('lesson.normal')} title={t('lesson.normal')}>
        🔊
      </button>
      <button type="button" className={`${cls} slow`} onClick={() => speak(text, true)} aria-label={t('lesson.slow')} title={t('lesson.slow')}>
        🐢
      </button>
    </span>
  );
}

export function Bar({ value, max, kind }: { value: number; max: number; kind?: 'xp' | 'ok' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={`bar ${kind ?? ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="iconbtn" onClick={onClose} aria-label={t('nav.close')}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function GrammarView({ g }: { g: GrammarPoint }) {
  return (
    <div>
      <p className="muted small">{g.titleEn}</p>
      {g.explanation.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {g.table && (
        <table className="grammar-table">
          <tbody>
            {g.table.map((r, i) => (
              <tr key={i}>
                <td>{r.en}</td>
                <td>{r.ru}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div>
        {g.examples.map((ex, i) => (
          <div className="example" key={i}>
            <PlayButtons text={ex.en} size="mini" />
            <div>
              <div className="en">{ex.en}</div>
              <div className="muted small">{ex.ru}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MistakesView({ list }: { list: Mistake[] }) {
  return (
    <div>
      {list.map((m, i) => (
        <details className="mistake" key={i}>
          <summary>{m.title}</summary>
          <p style={{ marginTop: 8 }}>{m.text}</p>
          {(m.wrong || m.right) && (
            <div className="wr">
              {m.wrong && <div className="w">{m.wrong}</div>}
              {m.right && <div className="r">{m.right}</div>}
            </div>
          )}
        </details>
      ))}
    </div>
  );
}

export function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 2600);
    return () => clearTimeout(id);
  }, [onDone]);
  return (
    <div className="toast" role="status">
      {text}
    </div>
  );
}

export function Confetti() {
  const [pieces] = useState(() =>
    Array.from({ length: 40 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      color: ['#3b5bdb', '#f08c00', '#2b8a3e', '#e64980', '#15aabf'][i % 5]
    }))
  );
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i key={i} style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, background: p.color }} />
      ))}
    </div>
  );
}

/** Shows an answer with the corrected words highlighted. */
export function Corrected({ text, fixes }: { text: string; fixes: string[] }) {
  if (!fixes.length) return <>{text}</>;
  const set = new Set(fixes.map((f) => f.toLowerCase()));
  return (
    <>
      {text.split(/(\s+)/).map((w, i) =>
        set.has(w.toLowerCase().replace(/[.,!?]/g, '')) ? (
          <mark className="fix" key={i}>
            {w}
          </mark>
        ) : (
          <span key={i}>{w}</span>
        )
      )}
    </>
  );
}
