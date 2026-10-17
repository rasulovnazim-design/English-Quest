// Little game sounds made with the Web Audio API (no audio files to download).
// They only play after a tap, which iPhone requires.

import { getState } from './store';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!getState().settings.sound) return null;
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', vol = 0.08) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sfx = {
  tap: () => tone(660, 0, 0.05, 'triangle', 0.05),
  correct: () => {
    tone(784, 0, 0.1);
    tone(1047, 0.09, 0.18);
  },
  wrong: () => {
    tone(196, 0, 0.18, 'sawtooth', 0.06);
    tone(147, 0.15, 0.25, 'sawtooth', 0.06);
  },
  chop: () => {
    tone(180, 0, 0.08, 'square', 0.1);
    tone(110, 0.03, 0.12, 'triangle', 0.12);
  },
  coin: () => {
    tone(988, 0, 0.07, 'square', 0.06);
    tone(1319, 0.07, 0.2, 'square', 0.06);
  },
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.22, 'square', 0.07)),
  levelUp: () => [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.2, 'triangle', 0.09))
};
