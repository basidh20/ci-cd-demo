# Lesson 07 — Caching and artifacts

**Workflow file:** [`.github/workflows/07-cache-and-artifacts.yml`](../.github/workflows/07-cache-and-artifacts.yml)

---

## Two different things that get confused constantly

| | **Cache** | **Artifact** |
| --- | --- | --- |
| Purpose | Speed | Delivery |
| Holds | Reusable *inputs* (`~/.npm`, `node_modules`) | *Outputs* (`dist/`, reports, binaries) |
| If it disappears | Build is slower, still correct | You've lost something real |
| Scope | Across runs | Within a run, and downloadable after |
| Lifetime | 7 days unused, 10 GB repo cap | 90 days (configurable) |
| Downloadable in the UI | No | **Yes** |

**The one-line test:** *could you delete it and still get the same result,
just slower?* Then it's a cache. Otherwise it's an artifact.

Getting this wrong is a real bug. Caching `dist/` means a stale build output
can be restored over a fresh one, and you ship yesterday's code. Caches must
only ever hold things that are *derivable*.

---

## Caching

### The easy way

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '22'
    cache: npm
```

That single line is `actions/cache` preconfigured: it caches npm's download
directory, keyed on the hash of your lockfile. For most Node projects this is
all the caching you need. The same option exists on `setup-python`,
`setup-java`, and friends.

### The manual way, and what the key means

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-npm-
```

**The key is the whole game.** It's the cache's identity:

- `runner.os` — Linux and Windows caches are not interchangeable.
- `hashFiles('**/package-lock.json')` — a hash of the file *contents*. Change
  a dependency, change the lockfile, change the hash, get a fresh cache.
  Exactly the behaviour you want.

**`restore-keys` are prefixes tried in order when the exact key misses.** So a
lockfile change gets you a *partial* hit: most packages are already there,
npm downloads only what's new. Without `restore-keys`, any dependency change
means a completely cold cache.

### The rule that surprises everyone

**Caches are immutable.** Once written, a key is never overwritten. Save to
`npm-cache`, and that content is frozen — new dependencies will never be
added to it. Your cache is permanently stale and you'll spend a while
wondering why.

This is why the key must contain a hash of whatever determines the content.
`key: npm-cache` is always wrong. `key: npm-${{ hashFiles(...) }}` is right.

### Other things worth knowing

- **Branch scoping.** A cache written on a branch is visible to that branch
  and its children. Caches written on the **default branch** are readable by
  every branch. So the first run on a new feature branch usually gets a hit
  from `main`.
- **Eviction:** untouched for 7 days, or when the repo exceeds 10 GB
  (oldest first).
- **Don't cache `node_modules` directly.** Cache `~/.npm` and run `npm ci`.
  `node_modules` can contain platform-specific compiled binaries, and
  restoring a Linux build onto a macOS runner produces confusing failures.

### Does caching even help you?

Be honest about the numbers. Caching saves the *download*, not the install.
For a project with 40 dependencies, that might be 20 seconds. For one with
1,500, it's minutes.

There's also a floor: restoring the cache itself costs a few seconds. On a
zero-dependency project like this one, caching is very slightly *slower*.
Measure before you optimise — that's true here as everywhere.

---

## Artifacts

### Uploading

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: site
    path: dist/
    retention-days: 7
    if-no-files-found: error
```

`if-no-files-found: error` is the option to always set. The default is
`warn`, which means a build that silently produced nothing gives you a green
run and an empty artifact — and you find out at deploy time. Fail loudly
instead.

**v4 changed one thing that breaks old tutorials:** artifact names must be
**unique within a run**. In v3 you could upload to the same name repeatedly
and it would merge. In v4 that's an error. In a matrix, include the matrix
values in the name:

```yaml
name: site-${{ matrix.os }}-${{ matrix.node }}
```

### Downloading

```yaml
- uses: actions/download-artifact@v4
  with:
    name: site
    path: downloaded/
```

Omit `name:` and you get *every* artifact from the run, each in its own
subdirectory. Useful for a job that collects matrix results.

Artifacts also appear on the run's Summary page in the browser, as a zip.
That's how you hand a build to a colleague, or download a test report, or
grab the screenshots from a failed browser test.

---

## The pattern that makes artifacts click

Look at the `verify` job in this lesson's workflow. It deliberately has **no
`checkout` step**.

It never sees your source code. It downloads `dist/` and inspects it — which
is exactly what a deploy job does, and exactly what a security scanner does.
Artifacts are the seam between "the machine that built it" and "the machine
that ships it."

This is also the **build-once principle**: build a single time, then promote
that same artifact through staging and production. If you rebuild for each
environment, you're shipping something you never tested. Lesson 12's capstone
is structured this way.

---

## Artifacts are not private

Worth stating plainly: **on a public repository, anyone can download your
artifacts.** They're on the run summary page for anyone who visits.

So never upload:
- `.env` files
- anything under `node_modules/.cache` you haven't inspected
- build logs that echoed a secret
- `.git/` (it contains credentials in some configurations)

Be specific with `path:`. `path: .` is a mistake waiting to happen.

---

## Run it

Push and open *07 - Cache and Artifacts*.

1. **First run:** watch the cache step report `cache-hit: false`. Nothing was
   there yet.
2. **Second run** (push again, or re-run): `cache-hit: true`.
3. On the run's **Summary** page, scroll to **Artifacts**. Download `site`,
   unzip it, open `index.html` in a browser. That page was generated by a
   machine that no longer exists.
4. Open `build-info.json` and look at the values — `commit`, `runNumber`,
   `isCI: yes`. Compare with running `npm run build` locally, where you get
   `isCI: no` and `local-working-copy`. Same code, different environment.

---

## Exercises

1. **Force a cache miss.** Add a dependency (`npm install --save-dev
   left-pad`), push, and watch the key change. Then look at the
   `restore-keys` behaviour in the log — it should report a partial restore.

2. **Make `if-no-files-found` earn its keep.** Change the upload path to
   `dist-typo/` and push. With `error` you get a clear red failure. Change it
   to `warn` and confirm you'd have shipped nothing, silently.

3. **Measure it.** Time `npm ci` on a cold cache versus a warm one. On this
   project the difference is negligible — which is itself the lesson. Then
   look at a real project you work on and estimate the saving there.

4. **Break the build-once principle deliberately.** Make the `verify` job
   check out the source and rebuild instead of downloading. It'll work — and
   that's the point: nothing stops you shipping an artifact you never tested.

---

## Quiz

1. Cache or artifact: `node_modules`? `dist/`? A JUnit test report?
2. What's wrong with `key: npm-cache`?
3. Why `if-no-files-found: error`?
4. Two matrix jobs both upload as `name: results`. What happens on v4?
5. Why does the `verify` job skip checkout?

<details>
<summary>Answers</summary>

1. `node_modules` → **cache** (derivable). `dist/` → **artifact** (the
   deliverable). Test report → **artifact** (you want to read it).
2. It's static, and caches are immutable — the first version is frozen
   forever and never picks up new dependencies.
3. The default (`warn`) lets a build that produced nothing pass as green,
   with an empty artifact you discover at deploy time.
4. **Error.** v4 requires unique artifact names within a run.
5. To prove the point: it only needs the build *output*, exactly like a real
   deploy job. Artifacts are the seam between building and shipping.

</details>

---

**Next:** [Lesson 08 — Pipelines and conditions](08-pipelines-and-conditions.md)
