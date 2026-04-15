# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a **skills repository** containing Claude Code skills for specific domains. Each skill is a self-contained module with documentation, references, and evaluation criteria.

## Skill Structure

Each skill lives in `skills/<skill-name>/` with this layout:

```
skills/<skill-name>/
├── SKILL.md          # Main skill file (YAML frontmatter + markdown content)
├── references/        # Detailed reference documentation
│   └── *.md
└── evals/            # Evaluation criteria for skill validation
    └── evals.json
```

### Skill Frontmatter

Each SKILL.md begins with YAML frontmatter defining:

```yaml
---
name: <skill-name>
description: |
  When to invoke this skill and what it covers
compatibility: <comma-separated list of technologies>
---
```

## Skills Available

### `wow`
DDD + Event Sourcing + CQRS microservices framework for Kotlin/Spring Boot.

Key modules: `wow-api`, `wow-core`, `wow-mongo`, `wow-kafka`, `wow-query`, `wow-test`

Key concepts: Aggregate Roots, Command/Event sourcing, Sagas, Projections, Command Gateway

Reference files: `annotations.md`, `command-gateway.md`, `dsl.md`, `modeling.md`, `prepare-key.md`, `testing.md`

### `fluent-assert`
Kotlin assertion library wrapping AssertJ with Kotlin idioms.

Import: `me.ahoo.test.asserts.assert`

Pattern: `value.assert().assertionMethod()` instead of AssertJ's `assertThat(value).isEqualTo(expected)`

## Working with Skills

- **Creating a new skill**: Follow the structure above - SKILL.md with YAML frontmatter, references/, evals/
- **Evaluating skills**: Skills have `evals.json` containing evaluation criteria
- **No build/test commands**: This repository only contains documentation and skill definitions - no build system or tests to run
