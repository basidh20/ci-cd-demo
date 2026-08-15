# Lesson 09 — Reuse: composite actions and reusable workflows

**Files:**
- [`.github/actions/setup-project/action.yml`](../.github/actions/setup-project/action.yml) — a composite action
- [`.github/workflows/09-reusable-build.yml`](../.github/workflows/09-reusable-build.yml) — a reusable workflow (callee)
- [`.github/workflows/09-reusable-caller.yml`](../.github/workflows/09-reusable-caller.yml) — the caller

---

## The problem

Count the repetitions in this repo:

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: '22'
    cache: npm
- run: npm ci
```

That block appears in nearly every job. When you upgrade to Node 24 you must
edit eight files, and you will miss one, and it will be the deploy job.

Actions gives you two tools for this, and picking the right one is the whole
lesson.

---

## The distinction

| | **Composite action** | **Reusable workflow** |
| --- | --- | --- |
| Bundles | **Steps** | **Jobs** |
| Runs | inside a job you already have | brings its own runners |
| Can set `runs-on` | No | Yes |
| Can contain a matrix | No | Yes |
| Can have multiple jobs | No | Yes |
| Invoked from | `steps:` | `jobs:` (as `uses:` at job level) |
| Lives in | `.github/actions/NAME/action.yml` | `.github/workflows/NAME.yml` |

**Rule of thumb:**
- Repeated **steps** → composite action.
- Repeated **pipelines** → reusable workflow.

---

## Composite actions

A composite action is a folder containing `action.yml`:

```
.github/actions/setup-project/action.yml
```

The **directory name** is what you reference. The **file must** be called
`action.yml` or `action.yaml`.

```yaml
name: Setup Project
description: Install Node and dependencies

inputs:
  node-version:
    default: '22'

outputs:
  node-version:
    value: ${{ steps.detect.outputs.version }}

runs:
  using: composite
  steps:
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
    - shell: bash               # <- MANDATORY
      run: npm ci
```

Used as:

```yaml
- uses: actions/checkout@v4
- uses: ./.github/actions/setup-project
  with:
    node-version: '22'
```

### The two errors you will hit

**1. `Required property is missing: shell`**

Every `run:` step in a composite action must declare `shell:`. There is no
default. This is *the* most common composite-action error. Add
`shell: bash`.

**2. `Can't find 'action.yml' under '.../setup-project'`**

A local action is referenced by **path**, so GitHub must read the file off
the runner's disk — which means **checkout has to run first**.

The tempting move is to put `actions/checkout` *inside* your composite action
so callers don't have to think about it. It cannot work: GitHub can't find
your action file until the checkout it contains has already run. Chicken,
meet egg.

I made this exact mistake while writing this course. The validator caught
four call sites. That's why the action's header comment now says so in bold,
and why every caller does its own checkout first — the same convention every
setup action on the Marketplace follows.

### The three kinds of action

- **composite** — YAML, bundles steps. No build step. **Start here.**
- **javascript** — a Node program with `main.js`. Fast, cross-platform, but
  you must commit bundled `node_modules` or use `ncc`.
- **docker** — any language, fully isolated. Linux runners only, and slow to
  start (image pull per run).

For nearly everything you'll write, composite is the right answer.

---

## Reusable workflows

The callee declares `workflow_call` as its **only** trigger:

```yaml
on:
  workflow_call:
    inputs:
      node-version:
        type: string          # `type:` is REQUIRED here (unlike dispatch)
        default: '22'
    secrets:
      DEPLOY_TOKEN:
        required: false
    outputs:
      artifact-name:
        value: ${{ jobs.build.outputs.artifact-name }}
```

The caller invokes it with `uses:` **at job level**:

```yaml
jobs:
  build:
    uses: ./.github/workflows/09-reusable-build.yml
    with:
      node-version: '22'
    secrets:
      DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
```

### The shape that confuses people

A job that calls a workflow has **no `runs-on:` and no `steps:`**. It's not a
job that *does* things — it's a job that *is* another workflow. Adding
`runs-on:` there is an error, and it's the first thing people try.

### Secrets

Either name them explicitly (as above) or write `secrets: inherit` to pass
everything. `inherit` is convenient and has a much larger blast radius —
prefer naming them, especially when the callee lives in another repository.

### Outputs

Note the relay in the callee: a *step* writes to `$GITHUB_OUTPUT`, a *job*
declares `outputs:`, and then `workflow_call.outputs` references
`jobs.<job>.outputs.<name>`. Three levels. The caller then reads it via
`needs.<calling-job>.outputs.<name>`.

### Calling across repositories

```yaml
uses: my-org/ci-templates/.github/workflows/node-ci.yml@v1
```

This is where reusable workflows earn their keep in a real organisation: one
central pipeline definition, every team writes a five-line caller, and you
can fix a security issue for everyone in one commit.

### Limits

- Nesting depth: **4** levels.
- Max **20** reusable workflows per run.
- The callee must be on a public repo, or the same repo/org with access
  granted.

---

## Which one? A decision procedure

Ask: **does this need its own machine?**

- "Install my toolchain" → no → **composite action**
- "Run the whole test matrix and upload artifacts" → yes → **reusable
  workflow**

Ask: **does it contain more than one job?**

- Yes → it must be a reusable workflow. Composite actions cannot contain
  jobs.

---

## Run it

Push and open *09b - Reusable Caller*. Notice:

- The graph shows `quick-build / build` and `legacy-node-build / build` —
  called workflows are nested and prefixed with the calling job's name.
- Both come from **one** definition file with different inputs.
- The `report` job reads outputs back out through `needs`.

Then open the caller file and count its lines. Almost all the logic lives
somewhere else, and that's the point.

---

## Exercises

1. **Cause the `shell` error deliberately.** Remove `shell: bash` from a step
   in `action.yml` and push. Read the error message so you recognise it
   instantly next time.

2. **Cause the checkout error deliberately.** In `12-capstone.yml`, remove
   the `actions/checkout@v4` line before the local action. Read that error
   too. Then run `npm run check:workflows` — this project's checker now
   catches it before you push.

3. **Convert a job to use the composite action.** Take `03-test.yml` and
   replace its setup steps. Confirm it still passes, then count the lines you
   deleted.

4. **Add an input** to the composite action — `install-command`, defaulting
   to `npm ci` — and use it from one caller with `npm install` instead.

5. **Add a third call** to `09-reusable-caller.yml` with Node 24 and
   `run-tests: false`. Three pipelines, one definition.

---

## Quiz

1. Composite action or reusable workflow: a matrix across three OSes?
2. What's missing from a composite `run:` step that has no `shell:`?
3. Why can't a composite action check out the repository for you?
4. Where does `uses:` go when calling a reusable workflow — in `steps:` or
   at job level?
5. What does `secrets: inherit` do, and why be careful?

<details>
<summary>Answers</summary>

1. **Reusable workflow** — composite actions can't set `runs-on` or contain
   a matrix.
2. `shell:` is mandatory; there's no default. Error: *Required property is
   missing: shell*.
3. It's referenced by path, so its `action.yml` must already be on disk —
   which requires checkout to have run first.
4. **At job level.** Such a job has no `runs-on:` and no `steps:`.
5. Passes every secret to the called workflow. Convenient, but a much larger
   blast radius than naming them individually.

</details>

---

**Next:** [Lesson 10 — Permissions and automation](10-permissions-and-automation.md)
