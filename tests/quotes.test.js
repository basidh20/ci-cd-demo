import test from 'node:test';
import assert from 'node:assert/strict';

import {
  quotes,
  dayOfYear,
  getQuoteForDate,
  findByAuthor,
  validateQuote,
} from '../src/lib/quotes.js';

test('every shipped quote is valid', () => {
  for (const quote of quotes) {
    assert.doesNotThrow(() => validateQuote(quote), `bad quote: ${JSON.stringify(quote)}`);
  }
});

test('dayOfYear counts from 1 on January 1st', () => {
  assert.equal(dayOfYear(new Date('2026-01-01T00:00:00Z')), 1);
  assert.equal(dayOfYear(new Date('2026-02-01T00:00:00Z')), 32);
  assert.equal(dayOfYear(new Date('2026-12-31T00:00:00Z')), 365);
});

test('dayOfYear handles leap years', () => {
  assert.equal(dayOfYear(new Date('2028-12-31T00:00:00Z')), 366);
});

test('dayOfYear rejects nonsense', () => {
  assert.throws(() => dayOfYear('2026-01-01'), TypeError);
  assert.throws(() => dayOfYear(new Date('not a date')), TypeError);
});

test('the same date always produces the same quote', () => {
  const first = getQuoteForDate(new Date('2026-08-15T00:00:00Z'));
  const second = getQuoteForDate(new Date('2026-08-15T23:59:59Z'));
  assert.deepEqual(first, second);
});

test('different days rotate through the list', () => {
  const seen = new Set();
  for (let day = 0; day < quotes.length; day += 1) {
    const date = new Date(Date.UTC(2026, 0, day + 1));
    seen.add(getQuoteForDate(date).text);
  }
  assert.equal(seen.size, quotes.length, 'each day in the first cycle should be unique');
});

test('getQuoteForDate refuses an empty list', () => {
  assert.throws(() => getQuoteForDate(new Date(), []), TypeError);
});

test('findByAuthor is case-insensitive and trims', () => {
  const found = findByAuthor('  automation proverb ');
  assert.ok(found.length > 0);
  assert.ok(found.every((q) => q.author === 'Automation Proverb'));
});

test('findByAuthor returns an empty array for strangers', () => {
  assert.deepEqual(findByAuthor('Nobody At All'), []);
});

test('validateQuote trims and returns a clean object', () => {
  const result = validateQuote({ text: '  hi  ', author: '  me  ' });
  assert.deepEqual(result, { text: 'hi', author: 'me' });
});

test('validateQuote rejects bad shapes', () => {
  assert.throws(() => validateQuote(null), TypeError);
  assert.throws(() => validateQuote([]), TypeError);
  assert.throws(() => validateQuote({ author: 'x' }), TypeError);
  assert.throws(() => validateQuote({ text: '   ', author: 'x' }), TypeError);
  assert.throws(() => validateQuote({ text: 'x', author: '' }), TypeError);
});
