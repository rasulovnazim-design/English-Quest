import { useEffect, useMemo, useRef } from 'react';
import { useStore } from '../engine/store';
import { sfx } from '../engine/sfx';
import { Avatar } from './Avatar';
import type { CheckResult } from '../engine/checker';
import { t } from '../locale';
import { Corrected, PlayButtons } from './common';

export function FeedbackSheet({
  check,
  correct,
  xp,
  audio,
  onContinue,
  continueLabel
}: {
  check?: CheckResult;
  correct: boolean;
  xp: number;
  audio?: string;
  onContinue: () => void;
  continueLabel?: string;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  const look = useStore((x) => x.avatar);
  const cheer = useMemo(() => {
    const list = t(correct ? 'lesson.cheers' : 'lesson.oops').split('|');
    return list[Math.floor(Math.random() * list.length)];
  }, [correct]);
  useEffect(() => {
    if (correct) sfx.correct();
    else sfx.wrong();
  }, [correct]);
  useEffect(() => {
    btn.current?.focus({ preventScroll: true });
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') {
        e.preventDefault();
        onContinue();
      }
    };
    // Delay so the Enter that submitted the answer does not also continue.
    const id = setTimeout(() => window.addEventListener('keydown', on), 250);
    return () => {
      clearTimeout(id);
      window.removeEventListener('keydown', on);
    };
  }, [onContinue]);
  if (!correct && navigator.vibrate) navigator.vibrate?.(60);
  const status = !correct ? 'bad' : check?.status === 'typo' ? 'typo' : 'ok';
  return (
    <div className={`sheet ${status}`} role="status" aria-live="polite" data-testid="feedback" data-status={status}>
      <div className="sheet-inner">
        <h3>
          <span className="sheet-avatar-inline" aria-hidden="true">
            <Avatar look={look} size={58} mood={correct ? 'jump' : 'sad'} />
          </span>
          {status === 'ok' && <>{cheer}</>}
          {status === 'typo' && <>✍️ {t('lesson.correctTypo')}</>}
          {status === 'bad' && <>{cheer}</>}
          <span className="spacer" />
          {xp > 0 && <span className="xp-pop">{t('xp.plus', { n: xp })}</span>}
        </h3>
        {status === 'typo' && check && (
          <div>
            {t('lesson.rightSpelling', { text: '' })}
            <b>
              <Corrected text={check.expected} fixes={(check.typos ?? []).map((x) => x.right)} />
            </b>
          </div>
        )}
        {status === 'bad' && check?.expected && (
          <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              {t('lesson.rightAnswer', { text: '' })}
              <b>{check.expected}</b>
            </div>
            {audio && <PlayButtons text={audio} size="mini" />}
          </div>
        )}
        {status === 'bad' && check?.why && <div className="why">💡 {check.why}</div>}
        <button ref={btn} className={`btn block ${status === 'bad' ? 'bad' : 'ok'}`} onClick={onContinue} data-testid="continue">
          {continueLabel ?? t('lesson.continue')}
        </button>
      </div>
    </div>
  );
}
