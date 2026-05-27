#!/usr/bin/env bash
set -euo pipefail

SOURCES_DIR="${1:-sources}"
CLAUDE_MARKETPLACE_FILE="${2:-.claude-plugin/marketplace.json}"
PLUGINS_DIR="${3:-plugins}"
CODEX_MARKETPLACE_FILE="${4:-.agents/plugins/marketplace.json}"
GENERATED_PLUGINS_FILE="${5:-$PLUGINS_DIR/.generated-plugins.json}"

fail() {
  echo "Error: $*" >&2
  exit 1
}

validate_name() {
  local name="$1"
  case "$name" in
    ""|"."|".."|*/*)
      fail "Invalid name: $name"
      ;;
  esac
}

[ -d "$SOURCES_DIR" ] || fail "$SOURCES_DIR not found"
[ -f "$CLAUDE_MARKETPLACE_FILE" ] || fail "$CLAUDE_MARKETPLACE_FILE not found"
[ -d "$PLUGINS_DIR" ] || fail "$PLUGINS_DIR not found"
[ -f "$CODEX_MARKETPLACE_FILE" ] || fail "$CODEX_MARKETPLACE_FILE not found"
[ -f "$GENERATED_PLUGINS_FILE" ] || fail "$GENERATED_PLUGINS_FILE not found"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

SOURCE_SKILL_NAMES_FILE="$TMP_DIR/source-skill-names.txt"
GENERATED_PLUGIN_SKILL_NAMES_FILE="$TMP_DIR/generated-plugin-skill-names.txt"
ALL_PLUGIN_SKILL_NAMES_FILE="$TMP_DIR/all-plugin-skill-names.txt"
ALL_PLUGIN_SKILL_NAMES_SORTED_FILE="$TMP_DIR/all-plugin-skill-names-sorted.txt"
CLAUDE_PLUGIN_NAMES_FILE="$TMP_DIR/claude-plugin-names.txt"
CODEX_PLUGIN_NAMES_FILE="$TMP_DIR/codex-plugin-names.txt"

: > "$SOURCE_SKILL_NAMES_FILE"
: > "$GENERATED_PLUGIN_SKILL_NAMES_FILE"
: > "$ALL_PLUGIN_SKILL_NAMES_FILE"

for source_dir in "$SOURCES_DIR"/*/; do
  [ -d "$source_dir" ] || continue
  source_name=$(basename "$source_dir")
  validate_name "$source_name"
  [ -f "$source_dir/plugins.json" ] || fail "$source_dir/plugins.json not found"
  jq -er '.plugins | if type == "array" then . else error("plugins must be an array") end' "$source_dir/plugins.json" >/dev/null

  for skill_dir in "$source_dir"/skills/*/; do
    [ -d "$skill_dir" ] || continue
    skill_name=$(basename "$skill_dir")
    validate_name "$skill_name"
    [[ "$skill_name" == *-workspace ]] && continue
    skill_file="$skill_dir/SKILL.md"
    [ -f "$skill_file" ] || fail "Missing SKILL.md in $skill_dir"
    head -1 "$skill_file" | grep -q "^---" || fail "Missing YAML frontmatter in $skill_file"
    printf '%s\n' "$skill_name" >> "$SOURCE_SKILL_NAMES_FILE"
  done
done

sort "$SOURCE_SKILL_NAMES_FILE" > "$TMP_DIR/source-skill-names-sorted.txt"
duplicated_source_skills=$(uniq -d "$TMP_DIR/source-skill-names-sorted.txt")
[ -z "$duplicated_source_skills" ] || fail "Duplicate source skills: $duplicated_source_skills"
mv "$TMP_DIR/source-skill-names-sorted.txt" "$SOURCE_SKILL_NAMES_FILE"

jq -er '.plugins | if type == "array" then . else error("plugins must be an array") end' "$CLAUDE_MARKETPLACE_FILE" >/dev/null
jq -er '.plugins | if type == "array" then . else error("plugins must be an array") end' "$CODEX_MARKETPLACE_FILE" >/dev/null
jq -er '.plugins | if type == "array" then . else error("plugins must be an array") end' "$GENERATED_PLUGINS_FILE" >/dev/null
jq -r '.plugins[].name' "$CLAUDE_MARKETPLACE_FILE" | sort > "$CLAUDE_PLUGIN_NAMES_FILE"
jq -r '.plugins[].name' "$CODEX_MARKETPLACE_FILE" | sort > "$CODEX_PLUGIN_NAMES_FILE"

if ! cmp -s "$CLAUDE_PLUGIN_NAMES_FILE" "$CODEX_PLUGIN_NAMES_FILE"; then
  echo "Error: Claude and Codex marketplace plugin lists differ" >&2
  comm -3 "$CLAUDE_PLUGIN_NAMES_FILE" "$CODEX_PLUGIN_NAMES_FILE" >&2
  exit 1
fi

codex_display_name=$(jq -r '.interface.displayName // empty' "$CODEX_MARKETPLACE_FILE")
[ -n "$codex_display_name" ] || fail "Codex marketplace missing interface.displayName"

while IFS=$'\t' read -r plugin_name source_path; do
  [ -n "$plugin_name" ] || continue
  validate_name "$plugin_name"
  case "$source_path" in
    ./*) relative_source="${source_path#./}" ;;
    *) relative_source="$source_path" ;;
  esac

  plugin_dir="$relative_source"
  claude_plugin_manifest="$plugin_dir/.claude-plugin/plugin.json"
  codex_plugin_manifest="$plugin_dir/.codex-plugin/plugin.json"
  [ -d "$plugin_dir" ] || fail "Marketplace plugin '$plugin_name' source not found: $source_path"
  [ -f "$claude_plugin_manifest" ] || fail "Plugin '$plugin_name' is missing $claude_plugin_manifest"
  [ -f "$codex_plugin_manifest" ] || fail "Plugin '$plugin_name' is missing $codex_plugin_manifest"

  claude_manifest_name=$(jq -r '.name' "$claude_plugin_manifest")
  codex_manifest_name=$(jq -r '.name' "$codex_plugin_manifest")
  [ "$claude_manifest_name" = "$plugin_name" ] || fail "Claude plugin manifest name '$claude_manifest_name' does not match marketplace name '$plugin_name'"
  [ "$codex_manifest_name" = "$plugin_name" ] || fail "Codex plugin manifest name '$codex_manifest_name' does not match marketplace name '$plugin_name'"
  [ "$(jq -r '.skills // empty' "$codex_plugin_manifest")" = "./skills/" ] || fail "Codex plugin '$plugin_name' must set skills to ./skills/"
  [ -n "$(jq -r '.interface.displayName // empty' "$codex_plugin_manifest")" ] || fail "Codex plugin '$plugin_name' missing interface.displayName"
  [ -n "$(jq -r '.interface.shortDescription // empty' "$codex_plugin_manifest")" ] || fail "Codex plugin '$plugin_name' missing interface.shortDescription"
  [ -n "$(jq -r '.interface.longDescription // empty' "$codex_plugin_manifest")" ] || fail "Codex plugin '$plugin_name' missing interface.longDescription"
  [ -n "$(jq -r '.interface.defaultPrompt // .interface.default_prompt // empty' "$codex_plugin_manifest")" ] || fail "Codex plugin '$plugin_name' missing interface.defaultPrompt"

  generated_source=$(jq -r --arg name "$plugin_name" '.plugins[]? | select(.name == $name) | .source' "$GENERATED_PLUGINS_FILE")
  plugin_skills_dir="$plugin_dir/skills"
  [ -d "$plugin_skills_dir" ] || fail "Plugin '$plugin_name' has no skills directory"

  for plugin_skill_dir in "$plugin_skills_dir"/*/; do
    [ -d "$plugin_skill_dir" ] || continue
    plugin_skill_name=$(basename "$plugin_skill_dir")
    validate_name "$plugin_skill_name"
    [ -f "$plugin_skill_dir/SKILL.md" ] || fail "Missing SKILL.md in $plugin_skill_dir"
    head -1 "$plugin_skill_dir/SKILL.md" | grep -q "^---" || fail "Missing YAML frontmatter in $plugin_skill_dir/SKILL.md"

    if [ -n "$generated_source" ]; then
      source_skill_dir="$SOURCES_DIR/$generated_source/skills/$plugin_skill_name"
      [ -d "$source_skill_dir" ] || fail "Plugin '$plugin_name' contains unknown generated skill '$plugin_skill_name'"
      diff -qr "$source_skill_dir" "$plugin_skill_dir" >/dev/null || fail "Plugin '$plugin_name' skill '$plugin_skill_name' differs from $source_skill_dir"
      printf '%s\n' "$plugin_skill_name" >> "$GENERATED_PLUGIN_SKILL_NAMES_FILE"
    fi
    printf '%s\n' "$plugin_skill_name" >> "$ALL_PLUGIN_SKILL_NAMES_FILE"
  done
done < <(jq -r '.plugins[] | [.name, .source] | @tsv' "$CLAUDE_MARKETPLACE_FILE")

while IFS=$'\t' read -r plugin_name source_kind source_path installation authentication category; do
  validate_name "$plugin_name"
  [ "$source_kind" = "local" ] || fail "Codex plugin '$plugin_name' source.source must be local"
  [ "$source_path" = "./$PLUGINS_DIR/$plugin_name" ] || fail "Codex plugin '$plugin_name' source.path must be ./$PLUGINS_DIR/$plugin_name"
  [ -n "$installation" ] || fail "Codex plugin '$plugin_name' missing policy.installation"
  [ -n "$authentication" ] || fail "Codex plugin '$plugin_name' missing policy.authentication"
  [ -n "$category" ] || fail "Codex plugin '$plugin_name' missing category"
done < <(jq -r '.plugins[] | [.name, .source.source, .source.path, .policy.installation, .policy.authentication, .category] | @tsv' "$CODEX_MARKETPLACE_FILE")

sort "$ALL_PLUGIN_SKILL_NAMES_FILE" > "$ALL_PLUGIN_SKILL_NAMES_SORTED_FILE"
duplicated=$(uniq -d "$ALL_PLUGIN_SKILL_NAMES_SORTED_FILE")
[ -z "$duplicated" ] || fail "Duplicate skills across plugins: $duplicated"

sort -u "$GENERATED_PLUGIN_SKILL_NAMES_FILE" -o "$GENERATED_PLUGIN_SKILL_NAMES_FILE"
if ! cmp -s "$SOURCE_SKILL_NAMES_FILE" "$GENERATED_PLUGIN_SKILL_NAMES_FILE"; then
  echo "Error: Generated plugin skills do not match source skill directories" >&2
  echo "Only in sources or only in generated plugins:" >&2
  comm -3 "$SOURCE_SKILL_NAMES_FILE" "$GENERATED_PLUGIN_SKILL_NAMES_FILE" >&2
  exit 1
fi

echo "All skills validated successfully"
