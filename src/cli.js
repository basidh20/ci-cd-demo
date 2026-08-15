/**
 * A tiny CLI so the project does something you can see without a browser.
 *
 *   npm start
 *   npm start -- 2026-12-25
 */

import { getQuoteForDate } from './lib/quotes.js';
import { formatDate, truncate } from './lib/formatter.js';

const [, , dateArg] = process.argv;
const date = dateArg ? new Date(`${dateArg}T00:00:00Z`) : new Date();

if (Number.isNaN(date.getTime())) {
  console.error(`Not a date I understand: "${dateArg}". Try: npm start -- 2026-12-25`);
  // A non-zero exit code is how a program says "I failed". CI watches this
  // number and nothing else — see Lesson 03.
  process.exit(1);
}

const quote = getQuoteForDate(date);

console.log('');
console.log(`  ${formatDate(date)}`);
console.log(`  "${quote.text}"`);
console.log(`      -- ${truncate(quote.author, 40)}`);
console.log('');
