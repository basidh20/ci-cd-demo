# Lesson 02 — Events: what makes a workflow start

**Workflow file:** [`.github/workflows/02-triggers.yml`](../.github/workflows/02-triggers.yml)

---

## Why this lesson gets its own chapter

A broken `on:` block is the most frustrating failure mode in GitHub Actions,
because **there is nothing to debug**. The workflow doesn't run. There's no
red X, no log, no error. From GitHub's side, no event matched, so nothing
happened, so there's nothing to report.

You will lose an afternoon to this at least once. This lesson is an attempt
to make it a short afternoon.

---

## The events that actually matter

There are 35-ish triggers. In practice you'll use five.

### `push`

```yaml
on:
  push:
    branches: [main, 'release/**']
    paths: ['src/**', 'package.json']
```

Fires when commits land on a branch.

- `branches` — glob patterns. `*` matches within a path segment,
  `**` crosses segments. So `release/**` matches `release/2.1/hotfix`, but
  `release/*` does not.
- `paths` — only run when matching files changed. This is a **cost control**:
  without it, a README typo triggers your full 12-minute test matrix.
- `paths-ignore` is the inverse. **You may use one or the other, never both**
  in the same trigger.
- `tags` also works here, and is how you build release pipelines:
  `tags: ['v*']`.

> **Gotcha:** `branches` and `tags` in the same `push:` block is an OR, not an
> AND. And if you specify `tags:` only, pushes to branches stop triggering it
> entirely.

### `pull_request`

```yaml
on:
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]
```

**The `branches:` filter means the TARGET branch** — where the PR wants to
merge *into*, not where it came from. Nearly everyone gets this backwards
once. `branches: [main]` means "PRs aimed at main," regardless of source.

The default `types` are `opened`, `synchronize`, `reopened`. `synchronize`
means "new commits pushed to an existing PR" — without it, your CI runs once
when the PR opens and then never again as the author fixes things. Leave the
defaults alone unless you know why you're changing them.

**The big one, and it's a security feature, not a bug:** when a PR comes from
a **fork**, the workflow runs with a read-only token and **no access to your
secrets**. Without that rule, anyone could open a PR containing a workflow
that prints your production keys. Lesson 10 covers the safe way around it.

### `schedule`

```yaml
on:
  schedule:
    - cron: '30 6 * * 1-5'
```

Five fields: `minute hour day-of-month month day-of-week`.

Three things that will catch you:

1. **Always UTC.** There is no timezone option. Your 9am is not 9am in
   February if you observe daylight saving.
2. **Default branch only.** A schedule on a feature branch does nothing.
3. **It's a suggestion.** Scheduled runs sit on shared infrastructure and
   routinely start 5-20 minutes late, especially on the hour. Never schedule
   anything time-critical, and avoid `0 * * * *` — everyone picks that, so
   it's the most congested slot on the platform. Use `:37` past instead.

Also: on **public** repos, schedules are disabled after 60 days of repository
inactivity. GitHub emails you first.

### `workflow_dispatch`

The manual button, with typed inputs (`string`, `boolean`, `choice`,
`environment`). Add it to almost everything — being able to re-run a pipeline
on demand, without pushing an empty commit, is worth the three lines.

### `workflow_call`

Makes the workflow callable by other workflows. That's Lesson 09.

---

## Combining triggers

Multiple triggers are an **OR**:

```yaml
on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:
```

"Run on pushes to main, **or** any PR, **or** when I click the button."

Note `pull_request:` with nothing under it — that's valid, and means "all
defaults." You'll see this shorthand constantly.

---

## The double-run confusion

Your CI runs **twice** on a PR branch. Everyone notices this and assumes
something is misconfigured.

It isn't. If you have both `push` and `pull_request` triggers, and you push
to a branch that has an open PR, you generated two events:

- a `push` event on `feature/thing`
- a `pull_request` `synchronize` event on the PR

Two events, two runs. Doubled minutes.

The standard fix is to scope `push` to only the branches you actually want it
on:

```yaml
on:
  push:
    branches: [main]     # only main; PR branches are covered by pull_request
  pull_request:
```

Now branch pushes trigger the PR run only, and `main` gets its own run after
merge. This is what nearly every well-tuned repo does, and it's why the
workflows in this course are written that way.

---

## Reading the event payload

Every run has a `github.event` object: the raw JSON GitHub sent. What's
inside depends entirely on the event type.

```yaml
- if: github.event_name == 'pull_request'
  run: |
    echo "PR #${{ github.event.number }}"
    echo "Title: ${{ github.event.pull_request.title }}"
    echo "From: ${{ github.head_ref }} into ${{ github.base_ref }}"
```

Don't memorise the shapes. Instead, dump the whole thing once and read it:

```yaml
- run: echo "$EVENT"
  env:
    EVENT: ${{ toJSON(github.event) }}
```

Ten seconds, and now you know exactly what fields exist for that event. This
is the single most useful debugging trick in this lesson.

> **Note the `env:` indirection.** Never put `${{ github.event.*.title }}`
> directly in a `run:` line. That's a script-injection hole, and Lesson 05
> explains exactly how it's exploited.

---

## Run it

Push the workflow, then trigger it three different ways and compare:

1. **Manually** — Actions → *02 - Triggers Playground* → Run workflow. Try
   both `staging` and `production`, and toggle the dry-run checkbox.
2. **By pushing** — edit any file under `src/` and push to `main`.
3. **By NOT pushing** — edit only `README.md` and push. The workflow does
   **not** run, because `README.md` isn't in the `paths` filter. Confirming a
   workflow correctly *didn't* run is a genuinely useful skill.

---

## Exercises

1. **Prove the paths filter works.** Do experiment 3 above. Then add
   `'*.md'` to the `paths` list, push a README change, and watch it run.

2. **Add a tag trigger:**
   ```yaml
   push:
     tags: ['v*']
   ```
   Then:
   ```bash
   git tag v0.1.0 && git push origin v0.1.0
   ```
   Look at `github.ref` in the output — it's `refs/tags/v0.1.0`, not a branch
   ref. Release workflows are built on this.

3. **Cause the double-run on purpose.** Remove `branches: [main]` from the
   `push` trigger, open a PR, and push to it. Two runs. Put it back.

4. **Dump the event payload** for a `pull_request` event using the `toJSON`
   trick, and find where the PR author's username lives.

---

## Quiz

1. In `pull_request: branches: [main]`, which branch is `main` — source or
   target?
2. Why might your scheduled 9am job run at 9:14?
3. You want CI on PRs but not on every branch push. What's the `on:` block?
4. A fork PR runs your workflow. Are your secrets available?
5. Can you use `paths` and `paths-ignore` in the same trigger?

<details>
<summary>Answers</summary>

1. **Target** — the branch it merges into.
2. Scheduled runs are queued on shared infrastructure and are frequently
   late. Also, they're UTC-only, so check for a timezone error too.
3. ```yaml
   on:
     push:
       branches: [main]
     pull_request:
   ```
4. **No.** Fork PRs get a read-only token and no secrets, deliberately.
5. **No.** One or the other.

</details>

---

**Next:** [Lesson 03 — Your first real CI](03-real-ci.md)
