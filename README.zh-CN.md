# Ahoo Skills

<p align="center"><img src="./logo.jpg" width="200" alt="Logo"></p>

[Ahoo-Wang](https://github.com/Ahoo-Wang) 开源项目的 [Agent Skills](https://agentskills.io/) 聚合仓库。

Skills 通过 GitHub Actions **每 6 小时**自动从源仓库同步，并按源项目发布为拆分插件。

## 可用插件

| 插件 | Skills |
|------|--------|
| `ahoo-wow-skills` | Wow、代码审查、调试、开发流程相关 skills |
| `ahoo-coapi-skills` | CoApi Spring HTTP client skill |
| `ahoo-cosec-skills` | CoSec 集成、策略、匹配器、排障 skills |
| `ahoo-cosid-skills` | CosId ID 生成与分片 skills |
| `ahoo-fluent-assert-skills` | FluentAssert Kotlin 断言 skill |
| `ahoo-fetcher-skills` | Fetcher client、decorator、React、OpenAPI、storage、event bus、streaming skills |
| `ahoo-cocache-skills` | CoCache 分布式缓存 skill |
| `ahoo-simba-skills` | Simba 分布式锁、leader election、测试 skills |
| `ahoo-agent-skills` | 本仓库直接维护的通用 agent prompt skills |

## 源仓库与 Skills

| 仓库 | Skills |
|------|--------|
| [Wow](https://github.com/Ahoo-Wang/Wow) | [`wow`](./sources/Wow/skills/wow/SKILL.md)、[`wow-code-review`](./sources/Wow/skills/wow-code-review/SKILL.md)、[`wow-debugging`](./sources/Wow/skills/wow-debugging/SKILL.md)、[`wow-development-workflow`](./sources/Wow/skills/wow-development-workflow/SKILL.md) |
| [CoApi](https://github.com/Ahoo-Wang/CoApi) | [`coapi-developer`](./sources/CoApi/skills/coapi-developer/SKILL.md) |
| [CoSec](https://github.com/Ahoo-Wang/CoSec) | [`cosec-custom-matcher`](./sources/CoSec/skills/cosec-custom-matcher/SKILL.md)、[`cosec-integration`](./sources/CoSec/skills/cosec-integration/SKILL.md)、[`cosec-policy-author`](./sources/CoSec/skills/cosec-policy-author/SKILL.md)、[`cosec-troubleshoot`](./sources/CoSec/skills/cosec-troubleshoot/SKILL.md) |
| [CosId](https://github.com/Ahoo-Wang/CosId) | [`cosid-manual-integration`](./sources/CosId/skills/cosid-manual-integration/SKILL.md)、[`cosid-sharding`](./sources/CosId/skills/cosid-sharding/SKILL.md)、[`cosid-spring-boot`](./sources/CosId/skills/cosid-spring-boot/SKILL.md)、[`cosid-strategy-guide`](./sources/CosId/skills/cosid-strategy-guide/SKILL.md) |
| [FluentAssert](https://github.com/Ahoo-Wang/FluentAssert) | [`fluent-assert`](./sources/FluentAssert/skills/fluent-assert/SKILL.md) |
| [Fetcher](https://github.com/Ahoo-Wang/fetcher) | [`fetcher-cosec-auth`](./sources/fetcher/skills/fetcher-cosec-auth/SKILL.md)、[`fetcher-decorator-service`](./sources/fetcher/skills/fetcher-decorator-service/SKILL.md)、[`fetcher-eventbus`](./sources/fetcher/skills/fetcher-eventbus/SKILL.md)、[`fetcher-integration`](./sources/fetcher/skills/fetcher-integration/SKILL.md)、[`fetcher-llm-streaming`](./sources/fetcher/skills/fetcher-llm-streaming/SKILL.md)、[`fetcher-openai-client`](./sources/fetcher/skills/fetcher-openai-client/SKILL.md)、[`fetcher-openapi-generator`](./sources/fetcher/skills/fetcher-openapi-generator/SKILL.md)、[`fetcher-openapi-types`](./sources/fetcher/skills/fetcher-openapi-types/SKILL.md)、[`fetcher-react-hooks`](./sources/fetcher/skills/fetcher-react-hooks/SKILL.md)、[`fetcher-storage`](./sources/fetcher/skills/fetcher-storage/SKILL.md)、[`fetcher-viewer-components`](./sources/fetcher/skills/fetcher-viewer-components/SKILL.md)、[`fetcher-wow-cqrs`](./sources/fetcher/skills/fetcher-wow-cqrs/SKILL.md) |
| [CoCache](https://github.com/Ahoo-Wang/CoCache) | [`cocache`](./sources/CoCache/skills/cocache/SKILL.md) |
| [Simba](https://github.com/Ahoo-Wang/Simba) | [`simba`](./sources/Simba/skills/simba/SKILL.md)、[`simba-testing`](./sources/Simba/skills/simba-testing/SKILL.md) |
| 本地插件 | [`agent-system-prompt`](./plugins/ahoo-agent-skills/skills/agent-system-prompt/SKILL.md) |

## 安装

### 在 Claude Code 中安装

```bash
/plugin marketplace add https://github.com/Ahoo-Wang/skills
/plugin install ahoo-wow-skills
```

### 在 Codex 中安装

```bash
codex plugin marketplace add Ahoo-Wang/skills --ref main
codex plugin add ahoo-wow-skills@ahoo-skills
```

按上表安装需要的拆分插件即可。

## 工作原理

- `repos.json` — 源仓库配置
- `schemas/` — `repos.json` 与上游 `skills/plugins.json` 的 JSON Schema
- `sources/<source>/plugins.json` — 从上游 `skills/plugins.json` 镜像来的插件源元数据
- `.claude-plugin/marketplace.json` — 生成的 Claude Code marketplace
- `.agents/plugins/marketplace.json` — 生成的 Codex marketplace
- `.github/workflows/sync-skills.yml` — 同步工作流（每 6 小时运行）
- 对每个源仓库 shallow clone 后镜像到 `sources/<source>/`
- `.sync-sources.json` 记录同步源仓库、skills 与插件元数据
- `scripts/generate-plugins.sh` 根据 `sources/` 重建上游插件，并保留 `plugins/` 下本地插件
- `scripts/validate-skills.sh` 校验 source 镜像、生成插件、本地插件与 marketplace 列表一致性
- `.github/workflows/ci.yml` 在 PR 中运行 `npm test` 和 `git diff --check`

添加新源仓库：编辑 `repos.json` 并推送即可。

## 技能结构

```
sources/<source>/
├── plugins.json      # 上游维护的插件源元数据
└── skills/
    └── <skill-name>/
        ├── SKILL.md
        ├── references/   # 可选
        └── evals/        # 可选

plugins/<plugin-name>/
├── .codex-plugin/plugin.json
├── .claude-plugin/plugin.json
└── skills/
    └── <skill-name>/
```

## 许可证

[Apache License 2.0](./LICENSE)
