import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { categories } from '../data';
import {
  AXES,
  BAGS,
  COINS_PER_LOG,
  PETS,
  REGROW_MS,
  axeOf,
  bagOf,
  hitsNeeded,
  lessonKeyOf,
  logsFor,
  newWordsFor,
  oakUnlocked,
  pictureable,
  treeGrowing,
  treeQuestions,
  treeUnlocked,
  zone,
  type ZoneTree
} from '../engine/forest';
import {
  addCoins,
  addXp,
  completeLesson,
  getState,
  gradeItem,
  setStars,
  starsFor,
  updateForest,
  useStore
} from '../engine/store';
import { dueKeys } from '../engine/srs';
import { reviewExercise } from '../engine/review';
import { refsFor, type Exercise } from '../engine/exercises';
import { findItem, groupOf } from '../data';
import { scoreExercise } from '../engine/xp';
import { sfx } from '../engine/sfx';
import { speak, speakRu, stopSpeaking } from '../engine/speech';
import { Avatar } from '../components/Avatar';
import { AxeArt, GateArt, SawmillArt, ShopArt, TreeArt } from '../components/ForestArt';
import { ExerciseView, type Outcome } from '../components/Exercises';
import { Confetti, Modal, PlayButtons, Toast } from '../components/common';
import { go, setReturnTo } from '../router';
import { t } from '../locale';

const SPEED = 560; // px per second
const LEAVES = ['#2ed573', '#26de81', '#20bf6b', '#7bed9f', '#55e6c1'];

type Panel =
  | { kind: 'intro'; tree: ZoneTree }
  | { kind: 'chop'; tree?: ZoneTree; golden?: boolean }
  | { kind: 'sawmill' }
  | { kind: 'shop' }
  | null;

function formatTime(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function ForestScreen() {
  const s = useStore((x) => x);
  const f = s.forest;
  const mode = f.mode;
  const viewRef = useRef<HTMLDivElement>(null);
  const [vw, setVw] = useState(390);
  const [x, setX] = useState(f.x);
  const xRef = useRef(f.x);
  const [facing, setFacing] = useState<1 | -1>(1);
  const [walking, setWalking] = useState(false);
  const target = useRef<{ x: number; then?: () => void } | null>(null);
  const hold = useRef<0 | 1 | -1>(0);
  const [panel, setPanel] = useState<Panel>(null);
  const [toast, setToast] = useState('');
  const [hit, setHit] = useState(0); // increments on every successful chop (for animations)
  const [falling, setFalling] = useState<string | null>(null);
  const [timber, setTimber] = useState<{ logs: number; lost: number } | null>(null);
  const [now, setNow] = useState(Date.now());

  // Keep the clock ticking so regrowing trees update.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setVw(el.clientWidth));
    ro.observe(el);
    setVw(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Movement loop: walks towards a target, or in the held direction.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const step = (time: number) => {
      const dt = Math.min(0.05, (time - last) / 1000);
      last = time;
      let nx = xRef.current;
      if (hold.current) {
        target.current = null;
        nx += hold.current * SPEED * dt;
        setFacing(hold.current);
      } else if (target.current) {
        const d = target.current.x - nx;
        const stepLen = SPEED * dt;
        if (Math.abs(d) <= stepLen) {
          nx = target.current.x;
          const then = target.current.then;
          target.current = null;
          setWalking(false);
          updateForest({ x: Math.round(nx) });
          then?.();
        } else {
          nx += Math.sign(d) * stepLen;
          setFacing(d > 0 ? 1 : -1);
        }
      }
      nx = Math.max(60, Math.min(zone.width - 60, nx));
      if (nx !== xRef.current) {
        xRef.current = nx;
        setX(nx);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const walkTo = useCallback((tx: number, then?: () => void) => {
    if (Math.abs(tx - xRef.current) < 4) {
      then?.();
      return;
    }
    setWalking(true);
    target.current = { x: tx, then };
  }, []);

  // Keyboard: arrows / A, D to walk.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (panel || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft' || e.key === 'a') hold.current = -1;
      if (e.key === 'ArrowRight' || e.key === 'd') hold.current = 1;
      if (hold.current) setWalking(true);
    };
    const up = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) {
        hold.current = 0;
        setWalking(false);
        updateForest({ x: Math.round(xRef.current) });
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [panel]);

  useEffect(() => {
    if (panel?.kind === 'chop' || panel?.kind === 'intro') viewRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [panel]);

  const camera = Math.max(0, Math.min(zone.width - vw, x - vw / 2));
  const bag = bagOf(f);
  const axe = axeOf(f);
  const bagFull = f.logs >= bag.capacity;
  const dueCount = useMemo(() => dueKeys(s.srs, undefined, 999).length, [s.srs]);
  const goldenReady = dueCount >= 3 && !treeGrowing(s, 'golden', now);

  const say = (text: string, key = 'toast') => {
    setToast(text);
    if (mode === 'little') speakRu(key, text);
  };

  const openTree = (tree: ZoneTree, index: number) => {
    sfx.tap();
    if (!treeUnlocked(s, index)) {
      walkTo(tree.x - 70);
      say(t('forest.lockedTree'), 'lockedTree');
      return;
    }
    if (treeGrowing(s, tree.id, now)) {
      say(t('forest.growing', { time: formatTime(s.forest.trees[tree.id].regrowAt - now) }));
      return;
    }
    if (bagFull) {
      say(t('forest.bagFull'), 'bagFull');
      return;
    }
    walkTo(tree.x - 70, () => {
      const first = !(s.forest.trees[tree.id]?.felled ?? 0);
      setPanel(first ? { kind: 'intro', tree } : { kind: 'chop', tree });
    });
  };

  const openOak = (cat: string) => {
    sfx.tap();
    if (s.bosses[cat]?.passed) {
      say(t('forest.oakDone'), 'oakDone');
      return;
    }
    if (!oakUnlocked(s, cat)) {
      say(t('forest.oakLocked'), 'oakLocked');
      return;
    }
    const oak = zone.oaks.find((o) => o.cat === cat)!;
    walkTo(oak.x - 90, () => {
      setReturnTo({ name: 'forest' });
      go({ name: 'boss', id: cat });
    });
  };

  const felled = (treeId: string, size: 'small' | 'medium' | 'golden', accuracy: number, tree?: ZoneTree) => {
    const st = getState();
    const fs = st.forest;
    const logs = logsFor(size, fs);
    const space = bagOf(fs).capacity - fs.logs;
    const got = Math.min(logs, space);
    const prev = fs.trees[treeId]?.felled ?? 0;
    updateForest((cur) => ({
      logs: cur.logs + got,
      trees: { ...cur.trees, [treeId]: { felled: prev + 1, regrowAt: Date.now() + REGROW_MS } }
    }));
    if (tree && prev === 0) {
      const cat = categories[tree.cat];
      completeLesson(lessonKeyOf(tree), accuracy, refsFor(cat, cat.lessons.find((l) => l.id === tree.lesson)!.items).map((r) => r.key));
    }
    if (tree) setStars(lessonKeyOf(tree), starsFor(accuracy));
    setFalling(treeId);
    setTimeout(() => setFalling(null), 1200);
    setTimber({ logs: got, lost: logs - got });
    sfx.win();
  };

  const sell = () => {
    const logs = getState().forest.logs;
    if (!logs) return;
    const coins = logs * COINS_PER_LOG;
    addCoins(coins);
    updateForest({ logs: 0 });
    sfx.coin();
    say(t('forest.sold', { logs, coins }));
    setPanel(null);
  };

  const onSceneTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (panel) return;
    const rect = e.currentTarget.getBoundingClientRect();
    walkTo(e.clientX - rect.left + camera);
  };

  const holdBtn = (dir: 1 | -1) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      hold.current = dir;
      setWalking(true);
    },
    onPointerUp: () => {
      hold.current = 0;
      setWalking(false);
      updateForest({ x: Math.round(xRef.current) });
    },
    onPointerLeave: () => {
      if (hold.current === dir) {
        hold.current = 0;
        setWalking(false);
      }
    }
  });

  /** The next tree to chop: the first one never felled, otherwise the first one ready again. */
  const nextTree = (() => {
    const order = zone.trees.map((tr, i) => ({ tr, i }));
    const fresh = order.find(({ tr, i }) => treeUnlocked(s, i) && !(s.forest.trees[tr.id]?.felled ?? 0));
    if (fresh) return fresh;
    const oakCat = zone.oaks.find((o) => oakUnlocked(s, o.cat) && !s.bosses[o.cat]?.passed);
    if (oakCat) return { oak: oakCat.cat };
    return order.find(({ tr }) => !treeGrowing(s, tr.id, now));
  })();

  const goNext = () => {
    if (!nextTree) return say(t('forest.allGrowing'), 'allGrowing');
    if ('oak' in nextTree) return openOak(nextTree.oak as string);
    openTree(nextTree.tr, nextTree.i);
  };

  // Which object is the player standing next to? (for the quick action button)
  const near = (() => {
    if (Math.abs(x - zone.sawmill.x) < 120) return 'sawmill';
    if (Math.abs(x - zone.shop.x) < 110) return 'shop';
    return null;
  })();

  return (
    <div className="forest-page">
      <div className="forest-hud">
        <span className="stat coins" data-testid="hud-coins">🪙 {s.coins}</span>
        <span className={`stat logs ${bagFull ? 'full' : ''}`} data-testid="hud-logs">
          {bag.emoji} 🪵 {f.logs}/{bag.capacity}
        </span>
        <span className="stat">{axe.emoji} 🪓</span>
        <span className="spacer" />
        <span className="zone-name">🌲 {zone.title}</span>
      </div>

      <div
        className="forest-view"
        ref={viewRef}
        onClick={onSceneTap}
        // Focusing a tree would make the browser scroll this box by itself; the camera handles movement.
        onScroll={(e) => {
          e.currentTarget.scrollLeft = 0;
          e.currentTarget.scrollTop = 0;
        }}
        data-testid="forest"
      >
        <div className="forest-hills" style={{ transform: `translateX(${-camera * 0.3}px)` }} />
        <div className="forest-world" style={{ width: zone.width, transform: `translateX(${-camera}px)` }}>
          <div className="forest-ground" />
          {/* shop */}
          <button
            className="forest-obj"
            style={{ left: zone.shop.x - 75 }}
            onClick={(e) => {
              e.stopPropagation();
              sfx.tap();
              walkTo(zone.shop.x + 10, () => setPanel({ kind: 'shop' }));
            }}
            aria-label={t('forest.shop')}
            data-testid="shop"
          >
            <ShopArt />
            <span className="obj-label">{t('forest.shop')}</span>
          </button>
          {/* sawmill */}
          <button
            className="forest-obj"
            style={{ left: zone.sawmill.x - 85 }}
            onClick={(e) => {
              e.stopPropagation();
              sfx.tap();
              walkTo(zone.sawmill.x - 10, () => setPanel({ kind: 'sawmill' }));
            }}
            aria-label={t('forest.sawmill')}
            data-testid="sawmill"
          >
            <SawmillArt />
            <span className="obj-label">{t('forest.sawmill')}</span>
            {bagFull && <span className="obj-arrow">⬇️</span>}
          </button>
          {/* golden review tree */}
          {goldenReady && (
            <button
              className="forest-obj tree-obj"
              style={{ left: zone.golden.x - 60 }}
              onClick={(e) => {
                e.stopPropagation();
                sfx.tap();
                if (bagFull) return say(t('forest.bagFull'), 'bagFull');
                walkTo(zone.golden.x - 70, () => setPanel({ kind: 'chop', golden: true }));
              }}
              aria-label={t('forest.golden')}
              data-testid="golden-tree"
            >
              <span className={`tree-sway ${falling === 'golden' ? 'fall' : ''} ${panel?.kind === 'chop' && panel.golden ? `hit-${hit % 2}` : ''}`}>
                <TreeArt look="golden" size={0.85} />
              </span>
              <span className="obj-label gold">✨ {t('forest.golden')}</span>
            </button>
          )}
          {/* lesson trees */}
          {zone.trees.map((tree, i) => {
            const unlocked = treeUnlocked(s, i);
            const growing = treeGrowing(s, tree.id, now);
            const chopping = panel?.kind === 'chop' && panel.tree?.id === tree.id;
            const stars = s.stars[lessonKeyOf(tree)] ?? 0;
            const look = falling === tree.id ? 'normal' : growing ? 'sapling' : 'normal';
            const size = tree.size === 'small' ? 0.78 : 0.95;
            return (
              <button
                key={tree.id}
                className={`forest-obj tree-obj ${unlocked ? '' : 'locked'}`}
                style={{ left: tree.x - 60 * size }}
                onClick={(e) => {
                  e.stopPropagation();
                  openTree(tree, i);
                }}
                aria-label={`${t('forest.tree')} ${i + 1}`}
                data-testid={`tree-${tree.id}`}
                data-state={!unlocked ? 'locked' : growing ? 'growing' : 'ready'}
              >
                <span className={`tree-sway ${falling === tree.id ? 'fall' : ''} ${chopping ? `hit-${hit % 2}` : ''}`}>
                  <TreeArt look={look} size={size} leaf={LEAVES[i % LEAVES.length]} />
                </span>
                {growing && falling !== tree.id && <span className="obj-label">🌱 {formatTime(s.forest.trees[tree.id].regrowAt - now)}</span>}
                {!growing && (
                  <span className="obj-label">
                    {unlocked ? categories[tree.cat]?.emoji : '🔒'} {stars > 0 ? '⭐'.repeat(stars) : t('forest.new')}
                  </span>
                )}
              </button>
            );
          })}
          {/* giant oaks (conversations) */}
          {zone.oaks.map((oak) => {
            const done = !!s.bosses[oak.cat]?.passed;
            const open = oakUnlocked(s, oak.cat);
            return (
              <button
                key={oak.cat}
                className={`forest-obj tree-obj ${open || done ? '' : 'locked'}`}
                style={{ left: oak.x - 80 }}
                onClick={(e) => {
                  e.stopPropagation();
                  openOak(oak.cat);
                }}
                aria-label={t('forest.oak')}
                data-testid={`oak-${oak.cat}`}
              >
                {done ? <TreeArt look="stump" size={1.6} /> : <TreeArt look="oak" size={1} />}
                <span className="obj-label oak">
                  {done ? '🏆' : open ? '⚔️' : '🔒'} {t('forest.oak')} · {categories[oak.cat]?.boss.avatar}
                </span>
              </button>
            );
          })}
          <div className="forest-obj" style={{ left: zone.gate.x - 70 }} onClick={(e) => (e.stopPropagation(), say(t('forest.gate', { name: zone.gate.title })))}>
            <GateArt title={zone.gate.title} />
          </div>
          {/* the player */}
          <div className={`forest-player ${walking ? 'walking' : ''}`} style={{ left: x - 30 }}>
            <div style={{ transform: `scaleX(${facing})` }}>
              <span className={`player-axe ${hit ? `swing-${hit % 2}` : ''}`}>
                <AxeArt colour={axe.colour} />
              </span>
              <Avatar look={s.avatar} size={96} />
            </div>
            {f.pets.map((p, i) => (
              <span key={p} className="pet" style={{ left: -34 - i * 30 }}>
                {PETS.find((x) => x.id === p)?.emoji}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="forest-controls">
        <button className="btn move" {...holdBtn(-1)} aria-label={t('forest.left')}>
          ◀
        </button>
        {near === 'sawmill' && (
          <button className="btn primary" onClick={() => setPanel({ kind: 'sawmill' })}>
            🪚 {t('forest.sawmill')}
          </button>
        )}
        {near === 'shop' && (
          <button className="btn primary" onClick={() => setPanel({ kind: 'shop' })}>
            🛒 {t('forest.shop')}
          </button>
        )}
        {!near && (
          <button className="btn primary" onClick={bagFull ? () => walkTo(zone.sawmill.x - 10, () => setPanel({ kind: 'sawmill' })) : goNext} data-testid="next-tree">
            {bagFull ? `🪚 ${t('forest.toSawmill')}` : `🌳 ${t('forest.nextTree')}`}
          </button>
        )}
        <button className="btn move" {...holdBtn(1)} aria-label={t('forest.right')}>
          ▶
        </button>
      </div>

      {panel?.kind === 'intro' && (
        <IntroPanel
          tree={panel.tree}
          little={mode === 'little'}
          onStart={() => setPanel({ kind: 'chop', tree: panel.tree })}
          onClose={() => setPanel(null)}
        />
      )}
      {panel?.kind === 'chop' && (
        <ChopPanel
          key={panel.tree?.id ?? 'golden'}
          tree={panel.tree}
          golden={panel.golden}
          mode={mode ?? 'big'}
          onHit={() => setHit((h) => h + 1)}
          onFelled={(acc) => {
            if (panel.golden) felled('golden', 'golden', acc);
            else if (panel.tree) felled(panel.tree.id, panel.tree.size, acc, panel.tree);
            setPanel(null);
          }}
          onClose={() => {
            stopSpeaking();
            setPanel(null);
          }}
        />
      )}
      {panel?.kind === 'sawmill' && (
        <Modal title={`🪚 ${t('forest.sawmill')}`} onClose={() => setPanel(null)}>
          <p>{t('forest.sawmillText', { price: COINS_PER_LOG })}</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 900, textAlign: 'center' }}>
            🪵 {f.logs} → 🪙 {f.logs * COINS_PER_LOG}
          </p>
          <button className="btn primary block" disabled={!f.logs} onClick={sell} data-testid="sell">
            {f.logs ? t('forest.sell') : t('forest.noLogs')}
          </button>
        </Modal>
      )}
      {panel?.kind === 'shop' && <ShopPanel onClose={() => setPanel(null)} onMessage={say} />}
      {timber && (
        <div className="timber" onClick={() => setTimber(null)} data-testid="timber">
          <Confetti />
          <div className="timber-card">
            <div className="timber-word">TIMBER!</div>
            <div className="timber-logs">+{timber.logs} 🪵</div>
            {timber.lost > 0 && <div className="small">{t('forest.lost', { n: timber.lost })}</div>}
            <button className="btn primary block" onClick={() => setTimber(null)} data-testid="timber-ok">
              {t('forest.great')}
            </button>
          </div>
        </div>
      )}
      {!mode && <ModePicker />}
      {toast && <Toast text={toast} onDone={() => setToast('')} />}
    </div>
  );
}

function ModePicker() {
  const choose = (m: 'little' | 'big') => {
    sfx.correct();
    updateForest({ mode: m });
    if (m === 'little') speakRu('hello', t('voice.hello'));
  };
  return (
    <div className="overlay">
      <div className="modal" role="dialog" aria-modal="true" style={{ textAlign: 'center' }}>
        <h2>{t('forest.whoPlays')}</h2>
        <p className="muted">{t('forest.whoPlaysText')}</p>
        <div className="mode-grid">
          <button className="mode-btn" onClick={() => choose('little')} data-testid="mode-little">
            <span className="big-emoji">🧸</span>
            <b>{t('forest.little')}</b>
            <span className="small muted">{t('forest.littleText')}</span>
          </button>
          <button className="mode-btn" onClick={() => choose('big')} data-testid="mode-big">
            <span className="big-emoji">🎒</span>
            <b>{t('forest.big')}</b>
            <span className="small muted">{t('forest.bigText')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function IntroPanel({ tree, little, onStart, onClose }: { tree: ZoneTree; little: boolean; onStart: () => void; onClose: () => void }) {
  const accent = useStore((x) => x.settings.accent);
  const refs = newWordsFor(tree).filter((r) => !little || r.group === 'letter' || pictureable(r));
  const list = refs.length ? refs : newWordsFor(tree);
  useEffect(() => {
    if (little) speakRu('newWords', t('voice.newWords'));
  }, [little]);
  return (
    <div className="chop-panel" role="dialog" aria-label={t('lesson.newWords')}>
      <div className="row">
        <h2 className="ex-title" style={{ flex: 1 }}>
          ✨ {t('lesson.newWords')}
        </h2>
        <button className="iconbtn" onClick={onClose} aria-label={t('nav.close')}>
          ✕
        </button>
      </div>
      <p className="small muted">{t('lesson.tapToHear')}</p>
      <div className="seed-grid">
        {list.map((r) => {
          const en = accent === 'us' && r.item.us ? r.item.us : r.item.en;
          return (
            <button key={r.key} className="seed" onClick={() => speak(r.item.say ?? en)}>
              <span className="seed-pic">{r.group === 'letter' ? r.item.en : r.item.emoji ?? '💬'}</span>
              {!little && <span className="seed-en">{r.group === 'letter' ? r.item.ru : en}</span>}
              {!little && r.group !== 'letter' && <span className="seed-ru">{r.item.ru}</span>}
            </button>
          );
        })}
      </div>
      <button className="btn primary block" onClick={onStart} data-testid="start-chop">
        🪓 {t('forest.startChop')}
      </button>
    </div>
  );
}

function ChopPanel({
  tree,
  golden,
  mode,
  onHit,
  onFelled,
  onClose
}: {
  tree?: ZoneTree;
  golden?: boolean;
  mode: 'little' | 'big';
  onHit: () => void;
  onFelled: (accuracy: number) => void;
  onClose: () => void;
}) {
  const f = getState().forest;
  const needed = golden ? 3 : hitsNeeded(tree!.size, f);
  const questions = useMemo<{ ex: Exercise; key?: string }[]>(() => {
    const st = getState();
    if (golden) {
      const keys = dueKeys(st.srs, undefined, 12);
      const out: { ex: Exercise; key: string }[] = [];
      for (const k of keys) {
        const found = findItem(k);
        if (!found) continue;
        if (mode === 'little') {
          const g = groupOf(found.cat, found.item.id);
          if (g !== 'letter' && !(g === 'word' && found.item.emoji && found.item.pic !== false)) continue;
        }
        const ex = reviewExercise(k, st.srs[k], st.settings.accent);
        if (ex) out.push({ ex, key: k });
      }
      return out;
    }
    return treeQuestions(tree!, mode, st.settings.accent, needed).map((ex) => ({ ex }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const [hits, setHits] = useState(0);
  const [answers, setAnswers] = useState({ total: 0, right: 0 });
  const [wrong, setWrong] = useState<Outcome | null>(null);
  const [k, setK] = useState(0);
  const [combo, setCombo] = useState(0);

  const q = questions.length ? questions[i % questions.length] : undefined;
  const advance = () => {
    setWrong(null);
    setI((n) => n + 1);
    setK((n) => n + 1);
  };

  useEffect(() => {
    if (!q) onFelled(100);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = (o: Outcome) => {
    if (o.skipped) {
      advance();
      return;
    }
    const st = getState();
    if (golden && q?.key) gradeItem(q.key, !o.correct ? 'again' : o.hints || o.check?.status === 'typo' ? 'hard' : 'good');
    const next = { total: answers.total + 1, right: answers.right + (o.correct ? 1 : 0) };
    setAnswers(next);
    if (!o.correct) {
      sfx.wrong();
      setCombo(0);
      setWrong(o);
      if (mode === 'little') speakRu('tryAgain', t('voice.tryAgain'));
      return;
    }
    const xp = scoreExercise({ correct: true, firstTry: true, hints: o.hints });
    addXp(xp);
    if (st.forest.pets.includes('owl')) addCoins(1);
    sfx.chop();
    onHit();
    setCombo((c) => c + 1);
    const h = hits + 1;
    setHits(h);
    if (h >= needed) {
      setTimeout(() => onFelled(Math.round((next.right / next.total) * 100)), 450);
    } else {
      setTimeout(advance, 650);
    }
  };

  if (!q) return null;
  const hp = Math.max(0, needed - hits);
  return (
    <div className="chop-panel" role="dialog" aria-label={t('forest.chopping')} data-testid="chop-panel">
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <div className="tree-hp" aria-label={t('forest.hitsLeft', { n: hp })}>
          {Array.from({ length: needed }, (_, n) => (
            <span key={n} className={n < hp ? 'on' : 'off'}>
              🪵
            </span>
          ))}
        </div>
        {combo >= 2 && <span className="combo">🔥 x{combo}</span>}
        <span className="spacer" />
        <button className="iconbtn" onClick={onClose} aria-label={t('nav.close')}>
          ✕
        </button>
      </div>
      {!wrong && (
        <ExerciseView
          key={k}
          ex={q.ex}
          locked={false}
          onSubmit={onSubmit}
          onContinue={advance}
          autoplay
          readAloud={mode === 'little'}
        />
      )}
      {wrong && (
        <div className="chop-wrong" data-testid="feedback" data-status="bad">
          <h3>🙈 {t('forest.missed')}</h3>
          {wrong.check?.expected && (
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <div style={{ flex: 1 }}>
                {t('lesson.rightAnswer', { text: '' })}
                <b style={{ fontSize: q.ex.kind === 'choice' && q.ex.mode === 'picture' ? '2rem' : undefined }}>{wrong.check.expected}</b>
              </div>
              {(wrong.audio || (q.ex.kind === 'choice' && q.ex.audio)) && (
                <PlayButtons text={(wrong.audio ?? (q.ex.kind === 'choice' ? q.ex.audio : '')) || ''} size="mini" />
              )}
            </div>
          )}
          {mode === 'big' && wrong.check?.why && <p className="small">💡 {wrong.check.why}</p>}
          <button className="btn primary block" onClick={advance} data-testid="continue">
            {t('lesson.continue')}
          </button>
        </div>
      )}
    </div>
  );
}

function ShopPanel({ onClose, onMessage }: { onClose: () => void; onMessage: (m: string) => void }) {
  const s = useStore((x) => x);
  const [tab, setTab] = useState<'axe' | 'bag' | 'pet'>('axe');
  const buy = (price: number, apply: () => void) => {
    if (getState().coins < price) {
      sfx.wrong();
      onMessage(t('avatar.notEnough'));
      return;
    }
    addCoins(-price);
    apply();
    sfx.coin();
    onMessage(t('avatar.bought'));
  };
  return (
    <Modal title={`🛒 ${t('forest.shop')}`} onClose={onClose}>
      <div className="row" style={{ marginBottom: 10 }}>
        <span className="stat coins">🪙 {s.coins}</span>
      </div>
      <div className="shop-tabs seg">
        {(['axe', 'bag', 'pet'] as const).map((k) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {t(`forest.tab.${k}`)}
          </button>
        ))}
      </div>
      <div className="stack" style={{ marginTop: 12 }}>
        {tab === 'axe' &&
          AXES.map((a) => {
            const have = a.price === 0 || s.forest.axe === a.id || AXES.findIndex((x) => x.id === s.forest.axe) >= AXES.indexOf(a);
            return (
              <div className="shop-row" key={a.id}>
                <AxeArt colour={a.colour} />
                <div style={{ flex: 1 }}>
                  <b>{a.name}</b>
                  <div className="small muted">{t('forest.axePerk', { power: a.power, bonus: a.bonus })}</div>
                </div>
                {s.forest.axe === a.id ? (
                  <span className="chip ok">✅</span>
                ) : have ? (
                  <button className="btn small" onClick={() => updateForest({ axe: a.id })}>
                    {t('avatar.wear')}
                  </button>
                ) : (
                  <button className="btn small primary" onClick={() => buy(a.price, () => updateForest({ axe: a.id }))} data-testid={`buy-${a.id}`}>
                    🪙 {a.price}
                  </button>
                )}
              </div>
            );
          })}
        {tab === 'bag' &&
          BAGS.map((b) => {
            const have = BAGS.findIndex((x) => x.id === s.forest.bag) >= BAGS.indexOf(b);
            return (
              <div className="shop-row" key={b.id}>
                <span style={{ fontSize: '2rem' }}>{b.emoji}</span>
                <div style={{ flex: 1 }}>
                  <b>{b.name}</b>
                  <div className="small muted">{t('forest.bagPerk', { n: b.capacity })}</div>
                </div>
                {s.forest.bag === b.id ? (
                  <span className="chip ok">✅</span>
                ) : have ? (
                  <button className="btn small" onClick={() => updateForest({ bag: b.id })}>
                    {t('avatar.wear')}
                  </button>
                ) : (
                  <button className="btn small primary" onClick={() => buy(b.price, () => updateForest({ bag: b.id }))} data-testid={`buy-${b.id}`}>
                    🪙 {b.price}
                  </button>
                )}
              </div>
            );
          })}
        {tab === 'pet' &&
          PETS.map((p) => (
            <div className="shop-row" key={p.id}>
              <span style={{ fontSize: '2rem' }}>{p.emoji}</span>
              <div style={{ flex: 1 }}>
                <b>{p.name}</b>
                <div className="small muted">{p.perk}</div>
              </div>
              {s.forest.pets.includes(p.id) ? (
                <span className="chip ok">✅</span>
              ) : (
                <button className="btn small primary" onClick={() => buy(p.price, () => updateForest((cur) => ({ pets: [...cur.pets, p.id] })))}>
                  🪙 {p.price}
                </button>
              )}
            </div>
          ))}
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>
        {t('forest.shopHint')}
      </p>
    </Modal>
  );
}
