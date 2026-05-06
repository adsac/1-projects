# Repo conventions for Claude

## Branch workflow

- **`main` is both the deployable AND the test environment.** GitHub Pages serves projects from `main`, so there is no separate staging — merging to `main` *is* the deploy. The earlier rule "sanity-check before merging" was wrong: you can't, because there's nowhere else to run it.
- **For an entirely new project / initial scaffold**: develop directly on `main`. A feature branch on an empty repo just adds friction.
- **Once a project exists and is in use**: do every change on a short-lived feature branch (the harness-assigned `claude/...` branch is fine), then merge back. The branch is for grouping a change so it can be reviewed, rewritten, or abandoned as a unit — not for pre-merge testing.
- **Validate locally what you can before merging:**
  - JSON content files: parse them (`node -e "JSON.parse(require('fs').readFileSync('path','utf8'))"`) and cross-check ID references between files.
  - HTML/JS: serve with `python3 -m http.server` from the project folder and load the page; check the console.
- **Risk tiers — when to merge vs. ask first:**
  - *Additive content* (new phrases / engines / isolated pages / docs) and *small fixes to existing logic*: merge after local validation. Don't ask for explicit permission each time once the user has approved the change.
  - *Schema changes, dependency changes, refactors that touch many call sites, anything that could break the load path*: ask before merging. These are the cases where "main = test" is genuinely risky.
- **Never force-push `main`.** Prefer a fast-forward merge — keep the feature branch sitting directly on top of current `main` so the merge is trivial.
- **Harness-assigned `claude/...` branches may be stale** (forked from an earlier snapshot of `main`). Before working on one, run `git log main..HEAD --oneline` and `git diff main..HEAD --stat`. If it's diverged downward (its tip is behind `main`), reset it to current `main` (`git reset --hard main`) before adding your changes — that way the eventual push to the branch is a fast-forward, not a force-push, and the merge to `main` is also a clean fast-forward.

## Project layout

Each project lives in its own subfolder of `/home/user/1-projects/`. Don't cross-contaminate. If asked to work on project X, leave project Y alone unless explicitly told otherwise.

## Hosting

Projects intended for the web are deployed via GitHub Pages from `main`, served at:

  `https://adsac.github.io/1-projects/<project-folder>/`

That means each project's paths must be relative (no leading `/`) so they resolve under the subfolder.
