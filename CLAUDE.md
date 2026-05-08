# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is an **aggregation repository** that collects Claude Code skills from multiple Ahoo-Wang open source projects into a single location. Skills are automatically synced from source repositories via GitHub Actions.

## Architecture

**Source repos** are listed in `repos.json`. The GitHub Actions workflow (`.github/workflows/sync-skills.yml`) runs every 6 hours, shallow-clones each source repo, and rsync's its `skills/` directory into this repo's `skills/` directory.

To add a new source repo, add an entry to `repos.json`:
```json
{ "url": "https://github.com/Ahoo-Wang/<repo>.git", "branch": "main", "skills_path": "skills" }
```

Skills can also be added directly to this repo (not synced) — the workflow only overwrites skills that exist in source repos.

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
compatibility: <comma-separated list of technologies>
---
```

## Working with Skills

- **Creating a new skill**: Follow the structure above — SKILL.md with YAML frontmatter, optional references/ and evals/
- **Adding a source repo**: Edit `repos.json`, the next sync will pick it up
- **No build/test commands**: This repository only contains documentation and skill definitions — no build system or tests to run
