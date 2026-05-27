# Ahoo Skills

<p align="center">
  <a href="https://skills.ahoo.me/">
    <img src="./docs/assets/logo/skills-logo-primary.svg" width="280" alt="Ahoo-Wang's skills logo">
  </a>
</p>

<p align="center">
  <a href="https://skills.ahoo.me/">GitHub Pages</a> ·
  <a href="./.agents/plugins/marketplace.json">Codex Marketplace</a> ·
  <a href="./.claude-plugin/marketplace.json">Claude Code Marketplace</a>
</p>

A central aggregation repository for [Agent Skills](https://agentskills.io/) from [Ahoo-Wang](https://github.com/Ahoo-Wang)'s open source projects.

Skills are automatically synced from source repositories **every 6 hours** via GitHub Actions and published as split plugins by source project.

## Available Plugins

| Plugin | Skills |
|--------|--------|
| `ahoo-wow-skills` | Wow, review, debugging, and development workflow skills |
| `ahoo-coapi-skills` | CoApi Spring HTTP client skill |
| `ahoo-cosec-skills` | CoSec integration, policy, matcher, and troubleshooting skills |
| `ahoo-cosid-skills` | CosId ID generation and sharding skills |
| `ahoo-fluent-assert-skills` | FluentAssert Kotlin assertion skill |
| `ahoo-fetcher-skills` | Fetcher client, decorator, React, OpenAPI, storage, event bus, and streaming skills |
| `ahoo-cocache-skills` | CoCache distributed cache skill |
| `ahoo-simba-skills` | Simba mutex, leader election, and testing skills |
| `ahoo-agent-skills` | General agent prompt skills maintained directly here |

## Source Repositories & Skills

| Repository | Skills |
|------------|--------|
| [Wow](https://github.com/Ahoo-Wang/Wow) | [`wow`](./sources/Wow/skills/wow/SKILL.md), [`wow-code-review`](./sources/Wow/skills/wow-code-review/SKILL.md), [`wow-debugging`](./sources/Wow/skills/wow-debugging/SKILL.md), [`wow-development-workflow`](./sources/Wow/skills/wow-development-workflow/SKILL.md) |
| [CoApi](https://github.com/Ahoo-Wang/CoApi) | [`coapi-developer`](./sources/CoApi/skills/coapi-developer/SKILL.md) |
| [CoSec](https://github.com/Ahoo-Wang/CoSec) | [`cosec-custom-matcher`](./sources/CoSec/skills/cosec-custom-matcher/SKILL.md), [`cosec-integration`](./sources/CoSec/skills/cosec-integration/SKILL.md), [`cosec-policy-author`](./sources/CoSec/skills/cosec-policy-author/SKILL.md), [`cosec-troubleshoot`](./sources/CoSec/skills/cosec-troubleshoot/SKILL.md) |
| [CosId](https://github.com/Ahoo-Wang/CosId) | [`cosid-manual-integration`](./sources/CosId/skills/cosid-manual-integration/SKILL.md), [`cosid-sharding`](./sources/CosId/skills/cosid-sharding/SKILL.md), [`cosid-spring-boot`](./sources/CosId/skills/cosid-spring-boot/SKILL.md), [`cosid-strategy-guide`](./sources/CosId/skills/cosid-strategy-guide/SKILL.md) |
| [FluentAssert](https://github.com/Ahoo-Wang/FluentAssert) | [`fluent-assert`](./sources/FluentAssert/skills/fluent-assert/SKILL.md) |
| [Fetcher](https://github.com/Ahoo-Wang/fetcher) | [`fetcher-cosec-auth`](./sources/fetcher/skills/fetcher-cosec-auth/SKILL.md), [`fetcher-decorator-service`](./sources/fetcher/skills/fetcher-decorator-service/SKILL.md), [`fetcher-eventbus`](./sources/fetcher/skills/fetcher-eventbus/SKILL.md), [`fetcher-integration`](./sources/fetcher/skills/fetcher-integration/SKILL.md), [`fetcher-llm-streaming`](./sources/fetcher/skills/fetcher-llm-streaming/SKILL.md), [`fetcher-openai-client`](./sources/fetcher/skills/fetcher-openai-client/SKILL.md), [`fetcher-openapi-generator`](./sources/fetcher/skills/fetcher-openapi-generator/SKILL.md), [`fetcher-openapi-types`](./sources/fetcher/skills/fetcher-openapi-types/SKILL.md), [`fetcher-react-hooks`](./sources/fetcher/skills/fetcher-react-hooks/SKILL.md), [`fetcher-storage`](./sources/fetcher/skills/fetcher-storage/SKILL.md), [`fetcher-viewer-components`](./sources/fetcher/skills/fetcher-viewer-components/SKILL.md), [`fetcher-wow-cqrs`](./sources/fetcher/skills/fetcher-wow-cqrs/SKILL.md) |
| [CoCache](https://github.com/Ahoo-Wang/CoCache) | [`cocache`](./sources/CoCache/skills/cocache/SKILL.md) |
| [Simba](https://github.com/Ahoo-Wang/Simba) | [`simba`](./sources/Simba/skills/simba/SKILL.md), [`simba-testing`](./sources/Simba/skills/simba-testing/SKILL.md) |
| Local plugin | [`agent-system-prompt`](./plugins/ahoo-agent-skills/skills/agent-system-prompt/SKILL.md) |

## Installation

### Install in Claude Code

```bash
/plugin marketplace add https://github.com/Ahoo-Wang/skills
/plugin install ahoo-wow-skills
```

### Install in Codex

```bash
codex plugin marketplace add Ahoo-Wang/skills --ref main
codex plugin add ahoo-wow-skills@ahoo-skills
```

Install the specific split plugin you need from the table above.

## How It Works

- `repos.json` — source repository configuration
- `schemas/` — JSON schemas for `repos.json` and upstream `skills/plugins.json`
- `sources/<source>/plugins.json` — source-owned split plugin metadata mirrored from upstream `skills/plugins.json`
- `.claude-plugin/marketplace.json` — generated Claude Code marketplace
- `.agents/plugins/marketplace.json` — generated Codex marketplace
- `.github/workflows/sync-skills.yml` — sync workflow (runs every 6 hours)
- Each source repo is shallow-cloned and mirrored into `sources/<source>/`
- `.sync-sources.json` tracks synced source repositories, paths, and commits
- `scripts/generate-plugins.sh` rebuilds source-owned `plugins/<plugin-name>/` from `sources/` and keeps local plugins in `plugins/`
- `scripts/validate-skills.sh` checks source mirrors, generated plugin copies, local plugins, and marketplace consistency
- `.github/workflows/ci.yml` validates pull requests with `npm test` and `git diff --check`

To add a new source repo, edit `repos.json` and push.

## Skill Structure

```
sources/<source>/
├── plugins.json      # Upstream-owned plugin source metadata
└── skills/
    └── <skill-name>/
        ├── SKILL.md
        ├── references/   # optional
        └── evals/        # optional

plugins/<plugin-name>/
├── .codex-plugin/plugin.json
├── .claude-plugin/plugin.json
└── skills/
    └── <skill-name>/
```

## License

[Apache License 2.0](./LICENSE)
