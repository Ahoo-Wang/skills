# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is an **aggregation repository** (npm package: `ahoo-skills`) that collects Claude Code skills from multiple Ahoo-Wang open source projects into a single location. Skills are automatically synced from source repositories via GitHub Actions.

## Installation

This repository is a valid [Claude Code plugin](https://code.claude.com/docs/en/plugins). The plugin manifest lives at `.claude-plugin/plugin.json` and defines the `ahoo-skills` namespace.

```bash
/plugin marketplace add https://github.com/Ahoo-Wang/skills
/plugin install ahoo-skills
```

Skills are namespaced under the plugin name (e.g., `/ahoo-skills:wow`, `/ahoo-skills:simba`).

## Architecture

**Source repos** are listed in `repos.json`. The GitHub Actions workflow (`.github/workflows/sync-skills.yml`) runs every 6 hours (02:00, 08:00, 14:00, 20:00 UTC) via `scripts/sync-skills.sh`, which shallow-clones each source repo and rsync's its `skills/` directory into `skills/`.

To add a new source repo, add an entry to `repos.json`:
```json
{ "url": "https://github.com/Ahoo-Wang/<repo>.git", "branch": "main", "skills_path": "skills" }
```

Sync behavior:
- Skills can also be added directly to this repo (not synced) — the workflow only overwrites skills that exist in source repos
- Workspace skills (directories ending in `-workspace`) are skipped during sync and existing ones are cleaned up
- Duplicate skill names across repos produce a warning; the last repo wins

## Skill Structure

Each skill lives in `skills/<skill-name>/`:

```
skills/<skill-name>/
├── SKILL.md          # Main skill file (YAML frontmatter + markdown)
├── references/       # Detailed reference documentation (optional)
│   └── *.md
└── evals/            # Evaluation criteria (optional)
    └── evals.json
```

### SKILL.md Frontmatter

```yaml
---
name: <skill-name>
description: |
  When to invoke this skill and what it covers
compatibility: <comma-separated list of technologies>  # optional
---
```

## Working with Skills

- **Creating a new skill**: Follow the structure above — SKILL.md with YAML frontmatter, optional references/ and evals/
- **Adding a source repo**: Edit `repos.json`, the next sync will pick it up
- **Sync does not touch `.claude-plugin/`**: The sync script only operates on `skills/`, so the plugin manifest is maintained separately
- **No build/test commands**: This repository only contains documentation and skill definitions — no build system or tests to run
