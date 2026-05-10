# Repo conventions for Claude

## Branch workflow

- **`main` is both the deployable AND the test environment.** GitHub Pages serves projects from `main`, so there is no separate staging — merging to `main` *is* the deploy.
- **For a brand-new project / initial scaffold**: develop directly on `main`. A feature branch on an empty repo just adds friction.
- **Once a project exists, work feature-by-feature:**
  - **Fresh branch per logical change**, named for the feature (e.g. `claude/arabic-add-give-bring-engines`, not the harness-assigned generic name reused across unrelated rounds). One branch = one PR = one logical change.
  - **PR-merge via API is the default landing path.** Use `mcp__github__create_pull_request` then `mcp__github__merge_pull_request` (method: `merge`). Direct pushes to `main` may be blocked at the proxy; don't burn cycles retrying.
  - **No explicit permission needed for each merge.** If a merged change turns out wrong, we revert. Don't gate on "is this approved enough yet" — the cost of a wasted merge is much lower than the cost of waiting.
  - **For changes with high blast radius** (schema migrations, dependency bumps, build-tooling shifts), still flag the risk in the PR description so the user can sanity-check after merge — but you don't need an explicit go-ahead.
- **Validate locally before opening the PR:**
  - JSON content files: parse them (`node -e "JSON.parse(require('fs').readFileSync('path','utf8'))"`) and cross-check ID references between files.
  - HTML/JS: serve with `python3 -m http.server` from the project folder, load the page, check the console.
- **Never force-push `main`.** PR merges produce merge commits, not fast-forwards — that's expected.
- **Harness-assigned `claude/...` branches may be stale** (forked from an earlier snapshot of `main`). Prefer creating your own per-feature branch off current `main`. If you do use the assigned one, run `git log main..HEAD --oneline` and `git diff main..HEAD --stat` first; reset to current `main` (`git reset --hard main`) if it's diverged downward.

## Project layout

Each project lives in its own subfolder of `/home/user/1-projects/`. Don't cross-contaminate. If asked to work on project X, leave project Y alone unless explicitly told otherwise.

## Hosting

Projects intended for the web are deployed via GitHub Pages from `main`, served at:

  `https://adsac.github.io/1-projects/<project-folder>/`

That means each project's paths must be relative (no leading `/`) so they resolve under the subfolder.
