// Text to speech and speech recognition using the browser's built-in Web Speech API.
// Audio always starts from a tap (required on iPhone), never automatically.

import { getState } from './store';

const synth: SpeechSynthesis | undefined =
  typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : undefined;

export const ttsSupported = !!synth;

let voices: SpeechSynthesisVoice[] = [];
function loadVoices() {
  if (!synth) return;
  voices = synth.getVoices();
}
if (synth) {
  loadVoices();
  synth.addEventListener?.('voiceschanged', loadVoices);
}

const PREFERRED: Record<'gb' | 'us', string[]> = {
  gb: ['Google UK English Female', 'Serena', 'Kate', 'Martha', 'Daniel', 'Arthur', 'Microsoft Sonia', 'Microsoft Libby', 'Microsoft Ryan', 'Google UK English Male'],
  us: ['Samantha', 'Google US English', 'Microsoft Aria', 'Microsoft Jenny', 'Ava', 'Allison', 'Alex', 'Microsoft Guy']
};

export function englishVoices(): SpeechSynthesisVoice[] {
  if (!voices.length) loadVoices();
  return voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('en'));
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const { accent, voiceURI } = getState().settings;
  const list = englishVoices();
  if (voiceURI) {
    const chosen = list.find((v) => v.voiceURI === voiceURI);
    if (chosen) return chosen;
  }
  const lang = accent === 'gb' ? 'en-gb' : 'en-us';
  const local = list.filter((v) => v.lang.toLowerCase().replace('_', '-') === lang && voiceQuality(v) > -3);
  // A natural/online voice beats everything else; then the known good voices; then the best of the rest.
  const natural = [...local].sort((a, b) => voiceQuality(b) - voiceQuality(a)).find((v) => voiceQuality(v) >= 3);
  if (natural) return natural;
  for (const name of PREFERRED[accent]) {
    const v = local.find((x) => x.name.includes(name));
    if (v) return v;
  }
  return [...local].sort((a, b) => voiceQuality(b) - voiceQuality(a))[0] ?? list[0];
}

export function speak(text: string, slow = false, onEnd?: () => void) {
  if (!synth) {
    onEnd?.();
    return;
  }
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? (getState().settings.accent === 'gb' ? 'en-GB' : 'en-US');
  u.rate = slow ? 0.6 : 0.92;
  u.pitch = 1;
  if (onEnd) {
    u.onend = () => onEnd();
    u.onerror = () => onEnd();
  }
  synth.speak(u);
}

/** Rough voice quality: natural/online voices sound far better than the old built-in ones. */
export function voiceQuality(v: SpeechSynthesisVoice): number {
  let q = 0;
  if (/natural|neural|online|premium|enhanced|siri/i.test(v.name)) q += 3;
  if (/google/i.test(v.name)) q += 2;
  if (!v.localService) q += 1;
  if (/espeak|compact|eloquence/i.test(v.name)) q -= 5;
  return q;
}

/** Russian voices known to be clear and natural on common devices. */
const GOOD_RU = ['Google русский', 'Milena', 'Yuri', 'Katya', 'Svetlana', 'Dmitry', 'Dariya'];

export function russianVoices(): SpeechSynthesisVoice[] {
  if (!voices.length) loadVoices();
  return voices.filter((v) => v.lang.toLowerCase().startsWith('ru'));
}

function goodRussianVoice(): SpeechSynthesisVoice | undefined {
  const list = russianVoices();
  for (const name of GOOD_RU) {
    const v = list.find((x) => x.name.includes(name) && voiceQuality(x) >= 0);
    if (v) return v;
  }
  return [...list].sort((a, b) => voiceQuality(b) - voiceQuality(a)).find((v) => voiceQuality(v) >= 3);
}

/** Is there a voice good enough to read Russian instructions aloud? */
export function russianVoiceAvailable(): boolean {
  return !!goodRussianVoice();
}

// Human recordings of the Russian instructions: put <key>.mp3 into src/assets/voice/ru/ and
// they are played instead of the device voice (e.g. pictureSay.mp3 for "Послушай и найди").
const recordings = import.meta.glob<string>('../assets/voice/ru/*.mp3', { eager: true, query: '?url', import: 'default' });
function recordingFor(key: string): string | undefined {
  const hit = Object.entries(recordings).find(([path]) => path.endsWith(`/${key}.mp3`));
  return hit?.[1];
}

let clip: HTMLAudioElement | null = null;

/**
 * Reads a short Russian instruction aloud (for children who cannot read yet), then calls onEnd.
 * Uses a human recording if there is one; otherwise the device voice, but only if it sounds good
 * (setting "auto"), or always ("on"), or never ("off").
 */
export function speakRu(key: string, text: string, onEnd?: () => void) {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    onEnd?.();
  };
  const mode = getState().settings.ruVoice;
  if (mode === 'off') return finish();
  const rec = recordingFor(key);
  if (rec) {
    synth?.cancel();
    clip?.pause();
    clip = new Audio(rec);
    clip.onended = finish;
    clip.onerror = finish;
    void clip.play().catch(finish);
    setTimeout(finish, 4000);
    return;
  }
  const v = mode === 'on' ? goodRussianVoice() ?? russianVoices()[0] : goodRussianVoice();
  if (!synth || !v) return finish();
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = v;
  u.lang = v.lang;
  u.rate = 0.95;
  u.onend = finish;
  u.onerror = finish;
  // Some browsers never fire onend; don't let the English word get lost.
  setTimeout(finish, 3000);
  synth.speak(u);
}

export function stopSpeaking() {
  synth?.cancel();
}

// ---------- speech recognition ----------

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export const recognitionSupported = !!recognitionCtor();

/** Speaking exercises are shown only when supported and switched on in settings. */
export function speakingEnabled(): boolean {
  return recognitionSupported && getState().settings.speaking && !speakingPaused();
}

let pausedUntil = 0;
/** "I can't speak now" pauses speaking exercises for 15 minutes. */
export function pauseSpeaking() {
  pausedUntil = Date.now() + 15 * 60 * 1000;
}
export function speakingPaused() {
  return Date.now() < pausedUntil;
}

export interface Listening {
  stop(): void;
}

/** Starts listening. Calls back with all recognised alternatives, or an error code. */
export function listen(onResult: (alternatives: string[]) => void, onError: (code: string) => void): Listening | null {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    onError('unsupported');
    return null;
  }
  stopSpeaking();
  const rec = new Ctor();
  rec.lang = getState().settings.accent === 'gb' ? 'en-GB' : 'en-US';
  rec.interimResults = false;
  rec.maxAlternatives = 5;
  rec.continuous = false;
  let done = false;
  rec.onresult = (e) => {
    done = true;
    const res = e.results[0];
    const alts: string[] = [];
    for (let i = 0; i < res.length; i++) alts.push(res[i].transcript);
    onResult(alts);
  };
  rec.onerror = (e) => {
    if (done) return;
    done = true;
    onError(e.error || 'error');
  };
  rec.onend = () => {
    if (!done) {
      done = true;
      onError('no-speech');
    }
  };
  try {
    rec.start();
  } catch {
    onError('error');
    return null;
  }
  return { stop: () => rec.stop() };
}
