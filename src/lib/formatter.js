/**
 * Small pure formatting helpers.
 *
 * "Pure" means: same input, same output, no reading the clock, no touching
 * the filesystem, no network. Pure functions are the easiest thing in the
 * world to test, which is why the interesting logic lives here and the messy
 * side-effects live in src/build.js.
 */

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Unicode combining marks. Built from a string so the source file stays plain
// ASCII — invisible characters in source code are a debugging nightmare.
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

/**
 * Escape text so it is safe to drop inside an HTML document.
 * Skipping this is how you get cross-site scripting.
 *
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') {
    throw new TypeError('escapeHtml expects a string');
  }
  return str.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/**
 * Turn arbitrary text into a URL-friendly slug.
 * "Crème Brûlée!" becomes "creme-brulee".
 *
 * @param {string} str
 * @returns {string}
 */
export function slugify(str) {
  if (typeof str !== 'string') {
    throw new TypeError('slugify expects a string');
  }
  return str
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Format a date as "15 August 2026", always in UTC.
 *
 * @param {Date} date
 * @returns {string}
 */
export function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError('formatDate expects a valid Date');
  }
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * Shorten a string to `max` characters, adding an ellipsis if it was cut.
 *
 * @param {string} str
 * @param {number} max
 * @returns {string}
 */
export function truncate(str, max) {
  if (typeof str !== 'string') {
    throw new TypeError('truncate expects a string');
  }
  if (!Number.isInteger(max) || max < 1) {
    throw new RangeError('truncate expects a positive integer length');
  }
  if (str.length <= max) {
    return str;
  }
  return `${str.slice(0, max - 1).trimEnd()}...`;
}
