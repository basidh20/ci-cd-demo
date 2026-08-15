# Lesson 00 — Orientation: what problem is this solving?

> **Do this first.** No workflow files yet. Ten minutes of reading that will
> make the other twelve lessons make sense instead of feeling like magic
> incantations.

---

## 1. The problem, before the solution

Imagine you and two colleagues work on this project. There is no automation.
The routine goes:

1. You write code.
2. You *remember* to run the tests. Usually.
3. You *remember* to check the formatting. Less often.
4. You push.
5. Someone else pulls, and it's broken — you had a file they didn't, or your
   Node version differs, or you never ran the tests on Friday afternoon.
6. To release, someone follows a wiki page of fourteen manual steps. Step 9
   is wrong. It has been wrong for months. Only Priya knows the workaround,
   and Priya is on holiday.

Every one of those failures has the same shape: **a human was trusted to do
something repeatedly, consistently, without forgetting.** Humans are
excellent at many things. That is not one of them.

CI/CD is the response:

- **Continuous Integration (CI)** — every change is automatically built and
  tested, on a clean machine, before anyone merges it. Errors surface in
  minutes rather than at release.
- **Continuous Delivery/Deployment (CD)** — the path from "merged" to
  "running in production" is itself automated code. No wiki page. No Priya
  dependency.

**GitHub Actions is a way to run your commands on GitHub's computers, when
something happens in your repository.** That's it. That's the whole idea.
Everything else in these twelve lessons is detail.

---

## 2. The single most useful mental model

Here is the framing that will save you the most confusion, so I'll be blunt
about it:

> **A GitHub Actions job is a brand-new laptop, delivered to your desk, with
> nothing on it. You get to type a list of commands. Then it's incinerated.**

Unpack that, because every rule follows from it:

| The metaphor | The consequence |
| --- | --- |
| Brand-new machine | Your code isn't on it. That's why every job starts with `checkout`. |
| Nothing installed | You must install your own toolchain (`setup-node`). |
| You type commands | A workflow is just your terminal commands, written down. |
| It's incinerated | Nothing survives unless you explicitly save it (artifacts). |
| Your desk is untouched | It can't break your laptop. Experiment freely. |

When something confuses you later — "why can't job B see job A's files?" —
come back to this table. The answer is almost always "different machine."

---

## 3. The vocabulary, in the order it nests

You'll meet these words constantly. They form a strict hierarchy:

```
WORKFLOW              one .yml file in .github/workflows/
  │                   "run CI when someone pushes"
  │
  ├── triggered by an EVENT      push, pull request, schedule, button
  │
  └── contains JOBS              run in PARALLEL by default
        │                        each on its OWN fresh machine
        │
        └── contains STEPS       run in ORDER, on that one machine
              │
              ├── run:   a shell command you wrote
              └── uses:  a prepackaged ACTION someone else wrote
```

Two distinctions that beginners routinely blur, so learn them now:

**Jobs are parallel. Steps are sequential.**
Two jobs run at the same time on two different machines and cannot see each
other's files. Two steps run one after another on the same machine and share
a filesystem. If you need ordering between jobs, you must ask for it
(`needs:`, Lesson 08).

**"Action" is a specific thing, not a general one.**
The product is *GitHub Actions*. An *action* (singular) is a reusable unit
you invoke with `uses:` — like `actions/checkout`. Most of what you write
will be plain `run:` commands, not actions. People say "I wrote an action"
when they mean "I wrote a workflow" all the time; now you'll know the
difference.

---

## 4. Why YAML, and why it will annoy you

Workflows are written in YAML. Three facts will save you real time:

1. **Indentation is syntax.** Two spaces per level. Get it wrong and the
   meaning changes.
2. **Tabs are forbidden.** Not discouraged — illegal. If your editor inserts
   tabs, fix that now. (`.editorconfig` in this repo already handles it.)
3. **`on:` is cursed.** In the YAML spec version most parsers use, a bare
   `on` is the *boolean true*. GitHub special-cases it so it works, but
   linters will occasionally shout at you. Not your fault.

`npm run check:workflows` in this project catches all three before you push.

---

## 5. What it costs

Worth knowing before you start clicking buttons:

- **Public repositories: free.** Unlimited minutes on standard runners.
- **Private repositories:** a monthly free allowance (2,000 minutes on the
  free plan), then metered.
- **Runners are not priced equally.** Linux is the baseline. Windows costs
  **2x** the minutes. macOS costs **10x**. This is why Lesson 06's matrix
  excludes most macOS combinations — it's not arbitrary.
- Storage for artifacts and caches is also metered on private repos.

**Recommendation: make your practice repository public.** Free, and you'll
be able to use GitHub Pages in Lesson 11 without a paid plan.

---

## 6. How to take this course

Each lesson is a pair: a workflow file in `.github/workflows/` that is
*heavily* commented, and a markdown lecture in `COURSE/` that explains the
why. **Read them side by side.** The YAML file is the specimen; the lecture
is the dissection.

The rhythm that works:

1. Read the lecture up to "The workflow."
2. Open the `.yml` file and read it top to bottom.
3. Push it and watch the run in the Actions tab.
4. Come back and do the **Exercises**.
5. Check yourself against the **Quiz**.

Deliberately break things. A failed workflow costs you nothing and teaches
you more than a successful one. That's not a platitude — the log output of a
failure is where you learn what the runner is actually doing.

---

## 7. Before Lesson 01: get this on GitHub

You need the project in a GitHub repository. From `D:\Github_Actions`:

```bash
git add -A && git commit -m "Start the GitHub Actions course"
```

Then create an empty repo on GitHub (**no** README, **no** .gitignore — you
already have both), and connect it:

```bash
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
```

```bash
git branch -M main && git push -u origin main
```

Now open your repo and click the **Actions** tab. You should see thirteen
workflows listed down the left side. Nothing has run yet — most of them are
waiting for a push to `main`, which you just did, so some may already be
going.

---

## Quiz

Answer before moving on. Answers at the bottom.

1. Two jobs, `build` and `test`, with no `needs:` between them. Does `test`
   see the files `build` created?
2. Where does the code come from on a fresh runner?
3. You set `MY_VAR=hello` in one step. Can the next step read `$MY_VAR`?
4. Which costs more runner minutes: `ubuntu-latest` or `macos-latest`?
5. What's the difference between "GitHub Actions" and "an action"?

<details>
<summary>Answers</summary>

1. **No.** Different machines entirely. `needs:` orders them but still
   doesn't share files — you need artifacts for that (Lesson 07).
2. From `actions/checkout`. Nothing else puts it there.
3. **No.** Each `run:` is a separate shell process. Use `$GITHUB_ENV` or
   `$GITHUB_OUTPUT` (Lesson 05).
4. macOS, by 10x. Windows is 2x.
5. "GitHub Actions" is the product. "An action" is one reusable unit you
   call with `uses:`.

</details>

---

**Next:** [Lesson 01 — Anatomy of a workflow](01-anatomy-of-a-workflow.md)
