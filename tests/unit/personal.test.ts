import { describe, it, expect } from 'vitest';
import { matchPattern, matchAnyPattern } from '../../src/engine/patterns';
import { checkFree, profileVars, fill } from '../../src/engine/boss';
import type { BossReply } from '../../src/engine/types';

const AGE = ['[i am]? {age} [years old|years of age]?', "[i'm|i am] {age} [this year]?"];
const NAME = ['[i am|my name is|it is|call me]? {name}', '{name} [is my name]'];
const COUNTRY = ['[i am|i come]? from {country}', '{country}', "[i'm|i am] {nationality}"];
const CITY = ['[i]? live in {city}', 'in {city}', '{city}'];
const JOB = ['[i am|i work as]? [a|an] {job}', 'i work [in|at|for] {any}', "[i'm|i am]? [retired|a student|unemployed|between jobs]"];

describe('personal answers: age', () => {
  it.each(["I'm 34", 'I am 34 years old', '34', 'I’m thirty-four', 'thirty four years old', 'I am 34.'])('accepts "%s"', (a) => {
    const m = matchAnyPattern(a, AGE);
    expect(m).not.toBeNull();
    expect(m!.values.age).toBe('34');
  });
  it.each(['I have 34 years', 'I am', 'years old', 'I am 300', 'banana'])('rejects "%s"', (a) => {
    expect(matchAnyPattern(a, AGE)).toBeNull();
  });
});

describe('personal answers: name', () => {
  it.each([
    ["I'm Anna", 'anna'],
    ['My name is Ivan Petrov', 'ivan petrov'],
    ["My name's Olga", 'olga'],
    ['Dmitry', 'dmitry'],
    ['Call me Sasha', 'sasha']
  ])('accepts "%s"', (a, name) => {
    expect(matchAnyPattern(a, NAME)?.values.name).toBe(name);
  });
  it('does not take "I am" as a name', () => {
    expect(matchAnyPattern('I am', NAME)).toBeNull();
    expect(matchAnyPattern('my name', NAME)).toBeNull();
  });
});

describe('personal answers: country and nationality', () => {
  it.each(["I'm from Russia", 'I am from Kazakhstan', 'From the UK', 'Uzbekistan', "I'm Georgian", 'I come from Kyrgyzstan', 'I am from Türkiye'])(
    'accepts "%s"',
    (a) => {
      expect(matchAnyPattern(a, COUNTRY)).not.toBeNull();
    }
  );
  it('rejects a made-up country', () => {
    expect(matchAnyPattern("I'm from Narnia", COUNTRY)).toBeNull();
  });
});

describe('personal answers: city and job', () => {
  it.each(['I live in Saint Petersburg', 'In Almaty', 'Tbilisi'])('accepts city "%s"', (a) => {
    expect(matchAnyPattern(a, CITY)).not.toBeNull();
  });
  it.each(["I'm a teacher", 'I am an engineer', 'I work as a software developer', 'I work in a bank', "I'm retired", 'a doctor'])(
    'accepts job "%s"',
    (a) => {
      expect(matchAnyPattern(a, JOB)).not.toBeNull();
    }
  );
  it('requires an article before a job', () => {
    expect(matchPattern("I'm teacher", JOB[0])).toBeNull();
  });
});

describe('boss free replies', () => {
  const vars = profileVars({ name: 'anna', age: '34', country: 'Russia', city: 'kazan', job: 'engineer' });
  const reply: BossReply = {
    answers: [{ say: "I'm {age}.", patterns: AGE }],
    hint: 'Скажите свой возраст',
    ru: 'Мне … лет.'
  };
  it('fills templates from the profile', () => {
    expect(fill("Hi, I'm {name} from {city}. I'm {a_job}.", vars)).toBe("Hi, I'm Anna from Kazan. I'm an engineer.");
  });
  it('accepts any valid age, not only the profile one', () => {
    const r = checkFree(reply, 'I am 52 years old', vars);
    expect(r.check.status).toBe('correct');
    expect(r.vars.age).toBe('52');
  });
  it('explains a wrong age answer in Russian', () => {
    const r = checkFree(reply, 'I have 34 years', vars);
    expect(r.check.status).toBe('wrong');
    expect(r.check.why).toMatch(/I'm 34/);
  });
  it('picks the branch matching the answer', () => {
    const yesNo: BossReply = {
      answers: [
        { say: 'Yes, I do.', patterns: ['yes [i do|a little|of course]?'], next: 'yes' },
        { say: "No, I don't.", patterns: ['no [i do not|not really]?'], next: 'no' }
      ],
      hint: '',
      ru: ''
    };
    expect(checkFree(yesNo, "No, I don't", vars).answer?.next).toBe('no');
    expect(checkFree(yesNo, 'Yes, a little', vars).answer?.next).toBe('yes');
  });
  it('accepts fixed phrases with typo tolerance', () => {
    const r = checkFree({ answers: [{ say: 'Nice to meet you too.' }], hint: '', ru: '' }, 'nise to meet you too', vars);
    expect(r.check.status).toBe('typo');
  });
});
