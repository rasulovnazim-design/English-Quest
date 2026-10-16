// Content types. All learning content lives in src/data/**.json and must match these shapes.

export interface Item {
  /** Unique within the category, e.g. "hello". The global key is "<categoryId>:<id>". */
  id: string;
  en: string;
  ru: string;
  ipa?: string;
  emoji?: string;
  /** American variant, shown and spoken when the American setting is on. */
  us?: string;
  /** Other English answers that are also accepted (variants, synonyms). */
  alt?: string[];
  /** Short note in Russian shown in the phrasebook. */
  note?: string;
  /** Text for text-to-speech when it differs from `en` (e.g. a letter name). */
  say?: string;
}

export interface GrammarPoint {
  title: string; // Russian
  titleEn: string;
  /** Short explanation in Russian, one paragraph per array entry. */
  explanation: string[];
  table?: { en: string; ru: string }[];
  examples: { en: string; ru: string }[];
}

export interface Mistake {
  title: string; // Russian
  text: string; // Russian
  wrong?: string;
  right?: string;
}

/** Authored exercises. Auto exercises are generated from the lesson's items. */
export type AuthoredExercise =
  | {
      type: 'gap';
      /** Sentence with ___ for the gap. */
      en: string;
      ru: string;
      answer: string;
      /** Other accepted answers for the gap. */
      alt?: string[];
      options: string[];
      /** Explanation in Russian shown when the learner picks a wrong option. */
      why?: string;
    }
  | {
      type: 'tiles';
      en: string;
      ru: string;
      /** Extra wrong tiles. */
      extra?: string[];
      /** Other word orders that are also correct. */
      alt?: string[];
      why?: string;
    }
  | {
      type: 'dictation';
      /** What is spoken (e.g. spelled letters "C, A, T"). */
      say: string;
      en: string;
      ru: string;
      alt?: string[];
    }
  | {
      type: 'translate';
      ru: string;
      en: string;
      alt?: string[];
      why?: string;
    }
  | {
      type: 'choose';
      /** A question in Russian (or English) with several options. */
      prompt: string;
      promptEn?: string;
      answer: string;
      options: string[];
      why?: string;
    };

export type AutoStep =
  | 'intro' // show new items with audio
  | 'match' // match English to emoji/Russian
  | 'listen' // listen and choose the word
  | 'flash-en' // flashcard English → Russian
  | 'flash-ru' // flashcard Russian → English
  | 'meaning' // see English, choose Russian
  | 'dictation' // type what you hear
  | 'speak' // say it aloud
  | 'grammar'; // show the grammar card

export type Step = AutoStep | AuthoredExercise;

export interface Lesson {
  id: string;
  title: string; // Russian
  titleEn: string;
  /** Item ids introduced in this lesson (words or phrases). */
  items: string[];
  steps: Step[];
}

export type Slot =
  | 'name'
  | 'age'
  | 'country'
  | 'city'
  | 'job'
  | 'nationality'
  | 'language'
  | 'number'
  | 'phone'
  | 'letters'
  | 'any';

export interface BossAnswer {
  /** What the learner says, with {slot} placeholders filled from the profile. */
  say: string;
  /** Patterns for free answers (see engine/patterns.ts). */
  patterns?: string[];
  /** Other accepted exact phrasings (checked with typo tolerance). */
  accept?: string[];
  /** Next node id when this answer is chosen. */
  next?: string;
}

export interface BossReply {
  answers: BossAnswer[];
  /** Wrong options for round 1, with {slot} placeholders allowed. */
  wrong?: string[];
  /** Wrong word tiles for round 2. */
  extraTiles?: string[];
  /** Hint in Russian. */
  hint: string;
  /** Russian translation of the expected reply (shown in round 2 and as hint). */
  ru: string;
  /** Explanation in Russian shown when a wrong option is chosen. */
  why?: string;
}

export interface BossNode {
  id: string;
  /** What the character says. {name} etc. are filled from the learner's answers. */
  npc: string;
  ru: string;
  reply?: BossReply;
  next?: string;
  end?: boolean;
}

export interface Boss {
  character: string;
  role: string; // Russian
  avatar: string; // emoji
  scene: string; // Russian description of the situation
  /** Voice gender hint for text-to-speech. */
  voice?: 'female' | 'male';
  start: string;
  nodes: BossNode[];
}

export interface Category {
  id: string;
  stage: number;
  order: number;
  title: string; // Russian
  titleEn: string;
  emoji: string;
  description: string; // Russian
  grammar: GrammarPoint;
  words: Item[];
  phrases: Item[];
  /** Optional extra items such as the letters of the alphabet. */
  letters?: Item[];
  mistakes: Mistake[];
  lessons: Lesson[];
  boss: Boss;
  /** Number drill: generates numbers in this range for extra listening/dictation. */
  numberDrill?: [number, number];
}

export interface Stage {
  id: number;
  title: string;
  titleEn: string;
  emoji: string;
}

export interface Profile {
  name: string;
  age: string;
  country: string;
  city: string;
  job: string;
}
