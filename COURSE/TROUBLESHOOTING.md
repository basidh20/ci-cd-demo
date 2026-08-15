# Troubleshooting

Symptoms you will actually hit, and what causes them. Ordered roughly by how
often they happen.

---

## "My workflow doesn't run at all"

The worst failure mode, because there's nothing to read. Work through these
in order:

**1. Is the path exactly right?**
```
.github/workflows/name.yml
```
- `.github/workflow/` (no `s`) → ignored
- `.github/name.yml` → ignored
- `github/workflows/` (no dot) → ignored

No error is produced. From GitHub's view, there is no workflow.

**2. Is it on the right branch?** A workflow only reacts to events on
branches where the file exists. Pushing it to `feature/x` won't make it run
on `main`.

**3. `workflow_dispatch` button missing?** It only appears once the file is
on the **default branch**.

**4. Does the trigger actually match?** Print it: temporarily replace `on:`
with just `push:` and see if it fires. If it does, your filters are wrong.
Common culprits: `paths` excluding the file you changed, or `branches` not
matching (remember `release/*` doesn't match `release/1/2`).

**5. Is YAML valid?** A syntax error means GitHub can't parse the file, and
depending on where it is you may get nothing at all. Run:
```bash
npm run check:workflows
```

**6. Are Actions enabled?** Settings → Actions → General. Also check whether
a fork has them disabled by default (it does).

**7. Scheduled workflow not firing?** They only run on the default branch,
they're often 5-20 minutes late, and on public repos they're disabled after
60 days of inactivity.

---

## "Two runs for every push"

Not a bug. You have both `push` and `pull_request` triggers, and pushing to a
branch with an open PR produces two events.

```yaml
on:
  push:
    branches: [main]     # <- scope it; PR branches covered by pull_request
  pull_request:
```

---

## "No such file or directory"

You forgot `actions/checkout`. The runner starts with nothing.

```yaml
- uses: actions/checkout@v4      # almost always the first step
```

If checkout *is* there, check your working directory. Steps start in
`$GITHUB_WORKSPACE`, and a `cd` in one step doesn't persist to the next — use
`working-directory:` instead:

```yaml
- working-directory: ./packages/app
  run: npm ci
```

---

## "Works locally, fails in CI"

The five causes, in order of likelihood:

1. **An uncommitted file.** It works on your machine because a file exists
   there that git doesn't know about. Verify with:
   ```bash
   git stash -u && npm ci && npm test
   ```
   (Then `git stash pop`.) Or clone into a temp folder and run there.

2. **Version differences.** Pin the toolchain in both places. `.nvmrc` plus
   `node-version-file: .nvmrc` keeps them honest.

3. **Case-sensitive filesystem.** Linux cares about `Utils.js` vs
   `utils.js`. Windows and macOS don't. Your runner is Linux.

4. **Timezone.** Runners are UTC. Any test that constructs a date without
   specifying a zone can pass in one place and fail in another.

5. **Environment variables** from your shell profile that don't exist on the
   runner.

**The fastest diagnostic:** add a step that dumps state.
```yaml
- run: |
    node --version && npm --version
    git status --porcelain
    env | sort
    ls -la
```

---

## "Green build, but the tests failed"

Two causes:

**1. The pipeline swallowed the exit code.**
```yaml
- run: npm test | tee out.log        # reports tee's exit code
```
Fix:
```yaml
- run: |
    set -o pipefail
    npm test | tee out.log
```

**2. Your test command exits 0 despite failures.** Check locally:
```bash
npm test; echo "exit code: $?"
```

---

## "It deployed even though tests failed"

```yaml
deploy:
  needs: test
  if: github.ref == 'refs/heads/main'      # BUG
```

Adding any `if:` removes the implicit `success()`.

```yaml
  if: success() && github.ref == 'refs/heads/main'
```

---

## "`needs.something.outputs.x` is empty"

**Outputs are not transitive.** You can only read outputs from a job named
directly in your own `needs:` list, even if there's an indirect path.

```yaml
package:
  needs: [setup, lint, test]     # setup must be here explicitly
```

Also check:
- The producing job declared `outputs:` at **job** level, not just the step.
- The producing step has an `id:`.
- The producing job wasn't skipped (skipped jobs give empty outputs).
- You used `>>` not `>` when writing to `$GITHUB_OUTPUT`.

---

## "Required property is missing: shell"

Every `run:` step in a **composite action** must declare a shell. There's no
default.

```yaml
- shell: bash
  run: npm ci
```

---

## "Can't find 'action.yml' under ..."

A local action (`uses: ./...`) is loaded from disk, so the repo must be
checked out first.

```yaml
- uses: actions/checkout@v4              # must come first
- uses: ./.github/actions/my-action
```

This means a composite action **cannot** perform its own checkout — the file
wouldn't be there to read.

---

## "403" or "Resource not accessible by integration"

A permissions problem. Three things to check:

1. **The workflow's `permissions:` block.** Any block sets unlisted scopes to
   `none`.
   ```yaml
   permissions:
     contents: read
     pull-requests: write
   ```
2. **The repository default.** Settings → Actions → General → Workflow
   permissions.
3. **Is it a fork PR?** Those get a read-only token, always, regardless of
   your config.

Remember: **PR labels need `issues: write`**, not `pull-requests: write`.

---

## "My secret is empty"

- **Fork PR** — no secrets, by design.
- **Typo** — secret names are case-sensitive.
- **Wrong level** — environment secrets are only available to jobs that
  declare that `environment:`.
- **Wrong context** — `${{ secrets.NAME }}`, not `${{ env.NAME }}`.
- Secrets are **not available** in `if:` conditions at job/step level. Assign
  to `env:` first, then test the env var.

---

## "The cache never updates"

**Caches are immutable.** Once a key is written, it's frozen forever.

```yaml
key: npm-cache                                          # WRONG — static
key: ${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}   # right
```

If you need to bust a cache manually, add a version prefix you can bump:
`key: v2-${{ runner.os }}-npm-...`.

---

## "Artifact not found"

- **Name mismatch.** Often caused by an empty interpolation — `site-v` when
  you meant `site-v1.0.42`, because of the transitive-outputs bug above.
- **The producing job failed or was skipped.**
- **Missing `needs:`** — the download job ran in parallel with the upload.
- **Cross-run download.** `download-artifact` only sees artifacts from the
  *same run* by default; you need `run-id` and `github-token` for others.
- **v4 uniqueness:** two jobs uploading the same artifact name is an error.

---

## "Windows jobs fail, Linux passes"

- **Shell.** Windows defaults to PowerShell. Add `shell: bash`.
- **Paths.** `\` vs `/`. In Node use `path.join()`.
- **Line endings.** Configure `.gitattributes` with `* text=auto eol=lf`.
- **Missing tools.** No `grep`, `sed`, `awk`, `make` by default.
- **Case sensitivity.** A file that resolves on Windows may not on Linux.

---

## "The job hangs and eventually times out"

Default timeout is **360 minutes**. Always set your own:

```yaml
jobs:
  test:
    timeout-minutes: 10
```

Common hangs: a command waiting for interactive input (add `--yes`,
`--non-interactive`, `CI=true`), a dev server started without `&`, or a
watch-mode test runner (`jest --watch` instead of `jest --ci`).

---

## "Something is wrong and I can't see why"

In escalating order:

1. **Read the log from the bottom.** The error is in the last few lines.
2. **Dump the context:**
   ```yaml
   - run: echo "$CTX"
     env:
       CTX: ${{ toJSON(github) }}
   ```
3. **Dump the environment:** `env | sort`
4. **Enable debug logging.** Re-run jobs → *Enable debug logging*. Or set
   repo secrets `ACTIONS_STEP_DEBUG=true` and `ACTIONS_RUNNER_DEBUG=true`.
5. **Bisect.** Comment out half the steps. Repeat.
6. **Reproduce locally** with [act](https://github.com/nektos/act):
   ```bash
   act -j build
   ```
   Imperfect emulation, but far faster than push-and-pray.
7. **Get a shell on the runner** with
   [action-tmate](https://github.com/mxschmitt/action-tmate). Extremely
   effective, and **never** use it on a repo with real secrets — it opens an
   interactive session on a machine holding your credentials.

---

## "I'm burning through my minutes"

- Scope triggers with `paths` / `paths-ignore`.
- `concurrency` with `cancel-in-progress` for PR runs.
- Trim the matrix — macOS is **10x**, Windows **2x**.
- Cache dependencies.
- Split fast checks into their own job so failures abort early.
- `timeout-minutes` everywhere so a hang costs 10 minutes, not 6 hours.
- Check Settings → Billing → Actions to see where it's actually going.
- **Make the repo public** if you can. Then it's all free.
