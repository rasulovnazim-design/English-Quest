import { useEffect, useRef, useState } from 'react';
import { exportState, importState, resetState, updateSettings, useStore } from '../engine/store';
import { englishVoices, recognitionSupported, speak, ttsSupported } from '../engine/speech';
import { DAILY_GOALS } from '../engine/xp';
import { ProfileForm } from './BossScreen';
import { Modal, Toast } from '../components/common';
import { t } from '../locale';
import { installPrompt, onInstallPrompt } from '../install';

export function SettingsScreen() {
  const settings = useStore((s) => s.settings);
  const [toast, setToast] = useState('');
  const [profile, setProfile] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [canInstall, setCanInstall] = useState(!!installPrompt());
  const [voices, setVoices] = useState(() => englishVoices());
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => onInstallPrompt(() => setCanInstall(true)), []);
  useEffect(() => {
    const id = setTimeout(() => setVoices(englishVoices()), 600);
    return () => clearTimeout(id);
  }, []);

  const download = () => {
    const blob = new Blob([exportState()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `english-quest-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const accentVoices = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(settings.accent === 'gb' ? 'en-gb' : 'en-us'));

  return (
    <div className="page">
      <h1>⚙️ {t('settings.title')}</h1>

      <div className="card">
        <h2>{t('settings.accent')}</h2>
        <div className="seg" role="radiogroup">
          {(['gb', 'us'] as const).map((a) => (
            <button key={a} className={settings.accent === a ? 'on' : ''} onClick={() => updateSettings({ accent: a, voiceURI: '' })} role="radio" aria-checked={settings.accent === a}>
              {a === 'gb' ? t('settings.british') : t('settings.american')}
            </button>
          ))}
        </div>
        {ttsSupported && (
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="voice">{t('settings.voice')}</label>
            <select id="voice" className="input" value={settings.voiceURI} onChange={(e) => updateSettings({ voiceURI: e.target.value })}>
              <option value="">{t('settings.voiceAuto')}</option>
              {(accentVoices.length ? accentVoices : voices).map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
            <button className="btn small" onClick={() => speak("Hello! Nice to meet you. What's your name?")}>
              🔊 {t('settings.testVoice')}
            </button>
          </div>
        )}
        {!ttsSupported && <p className="small muted">{t('lesson.noAudio')}</p>}
      </div>

      <div className="card">
        <h2>{t('settings.theme')}</h2>
        <div className="seg">
          {(['auto', 'light', 'dark'] as const).map((th) => (
            <button key={th} className={settings.theme === th ? 'on' : ''} onClick={() => updateSettings({ theme: th })}>
              {th === 'auto' ? t('settings.themeAuto') : th === 'light' ? t('settings.themeLight') : t('settings.themeDark')}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>🔔 {t('settings.sound')}</h2>
        <div className="seg">
          <button className={settings.sound ? 'on' : ''} onClick={() => updateSettings({ sound: true })}>
            {t('settings.soundOn')}
          </button>
          <button className={!settings.sound ? 'on' : ''} onClick={() => updateSettings({ sound: false })}>
            {t('settings.soundOff')}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>{t('settings.goal')}</h2>
        <div className="seg">
          {(Object.keys(DAILY_GOALS) as (keyof typeof DAILY_GOALS)[]).map((g) => (
            <button key={g} className={settings.goal === g ? 'on' : ''} onClick={() => updateSettings({ goal: g })}>
              {t(`settings.goal${g[0].toUpperCase()}${g.slice(1)}`, { n: DAILY_GOALS[g] })}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>{t('settings.speaking')}</h2>
        {recognitionSupported ? (
          <div className="seg">
            <button className={settings.speaking ? 'on' : ''} onClick={() => updateSettings({ speaking: true })}>
              {t('settings.speakingOn')}
            </button>
            <button className={!settings.speaking ? 'on' : ''} onClick={() => updateSettings({ speaking: false })}>
              {t('settings.speakingOff')}
            </button>
          </div>
        ) : (
          <p className="small muted">{t('settings.speakingUnsupported')}</p>
        )}
      </div>

      <div className="card">
        <h2>{t('settings.profile')}</h2>
        <button className="btn block" onClick={() => setProfile(true)}>
          👤 {t('settings.profile')}
        </button>
      </div>

      <div className="card">
        <h2>📲 {t('settings.install')}</h2>
        <p className="small">{t('settings.installText')}</p>
        {canInstall && (
          <button
            className="btn primary block"
            onClick={async () => {
              const p = installPrompt();
              if (p) {
                await p.prompt();
                setCanInstall(false);
              }
            }}
          >
            {t('settings.installButton')}
          </button>
        )}
      </div>

      <div className="card">
        <h2>💾 {t('settings.backup')}</h2>
        <p className="small">{t('settings.backupText')}</p>
        <div className="stack">
          <button className="btn block" onClick={download} data-testid="export">
            ⬇️ {t('settings.export')}
          </button>
          <button className="btn block" onClick={() => file.current?.click()}>
            ⬆️ {t('settings.import')}
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            data-testid="import-file"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const ok = importState(await f.text());
              setToast(ok ? t('settings.importOk') : t('settings.importFail'));
              e.target.value = '';
            }}
          />
          <button className="btn ghost block" style={{ color: 'var(--bad)' }} onClick={() => setConfirmReset(true)}>
            {t('settings.reset')}
          </button>
        </div>
      </div>

      <p className="small muted" style={{ textAlign: 'center' }}>
        English Quest · {t('settings.version', { v: __APP_VERSION__ })}
      </p>

      {profile && (
        <Modal title={t('boss.profileTitle')} onClose={() => setProfile(false)}>
          <ProfileForm onSaved={() => setProfile(false)} saveLabel="OK" />
        </Modal>
      )}
      {confirmReset && (
        <Modal title={t('settings.reset')} onClose={() => setConfirmReset(false)}>
          <p>{t('settings.resetConfirm')}</p>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <button className="btn block" onClick={() => setConfirmReset(false)}>
              {t('lesson.quitNo')}
            </button>
            <button
              className="btn bad block"
              onClick={() => {
                resetState();
                setConfirmReset(false);
              }}
            >
              {t('settings.reset')}
            </button>
          </div>
        </Modal>
      )}
      {toast && <Toast text={toast} onDone={() => setToast('')} />}
    </div>
  );
}
