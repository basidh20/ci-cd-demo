import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { build, renderPage, collectBuildInfo } from '../src/build.js';
import { getQuoteForDate } from '../src/lib/quotes.js';

test('collectBuildInfo falls back gracefully outside CI', () => {
  const info = collectBuildInfo({});
  assert.equal(info.commit, 'local-working-copy');
  assert.equal(info.isCI, 'no');
  assert.equal(info.repository, 'not-on-github');
});

test('collectBuildInfo reads the variables GitHub injects', () => {
  const info = collectBuildInfo({
    CI: 'true',
    GITHUB_SHA: 'a1b2c3d4e5f6a7b8c9d0',
    GITHUB_REF_NAME: 'main',
    GITHUB_REPOSITORY: 'octocat/quote-of-the-day',
    GITHUB_RUN_NUMBER: '42',
    GITHUB_ACTOR: 'octocat',
  });
  assert.equal(info.isCI, 'yes');
  assert.equal(info.shortCommit, 'a1b2c3d');
  assert.equal(info.runNumber, '42');
});

test('renderPage escapes hostile quote text', () => {
  const html = renderPage(
    { text: '<img src=x onerror=alert(1)>', author: 'Bad Actor' },
    new Date('2026-08-15T00:00:00Z'),
    collectBuildInfo({}),
  );
  assert.ok(!html.includes('<img src=x'), 'raw HTML must not survive into the page');
  assert.ok(html.includes('&lt;img'));
});

test('renderPage includes the date and the author', () => {
  const html = renderPage(
    { text: 'Ship it.', author: 'Delivery Proverb' },
    new Date('2026-08-15T00:00:00Z'),
    collectBuildInfo({}),
  );
  assert.ok(html.includes('15 August 2026'));
  assert.ok(html.includes('Delivery Proverb'));
  assert.ok(html.startsWith('<!doctype html>'));
});

test('build writes a complete dist folder', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'qotd-test-'));
  try {
    const date = new Date('2026-08-15T00:00:00Z');
    const result = await build({ outDir, date, env: {} });

    assert.deepEqual(
      result.files.sort(),
      ['.nojekyll', 'build-info.json', 'index.html', 'quotes.json'],
    );

    const html = await readFile(join(outDir, 'index.html'), 'utf8');
    assert.ok(html.includes(getQuoteForDate(date).text));

    const info = JSON.parse(await readFile(join(outDir, 'build-info.json'), 'utf8'));
    assert.equal(info.isCI, 'no');

    const data = JSON.parse(await readFile(join(outDir, 'quotes.json'), 'utf8'));
    assert.ok(Array.isArray(data) && data.length > 0);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
