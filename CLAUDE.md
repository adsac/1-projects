# Repo conventions for Claude

## Branch workflow

- **`main` is the deployable.** GitHub Pages serves projects in this repo from `main`.
- **For an entirely new project / initial scaffold**: develop directly on `main`. Merging an empty repo through a feature branch adds friction without protecting anything.
- **Once a project exists and is in use**: do every change on a short-lived feature branch (the harness-assigned `claude/...` branch is fine), and merge back to `main` only after the change has been sanity-checked on the device that runs it. The point is to not break the live thing while iterating.
- A clean fast-forward is preferred when merging back. Don't force-push `main`.
- Never push to `main` without explicit permission if `main` already contains a working version of the project being changed.

## Project layout

Each project lives in its own subfolder of `/home/user/1-projects/`. Don't cross-contaminate. If asked to work on project X, leave project Y alone unless explicitly told otherwise.

## Hosting

Projects intended for the web are deployed via GitHub Pages from `main`, served at:

  `https://adsac.github.io/1-projects/<project-folder>/`

That means each project's paths must be relative (no leading `/`) so they resolve under the subfolder.
