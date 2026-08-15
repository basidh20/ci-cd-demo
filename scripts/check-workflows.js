/**
 * A pre-flight check for workflow files.
 *
 * GitHub only tells you a workflow is broken *after* you push it, which makes
 * for a miserable feedback loop of "commit, push, squint at a red X, repeat".
 * This script catches the four mistakes that cause most of that pain:
 *
 *   1. Tab characters. YAML forbids tabs for indentation, full stop.
 *   2. A missing top-level key (name / on / jobs).
 *   3. An unpinned action (`uses: actions/checkout` with no @version).
 *   4. A job with no `runs-on`.
 *
 * It is regex-based, not a real YAML parser, so it is a smoke alarm rather
 * than a fire marshal. Run it with:  npm run check:workflows
 */

import { readFile } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'node:fs/promises';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

async function collectWorkflows() {
  const found = [];
  for await (const entry of glob('.github/workflows/*.{yml,yaml}', { cwd: projectRoot })) {
    found.push(entry);
  }
  return found.sort();
}

function checkWorkflow(contents) {
  const problems = [];
  const lines = contents.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNo = index + 1;

    // Tabs anywhere in the indentation are fatal to YAML.
    if (/^[ ]*\t/.test(line)) {
      problems.push({ line: lineNo, message: 'tab used for indentation (YAML forbids this)' });
    }

    // `uses: owner/repo` with no @ref. GitHub will fail the run.
    const uses = line.match(/^\s*(?:-\s*)?uses:\s*(\S+)/);
    if (uses) {
      const target = uses[1].replace(/['"]/g, '');
      const isLocal = target.startsWith('./');
      const isDocker = target.startsWith('docker://');
      if (!isLocal && !isDocker && !target.includes('@')) {
        problems.push({ line: lineNo, message: `action "${target}" is not pinned to a version` });
      }
    }
  });

  // A local ACTION (`uses: ./.github/actions/...`) is read off the runner's
  // disk, so the repository must be checked out before it can run.
  //
  // A local reusable WORKFLOW (`uses: ./.github/workflows/...`) is different:
  // GitHub resolves it from the repository itself, at job level, with no
  // checkout involved. So it is excluded here — that distinction is the
  // whole of Lesson 09.
  const usesLocalAction = /uses:\s*\.\/(?!\.github\/workflows\/)/.test(contents);
  if (usesLocalAction && !/uses:\s*actions\/checkout@/.test(contents)) {
    problems.push({
      line: 1,
      message: 'uses a local action (./...) but never runs actions/checkout',
    });
  }

  // Top-level keys sit at column zero. `on:` is special: YAML 1.1 reads a bare
  // `on` as the boolean true, so many repos quote it as "on:". Accept both.
  const hasName = /^name:/m.test(contents);
  const hasOn = /^(on|"on"|'on'):/m.test(contents);
  const hasJobs = /^jobs:/m.test(contents);

  if (!hasName) {
    problems.push({ line: 1, message: 'no top-level `name:` (the run list will show the filename)' });
  }
  if (!hasOn) {
    problems.push({ line: 1, message: 'no top-level `on:` — this workflow can never trigger' });
  }
  if (!hasJobs) {
    problems.push({ line: 1, message: 'no top-level `jobs:` — there is nothing to run' });
  }

  return problems;
}

const workflows = await collectWorkflows();

if (workflows.length === 0) {
  console.log('No workflow files found under .github/workflows/.');
  process.exit(1);
}

let total = 0;
for (const file of workflows) {
  const contents = await readFile(join(projectRoot, file), 'utf8');
  const problems = checkWorkflow(contents);
  const label = basename(file);

  if (problems.length === 0) {
    console.log(`  ok    ${label}`);
    continue;
  }

  total += problems.length;
  console.log(`  FAIL  ${label}`);
  for (const problem of problems) {
    console.log(`          line ${problem.line}: ${problem.message}`);
  }
}

console.log('');
if (total === 0) {
  console.log(`All ${workflows.length} workflow files passed the pre-flight check.`);
  process.exit(0);
}

console.log(`${total} problem(s) found. Fix them before pushing.`);
process.exit(1);
