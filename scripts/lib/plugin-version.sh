# shellcheck shell=bash
# Content-derived plugin versions, shared by the Claude and Codex manifests.
#
# Both Claude Code and Codex decide whether to reinstall a plugin by comparing
# versions, so a static version keeps users on stale content. The version is
# derived from the plugin's distributed files instead of being maintained by hand:
#
#   1.0.0+<first 12 hex chars of a SHA-256 over the plugin contents>
#
# It changes exactly when that plugin's files change, so a commit that touches
# other plugins or repository docs is not an update for this plugin. The fixed
# 1.0.0 core keeps the version semver-valid and orders it above the legacy 0.x
# versions that existing Codex caches may still hold. Both manifests are hashed
# without their own `version` field so the value is stable.

PLUGIN_VERSION_PREFIX="1.0.0+"

sha256_stdin() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum | cut -d' ' -f1
  else
    shasum -a 256 | cut -d' ' -f1
  fi
}

plugin_content_hash() {
  local plugin_dir="$1"
  local path

  (
    cd "$plugin_dir"
    find . \( -type f -o -type l \) ! -name '.DS_Store' -print0 | LC_ALL=C sort -z |
      while IFS= read -r -d '' path; do
        printf '%s\0' "$path"
        if [ -L "$path" ]; then
          printf 'link:%s' "$(readlink "$path")" | sha256_stdin
        elif [ "$path" = "./.codex-plugin/plugin.json" ] || [ "$path" = "./.claude-plugin/plugin.json" ]; then
          jq -S 'del(.version)' "$path" | sha256_stdin
        else
          sha256_stdin < "$path"
        fi
      done
  ) | sha256_stdin | cut -c1-12
}

plugin_content_version() {
  printf '%s%s\n' "$PLUGIN_VERSION_PREFIX" "$(plugin_content_hash "$1")"
}

# Writes `version` as the third key of a manifest (after name and description).
write_manifest_version() {
  local manifest="$1"
  local version="$2"
  local tmp

  tmp="$(mktemp)"
  jq --arg version "$version" \
    'to_entries
      | map(select(.key != "version"))
      | (.[0:2] + [{key: "version", value: $version}] + .[2:])
      | from_entries' \
    "$manifest" > "$tmp"
  cat "$tmp" > "$manifest"
  rm -f "$tmp"
}

# Stamps the content-derived version into both manifests of a plugin.
stamp_plugin_versions() {
  local plugin_dir="$1"
  local version

  version="$(plugin_content_version "$plugin_dir")"
  write_manifest_version "$plugin_dir/.claude-plugin/plugin.json" "$version"
  write_manifest_version "$plugin_dir/.codex-plugin/plugin.json" "$version"
}
