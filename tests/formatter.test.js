import test from 'node:test';
import assert from 'node:assert/strict';

import { escapeHtml, slugify, formatDate, truncate } from '../src/lib/formatter.js';

test('escapeHtml neutralises a script tag', () => {
  const evil = '<script>alert("xss")</script>';
  const safe = escapeHtml(evil);
  assert.ok(!safe.includes('<script>'));
  assert.equal(safe, '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
});

test('escapeHtml escapes ampersands first, not twice', () => {
  assert.equal(escapeHtml('a & b'), 'a &amp; b');
  assert.equal(escapeHtml('&lt;'), '&amp;lt;');
});

test('escapeHtml leaves ordinary text alone', () => {
  assert.equal(escapeHtml('perfectly normal'), 'perfectly normal');
});

test('slugify makes URL-safe text', () => {
  assert.equal(slugify('Automation Proverb'), 'automation-proverb');
  assert.equal(slugify('  Hello,   World!  '), 'hello-world');
  assert.equal(slugify('Creme Brulee'), 'creme-brulee');
});

test('slugify strips accents', () => {
  assert.equal(slugify('Crème Brûlée'), 'creme-brulee');
});

test('formatDate uses UTC, not the local timezone', () => {
  // 23:30 UTC on the 15th is already the 16th in Tokyo. A naive
  // implementation using getDate() would disagree with CI. This test is the
  // tripwire that catches it.
  assert.equal(formatDate(new Date('2026-08-15T23:30:00Z')), '15 August 2026');
  assert.equal(formatDate(new Date('2026-01-01T00:00:00Z')), '1 January 2026');
});

test('formatDate rejects invalid input', () => {
  assert.throws(() => formatDate('2026-08-15'), TypeError);
  assert.throws(() => formatDate(new Date('nope')), TypeError);
});

test('truncate leaves short strings untouched', () => {
  assert.equal(truncate('short', 10), 'short');
  assert.equal(truncate('exactly10!', 10), 'exactly10!');
});

test('truncate shortens long strings', () => {
  assert.equal(truncate('abcdefghij', 5), 'abcd...');
  assert.equal(truncate('hello world', 6), 'hello...');
});

test('truncate validates its length argument', () => {
  assert.throws(() => truncate('abc', 0), RangeError);
  assert.throws(() => truncate('abc', 1.5), RangeError);
});
