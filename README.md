# Learn GitHub Actions — a hands-on course

A complete, self-contained course built around a real (tiny) project.
Twelve lessons, thirteen working workflows, one composite action, and a live
website at the end.

**No prior knowledge assumed.** Start at
[COURSE/00-orientation.md](COURSE/00-orientation.md).

---

## The idea

Every lesson is a **pair**:

- a workflow in `.github/workflows/` that runs for real and is heavily
  commented
- a lecture in `COURSE/` explaining why it looks like that

Read them side by side. The YAML is the specimen; the lecture is the
dissection.

The project itself is a zero-dependency static site generator that renders a
quote of the day. It's deliberately small — the point is the pipeline, not
the app — but it's a real program with real tests, and it builds a real site
that really gets deployed.

---

## Syllabus

| # | Lesson | Workflow | You'll learn |
| --- | --- | --- | --- |
| 00 | [Orientation](COURSE/00-orientation.md) | — | What CI/CD is for; the mental model |
| 01 | [Anatomy of a workflow](COURSE/01-anatomy-of-a-workflow.md) | `01-hello-world.yml` | `name`/`on`/`jobs`, steps, runners |
| 02 | [Events and triggers](COURSE/02-events-and-triggers.md) | `02-triggers.yml` | push, PR, cron, manual inputs |
| 03 | [Your first real CI](COURSE/03-real-ci.md) | `03-test.yml` | checkout, setup, `npm ci`, exit codes |
| 04 | [Jobs and failure](COURSE/04-jobs-and-failure.md) | `04-lint.yml` | Parallelism, `continue-on-error`, timeouts |
| 05 | [Contexts and secrets](COURSE/05-contexts-variables-secrets.md) | `05-contexts-and-secrets.yml` | `${{ }}`, outputs, secrets, **script injection** |
| 06 | [Matrix builds](COURSE/06-matrix-builds.md) | `06-matrix.yml` | Cross-platform testing, `include`/`exclude`, cost |
| 07 | [Cache and artifacts](COURSE/07-cache-and-artifacts.md) | `07-cache-and-artifacts.yml` | Speed vs delivery; cache keys |
| 08 | [Pipelines and conditions](COURSE/08-pipelines-and-conditions.md) | `08-pipeline.yml` | `needs`, job outputs, status functions |
| 09 | [Reuse](COURSE/09-reuse.md) | `09-reusable-*.yml` + `actions/setup-project` | Composite actions, reusable workflows |
| 10 | [Permissions and automation](COURSE/10-permissions-and-automation.md) | `10-pr-automation.yml` | `GITHUB_TOKEN`, least privilege, forks |
| 11 | [Deployment](COURSE/11-deployment.md) | `11-deploy-pages.yml` | Environments, approval gates, Pages |
| 12 | [Capstone](COURSE/12-capstone.md) | `12-capstone.yml` | The whole thing, production-shaped |

**Reference:** [Cheatsheet](COURSE/CHEATSHEET.md) ·
[Troubleshooting](COURSE/TROUBLESHOOTING.md)

---

## Getting started

### 1. Check it works locally

Requires Node 20+. **There are no dependencies to install.**

```bash
npm test
```

```bash
npm run ci
```

That last one runs lint, tests, build, and workflow validation — the same
commands CI runs. That symmetry is the core idea of the whole course.

Other commands:

| Command | Does |
| --- | --- |
| `npm start` | Print today's quote |
| `npm start -- 2026-12-25` | Print a specific day's quote |
| `npm test` | Run the test suite |
| `npm run lint` | Style check |
| `npm run build` | Generate `dist/` |
| `npm run check:workflows` | Validate workflow files before pushing |

### 2. Put it on GitHub

The workflows need a GitHub repository to run in.

```bash
git add -A && git commit -m "Start the GitHub Actions course"
```

Create an **empty** repo on github.com (no README, no .gitignore — you have
both), then:

```bash
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
```

```bash
git branch -M main && git push -u origin main
```

> **Make it public.** Actions minutes and GitHub Pages are both free on
> public repos. On a private repo you'll hit limits during Lesson 06 and
> Pages won't work at all in Lesson 11.

### 3. Enable Pages (needed for Lesson 11)

Settings → Pages → Build and deployment → Source: **GitHub Actions**.

### 4. Open the Actions tab and start reading

Begin with [Lesson 00](COURSE/00-orientation.md).

---

## Project layout

```
├── COURSE/                        the lectures
├── .github/
│   ├── workflows/                 13 workflows, one per lesson
│   └── actions/setup-project/     a composite action (Lesson 09)
├── src/
│   ├── lib/quotes.js              data + selection logic
│   ├── lib/formatter.js           pure formatting helpers
│   ├── build.js                   generates dist/
│   └── cli.js                     npm start
├── tests/                         26 tests, node:test, no framework
└── scripts/
    ├── lint.js                    a tiny style checker
    └── check-workflows.js         pre-flight validation for workflows
```

### Why no dependencies?

So `git clone && npm test` works instantly, offline, on any machine — and so
you can read every line of the tooling that judges your code. `scripts/lint.js`
is ~120 lines of Node that does what ESLint does at the level that matters
for CI: print problems, exit non-zero.

In a real project use ESLint and Prettier. The **contract** with CI is
identical, and that contract is what this course teaches.

---

## A note on action versions

The workflows pin actions like `actions/checkout@v4`. Majors move over time.
Before copying any of this into a real project, check the action's
Marketplace page for its current major — and read
[Lesson 03](COURSE/03-real-ci.md) on why pinning to a full commit SHA is
safer for third-party actions.

---

## If you only read one thing

> **A GitHub Actions job is a brand-new machine, delivered empty, that runs
> your commands and is then destroyed.**

Your code isn't on it (hence `checkout`). Your tools aren't on it (hence
`setup-node`). Nothing you make survives (hence artifacts). Everything else
is detail.
