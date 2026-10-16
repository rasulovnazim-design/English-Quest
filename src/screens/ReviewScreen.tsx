import { useCallback, useMemo, useState } from 'react';
import { addXp, getState, gradeItem, useStore } from '../engine/store';
import { dueKeys } from '../engine/srs';
import { buildReview, type ReviewTask } from '../engine/review';
import { scoreExercise } from '../engine/xp';
import { stopSpeaking } from '../engine/speech';
import { ExerciseView, type Outcome } from '../components/Exercises';
import { FeedbackSheet } from '../components/Feedback';
import { Bar } from '../components/common';
import { href } from '../router';
import { t } from '../locale';

export function ReviewScreen() {
  const srs = useStore((s) => s.srs);
  const [session, setSession] = useState<ReviewTask[] | null>(null);
  const due = useMemo(() => dueKeys(srs, undefined, 999), [srs]);
  const all = Object.values(srs);
  const strong = all.filter((c) => c.box >= 4).length;
  const weak = all.filter((c) => c.box <= 1 && c.lapses > 0).length;

  if (session) return <ReviewRun tasks={session} onEnd={() => setSession(null)} />;

  return (
    <div className="page">
      <h1>🔁 {t('review.title')}</h1>
      <div className="card">
        <p>{t('review.intro')}</p>
        <div className="row">
          <span className="chip">{t('review.learned', { n: all.length })}</span>
          <span className="chip ok">{t('review.strong', { n: strong })}</span>
          <span className="chip">{t('review.weak', { n: weak })}</span>
        </div>
      </div>
      {all.length === 0 ? (
        <p className="muted">{t('review.nothingYet')}</p>
      ) : due.length === 0 ? (
        <p className="muted">✅ {t('review.nothing')}</p>
      ) : (
        <>
          <p>
            <b>{t('review.due', { n: due.length })}</b>
          </p>
          <button
            className="btn primary block"
            data-testid="review-start"
            onClick={() => {
              const s = getState();
              setSession(buildReview(dueKeys(s.srs, undefined, 15), s.srs, s.settings.accent));
            }}
          >
            {t('review.start')}
          </button>
        </>
      )}
    </div>
  );
}

function ReviewRun({ tasks, onEnd }: { tasks: ReviewTask[]; onEnd: () => void }) {
  const [queue, setQueue] = useState(tasks.map((x) => ({ ...x, retry: false })));
  const [pos, setPos] = useState(0);
  const [outcome, setOutcome] = useState<(Outcome & { xp: number }) | null>(null);
  const [earned, setEarned] = useState(0);
  const [k, setK] = useState(0);
  const [done, setDone] = useState(false);

  const onSubmit = useCallback(
    (o: Outcome) => {
      const task = queue[pos];
      const xp = scoreExercise({ correct: o.correct, firstTry: !task.retry, hints: o.hints });
      if (!task.retry) {
        gradeItem(task.key, !o.correct ? 'again' : o.hints || o.check?.status === 'typo' ? 'hard' : 'good');
      }
      if (!o.correct) setQueue((q) => [...q, { ...task, retry: true }]);
      if (xp) addXp(xp);
      setEarned((e) => e + xp);
      setOutcome({ ...o, xp });
    },
    [queue, pos]
  );
  const next = useCallback(() => {
    stopSpeaking();
    setOutcome(null);
    setK((x) => x + 1);
    if (pos + 1 >= queue.length) setDone(true);
    else setPos(pos + 1);
  }, [pos, queue.length]);

  if (done) {
    return (
      <div className="page full">
        <div className="card levelup">
          <div className="big">🧠</div>
          <h2>{t('review.done')}</h2>
          <p className="xp-pop">{t('lesson.earned', { n: earned })}</p>
          <div className="stack">
            <button className="btn primary block" onClick={onEnd}>
              {t('lesson.continue')}
            </button>
            <a className="btn block" href={href({ name: 'map' })}>
              {t('nav.map')}
            </a>
          </div>
        </div>
      </div>
    );
  }
  const task = queue[pos];
  return (
    <div className="page full">
      <div className="lesson-top">
        <button className="iconbtn" onClick={onEnd} aria-label={t('nav.close')}>
          ✕
        </button>
        <Bar value={pos} max={queue.length} kind="ok" />
        <span className="stat xp">⚡ {earned}</span>
      </div>
      <ExerciseView key={k} ex={task.ex} locked={!!outcome} onSubmit={onSubmit} onContinue={next} />
      {outcome && <FeedbackSheet check={outcome.check} correct={outcome.correct} xp={outcome.xp} audio={outcome.audio} onContinue={next} />}
    </div>
  );
}
