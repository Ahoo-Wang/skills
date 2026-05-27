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
`sources/<source>/`. The GitHub Actions workflow runs this sync every 6 hours
at 02:00, 08:00, 14:00, and 20:00 UTC.

Sync rules:
- Workspace skills ending in `-workspace` are skipped.
- Duplicate skill names across source repos fail the sync.
- `.sync-sources.json` records mirrored repos, skills, commits, and plugin
  metadata.
- Removed upstream skills are removed from generated distribution output on the
  next sync.

## Plugin Generation

`scripts/generate-plugins.sh` reads each `sources/<source>/plugins.json` and
regenerates source-owned plugins under `plugins/<plugin-name>/`.

Generation rules:
- Generated plugins are tracked in `plugins/.generated-plugins.json`.
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
