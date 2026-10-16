import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { categories } from '../data';
import type { Boss, BossAnswer, BossNode, Profile } from '../engine/types';
import { checkFree, fill, nodeById, nextNode, profileVars, replyOptions, replyTiles, type Option, type Vars } from '../engine/boss';
import { checkAnswer, type CheckResult } from '../engine/checker';
import { addXp, bossRoundCleared, getState, updateProfile, useStore } from '../engine/store';
import { speak, speakingEnabled, stopSpeaking } from '../engine/speech';
import { scoreExercise, XP } from '../engine/xp';
import { COUNTRY_LIST } from '../engine/patterns';
import { FeedbackSheet } from '../components/Feedback';
import { TileBuilder, SpeakInput } from '../components/Exercises';
import { Confetti, Modal, PlayButtons, e2e, E2E } from '../components/common';
import { href } from '../router';
import { t } from '../locale';

interface Bubble {
  who: 'npc' | 'me';
  en: string;
  ru?: string;
}

const LIVES = 3;

// The final boss is optional content: it appears once src/data/final-boss.json exists.
const finalFiles = import.meta.glob<Boss>('../data/final-boss.json', { eager: true, import: 'default' });
export const finalBoss: Boss | undefined = Object.values(finalFiles)[0];

export function profileComplete(p: Profile) {
  return !!(p.name.trim() && p.age.trim() && p.country.trim() && p.city.trim());
}

export function BossScreen({ catId }: { catId: string }) {
  const isFinal = catId === 'final';
  const cat = categories[catId];
  const boss: Boss | undefined = isFinal ? finalBoss : cat?.boss;
  const progress = useStore((s) => s.bosses[catId]);
  const profile = useStore((s) => s.profile);
  const [round, setRound] = useState<number | null>(null);
  const [editProfile, setEditProfile] = useState(false);

  if (!boss) return <div className="page">{t('nav.back')}</div>;
  const cleared = new Set(progress?.rounds ?? []);
  const rounds = isFinal ? [3] : [1, 2, 3];
  const nextRound = rounds.find((r) => !cleared.has(r)) ?? rounds[0];

  if (round !== null) {
    return <BossRound key={round} boss={boss} catId={catId} round={round} isFinal={isFinal} onExit={() => setRound(null)} onNext={(r) => setRound(r)} />;
  }

  const backHref = isFinal ? href({ name: 'map' }) : href({ name: 'category', id: catId });
  return (
    <div className="page full">
      <div className="lesson-top">
        <a className="iconbtn" href={backHref} aria-label={t('nav.back')}>
          ←
        </a>
        <h1 style={{ margin: 0, flex: 1 }}>{isFinal ? t('map.finalBoss') : t('boss.title')}</h1>
      </div>
      <div className="card">
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <div className="avatar">{boss.avatar}</div>
          <div>
            <h2 style={{ margin: 0 }}>{boss.character}</h2>
            <div className="muted">{boss.role}</div>
          </div>
        </div>
        <p style={{ marginTop: 12 }}>
          <b>{t('boss.intro')}:</b> {boss.scene}
        </p>
        <p className="small muted">{t('boss.personalNote')}</p>
      </div>
      {!isFinal && (
        <div className="card">
          {rounds.map((r) => (
            <div className="row" key={r} style={{ padding: '6px 0' }}>
              <span className={`chip ${cleared.has(r) ? 'ok' : ''}`}>{cleared.has(r) ? '✓' : r}</span>
              <span style={{ flex: 1 }}>
                {t('boss.round', { n: r })}: {t(`boss.round${r}`)}
              </span>
              <button className="btn small" onClick={() => (profileComplete(profile) ? setRound(r) : setEditProfile(true))} data-testid={`round-${r}`}>
                {cleared.has(r) ? t('category.repeat') : t('category.start')}
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        className="btn primary block"
        data-testid="boss-start"
        onClick={() => (profileComplete(profile) ? setRound(nextRound) : setEditProfile(true))}
      >
        ▶ {t('boss.start')} {isFinal ? '' : `· ${t('boss.round', { n: nextRound })}`}
      </button>
      {progress?.passed && <p className="chip ok" style={{ marginTop: 12 }}>🏆 {t('boss.passed')}</p>}
      <button className="btn ghost block small" style={{ marginTop: 8 }} onClick={() => setEditProfile(true)}>
        👤 {t('settings.profile')}
      </button>
      {editProfile && (
        <Modal title={t('boss.profileTitle')} onClose={() => setEditProfile(false)}>
          <ProfileForm
            onSaved={() => {
              setEditProfile(false);
              if (profileComplete(getState().profile)) setRound(nextRound);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

const LATIN = /^[A-Za-z][A-Za-z' .-]*$/;

export function ProfileForm({ onSaved, saveLabel }: { onSaved: () => void; saveLabel?: string }) {
  const p = useStore((s) => s.profile);
  const [form, setForm] = useState<Profile>(p);
  const [error, setError] = useState('');
  const set = (k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const save = () => {
    for (const k of ['name', 'city', 'job'] as const) {
      if (form[k].trim() && !LATIN.test(form[k].trim())) {
        setError(t('profile.latinOnly'));
        return;
      }
    }
    updateProfile({ ...form, name: form.name.trim(), city: form.city.trim(), job: form.job.trim(), country: form.country.trim() });
    onSaved();
  };
  return (
    <div>
      <p className="small muted">{t('boss.profileText')}</p>
      <div className="field">
        <label htmlFor="pf-name">{t('profile.name')}</label>
        <input id="pf-name" className="input" value={form.name} onChange={set('name')} placeholder={t('profile.namePh')} autoCapitalize="words" autoComplete="given-name" lang="en" />
      </div>
      <div className="field">
        <label htmlFor="pf-age">{t('profile.age')}</label>
        <input id="pf-age" className="input" value={form.age} onChange={set('age')} inputMode="numeric" pattern="[0-9]*" maxLength={3} />
      </div>
      <div className="field">
        <label htmlFor="pf-country">{t('profile.country')}</label>
        <input id="pf-country" className="input" value={form.country} onChange={set('country')} placeholder={t('profile.countryPh')} list="countries" lang="en" />
        <datalist id="countries">
          {COUNTRY_LIST.map((c) => (
            <option key={c.en} value={c.en}>
              {c.ru}
            </option>
          ))}
        </datalist>
      </div>
      <div className="field">
        <label htmlFor="pf-city">{t('profile.city')}</label>
        <input id="pf-city" className="input" value={form.city} onChange={set('city')} placeholder={t('profile.cityPh')} autoCapitalize="words" lang="en" />
      </div>
      <div className="field">
        <label htmlFor="pf-job">{t('profile.job')}</label>
        <input id="pf-job" className="input" value={form.job} onChange={set('job')} placeholder={t('profile.jobPh')} autoCapitalize="off" lang="en" />
      </div>
      {error && <p style={{ color: 'var(--bad)' }}>{error}</p>}
      <button className="btn primary block" onClick={save} data-testid="profile-save">
        {saveLabel ?? t('boss.profileSave')}
      </button>
    </div>
  );
}

interface Feedback {
  correct: boolean;
  check?: CheckResult;
  xp: number;
  audio?: string;
  /** What to do when the learner taps Continue. */
  then: () => void;
}

function BossRound({
  boss,
  catId,
  round,
  isFinal,
  onExit,
  onNext
}: {
  boss: Boss;
  catId: string;
  round: number;
  isFinal: boolean;
  onExit: () => void;
  onNext: (r: number) => void;
}) {
  const [vars, setVars] = useState<Vars>(() => profileVars(getState().profile));
  const [log, setLog] = useState<Bubble[]>([]);
  const [nodeId, setNodeId] = useState<string>(boss.start);
  const [lives, setLives] = useState(isFinal ? 5 : LIVES);
  const [attempt, setAttempt] = useState(0);
  const [hints, setHints] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [showRu, setShowRu] = useState(round < 3);
  const [earned, setEarned] = useState(0);
  const chatEnd = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const node = nodeById(boss, nodeId);

  /** Shows the NPC line(s) starting at id, following NPC-only nodes, and speaks them in one go. */
  const enter = useCallback(
    (id: string, v: Vars) => {
      const lines: Bubble[] = [];
      let cur: BossNode | undefined = nodeById(boss, id);
      let last = cur;
      while (cur) {
        lines.push({ who: 'npc', en: fill(cur.npc, v), ru: fill(cur.ru, v) });
        last = cur;
        if (cur.reply || cur.end || !cur.next) break;
        cur = nodeById(boss, cur.next);
      }
      setLog((l) => [...l, ...lines]);
      setNodeId(last.id);
      setAttempt(0);
      setHints(0);
      speak(lines.map((b) => b.en).join(' '));
      if (last.end) setStatus('won');
    },
    [boss]
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    enter(boss.start, vars);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [log, feedback]);

  const rewarded = useRef(false);
  useEffect(() => {
    if (status !== 'won' || rewarded.current) return;
    rewarded.current = true;
    const before = getState().bosses[catId];
    const wasPassed = !!before?.passed;
    bossRoundCleared(catId, round);
    let bonus = XP.bossRound;
    const nowPassed = isFinal || !!getState().bosses[catId]?.passed;
    if (nowPassed && !wasPassed) bonus += XP.bossPassed;
    addXp(bonus);
    setEarned((e) => e + bonus);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const reply = node.reply;

  const succeed = (said: string, answer: BossAnswer | undefined, check: CheckResult, newVars: Vars) => {
    const xp = scoreExercise({ correct: true, firstTry: attempt === 0, hints });
    addXp(xp);
    setEarned((e) => e + xp);
    setLog((l) => [...l, { who: 'me', en: said }]);
    const nxt = nextNode(node, answer ?? reply?.answers[0]);
    setVars(newVars);
    const proceed = () => {
      setFeedback(null);
      if (nxt) enter(nxt, newVars);
      else setStatus('won');
    };
    if (check.status === 'typo') setFeedback({ correct: true, check, xp, then: proceed });
    else proceed();
  };

  const fail = (check: CheckResult, audio?: string) => {
    const left = lives - 1;
    setLives(left);
    setAttempt((a) => a + 1);
    setFeedback({
      correct: false,
      check,
      xp: 0,
      audio,
      then: () => {
        setFeedback(null);
        if (left <= 0) setStatus('lost');
      }
    });
  };

  const options = useMemo<Option[]>(() => (reply && round === 1 ? replyOptions(reply, vars) : []), [nodeId, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const tiles = useMemo(() => (reply && round === 2 ? replyTiles(reply, vars) : null), [nodeId, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const [picked, setPicked] = useState<Set<string>>(new Set());
  useEffect(() => setPicked(new Set()), [nodeId]);

  const backToCat = isFinal ? href({ name: 'map' }) : href({ name: 'category', id: catId });

  if (status === 'won') {
    const st = getState().bosses[catId];
    const passed = isFinal || !!st?.passed;
    const nextR = [1, 2, 3].find((r) => !st?.rounds.includes(r));
    return (
      <div className="page full">
        {passed && <Confetti />}
        <div className="card levelup" data-testid="round-won">
          <div className="big">{passed ? '🏆' : '⭐'}</div>
          <h2>{passed ? t('boss.passed') : t('boss.roundDone', { n: round })}</h2>
          {passed && <p>{t('boss.passedText')}</p>}
          <p className="xp-pop">{t('lesson.earned', { n: earned })}</p>
          <div className="stack">
            {!passed && nextR && (
              <button className="btn primary block" onClick={() => onNext(nextR)} data-testid="next-round">
                {t('boss.nextRound')} →
              </button>
            )}
            <a className="btn block" href={backToCat} data-testid="boss-back">
              {isFinal ? t('nav.map') : t('lesson.toCategory')}
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'lost') {
    return (
      <div className="page full">
        <div className="card levelup">
          <div className="big">💪</div>
          <h2>{t('boss.failed')}</h2>
          <p>{t('boss.failedText')}</p>
          <div className="stack">
            <button className="btn primary block" onClick={() => onNext(round)}>
              {t('boss.retry')}
            </button>
            <button className="btn block" onClick={onExit}>
              {t('nav.back')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const roundLabel = isFinal ? t('boss.roundFinal') : t(`boss.round${round}`);

  return (
    <div className="page full">
      <div className="lesson-top">
        <button
          className="iconbtn"
          onClick={() => {
            stopSpeaking();
            onExit();
          }}
          aria-label={t('nav.close')}
        >
          ✕
        </button>
        <div style={{ flex: 1 }}>
          <div className="small muted">{isFinal ? t('map.finalBoss') : t('boss.round', { n: round })}</div>
          <div style={{ fontWeight: 700 }}>{roundLabel}</div>
        </div>
        <span className="lives" aria-label={t('boss.lives', { n: lives })}>
          {'❤️'.repeat(lives)}
          {'🤍'.repeat(Math.max(0, (isFinal ? 5 : LIVES) - lives))}
        </span>
      </div>

      <div className="chat">
        {log.map((b, i) => (
          <div key={i} className={`bubble ${b.who}`}>
            {b.who === 'npc' && (
              <div className="who">
                {boss.avatar} {boss.character}
              </div>
            )}
            <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>{b.en}</div>
              {b.who === 'npc' && <PlayButtons text={b.en} size="mini" />}
            </div>
            {b.who === 'npc' && b.ru && showRu && <div className="ru">{b.ru}</div>}
          </div>
        ))}
        <div ref={chatEnd} />
      </div>

      {reply && (
        <div className="reply-box" style={{ paddingBottom: feedback ? 200 : 0 }}>
          <div className="row">
            <span className="small muted" style={{ flex: 1 }}>
              {t('boss.you')}: {round < 3 ? reply.ru : ''}
            </span>
            {round === 3 && (
              <button className="btn small ghost" onClick={() => setShowRu(!showRu)}>
                🇷🇺 {t('boss.translation')}
              </button>
            )}
          </div>

          {round === 1 && (
            <div className="options">
              {options.map((o) => (
                <button
                  key={o.text}
                  className={`option ${picked.has(o.text) ? 'wrong' : ''}`}
                  disabled={!!feedback || picked.has(o.text)}
                  {...(E2E && o.answer ? { 'data-correct': '1' } : {})}
                  onClick={() => {
                    if (o.answer) succeed(o.text, o.answer, { status: 'correct', expected: o.text }, vars);
                    else {
                      setPicked(new Set(picked).add(o.text));
                      fail({ status: 'wrong', expected: fill(reply.answers[0].say, vars), why: reply.why });
                    }
                  }}
                >
                  {o.text}
                </button>
              ))}
            </div>
          )}

          {round === 2 && tiles && (
            <TileBuilder
              tiles={tiles.tiles}
              target={tiles.target}
              locked={!!feedback}
              onCheck={(s) => {
                const c = checkAnswer(s, [tiles.target]);
                if (c.status === 'correct') succeed(tiles.target, tiles.answer, c, vars);
                else fail({ ...c, status: 'wrong', expected: tiles.target, why: c.why ?? reply.why }, tiles.target);
              }}
            />
          )}

          {round === 3 && (
            <FreeReply
              key={nodeId + attempt}
              locked={!!feedback}
              hintText={hints ? `${reply.hint} ${t('lesson.hintShown', { text: fill(reply.answers[0].say, vars) })}` : ''}
              answerForTests={fill(reply.answers[0].say, vars)}
              accepted={reply.answers.map((a) => fill(a.say, vars))}
              onHint={() => setHints(1)}
              onSubmit={(text, loose) => {
                const r = checkFree(reply, text, vars, loose);
                if (r.check.status !== 'wrong') succeed(text, r.answer, r.check, r.vars);
                else fail(r.check, r.check.expected);
              }}
            />
          )}
        </div>
      )}
      {feedback && (
        <FeedbackSheet
          check={feedback.check}
          correct={feedback.correct}
          xp={feedback.xp}
          audio={feedback.audio}
          onContinue={feedback.then}
          continueLabel={feedback.correct ? undefined : t('boss.retry')}
        />
      )}
    </div>
  );
}

function FreeReply({
  locked,
  hintText,
  onHint,
  onSubmit,
  accepted,
  answerForTests
}: {
  locked: boolean;
  hintText: string;
  onHint: () => void;
  onSubmit: (text: string, loose: boolean) => void;
  accepted: string[];
  answerForTests: string;
}) {
  const [value, setValue] = useState('');
  const canSpeak = speakingEnabled();
  const submit = () => value.trim() && onSubmit(value, false);
  return (
    <div className="stack" {...e2e(answerForTests)}>
      <input
        className="input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder={t('ex.typeHere')}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        lang="en"
        disabled={locked}
        data-testid="answer-input"
      />
      {hintText && <div className="chip primary" style={{ whiteSpace: 'normal' }}>💡 {hintText}</div>}
      <div className="row">
        <button className="btn small" disabled={locked || !!hintText} onClick={onHint}>
          💡 {t('lesson.hint', { n: 3 })}
        </button>
        <span className="spacer" />
        <button className="btn primary" disabled={locked || !value.trim()} onClick={submit} data-testid="check">
          {t('lesson.check')}
        </button>
      </div>
      {canSpeak && (
        <SpeakInput
          accepted={accepted}
          locked={locked}
          onResult={(_c, heard) => {
            setValue(heard);
            onSubmit(heard, true);
          }}
        />
      )}
    </div>
  );
}
