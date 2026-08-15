# Lesson 12 — Capstone: the pipeline you'd actually ship

**Workflow file:** [`.github/workflows/12-capstone.yml`](../.github/workflows/12-capstone.yml)

---

## What changed

Lessons 01-11 each isolated one idea and explained it at length. This file is
what those ideas look like when they stop being lessons: terse, defensive,
and boring. Production infrastructure should be boring.

Open it and read it top to bottom. Nothing in it is new — every construct has
appeared before, and each section header names the lesson that introduced it.
If you can read this file comfortably, you've finished the course.

---

## The design, and why

```
checks  ──▶  test (matrix)  ──▶  build  ──▶  deploy
   │              │                 │           │
   └──────────────┴─────────────────┴───────────┴──▶ report (always)
```

**1. Fast checks first.** Lint and workflow validation run before the
matrix. They take ~30 seconds and need no matrix. If you've left a tab
character in a file, you learn in 30 seconds rather than after 6 minutes of
cross-platform testing.

**2. Then the matrix.** Four combinations: Node 20 and 22 on Linux, plus one
Windows and one macOS via `include`. Broad enough to catch platform
assumptions, narrow enough not to burn minutes.

**3. Build exactly once.** The artifact produced here is the artifact that
gets deployed. Deploy does not rebuild. If you rebuild per environment you
are shipping something you never tested — the version you tested and the
version you shipped came from separate runs of a process that isn't perfectly
deterministic.

**4. Deploy, guarded three ways:**

```yaml
if: |
  success()
  && github.ref == 'refs/heads/main'
  && github.event_name != 'pull_request'
```

- `success()` — **explicit**, because any `if:` removes the implicit one
  (Lesson 08). Without it, this deploys when tests fail.
- Branch check — only `main`.
- Event check — belt and braces. A PR targeting `main` has a `github.ref` of
  `refs/pull/N/merge`, so the second condition already covers it, but stating
  it makes the intent unmissable to whoever reads this next.

**5. Report always.** `if: always()` so you get a summary table whatever
happened, then fail the run if any stage failed.

---

## The details worth stealing

**Concurrency that differs by event:**
```yaml
cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```
Cancel superseded PR runs (saves minutes, nobody cares about a stale PR
result). Queue everything on `main` (never kill a deploy mid-flight).

**A version from `run_number`:**
```yaml
version: 1.0.${{ github.run_number }}
```
Monotonic, unique, free. Fine until you need semver, at which point you read
it from a tag instead.

**Workflow-level `env` for the Node version:**
```yaml
env:
  NODE_VERSION: '22'
```
One place to change it — except in the matrix, which needs literal values.
That asymmetry is genuinely annoying and there's no clean fix.

**Least-privilege permissions:** `contents: read` at workflow level, with
`pages: write` and `id-token: write` granted only to the deploy job.

---

## What's still missing

An honest list. A mature pipeline would add:

- **`timeout-minutes` on every job.** The default is 6 hours (Lesson 04).
  This is the most glaring omission — add it as your first exercise.
- **Dependency scanning** — Dependabot, `npm audit` as a blocking gate.
- **Code scanning** — CodeQL, via `github/codeql-action`.
- **Test reporting** — JUnit XML uploaded as an artifact, surfaced as
  annotations on the PR.
- **Coverage thresholds** that fail the build below a floor.
- **Actions pinned to full SHAs** rather than major tags (Lesson 03).
- **A staging environment** with an approval gate before production.
- **Post-deploy smoke tests** and an automatic rollback on failure.
- **Notifications** — Slack, or an auto-opened issue on failure.

---

## Final exercises

These are bigger than the per-lesson ones. Each is a real feature.

1. **Add `timeout-minutes` everywhere.** 5 for `checks`, 15 for `test`, 10
   for `build` and `deploy`. Smallest change with the largest downside
   avoided.

2. **Add a staging gate.** Create a `staging` environment with yourself as a
   required reviewer. Insert a `deploy-staging` job that runs before
   `deploy`, and make production depend on it. Now you have an approval
   workflow.

3. **Make the release real.** Add a job triggered by `push: tags: ['v*']`
   that zips `dist/` and publishes it with `gh release create`. You'll need
   `contents: write`.

4. **Add a scheduled health check.** A workflow that runs daily, curls your
   Pages URL, and opens an issue with `gh issue create` if it's down. Combines
   Lessons 02, 08, and 10.

5. **Pin everything to SHAs.** Replace every `@v4` with a full commit SHA
   (find them on each action's releases page). Note the readability cost —
   this is a real trade-off, not a free win, which is why the comment
   convention `# v4.2.2` next to the SHA exists.

6. **Then delete a lesson.** Seriously: take `12-capstone.yml`, copy it into
   your own project, and adapt it. Reading a pipeline is a different skill
   from writing one for code you care about.

---

## The ten things worth remembering

If you forget everything else:

1. **A job is a fresh machine that gets destroyed.** Every other rule follows.
2. **Jobs are parallel; steps are sequential.**
3. **The runner has no code until `checkout` runs.**
4. **The exit code is the entire contract.** 0 = pass.
5. **Files survive between steps. Variables don't.** Use `$GITHUB_OUTPUT`.
6. **Never put `${{ }}` from user input into a `run:` block.** Use `env:`.
7. **Any `if:` on a job removes the implicit `success()`.**
8. **Outputs aren't transitive** — you can only read from direct `needs:`.
9. **Cache inputs, upload outputs.** Never cache what you're shipping.
10. **Least privilege.** Start from `permissions: {}` and add what breaks.

---

## Where to go next

- **[Awesome Actions](https://github.com/sindresorhus/awesome-actions)** — a
  curated list of actions worth knowing about.
- **[GitHub's security hardening guide](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)**
  — read this properly before you automate anything privileged.
- **[act](https://github.com/nektos/act)** — run workflows locally in Docker.
  Imperfect emulation, but a much faster feedback loop than push-and-pray.
- **[actionlint](https://github.com/rhysd/actionlint)** — a proper workflow
  linter. Strictly better than this project's `check-workflows.js`; that
  script exists so you'd understand what a checker is doing.
- Read the workflows in projects you admire. `.github/workflows/` is public
  on every open-source repo, and it's the best source of real patterns there
  is.

---

## Final quiz

No hints this time. If you can answer these, you're done.

1. Why does the deploy job need `success()` in its `if:`?
2. Why build once and download, rather than rebuilding in the deploy job?
3. Why is `cancel-in-progress` conditional on the event name?
4. The `checks` job has `actions/checkout` before `./.github/actions/
   setup-project`. Why is that order mandatory?
5. Your workflow passes locally and fails in CI. Name four likely causes.
6. A contributor opens a PR from a fork. Your workflow needs to comment on
   it. Why does the obvious approach fail, and what's the safe fix?

<details>
<summary>Answers</summary>

1. Adding any `if:` removes the implicit `success()` check, so without it the
   job deploys even when the tests failed.
2. Build-once means you deploy the exact artifact you tested. Rebuilding
   ships something that was never tested.
3. PR runs should be cancelled when superseded (saves minutes); `main` runs
   include deploys, which must queue rather than be killed mid-write.
4. A local action is referenced by path, so its `action.yml` must be on the
   runner's disk — which only happens after checkout.
5. Uncommitted files; tool version differences; case-sensitive filesystem;
   timezone (runners are UTC); environment variables set in your shell
   profile.
6. `pull_request` gives fork PRs a read-only token and no secrets, so the
   comment fails. Safe fix: a `pull_request` workflow that builds without
   secrets and uploads an artifact, plus a `workflow_run` workflow that picks
   it up with write permissions. Do **not** reach for
   `pull_request_target` + checking out the PR head.

</details>

---

## You're done

Twelve lessons, thirteen workflows, one composite action, and a live website.

The thing worth noticing: you didn't learn a YAML dialect. You learned that
a pipeline is *your own commands, run by someone else's computer, on a clean
machine, when something happens.* Everything else was detail hanging off that
sentence.

Go automate something tedious.
