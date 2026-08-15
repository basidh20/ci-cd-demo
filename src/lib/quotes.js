/**
 * The data + selection logic for our tiny app.
 *
 * These are original "engineering proverbs" rather than famous quotations,
 * partly to keep the project copyright-clean and partly because they say
 * useful things about the subject you are here to learn.
 */

export const quotes = [
  { text: 'A build you cannot reproduce is a rumour.', author: 'Automation Proverb' },
  { text: 'Automate the boring part twice; the third time it automates you.', author: 'Automation Proverb' },
  { text: 'Green tests are a promise, not a guarantee.', author: 'Testing Proverb' },
  {
    text: 'The best time to add CI was your first commit. The second best time is now.',
    author: 'Engineering Proverb',
  },
  { text: 'Fast feedback beats perfect feedback.', author: 'Delivery Proverb' },
  { text: 'If deploying scares you, deploy more often.', author: 'Delivery Proverb' },
  { text: 'A pipeline is documentation that refuses to go stale.', author: 'Automation Proverb' },
  { text: 'Secrets belong in vaults, never in YAML.', author: 'Security Proverb' },
  { text: 'Cache what is slow, never what is wrong.', author: 'Performance Proverb' },
  { text: 'Every manual step is a future outage waiting for a Friday.', author: 'Operations Proverb' },
  { text: 'Small commits make small fires.', author: 'Engineering Proverb' },
  { text: 'Logs are the only witness your build will ever have.', author: 'Debugging Proverb' },
];

/**
 * Which day of the year is this? 1 for 1 January, 365 or 366 for 31 December.
 *
 * Note that every date function in this file works in UTC on purpose.
 * GitHub's runners live in UTC; your laptop probably does not. Code that
 * quietly depends on the local timezone is one of the most common reasons a
 * test passes on your machine and fails in CI. See Lesson 03.
 *
 * @param {Date} date
 * @returns {number}
 */
export function dayOfYear(date) {
  assertValidDate(date);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 0);
  const thisDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((thisDay - yearStart) / 86_400_000);
}

/**
 * Pick the quote for a given day. Deterministic: the same date always yields
 * the same quote, which is what makes it testable. "Random" and "testable"
 * are usually enemies.
 *
 * @param {Date} date
 * @param {Array<{text: string, author: string}>} [list]
 * @returns {{text: string, author: string}}
 */
export function getQuoteForDate(date, list = quotes) {
  if (!Array.isArray(list) || list.length === 0) {
    throw new TypeError('getQuoteForDate needs a non-empty array of quotes');
  }
  return list[dayOfYear(date) % list.length];
}

/**
 * Find every quote by a given author, case-insensitively.
 *
 * @param {string} author
 * @param {Array<{text: string, author: string}>} [list]
 * @returns {Array<{text: string, author: string}>}
 */
export function findByAuthor(author, list = quotes) {
  if (typeof author !== 'string') {
    throw new TypeError('author must be a string');
  }
  const needle = author.trim().toLowerCase();
  return list.filter((q) => q.author.toLowerCase() === needle);
}

/**
 * Validate a quote object. Throws with a readable message when it is wrong,
 * because an error message is a user interface too.
 *
 * @param {unknown} quote
 * @returns {{text: string, author: string}}
 */
export function validateQuote(quote) {
  if (typeof quote !== 'object' || quote === null || Array.isArray(quote)) {
    throw new TypeError('a quote must be an object');
  }
  const { text, author } = /** @type {Record<string, unknown>} */ (quote);
  if (typeof text !== 'string' || text.trim() === '') {
    throw new TypeError('a quote must have a non-empty "text"');
  }
  if (typeof author !== 'string' || author.trim() === '') {
    throw new TypeError('a quote must have a non-empty "author"');
  }
  return { text: text.trim(), author: author.trim() };
}

function assertValidDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError('expected a valid Date');
  }
}
