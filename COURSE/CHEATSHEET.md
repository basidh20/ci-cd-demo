# GitHub Actions cheatsheet

Everything from the course on one page. Bookmark this one.

> **On versions:** action majors move (`@v4` → `@v5`). The versions here were
> current when this course was written. Check the Marketplace page for an
> action's current major before copying into production.

---

## Skeleton

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '22'

jobs:
  build:
    name: Build
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npm test
```

---

## Triggers

```yaml
on:
  push:
    branches: [main, 'release/**']
    tags: ['v*']
    paths: ['src/**']
    paths-ignore: ['**.md']        # paths OR paths-ignore, never both
  pull_request:
    branches: [main]               # the TARGET branch
    types: [opened, synchronize, reopened]
  schedule:
    - cron: '30 6 * * 1-5'         # UTC only; default branch only
  workflow_dispatch:
    inputs:
      env:
        type: choice               # string | boolean | choice | environment
        options: [staging, production]
  workflow_call:                   # makes it a reusable workflow
  workflow_run:
    workflows: ["CI"]
    types: [completed]
  release:
    types: [published]
  issue_comment:
    types: [created]
```

---

## Runners

| Runner | Cost | Notes |
| --- | --- | --- |
| `ubuntu-latest` | 1x | default choice |
| `windows-latest` | 2x | PowerShell by default — add `shell: bash` |
| `macos-latest` | 10x | ARM; required for iOS |

---

## Contexts

```yaml
github.repository        # "owner/repo"
github.repository_owner  # "owner"
github.ref               # "refs/heads/main"
github.ref_name          # "main"
github.ref_type          # "branch" | "tag"
github.sha               # full 40-char commit
github.actor             # who triggered it
github.event_name        # "push", "pull_request", ...
github.event             # the full payload object
github.run_id            # unique per run
github.run_number        # increments per workflow
github.run_attempt       # increments on re-run
github.workspace         # checkout directory
github.head_ref          # PR source branch (UNTRUSTED)
github.base_ref          # PR target branch

runner.os                # "Linux" | "Windows" | "macOS"
runner.arch              # "X64" | "ARM64"
runner.temp              # temp directory

job.status               # "success" | "failure" | "cancelled"
steps.<id>.outputs.<n>   # earlier step in this job
steps.<id>.outcome       # before continue-on-error
steps.<id>.conclusion    # after continue-on-error
needs.<job>.outputs.<n>  # direct dependency only
needs.<job>.result       # "success" | "failure" | "cancelled" | "skipped"
matrix.<key>
inputs.<name>
secrets.<NAME>
vars.<NAME>
```

---

## Environment variables (auto-set)

```bash
$GITHUB_REPOSITORY   $GITHUB_SHA         $GITHUB_REF        $GITHUB_REF_NAME
$GITHUB_ACTOR        $GITHUB_EVENT_NAME  $GITHUB_RUN_ID     $GITHUB_RUN_NUMBER
$GITHUB_WORKSPACE    $GITHUB_SERVER_URL  $RUNNER_OS         $RUNNER_TEMP
$CI                  # "true"

# Special FILES you append to:
$GITHUB_OUTPUT        # step outputs
$GITHUB_ENV           # env vars for later steps
$GITHUB_PATH          # add a directory to PATH
$GITHUB_STEP_SUMMARY  # markdown for the run summary page
```

---

## Passing data

```yaml
# Between STEPS
- id: gen
  run: echo "key=value" >> "$GITHUB_OUTPUT"     # >> not >
- run: echo "${{ steps.gen.outputs.key }}"

# Multi-line
- run: |
    {
      echo 'body<<EOF_MARKER'
      echo 'line one'
      echo 'EOF_MARKER'
    } >> "$GITHUB_OUTPUT"

# Env var for later steps
- run: echo "TAG=v1.2.3" >> "$GITHUB_ENV"

# Between JOBS
producer:
  outputs:
    version: ${{ steps.gen.outputs.version }}
consumer:
  needs: producer                                # required, not transitive
  steps:
    - run: echo "${{ needs.producer.outputs.version }}"
```

---

## Conditions

```yaml
if: success()                                    # implicit default
if: failure()
if: cancelled()
if: always()
if: "!cancelled()"                               # usually better than always()

if: github.event_name == 'push'
if: github.ref == 'refs/heads/main'
if: startsWith(github.ref, 'refs/tags/')
if: contains(github.event.head_commit.message, '[skip ci]')
if: contains(needs.*.result, 'failure')
if: matrix.os == 'ubuntu-latest'
if: success() && github.ref == 'refs/heads/main'
```

**Any `if:` on a job removes the implicit `success()`. Add it back explicitly.**

---

## Functions

```yaml
contains(search, item)         startsWith(str, prefix)     endsWith(str, suffix)
format('{0} and {1}', a, b)    join(array, ', ')
toJSON(value)                  fromJSON(string)
hashFiles('**/package-lock.json')
success()  failure()  cancelled()  always()
```

---

## Matrix

```yaml
strategy:
  fail-fast: false          # default true — cancels siblings on first failure
  max-parallel: 4
  matrix:
    os: [ubuntu-latest, windows-latest]
    node: ['20', '22']
    exclude:
      - os: windows-latest
        node: '20'
    include:
      - os: ubuntu-latest
        node: '22'
        primary: true       # matches existing -> ADDS A VARIABLE
      - os: ubuntu-22.04    # matches nothing  -> ADDS A JOB
        node: '22'

# Dynamic
strategy:
  matrix:
    target: ${{ fromJSON(needs.discover.outputs.list) }}
```

---

## Cache and artifacts

```yaml
# Cache (inputs — for speed)
- uses: actions/setup-node@v4
  with: { node-version: '22', cache: npm }      # the easy way

- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}
    restore-keys: ${{ runner.os }}-npm-

# Artifacts (outputs — for delivery)
- uses: actions/upload-artifact@v4
  with:
    name: dist-${{ matrix.os }}                 # must be UNIQUE per run (v4)
    path: dist/
    retention-days: 7
    if-no-files-found: error                    # always set this

- uses: actions/download-artifact@v4
  with:
    name: dist-ubuntu-latest
    path: ./downloaded
```

**Caches are immutable** — never key on a static string.

---

## Permissions

```yaml
permissions:                # setting ANY scope sets the rest to none
  contents: read            # read code | write: push, tag, release
  pull-requests: write      # comment, close
  issues: write             # PR LABELS live here
  packages: write
  actions: read
  id-token: write           # OIDC
  pages: write
  checks: write

permissions: {}             # nothing
permissions: read-all
```

---

## Reuse

```yaml
# Composite action: .github/actions/NAME/action.yml
runs:
  using: composite
  steps:
    - shell: bash           # MANDATORY on every run: step
      run: npm ci

# Use it (checkout MUST come first for local actions)
- uses: actions/checkout@v4
- uses: ./.github/actions/NAME
  with: { key: value }

# Reusable workflow — callee
on:
  workflow_call:
    inputs:
      name: { type: string, required: true }    # `type` is required
    secrets:
      TOKEN: { required: false }
    outputs:
      result: { value: "${{ jobs.j.outputs.r }}" }

# Reusable workflow — caller (JOB level; no runs-on, no steps)
jobs:
  call:
    uses: ./.github/workflows/reusable.yml
    with: { name: value }
    secrets: inherit
```

---

## Common actions

```yaml
actions/checkout@v4              actions/setup-node@v4
actions/setup-python@v5          actions/setup-java@v4
actions/setup-go@v5              actions/cache@v4
actions/upload-artifact@v4       actions/download-artifact@v4
actions/github-script@v7         actions/configure-pages@v5
actions/upload-pages-artifact@v3 actions/deploy-pages@v4
docker/build-push-action@v6      docker/login-action@v3
```

---

## Snippets worth memorising

```yaml
# Safe handling of untrusted input
- env:
    TITLE: ${{ github.event.pull_request.title }}
  run: echo "$TITLE"

# Don't let a pipe swallow the exit code
- run: |
    set -o pipefail
    npm test | tee out.log

# gh CLI
- env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: gh pr comment "$N" --body "hi"

# Matrix gate for branch protection
gate:
  needs: matrix-job
  if: always()
  runs-on: ubuntu-latest
  steps:
    - run: '[ "${{ needs.matrix-job.result }}" = "success" ] || exit 1'

# Job summary
- run: echo "## Done" >> "$GITHUB_STEP_SUMMARY"

# Mask a computed value
- run: echo "::add-mask::$COMPUTED"
```

---

## Debugging

| Symptom | First thing to check |
| --- | --- |
| Workflow never runs | Path is exactly `.github/workflows/*.yml`; `on:` matches |
| No *Run workflow* button | `workflow_dispatch` must be on the **default branch** |
| "file not found" | Missing `actions/checkout` |
| Runs twice on a PR | Both `push` and `pull_request` fire — scope push to `main` |
| Empty `needs.X.outputs` | X isn't in this job's `needs:` (not transitive) |
| Deploys despite failures | `if:` removed the implicit `success()` |
| "Required property: shell" | Composite `run:` steps need `shell:` |
| "Can't find action.yml" | Local action used before `checkout` |
| 403 from the API | `permissions:` block, or repo default is read-only |
| Secrets empty on a PR | It's from a fork — by design |
| Green despite failed tests | Piped command; needs `set -o pipefail` |
| Cache never updates | Key is static; caches are immutable |

**Verbose logs:** re-run with *Enable debug logging*, or set repo secrets
`ACTIONS_STEP_DEBUG=true` and `ACTIONS_RUNNER_DEBUG=true`.
