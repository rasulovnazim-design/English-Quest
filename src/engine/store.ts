// Progress, settings and profile, saved in localStorage.

import { useSyncExternalStore } from 'react';
import { newCard, review, today, daysBetween, type Grade, type SrsCard } from './srs';
import { levelFromXp, DAILY_GOALS } from './xp';
import type { Profile } from './types';

export interface Settings {
  accent: 'gb' | 'us';
  theme: 'auto' | 'light' | 'dark';
  goal: keyof typeof DAILY_GOALS;
  speaking: boolean;
  voiceURI: string;
  sound: boolean;
}

/** The learner's blocky avatar. Values are ids from engine/avatar.ts. */
export interface AvatarLook {
  skin: string;
  shirt: string;
  pants: string;
  hat: string;
  face: string;
}

export interface State {
  version: 1;
  xp: number;
  daily: { date: string; xp: number };
  streak: { count: number; last: string };
  lessons: Record<string, { done: true; best: number; date: string }>;
  bosses: Record<string, { rounds: number[]; passed: boolean }>;
  srs: Record<string, SrsCard>;
  settings: Settings;
  profile: Profile;
  /** Level the learner has already seen the level-up animation for. */
  seenLevel: number;
  coins: number;
  /** Best stars (1–3) per lesson key. */
  stars: Record<string, number>;
  avatar: AvatarLook;
  /** Avatar items bought in the shop. */
  owned: string[];
  forest: ForestState;
}

/** The forest game: tools, carried logs and the state of each tree. */
export interface ForestState {
  /** Age mode chosen at the start: "little" (3–6, no reading) or "big" (7–12). Null until chosen. */
  mode: 'little' | 'big' | null;
  axe: string;
  bag: string;
  pets: string[];
  logs: number;
  /** Per tree: how many times it has been felled and when it grows back (ms timestamp). */
  trees: Record<string, { felled: number; regrowAt: number }>;
  /** Avatar position in the forest (px). */
  x: number;
}

const KEY = 'english-quest:v1';

export function initialState(): State {
  return {
    version: 1,
    xp: 0,
    daily: { date: today(), xp: 0 },
    streak: { count: 0, last: '' },
    lessons: {},
    bosses: {},
    srs: {},
    settings: { accent: 'gb', theme: 'auto', goal: 'normal', speaking: true, voiceURI: '', sound: true },
    profile: { name: '', age: '', country: '', city: '', job: '' },
    seenLevel: 1,
    coins: 0,
    stars: {},
    avatar: { skin: 'sun', shirt: 'blue', pants: 'navy', hat: 'none', face: 'smile' },
    owned: [],
    forest: { mode: null, axe: 'stone', bag: 'basket', pets: [], logs: 0, trees: {}, x: 260 }
  };
}

function safeParse(raw: string | null): State | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    return validateState(data);
  } catch {
    return null;
  }
}

/** Accepts a parsed backup and fills in any missing fields. Returns null if it is not a backup. */
export function validateState(data: unknown): State | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Partial<State>;
  if (d.version !== 1 || typeof d.xp !== 'number') return null;
  const base = initialState();
  return {
    ...base,
    ...d,
    daily: { ...base.daily, ...d.daily },
    streak: { ...base.streak, ...d.streak },
    settings: { ...base.settings, ...d.settings },
    profile: { ...base.profile, ...d.profile },
    lessons: d.lessons ?? {},
    bosses: d.bosses ?? {},
    srs: d.srs ?? {},
    stars: d.stars ?? {},
    owned: d.owned ?? [],
    forest: { ...base.forest, ...d.forest, trees: d.forest?.trees ?? {} },
    coins: typeof d.coins === 'number' ? d.coins : 0,
    avatar: { ...base.avatar, ...d.avatar }
  } as State;
}

function load(): State {
  if (typeof localStorage === 'undefined') return initialState();
  return safeParse(localStorage.getItem(KEY)) ?? initialState();
}

let state: State = load();
const listeners = new Set<() => void>();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked: keep working in memory */
  }
}

function set(next: State) {
  state = next;
  save();
  listeners.forEach((l) => l());
}

export function getState(): State {
  return state;
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => select(state), () => select(state));
}

/** Keeps the daily counter and streak current for the given day. */
function rollDay(s: State, now = today()): State {
  if (s.daily.date === now) return s;
  return { ...s, daily: { date: now, xp: 0 } };
}

export function addXp(amount: number) {
  if (amount <= 0) return;
  const now = today();
  let s = rollDay(state, now);
  s = { ...s, xp: s.xp + amount, daily: { date: now, xp: s.daily.xp + amount } };
  // Streak: any activity with XP today counts.
  if (s.streak.last !== now) {
    const gap = s.streak.last ? daysBetween(s.streak.last, now) : 0;
    s = { ...s, streak: { count: gap === 1 ? s.streak.count + 1 : 1, last: now } };
  }
  set(s);
}

/** Streak to show: zero if the learner missed yesterday. */
export function currentStreak(s: State, now = today()): number {
  if (!s.streak.last) return 0;
  return daysBetween(s.streak.last, now) <= 1 ? s.streak.count : 0;
}

export function dailyXp(s: State, now = today()): number {
  return s.daily.date === now ? s.daily.xp : 0;
}

/** 3 stars for 90%+, 2 for 70%+, otherwise 1. */
export function starsFor(accuracy: number): number {
  return accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : 1;
}

export function addCoins(n: number) {
  if (n) set({ ...state, coins: Math.max(0, state.coins + n) });
}

export function setStars(lessonId: string, stars: number) {
  set({ ...state, stars: { ...state.stars, [lessonId]: Math.max(state.stars[lessonId] ?? 0, stars) } });
}

export function updateAvatar(patch: Partial<AvatarLook>) {
  set({ ...state, avatar: { ...state.avatar, ...patch } });
}

/** Buys an item if the learner has enough coins. Returns true on success. */
export function buyItem(id: string, price: number): boolean {
  if (state.owned.includes(id)) return true;
  if (state.coins < price) return false;
  set({ ...state, coins: state.coins - price, owned: [...state.owned, id] });
  return true;
}

export function updateForest(patch: Partial<ForestState> | ((f: ForestState) => Partial<ForestState>)) {
  const p = typeof patch === 'function' ? patch(state.forest) : patch;
  set({ ...state, forest: { ...state.forest, ...p } });
}

export function completeLesson(lessonId: string, score: number, itemKeys: string[]) {
  const now = today();
  const srs = { ...state.srs };
  for (const k of itemKeys) if (!srs[k]) srs[k] = newCard(now);
  const prev = state.lessons[lessonId];
  set({
    ...state,
    srs,
    lessons: { ...state.lessons, [lessonId]: { done: true, best: Math.max(prev?.best ?? 0, score), date: now } }
  });
}

export function gradeItem(key: string, grade: Grade) {
  const card = state.srs[key];
  if (!card) return;
  set({ ...state, srs: { ...state.srs, [key]: review(card, grade) } });
}

export function bossRoundCleared(catId: string, round: number) {
  const b = state.bosses[catId] ?? { rounds: [], passed: false };
  const rounds = b.rounds.includes(round) ? b.rounds : [...b.rounds, round].sort();
  set({ ...state, bosses: { ...state.bosses, [catId]: { rounds, passed: rounds.length >= 3 || b.passed } } });
}

export function bossPassed(catId: string) {
  set({ ...state, bosses: { ...state.bosses, [catId]: { rounds: [1, 2, 3], passed: true } } });
}

export function updateSettings(patch: Partial<Settings>) {
  set({ ...state, settings: { ...state.settings, ...patch } });
}

export function updateProfile(patch: Partial<Profile>) {
  set({ ...state, profile: { ...state.profile, ...patch } });
}

export function markLevelSeen(level: number) {
  set({ ...state, seenLevel: level });
}

export function exportState(): string {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString(), app: 'english-quest' }, null, 2);
}

export function importState(json: string): boolean {
  const parsed = safeParse(json);
  if (!parsed) return false;
  set(parsed);
  return true;
}

export function resetState() {
  set(initialState());
}

export function levelInfo(s: State) {
  return levelFromXp(s.xp);
}

/** For tests: replace the in-memory state. */
export function _setStateForTests(s: State) {
  state = s;
}
