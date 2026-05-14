#!/usr/bin/env bash
set -euo pipefail

# Sync skills from source repositories listed in repos.json
# Usage: sync-skills.sh [config_file] [skills_dir]
#
# Exit codes:
#   0 - changes detected
#   1 - error
#   2 - no changes

CONFIG_FILE="${1:-repos.json}"
SKILLS_DIR="${2:-skills}"

# Check dependencies
command -v jq >/dev/null 2>&1 || { echo "Error: jq is required but not installed" >&2; exit 1; }
command -v rsync >/dev/null 2>&1 || { echo "Error: rsync is required but not installed" >&2; exit 1; }

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: $CONFIG_FILE not found" >&2
  exit 1
fi

REPO_COUNT=$(jq '.repos | length' "$CONFIG_FILE")
echo "Found $REPO_COUNT source repos to sync"
echo ""

SYNC_DIR=$(mktemp -d)
trap 'rm -rf "$SYNC_DIR"' EXIT
TRACKED_SKILLS=""

# Clean up existing workspace skills
for dir in "$SKILLS_DIR"/*-workspace/; do
  [ -d "$dir" ] || continue
  echo "Removing workspace skill: $(basename "$dir")"
  rm -rf "$dir"
done

for i in $(seq 0 $((REPO_COUNT - 1))); do
  URL=$(jq -r ".repos[$i].url" "$CONFIG_FILE")
  BRANCH=$(jq -r ".repos[$i].branch // \"main\"" "$CONFIG_FILE")
  SRC_SKILLS_PATH=$(jq -r ".repos[$i].skills_path // \"skills\"" "$CONFIG_FILE")
  REPO_NAME=$(basename "$URL" .git)

  echo "=== Syncing from $REPO_NAME ($BRANCH) ==="

  CLONE_DIR="$SYNC_DIR/$REPO_NAME"
  if ! git clone --depth 1 --branch "$BRANCH" "$URL" "$CLONE_DIR" 2>&1; then
    echo "Warning: Failed to clone $REPO_NAME ($BRANCH), skipping" >&2
    echo ""
    continue
  fi

  SOURCE_SKILLS_DIR="$CLONE_DIR/$SRC_SKILLS_PATH"
  if [ ! -d "$SOURCE_SKILLS_DIR" ]; then
    echo "Warning: $SRC_SKILLS_PATH/ not found in $REPO_NAME, skipping"
    echo ""
    continue
  fi

  for skill_dir in "$SOURCE_SKILLS_DIR"/*/; do
    [ -d "$skill_dir" ] || continue
    SKILL_NAME=$(basename "$skill_dir")

    # Skip workspace skills
    if [[ "$SKILL_NAME" == *-workspace ]]; then
      echo "  Skipping workspace skill: $SKILL_NAME"
      continue
    fi

    # Warn on duplicate skill names across repos
    if echo "$TRACKED_SKILLS" | tr ' ' '\n' | grep -q "^${SKILL_NAME}$"; then
      echo "  Warning: '$SKILL_NAME' already synced, overwriting with $REPO_NAME"
    fi
    TRACKED_SKILLS="$TRACKED_SKILLS $SKILL_NAME"

    echo "  Copying skill: $SKILL_NAME (from $REPO_NAME)"
    rsync -a --delete "$skill_dir" "$SKILLS_DIR/$SKILL_NAME/"
  done

  echo ""
done

# Stage and detect changes
if git rev-parse --is-inside-work-tree &>/dev/null; then
  git add -A "$SKILLS_DIR/"
  if git diff --cached --quiet; then
    echo "No changes detected"
    exit 2
  else
    echo "Changes detected:"
    git diff --cached --stat
    exit 0
  fi
else
  echo "Sync complete (not a git repo, skipping change detection)"
  exit 0
fi
