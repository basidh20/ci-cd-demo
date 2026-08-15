/**
 * A deliberately tiny style checker.
 *
 * Real projects use ESLint and Prettier. This project uses ~90 lines of Node
 * so that you can clone it and have a working pipeline with zero `npm install`
 * — and so you can read every rule that is judging you.
 *
 * What matters for the course is the CONTRACT, which is identical to ESLint's:
 *   - print human-readable problems
 *   - exit 0 when clean, exit 1 when not
 * That exit code is the only thing GitHub Actions actually looks at.
 *
 * Swapping in the real thing later is a two-line change to the workflow.
 */

import { readFile } from 'node:fs/promises';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'node:fs/promises';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const MAX_LINE_LENGTH = 120;

// Files allowed to print to stdout: entry points and scripts. Library code
// that logs is usually a leftover debugging statement.
const CONSOLE_ALLOWED = [
  join('src', 'cli.js'),
  join('src', 'build.js'),
];

// Escape hatches, same idea as `// eslint-disable-next-line`. Every linter
// needs one: rules are guesses about intent, and sometimes the guess is wrong.
// (Neither pattern matches its own definition — the character after the rule
// name here is a backslash, and `\s+` demands real whitespace.)
const DISABLE_LINE = /lint-disable-line\s+([\w-, ]+)/;
const DISABLE_NEXT = /lint-disable-next-line\s+([\w-, ]+)/;

const RULES = [
  {
    id: 'no-tabs',
    test: (line) => line.includes('\t'),
    message: 'tab character (this project indents with spaces)',
  },
  {
    id: 'no-trailing-whitespace',
    test: (line) => /[ \t]+$/.test(line),
    message: 'trailing whitespace',
  },
  {
    id: 'max-line-length',
    test: (line) => line.length > MAX_LINE_LENGTH,
    message: `line longer than ${MAX_LINE_LENGTH} characters`,
  },
  {
    id: 'no-debugger',
    // The lookbehind stops the rule matching its own name, "no-debugger".
    // The two disable comments handle the remaining self-references below.
    test: (line) => /(?<![\w-])debugger\b/.test(line), // lint-disable-line no-debugger
    message: 'leftover `debugger` statement', // lint-disable-line no-debugger
  },
  {
    id: 'no-console',
    test: (line, file) => /\bconsole\.(log|debug)\b/.test(line)
      && !CONSOLE_ALLOWED.includes(file)
      && !file.startsWith(`scripts${sep}`),
    message: 'console.log outside an entry point or script',
  },
];

async function collectFiles() {
  const found = [];
  for await (const entry of glob('{src,tests,scripts}/**/*.js', { cwd: projectRoot })) {
    found.push(entry);
  }
  return found.sort();
}

/**
 * Which rules are switched off for this line?
 *
 * @param {string} line
 * @param {string} previousLine
 * @returns {Set<string>}
 */
function collectDisabledRules(line, previousLine) {
  const disabled = new Set();
  for (const [source, pattern] of [[line, DISABLE_LINE], [previousLine, DISABLE_NEXT]]) {
    const match = source.match(pattern);
    if (match) {
      match[1].split(/[,\s]+/).filter(Boolean).forEach((id) => disabled.add(id));
    }
  }
  return disabled;
}

async function lintFile(relPath) {
  const contents = await readFile(join(projectRoot, relPath), 'utf8');
  const problems = [];
  const lines = contents.split(/\r?\n/);

  lines.forEach((line, index) => {
    const disabled = collectDisabledRules(line, index > 0 ? lines[index - 1] : '');
    for (const rule of RULES) {
      if (disabled.has(rule.id)) {
        continue;
      }
      if (rule.test(line, relPath)) {
        problems.push({ line: index + 1, rule: rule.id, message: rule.message });
      }
    }
  });

  if (contents.length > 0 && !contents.endsWith('\n')) {
    problems.push({
      line: lines.length,
      rule: 'eol-last',
      message: 'file does not end with a newline',
    });
  }

  return problems;
}

const files = await collectFiles();
let total = 0;

for (const file of files) {
  const problems = await lintFile(file);
  if (problems.length === 0) {
    continue;
  }
  total += problems.length;
  console.log(`\n${relative('.', file)}`);
  for (const problem of problems) {
    console.log(`  ${String(problem.line).padStart(4)}:  ${problem.message}  [${problem.rule}]`);
  }
}

console.log('');
if (total === 0) {
  console.log(`Lint clean: ${files.length} files checked, 0 problems.`);
  process.exit(0);
}

console.log(`Lint failed: ${total} problem(s) across ${files.length} files.`);
// Exit code 1 == "this job failed". Lesson 04 shows what that looks like
// in the Actions UI, and how to make a job advisory instead of blocking.
process.exit(1);
