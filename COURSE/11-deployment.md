# Lesson 11 — Deployment: environments and GitHub Pages

**Workflow file:** [`.github/workflows/11-deploy-pages.yml`](../.github/workflows/11-deploy-pages.yml)

---

## Setup (do this first, it takes 20 seconds)

**Repository → Settings → Pages → Build and deployment → Source:
`GitHub Actions`**

Not "Deploy from a branch." If you skip this, the deploy job fails with an
unhelpful error about the Pages API. It's the single most common reason this
lesson doesn't work.

Your site will be at `https://YOUR-USERNAME.github.io/YOUR-REPO/`.

> Pages is free on public repos. On private repos it needs a paid plan —
> another reason to make your practice repo public.

---

## The shape of a deployment

```yaml
permissions:
  contents: read      # check out the code
  pages: write        # publish
  id-token: write     # OIDC: prove this run is genuinely yours

concurrency:
  group: pages
  cancel-in-progress: false     # note: FALSE
```

Two things to notice.

**`id-token: write`** is OIDC. The Pages service doesn't take a password — the
runner requests a short-lived signed token proving "I am a run from repo X on
branch Y," and Pages verifies it. No stored credential exists to leak. The
same mechanism is how you should authenticate to AWS, GCP and Azure.

**`cancel-in-progress: false`** — the opposite of Lesson 08. For CI, killing a
superseded run saves minutes. For a deploy, killing a run halfway through
leaves your site in an unknown state. **Deploys queue. They don't get
cancelled.** Internalise this distinction; it's a real production lesson
hiding in a one-word config change.

---

## Environments

```yaml
environment:
  name: github-pages
  url: ${{ steps.deployment.outputs.page_url }}
```

An environment is much more than a label. Configure them at
**Settings → Environments**, and you get:

**Required reviewers.** The job *pauses* and waits for a named human to click
Approve. This is a deployment gate you can set up in about thirty seconds,
and it's free on public repos. It's the single highest-value feature in this
lesson.

**Wait timer.** Force a delay before deploying — useful for a "you have five
minutes to cancel" window.

**Deployment branches.** Restrict which branches may deploy to this
environment. Only `main` reaches production, enforced by the platform rather
than by an `if:` someone can edit.

**Environment secrets.** Override repository secrets per environment, so
`DATABASE_URL` differs between staging and production with no branching logic
in your workflow.

The `url:` makes the deployment a clickable link in the Actions UI and on the
repo's Environments page, with a full deployment history.

---

## The Pages-specific actions

```yaml
- uses: actions/configure-pages@v5        # ask Pages for its config
- uses: actions/upload-pages-artifact@v3  # NOT upload-artifact
  with:
    path: dist/
- uses: actions/deploy-pages@v4           # publish
```

`upload-pages-artifact` is **not** interchangeable with `upload-artifact`. It
produces a tarball in the exact shape the Pages service expects. Using the
wrong one gives you a deploy that fails at the last step.

Note also the two-job split: `build` produces the artifact, `deploy` consumes
it. That separation is what lets you put an approval gate *between* building
and shipping.

### The `.nojekyll` file

`src/build.js` writes an empty `.nojekyll` into `dist/`. Without it, Pages
runs your output through Jekyll, which **ignores any file or directory
starting with an underscore**. If you've ever deployed a site where
`_next/` or `_assets/` 404'd, this was why.

---

## Deployment strategies, briefly

Pages is the simplest possible target. The concepts scale:

- **Build once, deploy many.** Build a single artifact and promote *that
  exact one* through staging and production. Rebuilding per environment means
  shipping something you never tested. This is why the capstone builds once
  and the deploy job only downloads.
- **Blue-green.** Two identical environments; deploy to the idle one, switch
  traffic, keep the old one warm for instant rollback.
- **Canary.** Route 5% of traffic to the new version, watch the metrics,
  proceed or roll back.
- **Rollback is a deploy.** The fastest recovery is redeploying the previous
  known-good artifact — which only works if you kept it. Set
  `retention-days` accordingly.

---

## Run it

Push to `main` and watch *11 - Deploy to GitHub Pages*.

The `deploy` job's summary shows the URL. Open it. **You have a live website,
built and published by a machine that no longer exists.**

Refresh tomorrow — the quote will have changed, because `getQuoteForDate`
keys off the day of the year. That's your build reading the clock at build
time, which is a nice illustration of why builds are only reproducible if you
control your inputs.

---

## Exercises

1. **Add an approval gate.** Settings → Environments → New environment →
   `production`. Add yourself as a required reviewer. Point a copy of the
   deploy job at it. Push, and watch the run *pause* and email you. Click
   Approve. This is the most useful thing in this lesson — do it.

2. **Restrict the branch.** In that environment's settings, limit deployments
   to `main`. Try deploying from a branch and watch it be refused by the
   platform, not by your YAML.

3. **Prove `.nojekyll` matters.** Remove that line from `src/build.js`, add a
   file called `_test.txt` to `dist/`, deploy, and try to fetch it. 404.
   Put it back.

4. **Add a smoke test after deploy:**
   ```yaml
   - run: |
       sleep 10
       curl -fsS "${{ steps.deployment.outputs.page_url }}" | grep -q "Quote of the Day"
   ```
   A deploy that isn't verified isn't finished.

---

## Quiz

1. What must you change in repo settings before this works?
2. Why `cancel-in-progress: false` here but `true` in Lesson 08?
3. What does `id-token: write` enable, and why is it better than a stored
   key?
4. Name two things an environment gives you beyond a label.
5. Why does `dist/` contain `.nojekyll`?

<details>
<summary>Answers</summary>

1. Settings → Pages → Source must be **GitHub Actions**, not "Deploy from a
   branch."
2. Cancelling a half-finished deploy leaves production in an unknown state.
   Deploys queue; CI runs get cancelled.
3. OIDC — a short-lived signed token instead of a stored credential. Nothing
   long-lived exists to leak.
4. Any two of: required reviewers, wait timers, branch restrictions,
   environment-specific secrets, deployment history.
5. It stops Pages running the output through Jekyll, which would silently
   drop files beginning with an underscore.

</details>

---

**Next:** [Lesson 12 — Capstone](12-capstone.md)
