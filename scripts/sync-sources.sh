#!/usr/bin/env bash
set -euo pipefail

# Sync source repositories listed in repos.json into sources/<repo-name>.
# Usage: sync-sources.sh [config_file] [sources_dir] [manifest_file]
#
# Exit codes:
#   0 - changes detected
#   1 - error
#   2 - no changes

CONFIG_FILE="${1:-repos.json}"
SOURCES_DIR="${2:-sources}"
MANIFEST_FILE="${3:-.sync-sources.json}"

command -v jq >/dev/null 2>&1 || { echo "Error: jq is required but not installed" >&2; exit 1; }
command -v rsync >/dev/null 2>&1 || { echo "Error: rsync is required but not installed" >&2; exit 1; }
command -v perl >/dev/null 2>&1 || { echo "Error: perl is required but not installed" >&2; exit 1; }

[ -f "$CONFIG_FILE" ] || { echo "Error: $CONFIG_FILE not found" >&2; exit 1; }

REPO_COUNT=$(jq -er '.repos | if type == "array" then length else error("repos must be an array") end' "$CONFIG_FILE")
echo "Found $REPO_COUNT source repos to sync"
echo ""

SYNC_DIR=$(mktemp -d)
trap 'rm -rf "$SYNC_DIR"' EXIT
CLONES_DIR="$SYNC_DIR/repos"
SYNCED_SOURCES_DIR="$SYNC_DIR/sources"
TRACKED_SKILLS_FILE="$SYNC_DIR/tracked-skills.txt"
MANIFEST_ENTRIES_FILE="$SYNC_DIR/source-entries.jsonl"
FAILED=0

mkdir -p "$CLONES_DIR" "$SYNCED_SOURCES_DIR"
: > "$TRACKED_SKILLS_FILE"
: > "$MANIFEST_ENTRIES_FILE"

validate_name() {
  local name="$1"
  case "$name" in
    ""|"."|".."|*/*)
      echo "Error: Invalid name: $name" >&2
      exit 1
      ;;
  esac
}

strip_whitespace_only_markdown_lines() {
  local root="$1"

  find "$root" -type f \( -name '*.md' -o -name '*.markdown' \) -print0 |
    while IFS= read -r -d '' file; do
      perl -0pi -e 's/^[ \t]+$//mg' "$file"
    done
}

for ((i = 0; i < REPO_COUNT; i++)); do
  URL=$(jq -r ".repos[$i].url" "$CONFIG_FILE")
  BRANCH=$(jq -r ".repos[$i].branch // \"main\"" "$CONFIG_FILE")
  SRC_SKILLS_PATH=$(jq -r ".repos[$i].skills_path // \"skills\"" "$CONFIG_FILE")
  SRC_PLUGINS_PATH=$(jq -r ".repos[$i].plugins_path // ((.repos[$i].skills_path // \"skills\") + \"/plugins.json\")" "$CONFIG_FILE")
  SOURCE_NAME=$(jq -r ".repos[$i].name // empty" "$CONFIG_FILE")
  if [ -z "$SOURCE_NAME" ]; then
    SOURCE_NAME=$(basename "$URL" .git)
  fi
  validate_name "$SOURCE_NAME"

  echo "=== Syncing from $SOURCE_NAME ($BRANCH) ==="

  CLONE_DIR="$CLONES_DIR/$i-$SOURCE_NAME"
  if ! git clone --depth 1 --branch "$BRANCH" "$URL" "$CLONE_DIR" 2>&1; then
    echo "Error: Failed to clone $SOURCE_NAME ($BRANCH)" >&2
    echo ""
    FAILED=1
    continue
  fi

  SOURCE_SKILLS_DIR="$CLONE_DIR/$SRC_SKILLS_PATH"
  SOURCE_PLUGINS_FILE="$CLONE_DIR/$SRC_PLUGINS_PATH"
  if [ ! -d "$SOURCE_SKILLS_DIR" ]; then
    echo "Error: $SRC_SKILLS_PATH/ not found in $SOURCE_NAME" >&2
    echo ""
    FAILED=1
    continue
  fi
  if [ ! -f "$SOURCE_PLUGINS_FILE" ]; then
    echo "Error: $SRC_PLUGINS_PATH not found in $SOURCE_NAME" >&2
    echo ""
    FAILED=1
    continue
  fi
  if ! jq -er '.plugins | if type == "array" then . else error("plugins must be an array") end' "$SOURCE_PLUGINS_FILE" >/dev/null; then
    echo "Error: Invalid plugins metadata in $SOURCE_NAME" >&2
    echo ""
    FAILED=1
    continue
  fi

  SOURCE_OUTPUT_DIR="$SYNCED_SOURCES_DIR/$SOURCE_NAME"
  mkdir -p "$SOURCE_OUTPUT_DIR/skills"
  cp "$SOURCE_PLUGINS_FILE" "$SOURCE_OUTPUT_DIR/plugins.json"

  for skill_dir in "$SOURCE_SKILLS_DIR"/*/; do
    [ -d "$skill_dir" ] || continue
    SKILL_NAME=$(basename "$skill_dir")
    validate_name "$SKILL_NAME"

    if [[ "$SKILL_NAME" == *-workspace ]]; then
      echo "  Skipping workspace skill: $SKILL_NAME"
      continue
    fi

    if grep -Fxq "$SKILL_NAME" "$TRACKED_SKILLS_FILE"; then
      echo "  Error: Duplicate skill '$SKILL_NAME' from $SOURCE_NAME" >&2
      FAILED=1
      continue
    fi
    printf '%s\n' "$SKILL_NAME" >> "$TRACKED_SKILLS_FILE"

    echo "  Copying skill: $SKILL_NAME (from $SOURCE_NAME)"
    rsync -a --delete "$skill_dir" "$SOURCE_OUTPUT_DIR/skills/$SKILL_NAME/"
    strip_whitespace_only_markdown_lines "$SOURCE_OUTPUT_DIR/skills/$SKILL_NAME"
  done

  COMMIT=$(git -C "$CLONE_DIR" rev-parse HEAD)
  jq -n \
    --arg source "$SOURCE_NAME" \
    --arg url "$URL" \
    --arg branch "$BRANCH" \
    --arg commit "$COMMIT" \
    --arg skills_path "$SRC_SKILLS_PATH" \
    --arg plugins_path "$SRC_PLUGINS_PATH" \
    '{source: $source, url: $url, branch: $branch, commit: $commit, skills_path: $skills_path, plugins_path: $plugins_path}' \
    >> "$MANIFEST_ENTRIES_FILE"

  echo ""
done

if [ "$FAILED" -ne 0 ]; then
  echo "Sync failed; no changes were applied" >&2
  exit 1
fi

sort -u "$TRACKED_SKILLS_FILE" -o "$TRACKED_SKILLS_FILE"
rm -rf "$SOURCES_DIR"
mkdir -p "$(dirname "$SOURCES_DIR")"
mv "$SYNCED_SOURCES_DIR" "$SOURCES_DIR"

jq -s \
  '{generated_by: "scripts/sync-sources.sh", sources: sort_by(.source)}' \
  "$MANIFEST_ENTRIES_FILE" > "$MANIFEST_FILE"

if git rev-parse --is-inside-work-tree &>/dev/null; then
  UNTRACKED_CHANGES=$(git ls-files --others --exclude-standard -- "$SOURCES_DIR/" "$MANIFEST_FILE")
  if git diff --quiet -- "$SOURCES_DIR/" "$MANIFEST_FILE" && [ -z "$UNTRACKED_CHANGES" ]; then
    echo "No changes detected"
    exit 2
  else
    echo "Changes detected:"
    git diff --stat -- "$SOURCES_DIR/" "$MANIFEST_FILE"
    if [ -n "$UNTRACKED_CHANGES" ]; then
      echo "$UNTRACKED_CHANGES" | sed 's/^/ new file: /'
    fi
    exit 0
  fi
else
  echo "Sync complete (not a git repo, skipping change detection)"
  exit 0
fi
