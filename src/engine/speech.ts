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
  const local = list.filter((v) => v.lang.toLowerCase().replace('_', '-') === lang);
  for (const name of PREFERRED[accent]) {
    const v = local.find((x) => x.name.includes(name));
    if (v) return v;
  }
  return local[0] ?? list[0];
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

function russianVoice(): SpeechSynthesisVoice | undefined {
  if (!voices.length) loadVoices();
  return voices.find((v) => v.lang.toLowerCase().startsWith('ru'));
}

/** Reads a short instruction aloud in Russian (for children who cannot read yet), then calls onEnd. */
export function speakRu(text: string, onEnd?: () => void) {
  const v = russianVoice();
  if (!synth || !v) {
    onEnd?.();
    return;
  }
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = v;
  u.lang = v.lang;
  u.rate = 1;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    onEnd?.();
  };
  u.onend = finish;
  u.onerror = finish;
  // Some browsers never fire onend; don't let the English word get lost.
  setTimeout(finish, 2500);
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
