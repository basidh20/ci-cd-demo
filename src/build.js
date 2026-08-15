/**
 * The build step: turns data + logic into a shippable folder.
 *
 * Run it locally with:   npm run build
 * CI runs the exact same command. That is the whole point — there is no
 * secret "CI mode". A pipeline is just your own commands, run by someone
 * else's computer, in a fresh checkout.
 */

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { quotes, getQuoteForDate } from './lib/quotes.js';
import { escapeHtml, formatDate, slugify } from './lib/formatter.js';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Collect the handful of environment variables GitHub injects into every job.
 * On your laptop they are all undefined, and we fall back to "local" — which
 * is itself a useful lesson: the build must work in both worlds.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Record<string, string>}
 */
export function collectBuildInfo(env = process.env) {
  return {
    builtAt: new Date().toISOString(),
    commit: env.GITHUB_SHA ?? 'local-working-copy',
    shortCommit: (env.GITHUB_SHA ?? 'local').slice(0, 7),
    ref: env.GITHUB_REF_NAME ?? 'local',
    repository: env.GITHUB_REPOSITORY ?? 'not-on-github',
    runNumber: env.GITHUB_RUN_NUMBER ?? '0',
    actor: env.GITHUB_ACTOR ?? 'you',
    isCI: env.CI === 'true' ? 'yes' : 'no',
  };
}

/**
 * Render the whole page as a string. Pure function: easy to test, no I/O.
 *
 * @param {{text: string, author: string}} quote
 * @param {Date} date
 * @param {Record<string, string>} info
 * @returns {string}
 */
export function renderPage(quote, date, info) {
  const safeText = escapeHtml(quote.text);
  const safeAuthor = escapeHtml(quote.author);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Quote of the Day</title>
<style>
  :root { color-scheme: light dark; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    display: grid; place-items: center; min-height: 100vh; margin: 0;
    background: #0f172a; color: #e2e8f0;
  }
  main { max-width: 42rem; padding: 2rem; text-align: center; }
  blockquote { font-size: clamp(1.5rem, 4vw, 2.5rem); line-height: 1.3; margin: 0 0 1rem; }
  cite { color: #94a3b8; font-style: normal; }
  footer { margin-top: 3rem; font-size: 0.8rem; color: #64748b; line-height: 1.8; }
  code { background: #1e293b; padding: 0.1rem 0.35rem; border-radius: 4px; }
</style>
</head>
<body>
<main>
  <p><small>${escapeHtml(formatDate(date))}</small></p>
  <blockquote id="${slugify(quote.author)}">&ldquo;${safeText}&rdquo;</blockquote>
  <cite>&mdash; ${safeAuthor}</cite>
  <footer>
    Built by run <code>#${escapeHtml(info.runNumber)}</code>
    from commit <code>${escapeHtml(info.shortCommit)}</code>
    on <code>${escapeHtml(info.ref)}</code><br>
    Running in CI: <code>${escapeHtml(info.isCI)}</code> &middot;
    triggered by <code>${escapeHtml(info.actor)}</code><br>
    ${escapeHtml(info.builtAt)}
  </footer>
</main>
</body>
</html>
`;
}

/**
 * The impure part: create the folder, write the files.
 *
 * @param {{outDir?: string, date?: Date, env?: NodeJS.ProcessEnv}} [options]
 * @returns {Promise<{outDir: string, files: string[]}>}
 */
export async function build(options = {}) {
  const outDir = options.outDir ?? join(projectRoot, 'dist');
  const date = options.date ?? new Date();
  const info = collectBuildInfo(options.env);
  const quote = getQuoteForDate(date);

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const files = [
    ['index.html', renderPage(quote, date, info)],
    ['quotes.json', `${JSON.stringify(quotes, null, 2)}\n`],
    ['build-info.json', `${JSON.stringify(info, null, 2)}\n`],
    // Stops GitHub Pages from running the output through Jekyll.
    ['.nojekyll', ''],
  ];

  for (const [name, contents] of files) {
    await writeFile(join(outDir, name), contents, 'utf8');
  }

  return { outDir, files: files.map(([name]) => name) };
}

// Only run when executed directly (`node src/build.js`), not when imported by
// a test. Comparing file URLs is the portable way to ask "am I the entry
// point?" — naive string comparison breaks on Windows paths like D:\foo.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = await build();
  console.log(`Built ${result.files.length} files into ${result.outDir}`);
  for (const name of result.files) {
    console.log(`  - ${name}`);
  }
}
