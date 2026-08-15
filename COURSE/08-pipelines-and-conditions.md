# Lesson 08 — Pipelines: `needs`, outputs, and conditions

**Workflow file:** [`.github/workflows/08-pipeline.yml`](../.github/workflows/08-pipeline.yml)

---

## Building a graph

`needs:` turns a pile of parallel jobs into a dependency graph.

```yaml
jobs:
  setup:
  lint:    { needs: setup }
  test:    { needs: setup }
  build:   { needs: setup }
  package: { needs: [lint, test, build] }
```

```
        setup
       /  |  \
   lint test build      (parallel — all three wait only for setup)
       \  |  /
       package          (waits for all three)
```

A list in `needs:` means **all of them**. There is no "any of them" — if you
want that, you use `if: always()` plus a manual result check.

GitHub draws this graph for you in the Actions tab, and it's genuinely the
best documentation your pipeline will ever have. Push this workflow and look
at it.

---

## Job outputs: how jobs talk

Jobs are separate machines. They cannot share files or variables. They have
exactly two channels: **artifacts** (Lesson 07) and **outputs**.

```yaml
setup:
  outputs:
    version: ${{ steps.meta.outputs.version }}    # declare at job level
  steps:
    - id: meta
      run: echo "version=1.0.${{ github.run_number }}" >> "$GITHUB_OUTPUT"

build:
  needs: setup
  steps:
    - run: echo "Building ${{ needs.setup.outputs.version }}"
```

Note the two-step relay: a *step* writes to `$GITHUB_OUTPUT`, the *job*
declares an output pointing at that step, and the consumer reads
`needs.<job>.outputs.<name>`.

### The gotcha that will cost you an hour

**Outputs are not transitive.**

```yaml
package:
  needs: [lint, test, build]              # setup is NOT here
  steps:
    - run: echo "${{ needs.setup.outputs.version }}"    # EMPTY STRING
```

`lint` depends on `setup`, and `package` depends on `lint` — but that does
*not* give `package` access to `setup`'s outputs. You may only read
`needs.X.outputs` for a job named directly in your own `needs:` list.

And it fails **silently**, as an empty string. In the workflow file for this
lesson, that would have made the artifact name `site-v` instead of
`site-v1.0.42`, and the download would fail later with a baffling "artifact
not found." I hit exactly this while writing the file — the fix is to add
`setup` to the list, and there's a comment marking it.

**Two more things about outputs:**
- They're **strings**. Always. `should_deploy: true` arrives as the string
  `"true"`, so compare with `== 'true'`, quotes included.
- A **skipped** job produces empty outputs, not an error.

---

## Status functions

Four functions, and one rule that catches everyone.

| Function | True when |
| --- | --- |
| `success()` | all `needs:` jobs succeeded (**the implicit default**) |
| `failure()` | any `needs:` job failed |
| `cancelled()` | the run was cancelled |
| `always()` | always — including cancellation |

### The rule that catches everyone

> **Writing any `if:` removes the implicit `success()` check.**

So this is a broken deploy, and it is a very common bug:

```yaml
deploy:
  needs: test
  if: github.ref == 'refs/heads/main'      # DEPLOYS EVEN IF TESTS FAILED
```

By adding an `if:`, you replaced the default condition. Correct version:

```yaml
  if: success() && github.ref == 'refs/heads/main'
```

Make `success() &&` a reflex whenever you add a condition to a job that
should only run after things pass.

### `always()` versus `!cancelled()`

`always()` runs even when someone hits the cancel button, which is rarely
what you want — a cancelled run generally *should* stop. Prefer:

```yaml
if: !cancelled()          # runs on success or failure, respects cancellation
```

for cleanup and notification jobs. `always()` is right when you truly must
run no matter what (releasing a lock, tearing down infrastructure).

---

## Useful expression functions

```yaml
contains(needs.*.result, 'failure')        # did anything fail?
contains(github.event.head_commit.message, '[skip ci]')
startsWith(github.ref, 'refs/tags/')
endsWith(github.repository, '-internal')
fromJSON('["a","b"]')                      # string -> array
toJSON(github)                             # object -> string
hashFiles('**/package-lock.json')
```

`needs.*.result` is the **object filter** syntax: it collects `result` from
every job in `needs` into an array. `contains(needs.*.result, 'failure')` is
the idiomatic "did anything upstream break?"

Operators: `==` `!=` `<` `>` `&&` `||` `!`. String comparison is
case-insensitive, which is occasionally surprising.

**In `if:`, the `${{ }}` is optional** — you're already in expression
context. Both forms work. The exception is a multi-line `if:` using `|`,
where you need it. You'll see both styles in the wild.

---

## Concurrency

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

Without this, pushing three commits in quick succession starts three runs
that race each other, and the *oldest* might finish last and report a stale
status. This cancels superseded runs.

**For deploys, set `cancel-in-progress: false`.** You want deployments to
*queue*, not to be killed halfway through writing to production. The
difference between these two settings is the difference between "saved some
minutes" and "left the database migrated but the app not deployed."

A good default pattern:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

Cancel superseded PR runs; queue everything on `main`.

---

## Run it

Push and open *08 - Full Pipeline*. Watch the graph animate through the
stages. Then:

- Note that `deploy` is **skipped** on a pull request — grey, not red.
  Skipped is not failed.
- The `notify` job runs regardless, and writes a results table to the
  Summary page.
- Push twice quickly and watch the first run get cancelled by the
  `concurrency` rule.

---

## Exercises

1. **Reproduce the transitive-outputs bug.** Remove `setup` from `package`'s
   `needs:` list. The workflow still runs. Look at what the artifact name
   becomes. Then watch the download fail. This is the failure mode that
   teaches the lesson properly.

2. **Reproduce the deploy-on-failure bug.** Break a test, then change the
   `deploy` job's condition to just `if: github.ref == 'refs/heads/main'`.
   Push to main. Watch it deploy despite red tests. Then add `success() &&`.

3. **Add a `[skip ci]` escape hatch:**
   ```yaml
   if: "!contains(github.event.head_commit.message, '[skip ci]')"
   ```
   Commit with that marker in the message and confirm the job skips.

4. **Add a rollback job** that runs only on deploy failure:
   ```yaml
   rollback:
     needs: deploy
     if: failure()
   ```

---

## Quiz

1. `needs: [a, b, c]` — does the job wait for all three or any one?
2. Job C needs B, B needs A. Can C read A's outputs?
3. Why is `if: github.ref == 'refs/heads/main'` dangerous on a deploy job?
4. `cancel-in-progress` on a deploy workflow: true or false?
5. How do you check whether any upstream job failed?

<details>
<summary>Answers</summary>

1. **All three.**
2. **No.** Outputs aren't transitive — C must list A in its own `needs:`.
3. Adding any `if:` removes the implicit `success()`, so it deploys even when
   the tests failed.
4. **False.** Deploys should queue; cancelling one mid-write can leave
   production in a broken half-state.
5. `contains(needs.*.result, 'failure')`

</details>

---

**Next:** [Lesson 09 — Reuse](09-reuse.md)
