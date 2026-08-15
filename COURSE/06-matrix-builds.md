# Lesson 06 — Matrix builds

**Workflow file:** [`.github/workflows/06-matrix.yml`](../.github/workflows/06-matrix.yml)

---

## One definition, many machines

A matrix is the highest-leverage feature in GitHub Actions. You write one job
and get many, running in parallel:

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
    node: ['20', '22', '24']
```

3 x 3 = **nine jobs**, all at once, each on its own machine. Written by hand
that's nine near-identical job definitions and a maintenance problem. Here
it's four lines.

Values are available as `${{ matrix.os }}` and `${{ matrix.node }}`, and —
importantly — you can use them in `runs-on:` and in the job's `name:`, which
is how each job gets a distinguishable label in the UI.

---

## `include` has two personalities

This trips people up, so it's worth being precise. `include` behaves
differently depending on whether it matches an existing combination.

**Personality 1 — it matches: add variables to that job.**

```yaml
matrix:
  os: [ubuntu-latest, windows-latest]
  node: ['20', '22']
  include:
    - os: ubuntu-latest
      node: '22'
      primary: true         # ubuntu+22 now also has matrix.primary
```

Still four jobs. One of them has an extra variable, which you can then branch
on with `if: matrix.primary`. This is how you say "do the coverage run on
exactly one combination" without writing a separate job.

**Personality 2 — it matches nothing: add a whole new job.**

```yaml
  include:
    - os: ubuntu-22.04
      node: '22'            # ubuntu-22.04 isn't in the os list at all
```

Now five jobs. The extra one exists outside the grid.

`exclude` is simpler — it just removes combinations from the product, and it
is applied *before* `include`.

---

## `fail-fast`

```yaml
strategy:
  fail-fast: false   # default is true
```

**`true` (default):** the instant one job fails, all its siblings are
cancelled. Fast, cheap, and you learn about exactly one failure.

**`false`:** everything runs to completion. Slower, costs more minutes, and
you get the full picture.

The practical rule: **`false` while you're debugging, `true` once things are
stable.** Knowing that "Node 20 fails on Windows and macOS but 22 is fine
everywhere" is a much better bug report than "something failed," and you only
get that from `fail-fast: false`.

`max-parallel: 4` caps concurrent jobs — useful when a matrix would otherwise
consume your whole runner allowance or overwhelm a rate-limited service.

---

## Cost, and why the example excludes macOS

Minutes are billed with a multiplier:

| Runner | Multiplier |
| --- | --- |
| Linux | **1x** |
| Windows | **2x** |
| macOS | **10x** |

A 3x3 matrix where each job takes 5 minutes:

```
3 Linux   x 5 x 1  =  15 minutes
3 Windows x 5 x 2  =  30 minutes
3 macOS   x 5 x 10 = 150 minutes
                     ---
                     195 billable minutes for one push
```

On a private repo's 2,000-minute free tier, that's ten pushes a month.

The workflow in this lesson excludes two of the three macOS combinations
deliberately. **A sensible default shape** for most projects:

- Every version on Linux (cheap, and where you probably deploy).
- One representative version on Windows and macOS (catches path separators,
  line endings, case sensitivity).

Public repos are free, so experiment freely — just build the instinct now,
because it matters the moment you're on a private repo.

---

## What a matrix is actually for

It's not just "more coverage." A matrix finds a specific class of bug: **the
assumption you didn't know you were making.**

The `Report` step in this lesson's workflow has `shell: bash` on it. Without
that line, it fails on `windows-latest`, because Windows runners default to
PowerShell and `$GITHUB_STEP_SUMMARY` redirection is bash syntax.

That's the matrix earning its keep. On Linux alone you'd never learn that your
workflow was Linux-specific. The same goes for:

- Path separators (`/` vs `\`)
- Case-sensitive filesystems (Linux) vs insensitive (Windows, macOS)
- Line endings (`\n` vs `\r\n`)
- Available shell utilities — no `grep`, `sed`, or `awk` on Windows by default

---

## The branch-protection problem

Here's a real-world wrinkle that bites teams.

You want to require CI to pass before merging: Settings → Branches →
require status checks. But matrix jobs are named things like
`Node 22 on ubuntu-latest`, and **that name changes whenever you edit the
matrix**. Add Node 24 and your required check list is silently wrong.

The fix is a **gate job** — the pattern at the bottom of this lesson's
workflow:

```yaml
matrix-passed:
  needs: test-matrix
  if: always()                      # critical
  steps:
    - run: |
        if [ "${{ needs.test-matrix.result }}" != "success" ]; then
          exit 1
        fi
```

Require `matrix-passed` in branch protection. Its name is stable, and it
turns N variable results into one fixed check.

**The `if: always()` is load-bearing.** Without it, the gate job is *skipped*
when the matrix fails — and a skipped required check leaves the PR waiting
forever for a result that will never arrive. This exact mistake has stranded
a lot of pull requests.

`needs.test-matrix.result` aggregates the whole matrix: `success` only if
every combination succeeded.

---

## Dynamic matrices

When the list isn't known until runtime, generate it as JSON:

```yaml
jobs:
  discover:
    outputs:
      targets: ${{ steps.find.outputs.targets }}
    steps:
      - id: find
        run: echo 'targets=["a","b","c"]' >> "$GITHUB_OUTPUT"

  build:
    needs: discover
    strategy:
      matrix:
        target: ${{ fromJSON(needs.discover.outputs.targets) }}
```

`fromJSON()` parses the string into a real array. Useful for monorepos where
you only want to build the packages that changed. It needs job outputs, which
is Lesson 08 — come back to this after you've read that.

---

## Run it

Push, open *06 - Matrix*, and look at the graph. Seven jobs (9 minus 2
excluded, plus 1 extra include), all running at once.

Things to notice:

- Linux jobs finish first. Windows and macOS take noticeably longer to boot.
- The `Extra work on the reference build only` step runs in exactly one job.
- The `Report` step prints the *actual* `node --version`, which should match
  the requested major.

---

## Exercises

1. **Break Windows on purpose.** Remove `shell: bash` from the Report step
   and push. Watch the three Windows jobs fail while everything else passes.
   Read the error. Then put it back.

2. **See `fail-fast` in both modes.** Add a step that fails only on Node 20:
   ```yaml
   - if: matrix.node == '20'
     run: exit 1
   ```
   Run with `fail-fast: false`, then `true`. Compare what you learn from each.

3. **Add a variable via `include`** — give each combination a `label`, and
   print it. Confirm that a matching `include` adds to the existing job
   rather than creating a new one (count the jobs).

4. **Build the gate job yourself** in a different workflow, then go into
   Settings → Branches and actually add it as a required check. Open a PR
   with a failing test and confirm the merge button is blocked.

---

## Quiz

1. `os: [a, b]` and `node: [1, 2, 3]` — how many jobs?
2. `include` with a combination that already exists — what happens?
3. Why `fail-fast: false` when debugging?
4. Why can't you require a matrix job by name in branch protection?
5. Why does a gate job need `if: always()`?

<details>
<summary>Answers</summary>

1. **Six** (2 x 3).
2. It **adds variables** to that existing job. It does not create a new one.
3. So every combination runs and you see the full failure pattern, instead of
   just whichever one failed first.
4. The names contain matrix values and change whenever you edit the matrix,
   silently breaking your required-checks list.
5. Without it the gate is *skipped* when the matrix fails, and a skipped
   required check blocks the PR forever.

</details>

---

**Next:** [Lesson 07 — Caching and artifacts](07-cache-and-artifacts.md)
