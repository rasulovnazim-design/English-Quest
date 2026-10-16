import { useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise, ItemRef } from '../engine/exercises';
import { englishOf } from '../engine/exercises';
import { checkAnswer, type CheckResult } from '../engine/checker';
import { listen, pauseSpeaking, speak, type Listening } from '../engine/speech';
import { useStore } from '../engine/store';
import { t } from '../locale';
import { GrammarView, PlayButtons, e2e, E2E } from './common';

export interface Outcome {
  correct: boolean;
  check?: CheckResult;
  hints: number;
  /** Mistakes made before getting it right (match exercise). */
  mistakes?: number;
  /** Fixed XP instead of the usual score (flashcards). */
  xp?: number;
  skipped?: boolean;
  /** Text to play for the correct answer in the feedback sheet. */
  audio?: string;
}

interface Props {
  ex: Exercise;
  locked: boolean;
  onSubmit: (o: Outcome) => void;
  onContinue: () => void;
}

export function ExerciseView(props: Props) {
  const { ex } = props;
  switch (ex.kind) {
    case 'intro':
      return <Intro refs={ex.items} onContinue={props.onContinue} />;
    case 'grammar':
      return (
        <div className="exercise">
          <h2 className="ex-title">📘 {ex.grammar.title}</h2>
          <GrammarView g={ex.grammar} />
          <button className="btn primary block" onClick={props.onContinue} data-testid="continue">
            {t('lesson.continue')}
          </button>
        </div>
      );
    case 'choice':
      return <Choice {...props} ex={ex} />;
    case 'match':
      return <Match {...props} ex={ex} />;
    case 'flash':
      return <Flash {...props} ex={ex} />;
    case 'type':
      return <TypeIn {...props} ex={ex} />;
    case 'tiles':
      return <Tiles {...props} ex={ex} />;
    case 'speak':
      return <Speak {...props} ex={ex} />;
  }
}

function Intro({ refs, onContinue }: { refs: ItemRef[]; onContinue: () => void }) {
  const accent = useStore((s) => s.settings.accent);
  const letters = refs.filter((r) => r.group === 'letter');
  const rest = refs.filter((r) => r.group !== 'letter');
  return (
    <div className="exercise">
      <h2 className="ex-title">✨ {t('lesson.newWords')}</h2>
      <p className="muted small">{t('lesson.tapToHear')}</p>
      {letters.length > 0 && (
        <div className="letters-grid">
          {letters.map((r) => (
            <button key={r.key} className="letter" onClick={() => speak(r.item.say ?? r.item.en)} aria-label={r.item.en}>
              <b>{r.item.en}</b>
              <span>{r.item.ru}</span>
              <span className="ipa">{r.item.ipa}</span>
            </button>
          ))}
        </div>
      )}
      <div className="intro-list">
        {rest.map((r) => {
          const en = englishOf(r.item, accent);
          return (
            <div className="intro-item" key={r.key}>
              <div className="emoji" aria-hidden="true">
                {r.item.emoji ?? (r.group === 'phrase' ? '💬' : '•')}
              </div>
              <div className="txt">
                <div className="en">{en}</div>
                <div>{r.item.ru}</div>
                {r.item.ipa && <div className="ipa">{r.item.ipa}</div>}
                {r.item.note && <div className="note">{r.item.note}</div>}
              </div>
              <PlayButtons text={r.item.say ?? en} size="mini" />
            </div>
          );
        })}
      </div>
      <button className="btn primary block" onClick={onContinue} data-testid="continue">
        {t('lesson.continue')}
      </button>
    </div>
  );
}

function useOptionKeys(count: number, onPick: (i: number) => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const n = Number(e.key);
      if (n >= 1 && n <= count) onPick(n - 1);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [count, onPick, enabled]);
}

function Choice({ ex, locked, onSubmit }: Props & { ex: Extract<Exercise, { kind: 'choice' }> }) {
  const [picked, setPicked] = useState<number | null>(null);
  const pick = (i: number) => {
    if (locked || picked !== null) return;
    setPicked(i);
    const opt = ex.options[i];
    const correct = opt === ex.answer;
    onSubmit({
      correct,
      hints: 0,
      audio: ex.mode === 'meaning' ? ex.audio : ex.mode === 'gap' ? ex.audio : ex.answer,
      check: correct
        ? { status: 'correct', expected: ex.answer }
        : { status: 'wrong', expected: ex.mode === 'gap' && ex.prompt ? ex.prompt.replace(/_{2,}/, ex.answer) : ex.answer, why: ex.why }
    });
    if (correct && ex.audio && ex.mode !== 'listen') speak(ex.audio);
  };
  useOptionKeys(ex.options.length, pick, !locked && picked === null);
  const title =
    ex.mode === 'listen' ? t('ex.listen') : ex.mode === 'meaning' ? t('ex.meaning') : ex.mode === 'gap' ? t('ex.gap') : t('ex.choose');
  return (
    <div className="exercise" {...e2e(ex.answer)}>
      <h2 className="ex-title">{title}</h2>
      {ex.mode === 'listen' && ex.audio && <PlayButtons text={ex.audio} size="big" />}
      {ex.mode === 'meaning' && (
        <div className="row">
          <div className="prompt">{ex.prompt}</div>
          {ex.audio && <PlayButtons text={ex.audio} size="mini" />}
        </div>
      )}
      {ex.mode === 'gap' && (
        <div>
          <div className="prompt">{ex.prompt?.replace(/_{2,}/, '_____')}</div>
          {ex.promptRu && <div className="prompt-ru">{ex.promptRu}</div>}
        </div>
      )}
      {ex.mode === 'choose' && (
        <div className="row">
          <div className="prompt" style={{ fontSize: '1.15rem' }}>
            {ex.prompt}
          </div>
          {ex.audio && <PlayButtons text={ex.audio} size="mini" />}
        </div>
      )}
      <div className={`options ${ex.options.some((o) => o.length > 22) ? '' : 'two'}`}>
        {ex.options.map((o, i) => {
          const state = picked === null ? '' : o === ex.answer ? 'right' : i === picked ? 'wrong' : '';
          return (
            <button key={o + i} className={`option ${state}`} onClick={() => pick(i)} disabled={locked || picked !== null} data-option={o}>
              <span className="key">{i + 1}</span>
              <span>{o}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Match({ ex, locked, onSubmit }: Props & { ex: Extract<Exercise, { kind: 'match' }> }) {
  const accent = useStore((s) => s.settings.accent);
  const right = useMemo(() => [...ex.pairs.keys()].sort(() => Math.random() - 0.5), [ex]);
  const [selL, setSelL] = useState<number | null>(null);
  const [selR, setSelR] = useState<number | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [wrong, setWrong] = useState<number | null>(null);
  const mistakes = useRef(0);
  const bigSide = ex.pairs.every((p) => p.side === p.ref.item.emoji);

  useEffect(() => {
    if (selL === null || selR === null) return;
    if (selL === selR) {
      const next = new Set(done).add(selL);
      setDone(next);
      if (next.size === ex.pairs.length) onSubmit({ correct: true, hints: 0, mistakes: mistakes.current });
    } else {
      mistakes.current++;
      setWrong(selR);
      setTimeout(() => setWrong(null), 400);
    }
    setSelL(null);
    setSelR(null);
  }, [selL, selR]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="exercise">
      <h2 className="ex-title">{t('ex.match')}</h2>
      <div className="match">
        <div className="col">
          {ex.pairs.map((p, i) => {
            const en = englishOf(p.ref.item, accent);
            return (
              <button
                key={i}
                className={`option ${selL === i ? 'selected' : ''} ${done.has(i) ? 'done' : ''}`}
                disabled={locked || done.has(i)}
                onClick={() => {
                  speak(p.ref.item.say ?? en);
                  setSelL(i);
                }}
                {...(E2E ? { 'data-pair': String(i) } : {})}
              >
                {en}
              </button>
            );
          })}
        </div>
        <div className="col">
          {right.map((i) => (
            <button
              key={i}
              className={`option ${bigSide ? 'big' : ''} ${selR === i ? 'selected' : ''} ${done.has(i) ? 'done' : ''} ${wrong === i ? 'wrong shake' : ''}`}
              disabled={locked || done.has(i)}
              onClick={() => setSelR(i)}
              {...(E2E ? { 'data-pair': String(i) } : {})}
            >
              {ex.pairs[i].side}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Flash({ ex, onSubmit, locked }: Props & { ex: Extract<Exercise, { kind: 'flash' }> }) {
  const accent = useStore((s) => s.settings.accent);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const remembered = useRef(0);
  const r = ex.refs[i];
  const en = englishOf(r.item, accent);
  const next = (ok: boolean) => {
    if (ok) remembered.current++;
    if (i + 1 >= ex.refs.length) {
      onSubmit({ correct: true, hints: 0, xp: remembered.current * 5 });
    } else {
      setI(i + 1);
      setFlipped(false);
    }
  };
  return (
    <div className="exercise">
      <h2 className="ex-title">
        {ex.dir === 'en' ? t('ex.flashEn') : t('ex.flashRu')} · {i + 1}/{ex.refs.length}
      </h2>
      <div className="flash">
        {r.item.emoji && ex.dir === 'en' && <div className="emoji">{r.item.emoji}</div>}
        <div className="front">{ex.dir === 'en' ? en : r.item.ru}</div>
        {ex.dir === 'en' && <PlayButtons text={r.item.say ?? en} size="mini" />}
        {flipped && (
          <>
            <div className="back">{ex.dir === 'en' ? r.item.ru : en}</div>
            {ex.dir === 'ru' && <PlayButtons text={r.item.say ?? en} size="mini" />}
            {r.item.ipa && <div className="ipa">{r.item.ipa}</div>}
          </>
        )}
      </div>
      {!flipped ? (
        <button
          className="btn primary block"
          disabled={locked}
          data-testid="flip"
          onClick={() => {
            setFlipped(true);
            if (ex.dir === 'ru') speak(r.item.say ?? en);
          }}
        >
          {t('ex.flip')}
        </button>
      ) : (
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <button className="btn block" onClick={() => next(false)} data-testid="forgot">
            😕 {t('ex.forgot')}
          </button>
          <button className="btn ok block" onClick={() => next(true)} data-testid="remembered">
            🙂 {t('ex.remembered')}
          </button>
        </div>
      )}
    </div>
  );
}

function hintFor(answer: string): string {
  return answer
    .split(' ')
    .map((w) => {
      const m = w.match(/^([\p{L}\d])([\p{L}\d']*)([^\p{L}\d']*)$/u);
      if (!m) return w;
      return m[1] + m[2].replace(/[\p{L}\d]/gu, '_') + m[3];
    })
    .join(' ');
}

function TypeIn({ ex, locked, onSubmit }: Props & { ex: Extract<Exercise, { kind: 'type' }> }) {
  const [value, setValue] = useState('');
  const [hints, setHints] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Focus on laptops; on phones the keyboard would hide the play button.
    if (window.matchMedia('(pointer: fine)').matches) ref.current?.focus();
  }, []);
  const submit = () => {
    if (!value.trim() || locked) return;
    const check = checkAnswer(value, ex.accepted, { why: ex.why });
    onSubmit({ correct: check.status !== 'wrong', check, hints, audio: check.expected });
    if (check.status !== 'wrong') speak(check.expected);
  };
  return (
    <div className="exercise" {...e2e(ex.accepted[0])}>
      <h2 className="ex-title">{ex.mode === 'dictation' ? t('ex.dictation') : t('ex.translate')}</h2>
      {ex.mode === 'dictation' && ex.audio && <PlayButtons text={ex.audio} size="big" />}
      {ex.mode === 'dictation' ? (
        <div className="prompt-ru small">{ex.prompt}</div>
      ) : (
        <div className="prompt">{ex.prompt}</div>
      )}
      <input
        ref={ref}
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
        aria-label={t('ex.typeHere')}
        data-testid="answer-input"
      />
      {hints > 0 && <div className="chip primary" style={{ alignSelf: 'flex-start' }}>{t('lesson.hintShown', { text: hintFor(ex.accepted[0]) })}</div>}
      <div className="row">
        <button className="btn small" disabled={locked || hints > 0} onClick={() => setHints(1)}>
          💡 {t('lesson.hint', { n: 3 })}
        </button>
        <span className="spacer" />
        <button className="btn primary" disabled={locked || !value.trim()} onClick={submit} data-testid="check">
          {t('lesson.check')}
        </button>
      </div>
    </div>
  );
}

export function TileBuilder({
  tiles,
  locked,
  onCheck,
  target
}: {
  tiles: string[];
  locked: boolean;
  onCheck: (sentence: string) => void;
  target?: string;
}) {
  const [chosen, setChosen] = useState<number[]>([]);
  useEffect(() => setChosen([]), [tiles]);
  const sentence = chosen.map((i) => tiles[i]).join(' ');
  return (
    <div className="stack" {...e2e(target)}>
      <div className="tiles-answer" aria-label={t('ex.tiles')}>
        {chosen.map((i, pos) => (
          <button key={pos} className="wtile" disabled={locked} onClick={() => setChosen(chosen.filter((_, p) => p !== pos))}>
            {tiles[i]}
          </button>
        ))}
      </div>
      <div className="tiles-bank">
        {tiles.map((w, i) => (
          <button
            key={i}
            className={`wtile ${chosen.includes(i) ? 'used' : ''}`}
            disabled={locked || chosen.includes(i)}
            onClick={() => {
              speak(w);
              setChosen([...chosen, i]);
            }}
            data-tile={w}
          >
            {w}
          </button>
        ))}
      </div>
      <div className="row">
        <button className="btn small" disabled={locked || !chosen.length} onClick={() => setChosen([])}>
          ⌫ {t('ex.clear')}
        </button>
        <span className="spacer" />
        <button className="btn primary" disabled={locked || !chosen.length} onClick={() => onCheck(sentence)} data-testid="check">
          {t('lesson.check')}
        </button>
      </div>
    </div>
  );
}

function Tiles({ ex, locked, onSubmit }: Props & { ex: Extract<Exercise, { kind: 'tiles' }> }) {
  return (
    <div className="exercise">
      <h2 className="ex-title">{t('ex.tiles')}</h2>
      <div className="prompt">{ex.ru}</div>
      <p className="muted small">{t('ex.tilesHint')}</p>
      <TileBuilder
        tiles={ex.tiles}
        locked={locked}
        target={ex.en}
        onCheck={(s) => {
          const check = checkAnswer(s, ex.accepted, { why: ex.why });
          // Tiles are spelt correctly by definition: a "typo" here means a different word.
          const correct = check.status === 'correct';
          onSubmit({ correct, check: correct ? check : { ...check, status: 'wrong' }, hints: 0, audio: ex.en });
          if (correct) speak(ex.en);
        }}
      />
    </div>
  );
}

export function SpeakInput({
  accepted,
  onResult,
  locked
}: {
  accepted: string[];
  onResult: (check: CheckResult, heard: string) => void;
  locked: boolean;
}) {
  const [state, setState] = useState<'idle' | 'listening' | 'failed'>('idle');
  const [heard, setHeard] = useState('');
  const rec = useRef<Listening | null>(null);
  useEffect(() => () => rec.current?.stop(), []);
  const start = () => {
    setState('listening');
    rec.current = listen(
      (alts) => {
        let best: CheckResult | null = null;
        let bestText = alts[0] ?? '';
        for (const a of alts) {
          const c = checkAnswer(a, accepted, { loose: true });
          if (c.status !== 'wrong') {
            best = c;
            bestText = a;
            break;
          }
          if (!best) best = c;
        }
        setHeard(bestText);
        setState('idle');
        if (best) onResult(best, bestText);
      },
      () => setState('failed')
    );
  };
  return (
    <div className="stack" style={{ alignItems: 'center' }}>
      <button
        className="play big"
        onClick={state === 'listening' ? () => rec.current?.stop() : start}
        disabled={locked}
        aria-label={t('ex.speakTap')}
        data-testid="mic"
        style={state === 'listening' ? { background: 'var(--bad)' } : undefined}
      >
        {state === 'listening' ? '⏺' : '🎤'}
      </button>
      <div className="small muted">{state === 'listening' ? t('ex.speakListening') : t('ex.speakTap')}</div>
      {heard && <div className="small">{t('ex.speakHeard', { text: heard })}</div>}
      {state === 'failed' && <div className="small" style={{ color: 'var(--bad)' }}>{t('ex.speakNotHeard')}</div>}
    </div>
  );
}

function Speak({ ex, locked, onSubmit }: Props & { ex: Extract<Exercise, { kind: 'speak' }> }) {
  const [typing, setTyping] = useState(false);
  const [value, setValue] = useState('');
  if (typing) {
    const submit = () => {
      if (!value.trim()) return;
      const check = checkAnswer(value, ex.accepted);
      onSubmit({ correct: check.status !== 'wrong', check, hints: 0, audio: ex.text });
    };
    return (
      <div className="exercise" {...e2e(ex.accepted[0])}>
        <h2 className="ex-title">{t('ex.translate')}</h2>
        <div className="prompt">{ex.ru}</div>
        <input
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={t('ex.typeHere')}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          lang="en"
          disabled={locked}
          data-testid="answer-input"
        />
        <button className="btn primary block" disabled={locked || !value.trim()} onClick={submit} data-testid="check">
          {t('lesson.check')}
        </button>
      </div>
    );
  }
  return (
    <div className="exercise" {...e2e(ex.accepted[0])}>
      <h2 className="ex-title">{t('ex.speak')}</h2>
      <div className="row">
        <div className="prompt">{ex.text}</div>
        <PlayButtons text={ex.text} size="mini" />
      </div>
      <div className="prompt-ru">{ex.ru}</div>
      <SpeakInput
        accepted={ex.accepted}
        locked={locked}
        onResult={(check) => {
          if (check.status !== 'wrong') onSubmit({ correct: true, check: { ...check, status: 'correct' }, hints: 0, audio: ex.text });
        }}
      />
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn small ghost" disabled={locked} onClick={() => setTyping(true)}>
          ⌨️ {t('ex.speakType')}
        </button>
        <button
          className="btn small ghost"
          disabled={locked}
          data-testid="cant-speak"
          onClick={() => {
            pauseSpeaking();
            onSubmit({ correct: true, hints: 0, skipped: true });
          }}
        >
          🔇 {t('ex.speakCantNow')}
        </button>
      </div>
    </div>
  );
}
