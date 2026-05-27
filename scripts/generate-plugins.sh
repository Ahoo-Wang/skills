#!/usr/bin/env bash
set -euo pipefail

SOURCES_DIR="${1:-sources}"
PLUGINS_DIR="${2:-plugins}"
CLAUDE_MARKETPLACE_FILE="${3:-.claude-plugin/marketplace.json}"
CODEX_MARKETPLACE_FILE="${4:-.agents/plugins/marketplace.json}"
GENERATED_PLUGINS_FILE="${5:-$PLUGINS_DIR/.generated-plugins.json}"
PACKAGE_FILE="${PACKAGE_FILE:-package.json}"

command -v jq >/dev/null 2>&1 || { echo "Error: jq is required but not installed" >&2; exit 1; }
command -v rsync >/dev/null 2>&1 || { echo "Error: rsync is required but not installed" >&2; exit 1; }

[ -d "$SOURCES_DIR" ] || { echo "Error: $SOURCES_DIR not found" >&2; exit 1; }

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

DEFAULTS_FILE="$TMP_DIR/defaults.json"
CLAUDE_MARKETPLACE_ENTRIES_FILE="$TMP_DIR/claude-marketplace-entries.jsonl"
CODEX_MARKETPLACE_ENTRIES_FILE="$TMP_DIR/codex-marketplace-entries.jsonl"
GENERATED_PLUGIN_ENTRIES_FILE="$TMP_DIR/generated-plugin-entries.jsonl"
GENERATED_PLUGIN_NAMES_FILE="$TMP_DIR/generated-plugin-names.txt"

: > "$CLAUDE_MARKETPLACE_ENTRIES_FILE"
: > "$CODEX_MARKETPLACE_ENTRIES_FILE"
: > "$GENERATED_PLUGIN_ENTRIES_FILE"
: > "$GENERATED_PLUGIN_NAMES_FILE"

if [ -f "$PACKAGE_FILE" ]; then
  jq '{
    marketplaceName: (.name // "ahoo-skills"),
    marketplaceDisplayName: (.displayName // "Ahoo Skills"),
    version: (.version // "0.0.0"),
    description: (.description // ""),
    author: (.author // {name: "Ahoo Wang"}),
    homepage: (.homepage // "https://github.com/Ahoo-Wang/skills"),
    repository: (
      if (.repository | type) == "object" then
        (.repository.url // "https://github.com/Ahoo-Wang/skills")
      else
        (.repository // "https://github.com/Ahoo-Wang/skills")
      end
    ),
    license: (.license // "Apache-2.0")
  }' "$PACKAGE_FILE" > "$DEFAULTS_FILE"
else
  jq -n '{
    marketplaceName: "ahoo-skills",
    marketplaceDisplayName: "Ahoo Skills",
    version: "0.0.0",
    description: "",
    author: {name: "Ahoo Wang"},
    homepage: "https://github.com/Ahoo-Wang/skills",
    repository: "https://github.com/Ahoo-Wang/skills",
    license: "Apache-2.0"
  }' > "$DEFAULTS_FILE"
fi

validate_name() {
  local name="$1"
  case "$name" in
    ""|"."|".."|*/*)
      echo "Error: Invalid name: $name" >&2
      exit 1
      ;;
  esac
}

matches_any_pattern() {
  local value="$1"
  local patterns_file="$2"
  local pattern

  while IFS= read -r pattern; do
    [ -n "$pattern" ] || continue
    case "$value" in
      $pattern) return 0 ;;
    esac
  done < "$patterns_file"
  return 1
}

collect_plugin_skills() {
  local source_dir="$1"
  local metadata_file="$2"
  local index="$3"
  local output_file="$4"
  local all_skills_file="$TMP_DIR/all-skills-$(basename "$source_dir")-$index.txt"
  local include_patterns_file="$TMP_DIR/include-patterns-$(basename "$source_dir")-$index.txt"
  local exclude_patterns_file="$TMP_DIR/exclude-patterns-$(basename "$source_dir")-$index.txt"
  local skills_type skill_name

  : > "$all_skills_file"
  : > "$output_file"

  for skill_dir in "$source_dir"/skills/*/; do
    [ -d "$skill_dir" ] || continue
    skill_name=$(basename "$skill_dir")
    validate_name "$skill_name"
    printf '%s\n' "$skill_name" >> "$all_skills_file"
  done
  sort -u "$all_skills_file" -o "$all_skills_file"

  skills_type=$(jq -r ".plugins[$index].skills | type" "$metadata_file")
  if [ "$skills_type" = "array" ]; then
    jq -r ".plugins[$index].skills[]" "$metadata_file" | sort -u > "$output_file"
    return 0
  fi

  jq -r ".plugins[$index].skills.include // [\"*\"] | .[]" "$metadata_file" > "$include_patterns_file"
  jq -r ".plugins[$index].skills.exclude // [\"*-workspace\"] | .[]" "$metadata_file" > "$exclude_patterns_file"

  while IFS= read -r skill_name; do
    [ -n "$skill_name" ] || continue
    if matches_any_pattern "$skill_name" "$include_patterns_file" &&
      ! matches_any_pattern "$skill_name" "$exclude_patterns_file"; then
      printf '%s\n' "$skill_name" >> "$output_file"
    fi
  done < "$all_skills_file"
  sort -u "$output_file" -o "$output_file"
}

write_claude_plugin_manifest() {
  local metadata_file="$1"
  local index="$2"
  local plugin_dir="$3"

  jq -n \
    --argjson plugin "$(jq -c ".plugins[$index]" "$metadata_file")" \
    --argjson defaults "$(cat "$DEFAULTS_FILE")" \
    '{
      name: $plugin.name,
      description: ($plugin.description // ""),
      version: ($plugin.version // $defaults.version),
      author: ($plugin.author // $defaults.author),
      homepage: ($plugin.homepage // $defaults.homepage),
      repository: ($plugin.repository // $defaults.repository),
      license: ($plugin.license // $defaults.license),
      keywords: ($plugin.keywords // [])
    } | with_entries(select(.value != "" and .value != []))' \
    > "$plugin_dir/.claude-plugin/plugin.json"
}

write_codex_plugin_manifest() {
  local metadata_file="$1"
  local index="$2"
  local plugin_dir="$3"

  jq -n \
    --argjson plugin "$(jq -c ".plugins[$index]" "$metadata_file")" \
    --argjson defaults "$(cat "$DEFAULTS_FILE")" \
    '
    def title_words:
      split("-") | map(if length > 0 then (.[0:1] | ascii_upcase) + .[1:] else . end) | join(" ");
    def codex_category:
      if . == "development" then "Development" else . end;

    ($plugin.name | title_words) as $displayName |
    ($plugin.interface // {}) as $interface |
    ($plugin.author // $defaults.author) as $author |
    ($plugin.homepage // $defaults.homepage) as $homepage |
    ($interface.displayName // $interface.display_name // $displayName) as $finalDisplayName |
    ($interface.shortDescription // $interface.short_description // $plugin.description) as $shortDescription |
    ($interface.longDescription // $interface.long_description // $plugin.description) as $longDescription |
    ($interface.defaultPrompt // $interface.default_prompt // ("Help me use " + $finalDisplayName + ".")) as $defaultPrompt |
    {
      name: $plugin.name,
      description: ($plugin.description // ""),
      version: ($plugin.version // $defaults.version),
      author: $author,
      homepage: $homepage,
      repository: ($plugin.repository // $defaults.repository),
      license: ($plugin.license // $defaults.license),
      keywords: ($plugin.keywords // []),
      skills: "./skills/",
      interface: {
        displayName: $finalDisplayName,
        shortDescription: $shortDescription,
        longDescription: $longDescription,
        developerName: ($interface.developerName // $interface.developer_name // $author.name // $defaults.author.name),
        category: (($interface.category // $plugin.category // "Development") | codex_category),
        capabilities: ($interface.capabilities // ["Skills"]),
        websiteURL: $homepage,
        defaultPrompt: $defaultPrompt,
        brandColor: ($interface.brandColor // $interface.brand_color // "")
      }
    } | with_entries(select(.value != "" and .value != []))
      | .interface |= with_entries(select(.value != "" and .value != []))
    ' \
    > "$plugin_dir/.codex-plugin/plugin.json"
}

append_claude_marketplace_entry() {
  local plugin_name="$1"
  local plugin_dir="$2"
  local manifest="$plugin_dir/.claude-plugin/plugin.json"

  jq -n \
    --arg source "./$PLUGINS_DIR/$plugin_name" \
    --argjson manifest "$(jq -c . "$manifest")" \
    '{
      name: $manifest.name,
      version: $manifest.version,
      description: $manifest.description,
      author: $manifest.author,
      homepage: $manifest.homepage,
      repository: $manifest.repository,
      license: $manifest.license,
      keywords: ($manifest.keywords // []),
      source: $source,
      category: ($manifest.category // "development")
    } | with_entries(select(.value != "" and .value != []))' \
    >> "$CLAUDE_MARKETPLACE_ENTRIES_FILE"
}

append_codex_marketplace_entry() {
  local plugin_name="$1"
  local plugin_dir="$2"
  local metadata_file="${3:-}"
  local index="${4:-}"
  local manifest="$plugin_dir/.codex-plugin/plugin.json"

  if [ -n "$metadata_file" ]; then
    jq -n \
      --arg name "$plugin_name" \
      --arg path "./$PLUGINS_DIR/$plugin_name" \
      --argjson plugin "$(jq -c ".plugins[$index]" "$metadata_file")" \
      'def codex_category:
        if . == "development" then "Development" else . end;
      {
        name: $name,
        source: {
          source: "local",
          path: $path
        },
        policy: {
          installation: ($plugin.policy.installation // "AVAILABLE"),
          authentication: ($plugin.policy.authentication // "ON_INSTALL")
        },
        category: (($plugin.interface.category // $plugin.category // "Development") | codex_category)
      }' \
      >> "$CODEX_MARKETPLACE_ENTRIES_FILE"
  else
    jq -n \
      --arg name "$plugin_name" \
      --arg path "./$PLUGINS_DIR/$plugin_name" \
      --argjson manifest "$(jq -c . "$manifest")" \
      'def codex_category:
        if . == "development" then "Development" else . end;
      {
        name: $name,
        source: {
          source: "local",
          path: $path
        },
        policy: {
          installation: "AVAILABLE",
          authentication: "ON_INSTALL"
        },
        category: (($manifest.interface.category // "Development") | codex_category)
      }' \
      >> "$CODEX_MARKETPLACE_ENTRIES_FILE"
  fi
}

remove_previous_generated_plugins() {
  local plugin_name

  [ -f "$GENERATED_PLUGINS_FILE" ] || return 0
  while IFS= read -r plugin_name; do
    [ -n "$plugin_name" ] || continue
    validate_name "$plugin_name"
    rm -rf "$PLUGINS_DIR/$plugin_name"
  done < <(jq -r '.plugins[]?.name' "$GENERATED_PLUGINS_FILE")
}

is_generated_plugin() {
  local plugin_name="$1"
  grep -Fxq "$plugin_name" "$GENERATED_PLUGIN_NAMES_FILE"
}

mkdir -p "$PLUGINS_DIR" "$(dirname "$CLAUDE_MARKETPLACE_FILE")" "$(dirname "$CODEX_MARKETPLACE_FILE")"
remove_previous_generated_plugins

for source_dir in "$SOURCES_DIR"/*/; do
  [ -d "$source_dir" ] || continue
  source_name=$(basename "$source_dir")
  validate_name "$source_name"
  metadata_file="$source_dir/plugins.json"
  [ -f "$metadata_file" ] || { echo "Error: $metadata_file not found" >&2; exit 1; }

  plugin_count=$(jq -er '.plugins | if type == "array" then length else error("plugins must be an array") end' "$metadata_file")
  for ((i = 0; i < plugin_count; i++)); do
    plugin_name=$(jq -r ".plugins[$i].name" "$metadata_file")
    plugin_description=$(jq -r ".plugins[$i].description // empty" "$metadata_file")
    validate_name "$plugin_name"
    [ -n "$plugin_description" ] || { echo "Error: Missing description for $plugin_name" >&2; exit 1; }

    plugin_dir="$PLUGINS_DIR/$plugin_name"
    skill_list_file="$TMP_DIR/$plugin_name-skills.txt"
    collect_plugin_skills "$source_dir" "$metadata_file" "$i" "$skill_list_file"
    [ -s "$skill_list_file" ] || { echo "Error: Plugin $plugin_name has no skills" >&2; exit 1; }

    rm -rf "$plugin_dir"
    mkdir -p "$plugin_dir/.claude-plugin" "$plugin_dir/.codex-plugin" "$plugin_dir/skills"
    write_claude_plugin_manifest "$metadata_file" "$i" "$plugin_dir"
    write_codex_plugin_manifest "$metadata_file" "$i" "$plugin_dir"

    while IFS= read -r skill_name; do
      [ -n "$skill_name" ] || continue
      validate_name "$skill_name"
      [ -d "$source_dir/skills/$skill_name" ] || { echo "Error: Skill not found in $source_name: $skill_name" >&2; exit 1; }
      echo "Adding $skill_name to $plugin_name"
      rsync -a --delete "$source_dir/skills/$skill_name/" "$plugin_dir/skills/$skill_name/"
    done < "$skill_list_file"

    append_claude_marketplace_entry "$plugin_name" "$plugin_dir"
    append_codex_marketplace_entry "$plugin_name" "$plugin_dir" "$metadata_file" "$i"
    printf '%s\n' "$plugin_name" >> "$GENERATED_PLUGIN_NAMES_FILE"
    jq -n \
      --arg name "$plugin_name" \
      --arg source "$source_name" \
      --argjson skills "$(jq -R -s 'split("\n") | map(select(length > 0))' "$skill_list_file")" \
      '{name: $name, source: $source, skills: $skills}' \
      >> "$GENERATED_PLUGIN_ENTRIES_FILE"
  done
done

sort -u "$GENERATED_PLUGIN_NAMES_FILE" -o "$GENERATED_PLUGIN_NAMES_FILE"
jq -s \
  '{generated_by: "scripts/generate-plugins.sh", plugins: sort_by(.name)}' \
  "$GENERATED_PLUGIN_ENTRIES_FILE" > "$GENERATED_PLUGINS_FILE"

for plugin_dir in "$PLUGINS_DIR"/*/; do
  [ -d "$plugin_dir" ] || continue
  plugin_name=$(basename "$plugin_dir")
  validate_name "$plugin_name"
  is_generated_plugin "$plugin_name" && continue
  [ -f "$plugin_dir/.claude-plugin/plugin.json" ] || { echo "Error: Local plugin $plugin_name missing .claude-plugin/plugin.json" >&2; exit 1; }
  [ -f "$plugin_dir/.codex-plugin/plugin.json" ] || { echo "Error: Local plugin $plugin_name missing .codex-plugin/plugin.json" >&2; exit 1; }
  append_claude_marketplace_entry "$plugin_name" "$plugin_dir"
  append_codex_marketplace_entry "$plugin_name" "$plugin_dir"
done

jq -n \
  --arg schema "https://json.schemastore.org/claude-code-marketplace.json" \
  --argjson defaults "$(cat "$DEFAULTS_FILE")" \
  --slurpfile plugins "$CLAUDE_MARKETPLACE_ENTRIES_FILE" \
  '{
    "$schema": $schema,
    name: $defaults.marketplaceName,
    version: $defaults.version,
    description: $defaults.description,
    owner: $defaults.author,
    plugins: ($plugins | sort_by(.name))
  } | with_entries(select(.value != ""))' \
  > "$CLAUDE_MARKETPLACE_FILE"

jq -n \
  --argjson defaults "$(cat "$DEFAULTS_FILE")" \
  --slurpfile plugins "$CODEX_MARKETPLACE_ENTRIES_FILE" \
  '{
    name: $defaults.marketplaceName,
    interface: {
      displayName: $defaults.marketplaceDisplayName
    },
    plugins: ($plugins | sort_by(.name))
  }' \
  > "$CODEX_MARKETPLACE_FILE"

echo "Generated $(wc -l < "$GENERATED_PLUGIN_NAMES_FILE" | tr -d ' ') source plugins"
