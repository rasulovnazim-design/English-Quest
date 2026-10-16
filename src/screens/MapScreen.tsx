import { useState } from 'react';
import { categories, categoryEntries, stages } from '../data';
import { useStore, currentStreak, dailyXp, levelInfo } from '../engine/store';
import { bossUnlocked, categoryDone, finalBossUnlocked, lessonsDone, stageComplete, stageUnlocked } from '../engine/progress';
import { rankForLevel, DAILY_GOALS } from '../engine/xp';
import { dueKeys } from '../engine/srs';
import { finalBoss } from './BossScreen';
import { Bar, Modal } from '../components/common';
import { href } from '../router';
import { t } from '../locale';

export function MapScreen() {
  const s = useStore((x) => x);
  const lvl = levelInfo(s);
  const rank = rankForLevel(lvl.level);
  const goal = DAILY_GOALS[s.settings.goal];
  const today = dailyXp(s);
  const due = dueKeys(s.srs, undefined, 999).length;
  const [soon, setSoon] = useState(false);

  return (
    <div className="page">
      <div className="card hero">
        <div className="hero-top">
          <div className="rank-emoji" aria-hidden="true">
            {rank.emoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>
              {t(`rank.${rank.key}`)} <span className="muted small">· {rank.en}</span>
            </div>
            <div className="small muted">
              {t('home.level', { n: lvl.level })} · {lvl.into}/{lvl.need} XP
            </div>
            <Bar value={lvl.into} max={lvl.need} kind="xp" />
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
        <div className="row">
          <span className="stat streak">🔥 {t('home.days', { n: currentStreak(s) })}</span>
          <span className="spacer" />
          {due > 0 ? (
            <a className="btn small primary" href={href({ name: 'review' })}>
              🔁 {t('home.reviewDue', { n: due })}
            </a>
          ) : (
            <span className="small muted">{t('home.reviewNone')}</span>
          )}
        </div>
      </div>

      {stages.map((st) => {
        const open = stageUnlocked(s, st.id);
        const entries = categoryEntries(st.id);
        const done = entries.filter((e) => categoryDone(s, e.id)).length;
        return (
          <section key={st.id} className={`stage ${open ? '' : 'locked'}`} data-testid={`stage-${st.id}`}>
            <div className="stage-head">
              <div className="num">{open ? st.id : '🔒'}</div>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0 }}>
                  {st.emoji} {st.title}
                </h2>
                <div className="small muted">
                  {t('map.stage', { n: st.id })} · {st.titleEn} · {t('map.progress', { done, total: entries.length })}
                  {stageComplete(s, st.id) && ` · ✅ ${t('map.complete')}`}
                </div>
              </div>
            </div>
            {!open && <p className="small muted">{t('map.locked', { n: st.id - 1 })}</p>}
            <div className="tiles">
              {entries.map((e) => {
                const cat = categories[e.id];
                if (!cat) {
                  return (
                    <button key={e.id} className="tile soon" onClick={() => setSoon(true)}>
                      <span className="emoji">{e.emoji}</span>
                      <span className="title">{e.title}</span>
                      <span className="sub">{e.titleEn}</span>
                      <span className="tile-foot chip">⏳ {t('map.comingSoon')}</span>
                    </button>
                  );
                }
                const ld = lessonsDone(s, cat);
                const passed = categoryDone(s, e.id);
                const ready = bossUnlocked(s, cat) && !passed;
                if (!open) {
                  return (
                    <div key={e.id} className="tile locked" aria-disabled="true">
                      <span className="corner">🔒</span>
                      <span className="emoji">{e.emoji}</span>
                      <span className="title">{e.title}</span>
                      <span className="sub">{e.titleEn}</span>
                    </div>
                  );
                }
                return (
                  <a key={e.id} className={`tile ${passed ? 'done' : ''}`} href={href({ name: 'category', id: e.id })} data-testid={`tile-${e.id}`}>
                    {passed && <span className="corner">🏆</span>}
                    {ready && <span className="corner">⚔️</span>}
                    <span className="emoji">{e.emoji}</span>
                    <span className="title">{e.title}</span>
                    <span className="sub">{e.titleEn}</span>
                    <span className="tile-foot">
                      <Bar value={ld + (passed ? 1 : 0)} max={cat.lessons.length + 1} kind="ok" />
                    </span>
                  </a>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="stage">
        <div className="tiles">
          {finalBoss && finalBossUnlocked(s) ? (
            <a className="tile final" href={href({ name: 'boss', id: 'final' })}>
              <span className="emoji">☕🏆</span>
              <span className="title">{t('map.finalBoss')}</span>
              <span className="sub">{t('map.finalBossDesc')}</span>
            </a>
          ) : (
            <div className="tile final locked">
              <span className="corner">🔒</span>
              <span className="emoji">☕🏆</span>
              <span className="title">{t('map.finalBoss')}</span>
              <span className="sub">{t('map.finalLocked')}</span>
            </div>
          )}
        </div>
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
