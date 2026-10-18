#!/usr/bin/env bash
set -euo pipefail

# A short pattern also matches branches such as ci/quality-reports.
archive_ref=refs/heads/quality-reports
if git ls-remote --exit-code --heads origin "$archive_ref"; then
  git fetch --depth=1 origin "$archive_ref"
  git worktree add --detach .report-history FETCH_HEAD
else
  status=$?
  # Git returns 2 only when the remote is reachable but the ref does not exist.
  # Authentication/network failures must not be treated as an empty archive.
  if [ "$status" -ne 2 ]; then
    exit "$status"
  fi
  git worktree add --detach .report-history HEAD
  git -C .report-history switch --orphan quality-reports
fi
