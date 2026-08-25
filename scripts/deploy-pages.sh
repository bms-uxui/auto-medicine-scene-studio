#!/usr/bin/env bash
# Publishes the studio and its gallery to GitHub Pages.
#
# The films live in `out/`, which is not committed, so the build stages them into
# `public/media` and the finished `dist/` is pushed to the `gh-pages` branch. The main
# branch stays free of binaries.
set -euo pipefail

REPO_NAME=$(basename -s .git "$(git config --get remote.origin.url)")
export VITE_BASE="/${REPO_NAME}/"

echo "building for ${VITE_BASE}"
npm run build

# Pages serves what it is given: no Jekyll pass, or it drops files beginning with _
touch dist/.nojekyll

# A deploy interrupted mid-build once pushed an index.html pointing at an asset hash that
# was no longer there, and the live page came up blank. Refuse to publish that.
for ref in $(grep -o '/[^"]*/assets/[^"]*' dist/index.html); do
  [ -f "dist/${ref#/*/}" ] || { echo "dist/index.html references a missing asset: $ref" >&2; exit 1; }
done

WORKTREE=$(mktemp -d)
# a worktree left behind by an interrupted deploy still holds the branch checked out
git worktree prune
git worktree list --porcelain | awk '/^worktree /{p=$2} /^branch refs\/heads\/gh-pages$/{print p}' |
  while read -r stale; do git worktree remove --force "$stale" 2>/dev/null || true; done
git worktree prune
if git show-ref --quiet refs/heads/gh-pages; then
  git worktree add "$WORKTREE" gh-pages
else
  git worktree add --detach "$WORKTREE"
  git -C "$WORKTREE" checkout --orphan gh-pages
  git -C "$WORKTREE" rm -rf . >/dev/null 2>&1 || true
fi

rsync -a --delete --exclude .git dist/ "$WORKTREE"/
git -C "$WORKTREE" add -A
git -C "$WORKTREE" commit -m "Deploy $(git rev-parse --short HEAD)" || echo "nothing to deploy"
git -C "$WORKTREE" push origin gh-pages
git worktree remove --force "$WORKTREE"

echo "deployed — enable Pages for the gh-pages branch in the repository settings if it is not on yet"
