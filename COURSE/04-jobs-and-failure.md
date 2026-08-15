# Lesson 04 — Jobs, parallelism, and what "failure" means

**Workflow file:** [`.github/workflows/04-lint.yml`](../.github/workflows/04-lint.yml)

---

## Jobs are parallel. This is free speed.

Three jobs, no `needs:` between them, so all three start **at the same moment
on three separate machines**:

```yaml
jobs:
  lint:              # machine 1  ┐
  workflow-syntax:   # machine 2  ├─ all start together
  advisory-checks:   # machine 3  ┘
```

Push this and watch the Actions graph. Seeing three boxes light up
simultaneously is the moment the jobs-vs-steps distinction stops being
abstract.

The practical consequence: if lint takes 40 seconds and tests take 3 minutes,
running them as separate jobs costs you 3 minutes of wall-clock time, not
3:40. You pay the same runner minutes either way, but you get your answer
sooner — and **feedback latency is the thing that determines whether people
actually pay attention to CI.**

### The cost of parallelism

It isn't free of trade-offs. Each job is a fresh machine, which means each
one repeats `checkout`, `setup-node`, and `npm ci` — maybe 20-30 seconds of
setup, three times over.

The rule of thumb:

- **Fast tasks that share setup** → same job, sequential steps.
- **Slow, independent tasks** → separate jobs.

Don't split a 5-second lint into its own job just because you can; you'll
spend 25 seconds of setup to save 5. In this project, `workflow-syntax` is a
separate job precisely because it needs **no** `npm ci` at all, so it's the
fastest signal in the repo.

---

## Splitting jobs by what fails

There's a second reason to split jobs that has nothing to do with speed:
**a job is the unit of "what went wrong."**

If lint and tests share a job, the UI tells you "the checks job failed." If
they're separate, it tells you "lint failed, tests passed" — and you knew
what to fix before you opened anything. Design your job boundaries around the
questions you'll be asking at 5pm on a Friday.

---

## What "failure" actually means

A step fails when its command exits non-zero. Then, by default:

1. That step goes red.
2. **Every remaining step in that job is skipped.**
3. The job fails.
4. Any job that `needs:` it is skipped.
5. The whole run goes red.

That cascade is the default and it's usually right. But you can intervene at
several points.

### `continue-on-error` — "this may fail"

At **step** level:

```yaml
- name: Flaky external check
  continue-on-error: true
  run: ./might-fail.sh

- name: This still runs
  run: echo "carried on regardless"
```

At **job** level:

```yaml
advisory-checks:
  continue-on-error: true
```

The job can fail without failing the workflow. In the UI you get a distinct
"failed but tolerated" state — an orange-ish result rather than a red X.

**Use it for:** a lint rule you're trialling before enforcing, a scan against
a flaky third-party service, informational metrics.

**Do not use it to silence a test you broke.** That's how a test suite decays
into decoration that everyone ignores. If a check isn't worth blocking on,
consider whether it's worth running.

### `if:` — "only run this sometimes"

```yaml
- if: github.event_name == 'push'
- if: failure()
- if: always()
```

Covered properly in Lesson 08, where the status functions get the attention
they deserve. For now: `if:` decides *whether* a step runs;
`continue-on-error` decides whether its failure *matters*.

### `timeout-minutes` — the one everyone forgets

```yaml
jobs:
  test:
    timeout-minutes: 10
```

**Default: 360 minutes.** Six hours. A hung test, an interactive prompt
waiting for input that never comes, an infinite retry loop — all of it burns
six hours of billable runner time before GitHub gives up.

Set this on every job. Ten minutes for tests, thirty for a big build. It's a
one-line change that has saved real people real money.

---

## Reading a failed run

When something goes red, the workflow is:

1. **Actions tab → the red run → the red job.**
2. Find the red step. It's collapsed; click it.
3. Read from the **bottom**. The last few lines before the exit are the
   error. Everything above is usually noise.
4. Look for `Error:` and `##[error]` markers — GitHub highlights these.
5. Still stuck? Re-run with debug logging: on the run page,
   **Re-run jobs → Enable debug logging**. This sets `ACTIONS_STEP_DEBUG` and
   turns on an enormous amount of internal detail about what the runner did.

There's also **Re-run failed jobs**, which skips the ones that already
passed. Useful when a single flaky job failed in a 20-job matrix.

---

## Run it

Push, then open *04 - Lint and Checks*. Things to look at:

- **The graph**: three boxes, side by side, no arrows between them.
- **`advisory-checks`**: it contains a step that runs `exit 1`. The step
  shows a warning, but the job continues and the workflow stays green.
- **Timings**: compare `workflow-syntax` (no `npm ci`) against `lint`. The
  difference is the cost of dependency installation.

Then break lint on purpose — add a tab character to a `.js` file — and watch
`lint` go red while the other two jobs still finish. That independence is the
point.

---

## Exercises

1. **Add `timeout-minutes: 5`** to every job in this file. Then add a step
   that runs `sleep 400` and watch the job get killed. Note how the log
   reports it.

2. **Prove the skip-cascade.** Add two steps to the `lint` job:
   ```yaml
   - run: exit 1
   - run: echo "you will never see this"
   ```
   Confirm the second is marked *skipped*, not *failed*. Then add
   `if: always()` to it and watch it run anyway.

3. **Measure the split.** Merge `lint` and `workflow-syntax` into one job with
   four steps. Compare total wall-clock time against the parallel version.
   Which is faster? Which tells you more when it fails?

4. **Promote an advisory check.** Move `npm audit` out of `advisory-checks`
   into its own blocking job. Think about when you'd actually want that —
   a security scan blocking every merge is either excellent discipline or an
   endless nuisance, depending on your dependency count.

---

## Quiz

1. Two jobs with no `needs:`. Sequential or parallel?
2. What's the default job timeout, and why should you change it?
3. A step has `continue-on-error: true` and fails. Is the workflow red?
4. Why might you split a fast task into its own job anyway?
5. How do you turn on verbose runner logging?

<details>
<summary>Answers</summary>

1. **Parallel**, on separate machines.
2. **360 minutes** (6 hours). A hung job otherwise burns billable time all
   day before it's killed.
3. **No** — the workflow stays green. The step is marked as failed-but-
   tolerated.
4. Because a job is the unit of failure reporting: separate jobs tell you
   *which* thing broke without opening any logs.
5. Re-run jobs → *Enable debug logging* (sets `ACTIONS_STEP_DEBUG`).

</details>

---

**Next:** [Lesson 05 — Contexts, variables, and secrets](05-contexts-variables-secrets.md)
