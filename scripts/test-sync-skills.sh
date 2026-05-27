#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_UNDER_TEST="$SCRIPT_DIR/sync-sources.sh"
LEGACY_SCRIPT="$SCRIPT_DIR/sync-skills.sh"
TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_file_exists() {
  [ -f "$1" ] || fail "Expected file to exist: $1"
}

assert_path_missing() {
  [ ! -e "$1" ] || fail "Expected path to be missing: $1"
}

assert_contains() {
  local file="$1"
  local expected="$2"
  grep -Fq "$expected" "$file" || fail "Expected '$expected' in $file"
}

assert_not_contains() {
  local file="$1"
  local unexpected="$2"
  ! grep -Fq "$unexpected" "$file" || fail "Did not expect '$unexpected' in $file"
}

assert_exit_code() {
  local actual="$1"
  local expected="$2"
  local context="$3"
  [ "$actual" -eq "$expected" ] || fail "$context: expected exit code $expected, got $actual"
}

init_repo() {
  local repo_dir="$1"
  git init -q -b main "$repo_dir"
  git -C "$repo_dir" config user.email test@example.com
  git -C "$repo_dir" config user.name "Sync Test"
}

commit_all() {
  local repo_dir="$1"
  local message="$2"
  git -C "$repo_dir" add -A
  git -C "$repo_dir" commit -q -m "$message"
}

write_skill() {
  local repo_dir="$1"
  local skill_name="$2"
  mkdir -p "$repo_dir/skills/$skill_name"
  cat > "$repo_dir/skills/$skill_name/SKILL.md" <<EOF
---
name: $skill_name
description: Test skill
---

# $skill_name
EOF
}

write_plugins_json() {
  local repo_dir="$1"
  local plugin_name="$2"
  local display_name="$3"
  mkdir -p "$repo_dir/skills"
  cat > "$repo_dir/skills/plugins.json" <<EOF
{
  "schemaVersion": 1,
  "plugins": [
    {
      "name": "$plugin_name",
      "description": "$display_name test skills",
      "skills": {
        "include": ["*"],
        "exclude": ["*-workspace"]
      },
      "keywords": ["test"],
      "category": "development",
      "interface": {
        "displayName": "$display_name",
        "capabilities": ["Skills"],
        "defaultPrompt": "Help me use $display_name."
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      }
    }
  ]
}
EOF
}

write_skill_with_whitespace_only_lines() {
  local repo_dir="$1"
  local skill_name="$2"
  mkdir -p "$repo_dir/skills/$skill_name"
  {
    printf '%s\n' '---'
    printf 'name: %s\n' "$skill_name"
    printf '%s\n' 'description: Test skill'
    printf '%s\n' '---'
    printf '    \n'
    printf '# %s\n' "$skill_name"
    printf '    \n'
  } > "$repo_dir/skills/$skill_name/SKILL.md"
}

create_aggregate_repo() {
  local repo_dir="$1"
  mkdir -p "$repo_dir/scripts"
  cp "$SCRIPT_UNDER_TEST" "$repo_dir/scripts/sync-sources.sh"
  cp "$LEGACY_SCRIPT" "$repo_dir/scripts/sync-skills.sh"
  init_repo "$repo_dir"
}

run_sync() {
  local repo_dir="$1"
  local output_file="$2"
  (cd "$repo_dir" && bash scripts/sync-sources.sh repos.json sources .sync-sources.json) >"$output_file" 2>&1
}

test_fails_when_source_repo_cannot_be_cloned() {
  local tmp
  tmp="$(mktemp -d "$TMP_ROOT/clone-failure.XXXXXX")"

  local aggregate="$tmp/aggregate"
  create_aggregate_repo "$aggregate"
  cat > "$aggregate/repos.json" <<EOF
{"repos":[{"name":"missing","url":"$tmp/missing-source","branch":"main","skills_path":"skills"}]}
EOF
  commit_all "$aggregate" "init"

  local output="$tmp/output.log"
  set +e
  run_sync "$aggregate" "$output"
  local code=$?
  set -e
  assert_exit_code "$code" 1 "Sync should fail when a configured source repo cannot be cloned"
  assert_contains "$output" "Failed to clone"
}

test_syncs_source_skills_and_compact_manifest() {
  local tmp
  tmp="$(mktemp -d "$TMP_ROOT/sync-source.XXXXXX")"

  local source="$tmp/source"
  init_repo "$source"
  write_skill "$source" "synced-skill"
  write_skill "$source" "synced-workspace"
  write_plugins_json "$source" "source-plugin" "Source Plugin"
  commit_all "$source" "add skill"

  local aggregate="$tmp/aggregate"
  create_aggregate_repo "$aggregate"
  mkdir -p "$aggregate/sources/source/skills/stale-skill"
  touch "$aggregate/sources/source/skills/stale-skill/SKILL.md"
  cat > "$aggregate/repos.json" <<EOF
{"repos":[{"name":"source","url":"$source","branch":"main","skills_path":"skills"}]}
EOF
  commit_all "$aggregate" "init"

  local output="$tmp/output.log"
  if ! run_sync "$aggregate" "$output"; then
    fail "Sync should succeed and report source mirror changes"
  fi
  assert_file_exists "$aggregate/sources/source/skills/synced-skill/SKILL.md"
  assert_path_missing "$aggregate/sources/source/skills/synced-workspace"
  assert_path_missing "$aggregate/sources/source/skills/stale-skill"
  assert_file_exists "$aggregate/sources/source/plugins.json"
  assert_file_exists "$aggregate/.sync-sources.json"
  assert_contains "$aggregate/.sync-sources.json" '"source": "source"'
  assert_contains "$aggregate/.sync-sources.json" '"commit":'
  assert_not_contains "$aggregate/.sync-sources.json" '"skills":'
  assert_not_contains "$aggregate/.sync-sources.json" '"plugins":'
}

test_fails_on_duplicate_skill_names() {
  local tmp
  tmp="$(mktemp -d "$TMP_ROOT/duplicate.XXXXXX")"

  local source_a="$tmp/source-a"
  local source_b="$tmp/source-b"
  init_repo "$source_a"
  init_repo "$source_b"
  write_skill "$source_a" "duplicate-skill"
  write_skill "$source_b" "duplicate-skill"
  write_plugins_json "$source_a" "source-a-plugin" "Source A Plugin"
  write_plugins_json "$source_b" "source-b-plugin" "Source B Plugin"
  commit_all "$source_a" "add duplicate"
  commit_all "$source_b" "add duplicate"

  local aggregate="$tmp/aggregate"
  create_aggregate_repo "$aggregate"
  cat > "$aggregate/repos.json" <<EOF
{"repos":[
  {"name":"source-a","url":"$source_a","branch":"main","skills_path":"skills"},
  {"name":"source-b","url":"$source_b","branch":"main","skills_path":"skills"}
]}
EOF
  commit_all "$aggregate" "init"

  local output="$tmp/output.log"
  set +e
  run_sync "$aggregate" "$output"
  local code=$?
  set -e
  assert_exit_code "$code" 1 "Sync should fail when two source repos expose the same skill name"
  assert_contains "$output" "Duplicate skill"
  assert_path_missing "$aggregate/sources/source-a/skills/duplicate-skill"
}

test_sync_does_not_stage_changes() {
  local tmp
  tmp="$(mktemp -d "$TMP_ROOT/no-stage.XXXXXX")"

  local source="$tmp/source"
  init_repo "$source"
  write_skill "$source" "unstaged-skill"
  write_plugins_json "$source" "source-plugin" "Source Plugin"
  commit_all "$source" "add skill"

  local aggregate="$tmp/aggregate"
  create_aggregate_repo "$aggregate"
  cat > "$aggregate/repos.json" <<EOF
{"repos":[{"name":"source","url":"$source","branch":"main","skills_path":"skills"}]}
EOF
  commit_all "$aggregate" "init"

  local output="$tmp/output.log"
  if ! run_sync "$aggregate" "$output"; then
    fail "Sync should report unstaged worktree changes"
  fi
  assert_file_exists "$aggregate/sources/source/skills/unstaged-skill/SKILL.md"
  git -C "$aggregate" diff --cached --quiet || fail "Sync should not stage worktree changes"
}

test_fails_when_configured_skills_path_is_missing() {
  local tmp
  tmp="$(mktemp -d "$TMP_ROOT/missing-path.XXXXXX")"

  local source="$tmp/source"
  init_repo "$source"
  mkdir -p "$source/docs"
  touch "$source/docs/.keep"
  commit_all "$source" "init"

  local aggregate="$tmp/aggregate"
  create_aggregate_repo "$aggregate"
  cat > "$aggregate/repos.json" <<EOF
{"repos":[{"name":"source","url":"$source","branch":"main","skills_path":"skills"}]}
EOF
  commit_all "$aggregate" "init"

  local output="$tmp/output.log"
  set +e
  run_sync "$aggregate" "$output"
  local code=$?
  set -e
  assert_exit_code "$code" 1 "Sync should fail when the configured skills_path is missing"
  assert_contains "$output" "skills/ not found"
}

test_fails_when_plugins_metadata_is_missing() {
  local tmp
  tmp="$(mktemp -d "$TMP_ROOT/missing-plugins.XXXXXX")"

  local source="$tmp/source"
  init_repo "$source"
  write_skill "$source" "skill-without-plugin-metadata"
  commit_all "$source" "add skill"

  local aggregate="$tmp/aggregate"
  create_aggregate_repo "$aggregate"
  cat > "$aggregate/repos.json" <<EOF
{"repos":[{"name":"source","url":"$source","branch":"main","skills_path":"skills"}]}
EOF
  commit_all "$aggregate" "init"

  local output="$tmp/output.log"
  set +e
  run_sync "$aggregate" "$output"
  local code=$?
  set -e
  assert_exit_code "$code" 1 "Sync should fail when skills/plugins.json is missing"
  assert_contains "$output" "plugins.json not found"
}

test_strips_whitespace_only_lines_from_synced_markdown() {
  local tmp
  tmp="$(mktemp -d "$TMP_ROOT/whitespace.XXXXXX")"

  local source="$tmp/source"
  init_repo "$source"
  write_skill_with_whitespace_only_lines "$source" "whitespace-skill"
  write_plugins_json "$source" "source-plugin" "Source Plugin"
  commit_all "$source" "add whitespace skill"

  local aggregate="$tmp/aggregate"
  create_aggregate_repo "$aggregate"
  cat > "$aggregate/repos.json" <<EOF
{"repos":[{"name":"source","url":"$source","branch":"main","skills_path":"skills"}]}
EOF
  commit_all "$aggregate" "init"

  local output="$tmp/output.log"
  if ! run_sync "$aggregate" "$output"; then
    fail "Sync should succeed when a source skill has whitespace-only markdown lines"
  fi
  if grep -n '^[[:blank:]]\+$' "$aggregate/sources/source/skills/whitespace-skill/SKILL.md" >/dev/null; then
    fail "Sync should strip whitespace-only markdown lines"
  fi
}

test_legacy_sync_skills_wrapper_delegates_to_sync_sources() {
  local tmp
  tmp="$(mktemp -d "$TMP_ROOT/legacy.XXXXXX")"

  local source="$tmp/source"
  init_repo "$source"
  write_skill "$source" "legacy-skill"
  write_plugins_json "$source" "source-plugin" "Source Plugin"
  commit_all "$source" "add legacy skill"

  local aggregate="$tmp/aggregate"
  create_aggregate_repo "$aggregate"
  cat > "$aggregate/repos.json" <<EOF
{"repos":[{"name":"source","url":"$source","branch":"main","skills_path":"skills"}]}
EOF
  commit_all "$aggregate" "init"

  local output="$tmp/output.log"
  (cd "$aggregate" && bash scripts/sync-skills.sh repos.json sources .sync-sources.json) >"$output" 2>&1
  assert_file_exists "$aggregate/sources/source/skills/legacy-skill/SKILL.md"
}

main() {
  test_fails_when_source_repo_cannot_be_cloned
  test_syncs_source_skills_and_compact_manifest
  test_fails_on_duplicate_skill_names
  test_sync_does_not_stage_changes
  test_fails_when_configured_skills_path_is_missing
  test_fails_when_plugins_metadata_is_missing
  test_strips_whitespace_only_lines_from_synced_markdown
  test_legacy_sync_skills_wrapper_delegates_to_sync_sources
  echo "sync-skills tests passed"
}

main "$@"
