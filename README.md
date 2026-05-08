# Ahoo Skills

![Logo](./logo.jpg)

A central aggregation repository for Claude Code skills from [Ahoo-Wang](https://github.com/Ahoo-Wang)'s open source projects. Skills are automatically synced from source repositories every 6 hours via GitHub Actions.

## Source Repositories

| Repository | Skills |
|------------|--------|
| [Wow](https://github.com/Ahoo-Wang/Wow) | `wow` |
| [CoApi](https://github.com/Ahoo-Wang/CoApi) | `coapi-developer` |
| [CoSec](https://github.com/Ahoo-Wang/CoSec) | `cosec-custom-matcher`, `cosec-integration`, `cosec-policy-author`, `cosec-troubleshoot` |
| [CosId](https://github.com/Ahoo-Wang/CosId) | `cosid-manual-integration`, `cosid-sharding`, `cosid-spring-boot`, `cosid-strategy-guide` |
| [FluentAssert](https://github.com/Ahoo-Wang/FluentAssert) | `fluent-assert` |
| [Fetcher](https://github.com/Ahoo-Wang/fetcher) | *(synced automatically)* |

## Installation

In Claude Code:

```bash
/plugin install ahoo-skills@github
```

## How It Works

- `repos.json` — lists source repositories to sync from
- `.github/workflows/sync-skills.yml` — GitHub Actions workflow that runs every 6 hours
- Skills are shallow-cloned from each source repo and rsync'd into `skills/`

To add a new source repo, edit `repos.json` and push — the next sync will pick it up.

## Skill Structure

Each skill lives in `skills/<skill-name>/`:

```
skills/<skill-name>/
├── SKILL.md          # Main skill file (YAML frontmatter + markdown content)
├── references/       # Detailed reference documentation
│   └── *.md
└── evals/            # Evaluation criteria for skill validation
    └── evals.json
```

## License

Apache License 2.0
