import { describe, it, expect } from 'vitest';
import { checkAnswer, editDistance, explainMistake } from '../../src/engine/checker';
import { normalize } from '../../src/engine/normalize';

describe('normalize', () => {
  it('ignores capitals and punctuation', () => {
    expect(normalize('Hello, how are you?!')).toBe('hello how are you');
  });
  it('expands contractions', () => {
    expect(normalize("I'm fine")).toBe('i am fine');
    expect(normalize("She's got a cat")).toBe('she has got a cat');
    expect(normalize("It's late")).toBe('it is late');
    expect(normalize("I don't know")).toBe('i do not know');
    expect(normalize("I can't")).toBe('i can not');
    expect(normalize('I cannot')).toBe('i can not');
    expect(normalize("I'd like a tea")).toBe('i would like a tea');
    expect(normalize("My name's Anna")).toBe('my name is anna');
    expect(normalize("we're friends")).toBe('we are friends');
  });
  it('handles curly apostrophes from phone keyboards', () => {
    expect(normalize('I’m Anna')).toBe('i am anna');
  });
  it('maps American spelling to British', () => {
    expect(normalize('My favorite color is gray')).toBe('my favourite colour is grey');
  });
  it('turns number words into digits', () => {
    expect(normalize("I'm thirty-four")).toBe('i am 34');
    expect(normalize('twenty one')).toBe('21');
    expect(normalize('a hundred')).toBe('100');
    expect(normalize('thirteen')).toBe('13');
  });
});

describe('checkAnswer: accepted variants', () => {
  it('accepts exact answers regardless of case and punctuation', () => {
    expect(checkAnswer('nice to meet you', ['Nice to meet you.']).status).toBe('correct');
    expect(checkAnswer('NICE TO MEET YOU!!!', ['Nice to meet you.']).status).toBe('correct');
  });
  it('accepts contractions and full forms both ways', () => {
    expect(checkAnswer('I am fine, thanks', ["I'm fine, thanks."]).status).toBe('correct');
    expect(checkAnswer("I'm fine thanks", ['I am fine, thanks.']).status).toBe('correct');
    expect(checkAnswer('What is your name?', ["What's your name?"]).status).toBe('correct');
    expect(checkAnswer('I do not understand', ["Sorry, I don't understand."]).status).toBe('wrong');
    expect(checkAnswer('Sorry I do not understand', ["Sorry, I don't understand."]).status).toBe('correct');
  });
  it('accepts British and American variants', () => {
    expect(checkAnswer('What colour is it?', ['What color is it?']).status).toBe('correct');
    expect(checkAnswer('Can I have the check, please?', ['Can I have the bill, please?', 'Can I have the check, please?']).status).toBe('correct');
  });
  it('accepts alternative phrasings listed in the data', () => {
    const accepted = ['Nice to meet you.', 'Pleased to meet you.', 'Lovely to meet you.'];
    expect(checkAnswer('pleased to meet you', accepted).status).toBe('correct');
  });
  it('accepts digits for number words', () => {
    expect(checkAnswer('I am 34', ["I'm thirty-four."]).status).toBe('correct');
  });
});

describe('checkAnswer: typos', () => {
  it('counts small typos on longer words as correct but marks them', () => {
    const r = checkAnswer('Nice to meet you, see you latr', ['Nice to meet you, see you later']);
    expect(r.status).toBe('typo');
    expect(r.typos).toEqual([{ wrong: 'latr', right: 'later' }]);
  });
  it('accepts swapped letters', () => {
    expect(checkAnswer('freind', ['friend']).status).toBe('typo');
  });
  it('allows two mistakes in long words', () => {
    expect(checkAnswer('colleage', ['colleague']).status).toBe('typo');
    expect(checkAnswer('afternon', ['afternoon']).status).toBe('typo');
  });
  it('does not allow typos in short words', () => {
    expect(checkAnswer('bet', ['bed']).status).toBe('wrong');
    expect(checkAnswer('I em fine', ["I'm fine"]).status).toBe('wrong');
  });
  it('never treats a different real word as a typo', () => {
    expect(checkAnswer('sheep', ['ship']).status).toBe('wrong');
    expect(checkAnswer('there', ['three']).status).toBe('wrong');
    expect(checkAnswer('thirty', ['thirteen']).status).toBe('wrong');
    expect(checkAnswer('vine', ['wine']).status).toBe('wrong');
  });
  it('accepts a missing space as a typo', () => {
    expect(checkAnswer('goodbye', ['good bye']).status).toBe('typo');
  });
  it('is looser for speech recognition', () => {
    expect(checkAnswer('helo', ['hello']).status).toBe('typo');
    expect(checkAnswer('hallo there', ['hello there'], { loose: true }).status).toBe('typo');
  });
});

describe('checkAnswer: explanations in Russian', () => {
  it('explains missing to be', () => {
    const r = checkAnswer('I Ivan', ["I'm Ivan."]);
    expect(r.status).toBe('wrong');
    expect(r.why).toMatch(/am\/is\/are/);
  });
  it('explains age with have', () => {
    expect(checkAnswer('I have 34 years', ["I'm 34."]).why).toMatch(/to be/);
  });
  it('explains word order in questions', () => {
    expect(checkAnswer('Where you are from?', ['Where are you from?']).why).toMatch(/порядок/);
  });
  it('explains a missing article', () => {
    expect(checkAnswer("I'm engineer", ["I'm an engineer."]).why).toMatch(/артикль/);
  });
  it('explains a and an', () => {
    expect(explainMistake('I am a engineer', 'I am an engineer')).toMatch(/an/);
  });
  it('explains he/she + s', () => {
    expect(explainMistake('She live in London', 'She lives in London')).toMatch(/-s/);
  });
  it('explains does + verb without s', () => {
    expect(explainMistake('Does she works here', 'Does she work here')).toMatch(/does/);
  });
  it('names a missing word', () => {
    expect(explainMistake('Nice meet you', 'Nice to meet you')).toMatch(/«to»/);
  });
  it('falls back to the data explanation or a generic one', () => {
    expect(checkAnswer('banana', ['Hello'], { why: 'Особое объяснение.' }).why).toContain('Особое объяснение.');
    expect(checkAnswer('banana', ['Hello']).why).toBeTruthy();
  });
  it('returns the closest accepted answer', () => {
    const r = checkAnswer('Pleased meet you', ['Nice to meet you.', 'Pleased to meet you.']);
    expect(r.expected).toBe('Pleased to meet you.');
  });
});

describe('editDistance', () => {
  it('counts insertions, deletions, substitutions and transpositions', () => {
    expect(editDistance('cat', 'cat')).toBe(0);
    expect(editDistance('cat', 'cut')).toBe(1);
    expect(editDistance('cat', 'cats')).toBe(1);
    expect(editDistance('freind', 'friend')).toBe(1);
  });
});
