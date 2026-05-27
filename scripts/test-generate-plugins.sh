#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_UNDER_TEST="$SCRIPT_DIR/generate-plugins.sh"
VALIDATE_SCRIPT="$SCRIPT_DIR/validate-skills.sh"
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

assert_json_value() {
  local file="$1"
  local filter="$2"
  local expected="$3"
  local actual
  actual="$(jq -r "$filter" "$file")"
  [ "$actual" = "$expected" ] || fail "Expected $filter in $file to be '$expected', got '$actual'"
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

write_source_plugins_json() {
  local source_dir="$1"
  local plugin_name="$2"
  local display_name="$3"
  mkdir -p "$source_dir"
  cat > "$source_dir/plugins.json" <<EOF
{
  "schemaVersion": 1,
  "plugins": [
    {
      "name": "$plugin_name",
      "description": "$display_name source skills",
      "skills": {
        "include": ["*"],
        "exclude": ["*-workspace"]
      },
      "keywords": ["source", "skills"],
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

write_local_plugin() {
  local repo_dir="$1"
  local plugin_name="$2"
  local skill_name="$3"
  local plugin_dir="$repo_dir/plugins/$plugin_name"

  mkdir -p "$plugin_dir/.claude-plugin" "$plugin_dir/.codex-plugin"
  write_skill "$plugin_dir" "$skill_name"
  cat > "$plugin_dir/.claude-plugin/plugin.json" <<EOF
{
  "name": "$plugin_name",
  "description": "Local plugin skills",
  "version": "0.0.3",
  "author": {"name": "Ahoo Wang", "email": "ahoowang@gmail.com"},
  "homepage": "https://github.com/Ahoo-Wang/skills",
  "repository": "https://github.com/Ahoo-Wang/skills",
  "license": "Apache-2.0",
  "keywords": ["local"]
}
EOF
  cat > "$plugin_dir/.codex-plugin/plugin.json" <<EOF
{
  "name": "$plugin_name",
  "description": "Local plugin skills",
  "version": "0.0.3",
  "author": {"name": "Ahoo Wang", "email": "ahoowang@gmail.com"},
  "homepage": "https://github.com/Ahoo-Wang/skills",
  "repository": "https://github.com/Ahoo-Wang/skills",
  "license": "Apache-2.0",
  "keywords": ["local"],
  "skills": "./skills/",
  "interface": {
    "displayName": "Local Plugin",
    "shortDescription": "Local plugin skills",
    "longDescription": "Local plugin skills",
    "developerName": "Ahoo Wang",
    "category": "Development",
    "capabilities": ["Skills"],
    "websiteURL": "https://github.com/Ahoo-Wang/skills",
    "defaultPrompt": "Help me use local plugin skills."
  }
}
EOF
}

run_codex_plugin_validator() {
  local plugin_dir="$1"
  local validator="${CODEX_PLUGIN_VALIDATOR:-}"

  if [ -n "$validator" ]; then
    [ -f "$validator" ] || fail "CODEX_PLUGIN_VALIDATOR not found: $validator"
    command -v python3 >/dev/null 2>&1 || fail "python3 is required to run CODEX_PLUGIN_VALIDATOR"
  else
    validator="$HOME/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py"
    if [ ! -f "$validator" ]; then
      echo "Skipping Codex plugin validator because validator script was not found"
      return 0
    fi
    if ! command -v python3 >/dev/null 2>&1; then
      echo "Skipping Codex plugin validator because python3 is not installed"
      return 0
    fi
    if ! python3 -c 'import yaml' >/dev/null 2>&1; then
      echo "Skipping Codex plugin validator because PyYAML is not installed"
      return 0
    fi
  fi

  python3 "$validator" "$plugin_dir" >/dev/null
}

test_generates_source_plugins_and_keeps_local_plugins() {
  local tmp
  tmp="$(mktemp -d "$TMP_ROOT/split.XXXXXX")"
  mkdir -p "$tmp/.claude-plugin"

  write_skill "$tmp/sources/Wow" "wow"
  write_skill "$tmp/sources/Wow" "wow-debugging"
  write_skill "$tmp/sources/Wow" "wow-workspace"
  write_source_plugins_json "$tmp/sources/Wow" "ahoo-wow-skills" "Ahoo Wow Skills"
  write_local_plugin "$tmp" "ahoo-agent-skills" "agent-system-prompt"

  (cd "$tmp" && bash "$SCRIPT_UNDER_TEST" sources plugins .claude-plugin/marketplace.json .agents/plugins/marketplace.json plugins/.generated-plugins.json)

  assert_file_exists "$tmp/plugins/ahoo-wow-skills/.claude-plugin/plugin.json"
  assert_file_exists "$tmp/plugins/ahoo-wow-skills/.codex-plugin/plugin.json"
  assert_file_exists "$tmp/plugins/ahoo-wow-skills/skills/wow/SKILL.md"
  assert_file_exists "$tmp/plugins/ahoo-wow-skills/skills/wow-debugging/SKILL.md"
  assert_path_missing "$tmp/plugins/ahoo-wow-skills/skills/wow-workspace"
  assert_file_exists "$tmp/plugins/ahoo-agent-skills/skills/agent-system-prompt/SKILL.md"
  assert_file_exists "$tmp/plugins/.generated-plugins.json"
  assert_json_value "$tmp/plugins/ahoo-wow-skills/.claude-plugin/plugin.json" ".name" "ahoo-wow-skills"
  assert_json_value "$tmp/plugins/ahoo-wow-skills/.codex-plugin/plugin.json" ".skills" "./skills/"
  assert_json_value "$tmp/plugins/ahoo-wow-skills/.codex-plugin/plugin.json" ".interface.displayName" "Ahoo Wow Skills"
  assert_json_value "$tmp/plugins/ahoo-wow-skills/.codex-plugin/plugin.json" ".interface.category" "Development"
  assert_json_value "$tmp/.claude-plugin/marketplace.json" ".plugins | length" "2"
  assert_json_value "$tmp/.claude-plugin/marketplace.json" ".plugins[] | select(.name == \"ahoo-wow-skills\") | .source" "./plugins/ahoo-wow-skills"
  assert_json_value "$tmp/.claude-plugin/marketplace.json" ".plugins[] | select(.name == \"ahoo-agent-skills\") | .source" "./plugins/ahoo-agent-skills"
  assert_json_value "$tmp/.agents/plugins/marketplace.json" ".interface.displayName" "Ahoo Skills"
  assert_json_value "$tmp/.agents/plugins/marketplace.json" ".plugins[] | select(.name == \"ahoo-wow-skills\") | .source.source" "local"
  assert_json_value "$tmp/.agents/plugins/marketplace.json" ".plugins[] | select(.name == \"ahoo-wow-skills\") | .source.path" "./plugins/ahoo-wow-skills"
  assert_json_value "$tmp/.agents/plugins/marketplace.json" ".plugins[] | select(.name == \"ahoo-wow-skills\") | .policy.installation" "AVAILABLE"
  assert_json_value "$tmp/.agents/plugins/marketplace.json" ".plugins[] | select(.name == \"ahoo-wow-skills\") | .policy.authentication" "ON_INSTALL"
  (cd "$tmp" && bash "$VALIDATE_SCRIPT" sources .claude-plugin/marketplace.json plugins .agents/plugins/marketplace.json plugins/.generated-plugins.json)
  run_codex_plugin_validator "$tmp/plugins/ahoo-wow-skills"
}

test_uses_codex_plugin_validator_override() {
  local tmp
  tmp="$(mktemp -d "$TMP_ROOT/validator.XXXXXX")"
  mkdir -p "$tmp/plugin-root"

  cat > "$tmp/custom-validator.py" <<'PY'
import os
import sys
from pathlib import Path

Path(os.environ["VALIDATOR_LOG"]).write_text(sys.argv[1], encoding="utf-8")
PY

  VALIDATOR_LOG="$tmp/validator.log" CODEX_PLUGIN_VALIDATOR="$tmp/custom-validator.py" run_codex_plugin_validator "$tmp/plugin-root"
  assert_file_exists "$tmp/validator.log"
  assert_contains "$tmp/validator.log" "$tmp/plugin-root"
}

test_removes_only_stale_generated_plugin_directories() {
  local tmp
  tmp="$(mktemp -d "$TMP_ROOT/stale.XXXXXX")"
  mkdir -p "$tmp/plugins/old-plugin/.claude-plugin" "$tmp/.claude-plugin"

  write_skill "$tmp/sources/Wow" "wow"
  write_source_plugins_json "$tmp/sources/Wow" "ahoo-wow-skills" "Ahoo Wow Skills"
  write_local_plugin "$tmp" "ahoo-agent-skills" "agent-system-prompt"
  cat > "$tmp/plugins/.generated-plugins.json" <<'EOF'
{
  "plugins": [
    {"name": "old-plugin", "source": "old-source", "skills": ["old-skill"]}
  ]
}
EOF

  (cd "$tmp" && bash "$SCRIPT_UNDER_TEST" sources plugins .claude-plugin/marketplace.json .agents/plugins/marketplace.json plugins/.generated-plugins.json)

  assert_path_missing "$tmp/plugins/old-plugin"
  assert_file_exists "$tmp/plugins/ahoo-wow-skills/.claude-plugin/plugin.json"
  assert_file_exists "$tmp/plugins/ahoo-agent-skills/.claude-plugin/plugin.json"
  assert_file_exists "$tmp/plugins/ahoo-agent-skills/.codex-plugin/plugin.json"
}

main() {
  test_generates_source_plugins_and_keeps_local_plugins
  test_uses_codex_plugin_validator_override
  test_removes_only_stale_generated_plugin_directories
  echo "generate-plugins tests passed"
}

main "$@"
