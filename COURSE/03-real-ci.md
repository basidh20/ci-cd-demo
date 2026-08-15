# Lesson 03 — Your first real CI

**Workflow file:** [`.github/workflows/03-test.yml`](../.github/workflows/03-test.yml)

---

## The four steps that are always the same

This is the workflow that starts earning its keep. And here's the reassuring
part: it's four steps, and they're the same four steps in essentially every
CI pipeline ever written.

```yaml
- uses: actions/checkout@v4      # 1. Get the code
- uses: actions/setup-node@v4    # 2. Get the toolchain
- run: npm ci                    # 3. Install dependencies
- run: npm test                  # 4. Run the tests
```

Swap step 2 for `setup-python` and steps 3-4 for `pip install` and `pytest`,
and you have a Python pipeline. Same skeleton. Once you can read this, you
can read most of the CI configs on GitHub.

---

## Step 1: `actions/checkout`

**The runner does not have your code.** This is the thing to internalise.

GitHub boots a generic virtual machine that knows nothing about your
repository. `checkout` clones it into the working directory. Forget this step
and you get `no such file or directory: package.json`, followed by five
confusing minutes.

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 1     # the default: latest commit only
```

`fetch-depth: 1` is a shallow clone — much faster on a repo with history.
Use `fetch-depth: 0` (meaning "everything") only when you genuinely need
history: generating changelogs, `git describe --tags`, diffing against a base
branch, or anything touching `git blame`. Lesson 10 needs it; almost nothing
else does.

### The `@v4` part is not optional

```yaml
uses: actions/checkout@v4          # major version tag — the usual choice
uses: actions/checkout@v4.2.2      # exact release — more locked down
uses: actions/checkout@a1b2c3d...  # full commit SHA — maximum paranoia
uses: actions/checkout            # ERROR: unpinned, the run fails
```

The trade-off is real. `@v4` gets you security patches automatically but
means you're running code that can change under you. A full SHA is immutable
and is what GitHub's own hardening guide recommends for third-party actions —
because an action you trust today can be sold, compromised, or have a
malicious release published tomorrow, and `@v4` would pick it up silently.

**A reasonable policy:** major tags for actions published by `actions/` and
`github/`, full SHAs for everything else. Dependabot can keep the SHAs
updated for you.

> Action versions move. These files use versions that were current when the
> course was written; check an action's Marketplace page for its current
> major before copying into production.

---

## Step 2: `actions/setup-node`

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '22'
    cache: npm
```

Runners ship with *some* Node preinstalled, but which version depends on the
runner image, which GitHub updates monthly. "Whatever Node happened to be on
the machine" is not a reproducible build. Pin it.

**Quote the version.** `node-version: 22` unquoted is the number 22, which
happens to work — but `node-version: 20.10` unquoted is the float `20.1`, and
now you're debugging something genuinely baffling. Quote it. Always.

That one line `cache: npm` is doing real work — it's `actions/cache`
configured for you, keyed on your lockfile. Lesson 07 opens it up.

The whole family works the same way: `setup-python`, `setup-java`,
`setup-go`, `setup-dotnet`.

---

## Step 3: `npm ci`, not `npm install`

This distinction matters more in CI than anywhere else:

| | `npm install` | `npm ci` |
| --- | --- | --- |
| Reads | `package.json` | `package-lock.json` |
| May modify the lockfile | **Yes** | Never |
| Stale lockfile | Silently fixes it | **Errors out** |
| `node_modules` | Updates in place | Deletes, reinstalls clean |
| Speed | Slower | Faster |

`npm ci` is the reproducible one. "Errors out on a stale lockfile" sounds
hostile, but it's the feature: it catches the case where someone edited
`package.json` and forgot to commit the updated lockfile. Better to fail
loudly in CI than to silently install different versions than your teammates.

The equivalents elsewhere: `pip install -r requirements.txt` (or `uv sync`),
`bundle install --deployment`, `yarn install --frozen-lockfile`.

---

## Step 4: the exit code is the whole contract

This is the most important paragraph in this lesson.

**GitHub Actions does not understand your test framework.** It doesn't parse
your output, count your assertions, or know what a test is. It runs your
command and looks at one number:

- **exit code 0** → success, green check
- **anything else** → failure, red X

That's it. That's the entire interface between your project and CI.

Two consequences follow, and both bite people:

**Consequence 1: a command that fails silently gives you a green build.**
Some tools print scary errors and still exit 0. Your CI will happily pass.
Verify by running `echo $?` locally after your test command.

**Consequence 2: piping can swallow the exit code.**

```yaml
- run: npm test | tee output.log      # exit code of `tee`, not `npm test`!
```

Bash reports the *last* command in a pipeline. `tee` almost always succeeds,
so your failing tests turn green. Fix it with:

```yaml
- run: |
    set -o pipefail
    npm test | tee output.log
```

This is a genuinely common bug in real pipelines. Now you know to look for it.

---

## The local/CI symmetry

Here's the insight that makes everything else easier:

> **CI runs the same commands you run.** There is no "CI mode."

You can run the entire pipeline right now:

```bash
npm ci && npm run lint && npm test && npm run build
```

That's what `npm run ci` in this project does. If it passes locally on a
clean checkout, it will almost certainly pass in CI.

The word *almost* covers the classic divergence causes — memorise this list,
because when something passes locally and fails in CI it is nearly always
one of these five:

1. **Uncommitted files.** It works because a file exists on your disk that
   isn't in git. Test with `git stash -u` or a fresh clone in a temp folder.
2. **Node/tool version differences.** Fixed by pinning in both places.
3. **Case-sensitive filesystems.** Windows and macOS don't care about
   `Utils.js` vs `utils.js`. Linux does, and your runner is Linux.
4. **Timezone.** Runners are UTC. Your laptop isn't. (This project's
   `formatDate` is UTC-only for exactly this reason — see the test in
   `tests/formatter.test.js` that guards it.)
5. **Environment variables** set in your shell profile but nowhere else.

---

## Run it

Push, then open Actions → *03 - Test*. You should get a green run in about
30 seconds.

Then **break it on purpose**, because a green run teaches you nothing:

```js
// in tests/quotes.test.js
test('deliberately broken', () => {
  assert.equal(1, 2);
});
```

Push and watch. Click into the failed step. Notice that the log shows exactly
what `npm test` printed — the same output you'd see locally. Then remove it.

---

## Exercises

1. **Prove the pipefail bug.** Make a test fail, then change the test step to
   `run: npm test | tee out.log` and push. Green, despite failing tests.
   Now add `set -o pipefail` and watch it correctly go red. This is the kind
   of thing you only really believe once you've seen it.

2. **Find out what's on a runner.** Add a step that prints
   `node --version`, `python3 --version`, `git --version`, `docker --version`.
   The runner image is much richer than "blank machine" suggests.

3. **Add a timing step.** Record `date +%s` before and after `npm ci`, then
   print the difference. Note it, and compare after Lesson 07's caching.

4. **Simulate the "uncommitted file" failure.** Add `import './secret.js'`
   to a source file, create `src/secret.js`, but only commit the first
   change. Watch CI fail on a file that works fine locally.

---

## Quiz

1. What happens if you forget `actions/checkout`?
2. Why `npm ci` over `npm install` in CI?
3. Your tests fail but the job is green. Name two possible causes.
4. Why quote `node-version: '22'`?
5. When do you need `fetch-depth: 0`?

<details>
<summary>Answers</summary>

1. The runner has no code. Every command fails with "file not found."
2. It's reproducible — obeys the lockfile exactly and errors if it's stale,
   rather than silently resolving different versions.
3. (a) The test command exits 0 despite failures; (b) the command is piped
   and the exit code came from the last pipeline stage instead — needs
   `set -o pipefail`.
4. Unquoted versions are parsed as numbers. `20.10` becomes `20.1`.
5. When you need full git history: changelogs, tags, `git blame`, or diffing
   against a base branch.

</details>

---

**Next:** [Lesson 04 — Jobs, parallelism, and failure](04-jobs-and-failure.md)
