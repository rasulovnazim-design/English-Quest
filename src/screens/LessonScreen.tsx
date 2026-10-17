import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { categories, lessonKey } from '../data';
import { buildLesson, isScored, refsFor, type Exercise } from '../engine/exercises';
import { addCoins, addXp, completeLesson, getState, setStars, starsFor, useStore } from '../engine/store';
import { lessonCoins } from '../engine/avatar';
import { sfx } from '../engine/sfx';
import { Avatar } from '../components/Avatar';
import { scoreExercise, XP } from '../engine/xp';
import { stopSpeaking } from '../engine/speech';
import { ExerciseView, type Outcome } from '../components/Exercises';
import { FeedbackSheet } from '../components/Feedback';
import { Bar, Confetti, Modal } from '../components/common';
import { go, href } from '../router';
import { t } from '../locale';

interface Slot {
  ex: Exercise;
  retry: boolean;
}

export function LessonScreen({ catId, lessonId }: { catId: string; lessonId: string }) {
  const cat = categories[catId];
  const lesson = cat?.lessons.find((l) => l.id === lessonId);
  const initial = useMemo<Slot[]>(
    () => (cat && lesson ? buildLesson(cat, lesson, { accent: getState().settings.accent }).map((ex) => ({ ex, retry: false })) : []),
    [cat, lesson]
  );
  const [queue, setQueue] = useState<Slot[]>(initial);
  const [pos, setPos] = useState(0);
  const [outcome, setOutcome] = useState<(Outcome & { xp: number }) | null>(null);
  const [earned, setEarned] = useState(0);
  const [stats, setStats] = useState({ answered: 0, right: 0 });
  const [finished, setFinished] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [key, setKey] = useState(0);

  const onSubmit = useCallback(
    (o: Outcome) => {
      const slot = queue[pos];
      if (o.skipped) {
        setOutcome(null);
        setPos((p) => p + 1);
        setKey((k) => k + 1);
        if (pos + 1 >= queue.length) setFinished(true);
        return;
      }
      const xp = o.xp ?? scoreExercise({ correct: o.correct, firstTry: !slot.retry && !o.mistakes, hints: o.hints });
      if (xp > 0) addXp(xp);
      setEarned((e) => e + xp);
      setStats((s) => ({ answered: s.answered + 1, right: s.right + (o.correct && !slot.retry ? 1 : 0) }));
      if (!o.correct) setQueue((q) => [...q, { ex: slot.ex, retry: true }]);
      setOutcome({ ...o, xp });
    },
    [queue, pos]
  );

  const next = useCallback(() => {
    stopSpeaking();
    setOutcome(null);
    setKey((k) => k + 1);
    if (pos + 1 >= queue.length) {
      setFinished(true);
      return;
    }
    setPos((p) => p + 1);
  }, [pos, queue.length]);

  if (!cat || !lesson) {
    return (
      <div className="page full">
        <a href={href({ name: 'map' })}>{t('nav.back')}</a>
      </div>
    );
  }

  if (finished) return <LessonDone catId={catId} lessonId={lessonId} earned={earned} stats={stats} />;

  const slot = queue[pos];
  const scoredTotal = queue.filter((s) => isScored(s.ex)).length || 1;
  const scoredDone = queue.slice(0, pos).filter((s) => isScored(s.ex)).length;

  return (
    <div className="page full">
      <div className="lesson-top">
        <button className="iconbtn" onClick={() => setConfirmQuit(true)} aria-label={t('nav.close')}>
          ✕
        </button>
        <Bar value={scoredDone} max={scoredTotal} kind="ok" />
        <span className="stat xp">⚡ {earned}</span>
      </div>
      {slot && (
        <ExerciseView key={key} ex={slot.ex} locked={!!outcome} onSubmit={onSubmit} onContinue={next} />
      )}
      {outcome && <FeedbackSheet check={outcome.check} correct={outcome.correct} xp={outcome.xp} audio={outcome.audio} onContinue={next} />}
      {confirmQuit && (
        <Modal title={t('lesson.quit')} onClose={() => setConfirmQuit(false)}>
          <p>{t('lesson.quitText')}</p>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <button className="btn block" onClick={() => setConfirmQuit(false)}>
              {t('lesson.quitNo')}
            </button>
            <button
              className="btn bad block"
              onClick={() => {
                stopSpeaking();
                go({ name: 'category', id: catId });
              }}
            >
              {t('lesson.quitYes')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function LessonDone({
  catId,
  lessonId,
  earned,
  stats
}: {
  catId: string;
  lessonId: string;
  earned: number;
  stats: { answered: number; right: number };
}) {
  const cat = categories[catId];
  const idx = cat.lessons.findIndex((l) => l.id === lessonId);
  const nextLesson = cat.lessons[idx + 1];
  const accuracy = stats.answered ? Math.round((stats.right / stats.answered) * 100) : 100;
  const stars = starsFor(accuracy);
  const coins = lessonCoins(stars);
  const look = useStore((x) => x.avatar);
  const saved = useRef(false);
  useEffect(() => {
    if (saved.current) return;
    saved.current = true;
    const lesson = cat.lessons[idx];
    completeLesson(lessonKey(catId, lessonId), accuracy, refsFor(cat, lesson.items).map((r) => r.key));
    setStars(lessonKey(catId, lessonId), stars);
    addCoins(coins);
    addXp(XP.lessonDone);
    sfx.win();
    setTimeout(() => sfx.coin(), 900);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="page full" data-testid="lesson-done">
      <div className="card levelup">
        <Confetti />
        <Avatar look={look} size={130} mood="jump" />
        <h2>{t('lesson.finished')}</h2>
        <div className="stars-big" aria-label={t('lesson.stars')}>
          {[1, 2, 3].map((n) => (
            <span key={n} className={n <= stars ? '' : 'off'}>
              ⭐
            </span>
          ))}
        </div>
        <p className="xp-pop">{t('lesson.earned', { n: earned + XP.lessonDone })}</p>
        <p>
          <span className="coin-reward">🪙 {t('lesson.coins', { n: coins })}</span>
        </p>
        <p className="muted">{t('lesson.accuracy', { n: accuracy })}</p>
        <div className="stack">
          {nextLesson ? (
            <a className="btn primary block" href={href({ name: 'lesson', id: catId, lesson: nextLesson.id })} data-testid="next-lesson">
              {t('lesson.next')} →
            </a>
          ) : (
            <a className="btn primary block" href={href({ name: 'boss', id: catId })} data-testid="to-boss">
              🏆 {t('category.boss')}
            </a>
          )}
          <a className="btn block" href={href({ name: 'category', id: catId })} data-testid="to-category">
            {t('lesson.toCategory')}
          </a>
        </div>
      </div>
    </div>
  );
}
