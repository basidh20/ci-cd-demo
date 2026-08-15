# Lesson 10 — Permissions, `GITHUB_TOKEN`, and automation

**Workflow file:** [`.github/workflows/10-pr-automation.yml`](../.github/workflows/10-pr-automation.yml)

---

## `GITHUB_TOKEN`

Every run gets a credential you never created:

```yaml
env:
  GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

It's minted when the run starts, scoped to your repository, and revoked the
moment the run ends. It's what lets a workflow comment on a PR, add a label,
create a release, or push a commit.

You don't configure it. You *do* need to configure what it's allowed to do.

---

## The permission model

```yaml
permissions:
  contents: read
  pull-requests: write
```

**Setting any `permissions:` block sets every unlisted scope to `none`.** It
is restrictive, not additive. That's the behaviour you want — it means the
block is a complete statement of what this workflow may do, and you can audit
it by reading it.

The scopes you'll actually use:

| Scope | Grants |
| --- | --- |
| `contents` | read code; `write` to push commits, create tags/releases |
| `pull-requests` | read PRs; `write` to comment, label, close |
| `issues` | same, for issues (**and PR labels — see below**) |
| `packages` | GitHub Packages / container registry |
| `actions` | manage workflow runs, download artifacts across runs |
| `id-token` | OIDC — cloud auth without long-lived secrets |
| `pages` | deploy to GitHub Pages |
| `checks` | create check runs and annotations |

Two shortcuts: `permissions: read-all`, `permissions: write-all`, and
`permissions: {}` for nothing at all.

**Set permissions per job, not per workflow, when they differ.** In the
lesson's workflow, `analyse` stays read-only and only `comment` gets write
access. Least privilege, per job.

> A PR is an issue underneath. Labelling a PR needs `issues: write`, not
> `pull-requests: write`. This is confusing and you will look it up again.

### The repository default

Settings → Actions → General → Workflow permissions. Older repos default to
**read and write**; newer ones default to **read-only**. If a workflow that
should work is getting 403s, check this first — and set it to read-only, then
grant per workflow.

---

## Automating with `gh`

The GitHub CLI is preinstalled on every GitHub-hosted runner. It's the
simplest way to interact with the API:

```yaml
- env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: gh pr comment 42 --body "Hello from CI"
```

**`gh` does not pick up the token automatically.** You must put it in
`GH_TOKEN`. Forgetting this gives you an authentication error that looks like
a permissions problem but isn't.

Useful commands:

```bash
gh pr comment "$N" --body "..."
gh pr edit "$N" --add-label "ci"
gh pr review "$N" --approve
gh issue create --title "..." --body "..."
gh release create v1.0.0 dist/*.zip --notes "..."
gh api repos/{owner}/{repo}/statuses/$GITHUB_SHA -f state=success
```

`gh api` is the escape hatch for anything without a dedicated command.

---

## The fork problem, properly

This is the security topic that matters most in practice.

### `pull_request` (the safe one)

When a PR comes from a fork:
- `GITHUB_TOKEN` is **read-only**, regardless of your `permissions:` block
- **No secrets** are available
- No cache writes

This is correct and deliberate. Without it, anyone could open a PR containing
a workflow that exfiltrates your production keys.

The consequence you'll hit: **a fork PR cannot post a comment on itself.**
People discover this, find `pull_request_target` in a search result, and walk
directly into a serious vulnerability.

### `pull_request_target` (the dangerous one)

It gets full secrets and write access. The critical difference:

> **`pull_request_target` runs the workflow file from the BASE branch, but
> `github.event.pull_request.head.sha` points at the contributor's code.**

The workflow definition is yours — good. But the moment you do this:

```yaml
on: pull_request_target
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}   # THEIR code
      - run: npm ci                                        # THEIR postinstall
```

...you have executed a stranger's code with your secrets in the environment.
`npm ci` alone is enough — a `postinstall` script in their `package.json`
runs arbitrary commands. Real projects have leaked real credentials this way.

**If you must use `pull_request_target`:**
- Don't check out the PR head at all (use it only for labelling/greeting), or
- If you must, run **no** code from it — no install, no build, no tests, and
- Never interpolate PR-controlled text into a `run:` block (Lesson 05).

### The safe pattern: `workflow_run`

Two workflows:

1. **`pull_request`** — builds and tests with no secrets, uploads results as
   an artifact.
2. **`workflow_run`** — triggered by the first completing. Runs on the base
   branch with full permissions, downloads the artifact, and posts the
   comment.

The untrusted code and the privileged token are never in the same job. More
setup, and it's the right answer.

---

## Beyond `GITHUB_TOKEN`

`GITHUB_TOKEN` has two real limits:

1. **It's scoped to one repository.** For cross-repo work you need a
   Personal Access Token (preferably fine-grained) or a GitHub App.
2. **Commits it pushes do not trigger other workflows.** This is deliberate
   loop prevention, and it surprises people whose "auto-format and commit"
   workflow doesn't re-trigger CI. Use a PAT or App token if you need that.

**For cloud deployments, use OIDC instead of stored credentials.** With
`id-token: write`, your workflow requests a short-lived token that AWS, Azure
or GCP will trust directly — no long-lived secret in your repo settings at
all. It's more setup once and strictly better than a permanent access key
sitting in your secrets, waiting to leak.

---

## Run it

This workflow needs a pull request. Make one:

```bash
git checkout -b lesson-10-test
```

Change something, commit, push, and open a PR against `main`. Watch the
workflow post a comment on your own PR.

Then edit a file under `.github/workflows/` in the same branch, push again,
and see the `ci` label logic fire. (Create a label called `ci` in the repo
first, or watch the fallback message.)

---

## Exercises

1. **Break it with permissions.** Remove `pull-requests: write` from the
   `comment` job. Push. Read the 403. Recognising that error is the skill.

2. **Start from zero.** Set `permissions: {}` at workflow level and add
   scopes back one at a time until everything works. This is genuinely how
   you should build a permissions block.

3. **Add a size labeller.** Use `needs.analyse.outputs.files_changed` to add
   `size/small`, `size/medium`, or `size/large`. Create the labels first.

4. **Read the token's actual permissions.** Add this step and look at the
   `x-oauth-scopes` and `x-accepted-github-permissions` response headers:
   ```yaml
   - env:
       GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
     run: gh api -i repos/${{ github.repository }} | head -30
   ```

---

## Quiz

1. Does `permissions: { contents: read }` leave other scopes at their
   defaults?
2. Which scope do you need to add a **label to a PR**?
3. Why can't a fork PR comment on itself with `pull_request`?
4. What exactly makes `pull_request_target` dangerous?
5. Why doesn't a commit pushed by `GITHUB_TOKEN` trigger your CI workflow?

<details>
<summary>Answers</summary>

1. **No.** Every unlisted scope becomes `none`.
2. `issues: write` — PRs are issues underneath.
3. Fork PRs get a read-only token and no secrets, deliberately, so a stranger
   can't exfiltrate your credentials.
4. It runs with full secrets and write access; if you also check out the
   PR's head and run any of its code (even `npm ci`), you've executed a
   stranger's code with your credentials in scope.
5. Deliberate loop prevention. Use a PAT or GitHub App token if you need the
   cascade.

</details>

---

**Next:** [Lesson 11 — Deployment](11-deployment.md)
