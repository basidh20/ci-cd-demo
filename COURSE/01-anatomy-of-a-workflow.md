# Lesson 01 — The anatomy of a workflow

**Workflow file:** [`.github/workflows/01-hello-world.yml`](../.github/workflows/01-hello-world.yml)

---

## The three required keys

Every workflow file, from the toy in front of you to the 800-line monster
deploying a bank, has exactly the same skeleton:

```yaml
name: What humans see
on:   What makes it start
jobs: What it does
```

That's the whole grammar. When you're lost in a big workflow later, find
those three keys and everything else hangs off them.

---

## Where the file must live

```
.github/workflows/anything.yml
```

This path is not a convention — it's a hard requirement. GitHub scans exactly
that directory.

- `.github/workflow/ci.yml` (missing the **s**) → silently ignored
- `.github/ci.yml` → silently ignored
- `workflows/ci.yml` → silently ignored

**Silently** is the operative word. There's no error and no warning, because
from GitHub's perspective there is no workflow. If you're ever staring at an
empty Actions tab, check the path first. It's the answer surprisingly often.

---

## Reading the file

Open the workflow now. Here's what to notice.

### `workflow_dispatch` — the safe trigger

```yaml
on:
  workflow_dispatch:
    inputs:
      student_name:
        type: string
        default: student
```

This means "a human presses a button." Nothing happens automatically, which
makes it perfect for experimenting. `inputs` become form fields in the UI and
are read back as `${{ inputs.student_name }}`.

> **Gotcha:** the *Run workflow* button only appears once the workflow file
> exists on your **default branch**. If you add `workflow_dispatch` on a
> feature branch and can't find the button, that's why. Merge to `main`.

### `runs-on` — asking for a machine

```yaml
jobs:
  greet:
    runs-on: ubuntu-latest
```

`greet` is the **job ID** — lowercase, no spaces, and what other jobs use to
refer to this one. `name:` is the pretty label; the ID is the handle.

`runs-on` is mandatory. Every job needs a machine, and GitHub boots a fresh
virtual machine, runs your steps, then destroys it. The common choices:

| Runner | Cost multiplier | Notes |
| --- | --- | --- |
| `ubuntu-latest` | 1x | Your default. Fastest to start, cheapest. |
| `windows-latest` | 2x | Defaults to PowerShell, not bash. |
| `macos-latest` | 10x | ARM by default now. Needed for iOS builds. |

Prefer `ubuntu-latest` unless you have a specific reason not to.

### Steps: `run` versus `uses`

Only two kinds of step exist.

```yaml
- name: Print a greeting          # run: a shell command
  run: echo "Hello"

- uses: actions/checkout@v4       # uses: someone else's packaged action
```

`run` is you typing into a terminal. `uses` is calling a function someone
else wrote. That's the entire step vocabulary.

`name:` is optional but do it anyway — without it the Actions UI labels your
step with the raw command, and a six-line bash block makes an ugly heading.

### Multi-line commands

```yaml
- run: |
    echo "line one"
    echo "line two"
```

The `|` is YAML for "keep the newlines." Everything indented under it becomes
one shell script.

**This matters more than it looks:** that script runs under `bash -e`, where
`-e` means *exit on the first error*. So in this block:

```yaml
- run: |
    npm run build
    npm run deploy
```

...if `build` fails, `deploy` never runs and the step fails. That's the
behaviour you want, and it's on by default. Good.

---

## The lesson hiding in the middle of the file

Steps 5 through 8 exist to demonstrate one thing, and it's the beginner
mistake I see most often:

```yaml
- name: Shell variables do NOT survive between steps
  run: |
    MY_VAR="I will be forgotten"
    echo "$MY_VAR"          # works

- name: Proof
  run: echo "$MY_VAR"       # EMPTY
```

**Files persist between steps. Shell variables do not.**

Both steps run on the same machine, so `/tmp/note.txt` written by one is
readable by the next. But each `run:` block is a *separate shell process*,
and a variable dies with its process. Same machine, different shell.

The fix is `$GITHUB_OUTPUT` and `$GITHUB_ENV`, which Lesson 05 covers
properly. For now just carve the rule into your memory: **files yes,
variables no.**

---

## Job summaries: the underused feature

```yaml
- run: echo "## Hello" >> "$GITHUB_STEP_SUMMARY"
```

`$GITHUB_STEP_SUMMARY` is a file path. Anything you append renders as
Markdown on the run's summary page — tables, links, code blocks, all of it.

Most people never discover this and make their teammates dig through 400
lines of log output instead. Every workflow in this course writes a summary.
Steal the habit.

---

## Run it

1. Push this repo to GitHub (see Lesson 00, section 7).
2. Repository → **Actions** tab.
3. Click **01 - Hello World** in the left sidebar.
4. Click **Run workflow** (top right), type your name, confirm.
5. Wait ~10 seconds, refresh, click into the run.

Then click into the job and expand each step. That expandable log view is
where you'll spend most of your debugging life — get comfortable in it now,
while nothing is broken.

Check the **Summary** page too, and find the table your workflow wrote.

---

## Exercises

1. **Add a step** that prints the contents of the runner's home directory
   (`ls -la ~`). What's already installed on a "blank" machine? You'll be
   surprised — GitHub's runners are loaded with tooling.

2. **Break it deliberately.** Add this and re-run:
   ```yaml
   - name: This will fail
     run: exit 1
   ```
   Note the red X, and note that any step *after* it is skipped. Then move it
   to the top and confirm nothing after it runs at all.

3. **Add a second job** called `farewell` that echoes goodbye. Re-run and
   watch the graph: two boxes, side by side, starting simultaneously. That
   picture is the parallel-jobs concept.

4. **Try the file-vs-variable rule yourself.** In your `farewell` job, try to
   `cat /tmp/note.txt` — the file the `greet` job created. It fails. Different
   machine. Confirming this yourself is worth more than reading it.

---

## Quiz

1. What are the three required top-level keys?
2. Why doesn't `.github/workflow/ci.yml` run?
3. Where does the *Run workflow* button come from, and why might it be missing?
4. Two steps in one job: can step 2 read a file step 1 created? A variable?
5. What does the `|` do in `run: |`?

<details>
<summary>Answers</summary>

1. `name:`, `on:`, `jobs:`
2. Missing the `s` — the directory must be exactly `.github/workflows/`.
   GitHub ignores anything else, with no error.
3. From the `workflow_dispatch` trigger. It only appears once the file is on
   the default branch.
4. File: **yes** (same machine). Variable: **no** (separate shell processes).
5. Preserves newlines, making the following indented block a single
   multi-line shell script.

</details>

---

**Next:** [Lesson 02 — Events and triggers](02-events-and-triggers.md)
