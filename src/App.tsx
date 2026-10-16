import { useEffect } from 'react';
import { useRoute, href } from './router';
import { useStore, currentStreak, dailyXp, levelInfo, markLevelSeen } from './engine/store';
import { dueKeys } from './engine/srs';
import { rankForLevel, DAILY_GOALS } from './engine/xp';
import { MapScreen } from './screens/MapScreen';
import { CategoryScreen } from './screens/CategoryScreen';
import { LessonScreen } from './screens/LessonScreen';
import { BossScreen } from './screens/BossScreen';
import { PhrasebookScreen } from './screens/PhrasebookScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { Confetti } from './components/common';
import { t } from './locale';

function useTheme() {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);
}

function TopBar() {
  const s = useStore((x) => x);
  const goal = DAILY_GOALS[s.settings.goal];
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="brand" href={href({ name: 'map' })}>
          <span aria-hidden="true">🗺️</span> {t('app.name')}
        </a>
        <span className="stat streak" title={t('home.streak')}>
          🔥 {currentStreak(s)}
        </span>
        <span className="stat xp" title={t('home.dailyGoal')}>
          ⚡ {Math.min(dailyXp(s), goal)}/{goal}
        </span>
      </div>
    </header>
  );
}

function BottomNav({ active }: { active: string }) {
  const srs = useStore((s) => s.srs);
  const due = dueKeys(srs, undefined, 999).length;
  const items = [
    { name: 'map', ico: '🗺️', label: t('nav.map'), href: href({ name: 'map' }) },
    { name: 'review', ico: '🔁', label: t('nav.review'), href: href({ name: 'review' }), badge: due },
    { name: 'phrasebook', ico: '📖', label: t('nav.phrasebook'), href: href({ name: 'phrasebook' }) },
    { name: 'settings', ico: '⚙️', label: t('nav.settings'), href: href({ name: 'settings' }) }
  ];
  return (
    <nav className="bottomnav" aria-label="Навигация">
      <div className="bottomnav-inner">
        {items.map((i) => (
          <a key={i.name} href={i.href} className={active === i.name ? 'active' : ''} aria-current={active === i.name ? 'page' : undefined}>
            <span className="ico" aria-hidden="true">
              {i.ico}
            </span>
            {i.label}
            {!!i.badge && <span className="badge">{i.badge > 99 ? '99+' : i.badge}</span>}
          </a>
        ))}
      </div>
    </nav>
  );
}

function LevelUp() {
  const s = useStore((x) => x);
  const { level } = levelInfo(s);
  if (level <= s.seenLevel) return null;
  const rank = rankForLevel(level);
  const newRank = rankForLevel(s.seenLevel).key !== rank.key;
  return (
    <>
      <Confetti />
      <div className="overlay" onClick={() => markLevelSeen(level)}>
        <div className="modal levelup" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} data-testid="level-up">
          <div className="big">{newRank ? rank.emoji : '⭐'}</div>
          <h2>{t('levelUp.title')}</h2>
          <p style={{ fontSize: '1.2rem', fontWeight: 700 }}>{t('levelUp.level', { n: level })}</p>
          {newRank && (
            <p>
              {t('levelUp.rank', { rank: t(`rank.${rank.key}`) })} <span className="muted">({rank.en})</span>
            </p>
          )}
          <button className="btn primary block" onClick={() => markLevelSeen(level)}>
            {t('levelUp.ok')}
          </button>
        </div>
      </div>
    </>
  );
}

export function App() {
  useTheme();
  const route = useRoute();
  const immersive = route.name === 'lesson' || route.name === 'boss';
  let screen;
  switch (route.name) {
    case 'map':
      screen = <MapScreen />;
      break;
    case 'category':
      screen = <CategoryScreen key={route.id} id={route.id} />;
      break;
    case 'lesson':
      screen = <LessonScreen key={`${route.id}/${route.lesson}`} catId={route.id} lessonId={route.lesson} />;
      break;
    case 'boss':
      screen = <BossScreen key={route.id} catId={route.id} />;
      break;
    case 'phrasebook':
      screen = <PhrasebookScreen key={route.id ?? 'all'} id={route.id} />;
      break;
    case 'review':
      screen = <ReviewScreen />;
      break;
    case 'settings':
      screen = <SettingsScreen />;
      break;
  }
  const active = route.name === 'category' ? 'map' : route.name;
  return (
    <div className="app">
      {!immersive && <TopBar />}
      <main>{screen}</main>
      {!immersive && <BottomNav active={active} />}
      {!immersive && <LevelUp />}
    </div>
  );
}
