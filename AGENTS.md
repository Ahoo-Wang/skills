# AGENTS.md

This file is the canonical agent guide for this repository. Claude Code should
also follow this file; `CLAUDE.md` only contains Claude-specific entry notes.

## Repository Role

This repository is a marketplace and distribution repository for Ahoo-Wang
skills. It aggregates skill sources from upstream projects, generates split
plugins, and publishes marketplace metadata for Codex and Claude Code.

Keep the responsibility boundary sharp:
- Upstream repositories own skills and plugin source metadata.
- Upstream plugin source metadata lives at `skills/plugins.json`.
- This repository mirrors upstream content into `sources/<source>/`.
- This repository generates source-owned distribution plugins under `plugins/`.
- Marketplace-local plugins are allowed, but they must live directly under
  `plugins/<plugin-name>/`.
- Do not reintroduce a top-level `skills/` distribution directory.

## Installation

Codex marketplace:

```bash
codex plugin marketplace add Ahoo-Wang/skills --ref main
codex plugin add ahoo-wow-skills@ahoo-skills
```

Claude Code marketplace:

```bash
/plugin marketplace add https://github.com/Ahoo-Wang/skills
/plugin install ahoo-wow-skills
```

Install the split plugin you need, such as `ahoo-wow-skills`,
`ahoo-fetcher-skills`, `ahoo-cosec-skills`, or `ahoo-agent-skills`.

## Directory Layout

```text
.
├── repos.json                         # Source repository list
├── sources/<source>/                  # Mirrored upstream source content
│   ├── plugins.json                   # Upstream-owned plugin metadata
│   └── skills/<skill-name>/           # Mirrored upstream skills
├── plugins/<plugin-name>/             # Distributed plugin packages
│   ├── .codex-plugin/plugin.json
│   ├── .claude-plugin/plugin.json
│   └── skills/<skill-name>/
├── .agents/plugins/marketplace.json   # Codex marketplace manifest
├── .claude-plugin/marketplace.json    # Claude Code marketplace manifest
├── .sync-sources.json                 # Sync snapshot
├── schemas/                           # Local metadata schemas
└── scripts/                           # Sync, generation, and validation
```

## Source Sync

Source repositories are listed in `repos.json`:

```json
{ "name": "<repo>", "url": "https://github.com/Ahoo-Wang/<repo>.git", "branch": "main", "skills_path": "skills" }
```

`scripts/sync-sources.sh` shallow-clones each source repo and mirrors
`<skills_path>/skills/` plus `<skills_path>/plugins.json` into
`sources/<source>/`. The GitHub Actions workflow
`.github/workflows/sync-skills.yml` runs this sync every 6 hours at 02:17,
08:17, 14:17, and 20:17 UTC. To ship an upstream change sooner, trigger it
manually:

```bash
gh workflow run sync-skills.yml --repo Ahoo-Wang/skills
```

Upstream repos do not notify this repository: a cross-repository trigger needs
a credential for this repo stored in every upstream, which is not worth it for
skill content that tolerates a few hours of delay.

Only one sync runs at a time (`concurrency: sync-skills`); if `main` moves
during a sync, the workflow rebases once before pushing.

Sync rules:
- Workspace skills ending in `-workspace` are skipped.
- Duplicate skill names across source repos fail the sync.
- `.sync-sources.json` records mirrored source repos, paths, and commits.
- A sync reports changes only when mirrored content or source configuration
  changes. When upstream commits move without changing mirrored content, the
  previous `.sync-sources.json` is kept and nothing is committed, because every
  commit to this repository is a new plugin version for users.
- Removed upstream skills are removed from generated distribution output on the
  next sync.

## Plugin Generation

`scripts/generate-plugins.sh` reads each `sources/<source>/plugins.json` and
regenerates source-owned plugins under `plugins/<plugin-name>/`.

Generation rules:
- Generated plugins are tracked in `plugins/.generated-plugins.json`.
- Each plugin name has exactly one owner. Generation fails before deleting
  anything when two sources declare the same plugin name, or when a source
  plugin name clashes with a marketplace-local plugin.
- Source-owned plugin directories may be deleted and rebuilt during generation.
- Marketplace-local plugin directories under `plugins/` are preserved.
- Do not manually edit generated plugin copies to fix upstream skill content;
  update the upstream repo and rerun sync.
- Local plugins must provide both `.codex-plugin/plugin.json` and
  `.claude-plugin/plugin.json`.

## Marketplace Metadata

This repository publishes two marketplace manifests:
- Codex: `.agents/plugins/marketplace.json`
- Claude Code: `.claude-plugin/marketplace.json`

Each split plugin also publishes both manifests:
- `plugins/<plugin-name>/.codex-plugin/plugin.json`
- `plugins/<plugin-name>/.claude-plugin/plugin.json`

Codex manifests must keep `skills` set to `./skills/` and include the Codex
`interface` metadata expected by the plugin validator.

## Versioning

No version in this repository is maintained by hand. Each plugin has one
content-derived version, shared by both of its manifests:

- `plugins/<plugin>/.claude-plugin/plugin.json` and
  `plugins/<plugin>/.codex-plugin/plugin.json` carry the same `version`:
  `1.0.0+<12-hex SHA-256 of the plugin's files>`, with both manifests hashed
  without their own `version`. `generate-plugins.sh` stamps it for generated
  and local plugins alike (`scripts/lib/plugin-version.sh`).
- The version changes exactly when that plugin's files change. Claude Code and
  Codex both reinstall only when the version changes, so users get an update
  for real content changes and never for commits that touch other plugins or
  repository docs. Because it is recomputed on every generation, it never pins
  users to stale content the way a hand-written version would.
- The fixed `1.0.0` core keeps the value semver-valid and above legacy `0.x`
  Codex cache entries.
- `.claude-plugin/marketplace.json` (top level and plugin entries) must omit
  `version`; Claude Code reads the plugin manifest first, and declaring it in
  both places is reported as a mismatch.
- Upstream `plugins.json` `version` fields are ignored.
- `package.json` is `private` and has no `version`; it is not published.

`validate-skills.sh` fails when the Claude marketplace declares a version, or
when either manifest's `version` differs from the content-derived value; rerun
`npm run generate:plugins` to fix it.

## Skill Structure

Each mirrored or distributed skill uses this shape:

```text
<skill-name>/
├── SKILL.md
├── agents/        # optional runtime-specific metadata
├── references/    # optional detailed documentation
└── evals/         # optional evaluation data
```

`SKILL.md` must start with YAML frontmatter:

```yaml
---
name: <skill-name>
description: |
  When to invoke this skill and what it covers
compatibility: <comma-separated list of technologies>  # optional
---
```

## Common Workflows

Add or change an upstream skill:
- Update the upstream repository's `skills/` content.
- Update the upstream repository's `skills/plugins.json`.
- In this repository, run `npm run sync`.

Add a new upstream source repo:
- Add the source to `repos.json`.
- Ensure the upstream repo has `skills/plugins.json`.
- Run `npm run sync`.

Add a marketplace-local plugin:
- Create the complete plugin under `plugins/<plugin-name>/`.
- Include both Codex and Claude plugin manifests.
- Run `npm run generate:plugins` so marketplace manifests include it.

Resolve sync-generated conflicts:
- Treat `sources/`, generated `plugins/`, and marketplace JSON as generated
  distribution state.
- Prefer rerunning `npm run sync` from current upstreams instead of manually
  merging stale generated files.

## Validation

Before pushing repository changes, run:

```bash
npm test
git diff --check
```

`npm test` exercises sync behavior, plugin generation, and marketplace
consistency. For plugin metadata changes, also run the Codex plugin validator
when available.

Pull requests are checked by `.github/workflows/ci.yml`, which runs the same
test suite and whitespace check. The scheduled sync workflow remains separate
in `.github/workflows/sync-skills.yml` and is responsible only for refreshing
mirrored source content and generated distribution files.
