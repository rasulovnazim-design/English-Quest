import { useState } from 'react';
import { categories, categoryEntries, lessonKey, stages } from '../data';
import { useStore, currentStreak, dailyXp, levelInfo } from '../engine/store';
import { bossUnlocked, categoryDone, finalBossUnlocked, lessonsDone, stageComplete, stageUnlocked } from '../engine/progress';
import { rankForLevel, DAILY_GOALS } from '../engine/xp';
import { dueKeys } from '../engine/srs';
import { finalBoss } from './BossScreen';
import { Bar, Modal } from '../components/common';
import { Avatar } from '../components/Avatar';
import { sfx } from '../engine/sfx';
import { href } from '../router';
import { t } from '../locale';

/** Bright block colours, one per category in turn. */
export const BLOCK_COLOURS = ['#ff4757', '#ff9f1a', '#2ed573', '#3a7bfd', '#8c52ff', '#ff6bcb', '#17c0eb'];
const SIDES = ['center', 'left', 'center', 'right'] as const;

export function MapScreen() {
  const s = useStore((x) => x);
  const lvl = levelInfo(s);
  const rank = rankForLevel(lvl.level);
  const goal = DAILY_GOALS[s.settings.goal];
  const today = dailyXp(s);
  const due = dueKeys(s.srs, undefined, 999).length;
  const [soon, setSoon] = useState(false);

  // The player stands on the first playable category that is not finished yet.
  let currentId: string | undefined;
  for (const st of stages) {
    if (!stageUnlocked(s, st.id)) break;
    const e = categoryEntries(st.id).find((x) => categories[x.id] && !categoryDone(s, x.id));
    if (e) {
      currentId = e.id;
      break;
    }
  }

  let blockIndex = 0;

  return (
    <div className="page">
      <div className="card hero">
        <div className="hero-top">
          <a className="avatar-stage" href={href({ name: 'avatar' })} aria-label={t('avatar.title')}>
            <Avatar look={s.avatar} size={92} mood="idle" />
          </a>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: '1.15rem' }}>
              {rank.emoji} {t(`rank.${rank.key}`)}
            </div>
            <div className="small muted">
              {t('home.level', { n: lvl.level })} · {lvl.into}/{lvl.need} XP
            </div>
            <Bar value={lvl.into} max={lvl.need} kind="xp" />
            <div className="row" style={{ marginTop: 8, gap: 6 }}>
              <span className="stat coins">🪙 {s.coins}</span>
              <span className="stat streak">🔥 {currentStreak(s)}</span>
            </div>
          </div>
        </div>
        <div>
          <div className="row small" style={{ marginBottom: 4 }}>
            <b>🎯 {t('home.dailyGoal')}</b>
            <span className="spacer" />
            <span>
              {Math.min(today, goal)}/{goal} XP
            </span>
          </div>
          <Bar value={today} max={goal} kind="ok" />
          {today >= goal && <div className="small" style={{ color: 'var(--ok)', marginTop: 4 }}>{t('home.goalDone')}</div>}
        </div>
        {due > 0 && (
          <a className="btn small primary" href={href({ name: 'review' })}>
            🔁 {t('home.reviewDue', { n: due })}
          </a>
        )}
      </div>

      <a className="forest-banner" href={href({ name: 'forest' })} data-testid="to-forest">
        <span className="fb-trees" aria-hidden="true">🌲🪓🌳</span>
        <span>
          <b>{t('forest.bannerTitle')}</b>
          <span className="small">{t('forest.bannerText')}</span>
        </span>
        <span className="fb-go">▶</span>
      </a>

      {stages.map((st) => {
        const open = stageUnlocked(s, st.id);
        const entries = categoryEntries(st.id);
        const done = entries.filter((e) => categoryDone(s, e.id)).length;
        return (
          <section key={st.id} className={`world w${st.id} ${open ? '' : 'locked'}`} data-testid={`stage-${st.id}`}>
            <div className="world-banner">
              <div className="num">{open ? st.id : '🔒'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2>
                  {st.emoji} {st.title}
                </h2>
                <div className="sub">
                  {t('map.world', { n: st.id })} · {t('map.progress', { done, total: entries.length })}
                  {stageComplete(s, st.id) && ` · ✅ ${t('map.complete')}`}
                </div>
              </div>
            </div>
            {!open && <p className="small" style={{ color: '#1f2a44', textAlign: 'center' }}>{t('map.locked', { n: st.id - 1 })}</p>}
            <div className="path">
              {entries.map((e, i) => {
                const side = SIDES[blockIndex % SIDES.length];
                const colour = BLOCK_COLOURS[blockIndex % BLOCK_COLOURS.length];
                blockIndex++;
                const cat = categories[e.id];
                const isCurrent = e.id === currentId;
                const label = (
                  <div className="block-label">
                    {e.title}
                    <span className="sub">{e.titleEn}</span>
                  </div>
                );
                let block;
                if (!cat) {
                  block = (
                    <button className="block soon" onClick={() => setSoon(true)} aria-label={`${e.title}: ${t('map.comingSoon')}`}>
                      {e.emoji}
                      <span className="badge-corner">⏳</span>
                    </button>
                  );
                } else if (!open) {
                  block = (
                    <div className="block locked" aria-disabled="true">
                      {e.emoji}
                      <span className="badge-corner">🔒</span>
                    </div>
                  );
                } else {
                  const passed = categoryDone(s, e.id);
                  const ready = bossUnlocked(s, cat) && !passed;
                  const stars = cat.lessons.reduce((n, l) => n + (s.stars[lessonKey(e.id, l.id)] ?? 0), 0);
                  block = (
                    <a
                      className={`block ${isCurrent ? 'current' : ''}`}
                      style={{ background: colour }}
                      href={href({ name: 'category', id: e.id })}
                      onClick={() => sfx.tap()}
                      data-testid={`tile-${e.id}`}
                      aria-label={e.title}
                    >
                      {e.emoji}
                      {passed && <span className="badge-corner">🏆</span>}
                      {ready && <span className="badge-corner">⚔️</span>}
                    </a>
                  );
                  return (
                    <div key={e.id} className={`path-step ${side} ${isCurrent ? 'has-player' : ''}`}>
                      {i > 0 && <div className="path-dots" />}
                      {isCurrent && (
                        <div className="player">
                          <Avatar look={s.avatar} size={76} mood="idle" />
                        </div>
                      )}
                      {block}
                      {label}
                      {lessonsDone(s, cat) > 0 && (
                        <div className="block-stars" aria-label={t('map.stars', { n: stars })}>
                          ⭐ {stars}/{cat.lessons.length * 3}
                        </div>
                      )}
                    </div>
                  );
                }
                return (
                  <div key={e.id} className={`path-step ${side}`}>
                    {i > 0 && <div className="path-dots" />}
                    {block}
                    {label}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="world w4" style={{ textAlign: 'center' }}>
        {finalBoss && finalBossUnlocked(s) ? (
          <a className="block final-block" href={href({ name: 'boss', id: 'final' })}>
            ☕🏆 {t('map.finalBoss')}
          </a>
        ) : (
          <div className="block final-block locked">🔒 {t('map.finalBoss')}</div>
        )}
        <p className="small" style={{ color: '#1f2a44', marginTop: 14 }}>
          {finalBoss && finalBossUnlocked(s) ? t('map.finalBossDesc') : t('map.finalLocked')}
        </p>
      </section>

      {soon && (
        <Modal title={t('map.comingSoon')} onClose={() => setSoon(false)}>
          <p>{t('map.comingSoonDesc')}</p>
          <button className="btn primary block" onClick={() => setSoon(false)}>
            OK
          </button>
        </Modal>
      )}
    </div>
  );
}
