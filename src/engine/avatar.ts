// Avatar parts and the shop. Prices are in coins (монетки).

import type { AvatarLook } from './store';

export type Slot = keyof AvatarLook;

export interface ShopItem {
  id: string; // "<slot>:<value>"
  slot: Slot;
  value: string;
  name: string; // Russian
  price: number; // 0 = free
}

export const COLOURS: Record<string, string> = {
  red: '#ff4757',
  orange: '#ff9f1a',
  yellow: '#ffd32a',
  green: '#2ed573',
  teal: '#17c0eb',
  blue: '#3a7bfd',
  navy: '#273c75',
  purple: '#8c52ff',
  pink: '#ff6bcb',
  black: '#2f3542',
  white: '#f1f2f6',
  gold: '#f5b800'
};

export const SKINS: Record<string, string> = {
  sun: '#ffcc4d',
  peach: '#ffd7b5',
  tan: '#e8b48a',
  brown: '#b97a4b',
  dark: '#7a4a2a',
  alien: '#7bed9f',
  robot: '#a4b0be'
};

const colourNames: Record<string, string> = {
  red: 'красный', orange: 'оранжевый', yellow: 'жёлтый', green: 'зелёный', teal: 'бирюзовый', blue: 'синий',
  navy: 'тёмно-синий', purple: 'фиолетовый', pink: 'розовый', black: 'чёрный', white: 'белый', gold: 'золотой'
};
const FREE_COLOURS = ['red', 'blue', 'green', 'navy', 'black'];

export const SHOP: ShopItem[] = [
  ...Object.entries({ sun: 'Классика', peach: 'Персик', tan: 'Загар', brown: 'Шоколад', dark: 'Какао', alien: 'Инопланетянин', robot: 'Робот' }).map(
    ([value, name]) => ({ id: `skin:${value}`, slot: 'skin' as Slot, value, name, price: value === 'alien' ? 80 : value === 'robot' ? 120 : 0 })
  ),
  ...Object.keys(COLOURS).map((value) => ({
    id: `shirt:${value}`,
    slot: 'shirt' as Slot,
    value,
    name: colourNames[value],
    price: FREE_COLOURS.includes(value) ? 0 : value === 'gold' ? 100 : 20
  })),
  ...Object.keys(COLOURS).map((value) => ({
    id: `pants:${value}`,
    slot: 'pants' as Slot,
    value,
    name: colourNames[value],
    price: FREE_COLOURS.includes(value) ? 0 : value === 'gold' ? 100 : 20
  })),
  { id: 'face:smile', slot: 'face', value: 'smile', name: 'Улыбка', price: 0 },
  { id: 'face:grin', slot: 'face', value: 'grin', name: 'Широкая улыбка', price: 0 },
  { id: 'face:wink', slot: 'face', value: 'wink', name: 'Подмигивание', price: 30 },
  { id: 'face:wow', slot: 'face', value: 'wow', name: 'Удивление', price: 30 },
  { id: 'face:cool', slot: 'face', value: 'cool', name: 'Тёмные очки', price: 60 },
  { id: 'face:stars', slot: 'face', value: 'stars', name: 'Глаза-звёзды', price: 90 },
  { id: 'hat:none', slot: 'hat', value: 'none', name: 'Без шапки', price: 0 },
  { id: 'hat:cap', slot: 'hat', value: 'cap', name: 'Кепка', price: 0 },
  { id: 'hat:beanie', slot: 'hat', value: 'beanie', name: 'Шапка', price: 40 },
  { id: 'hat:party', slot: 'hat', value: 'party', name: 'Праздничный колпак', price: 50 },
  { id: 'hat:headphones', slot: 'hat', value: 'headphones', name: 'Наушники', price: 70 },
  { id: 'hat:tophat', slot: 'hat', value: 'tophat', name: 'Цилиндр', price: 90 },
  { id: 'hat:helmet', slot: 'hat', value: 'helmet', name: 'Шлем космонавта', price: 150 },
  { id: 'hat:crown', slot: 'hat', value: 'crown', name: 'Корона', price: 250 }
];

export function isOwned(item: ShopItem, owned: string[]): boolean {
  return item.price === 0 || owned.includes(item.id);
}

export function colourOf(slot: Slot, value: string): string {
  return slot === 'skin' ? SKINS[value] ?? SKINS.sun : COLOURS[value] ?? COLOURS.blue;
}

/** Coins for finishing a lesson: a base amount plus a bonus per star. */
export function lessonCoins(stars: number): number {
  return 5 + stars * 5;
}

export const BOSS_COINS = 40;
