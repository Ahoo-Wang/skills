# Ahoo Skills

<p align="center"><img src="./logo.jpg" width="200" alt="Logo"></p>

[Ahoo-Wang](https://github.com/Ahoo-Wang) 开源项目的 [Agent Skills](https://agentskills.io/) 聚合仓库。

Skills 通过 GitHub Actions **每 6 小时**自动从源仓库同步。

## 源仓库与 Skills

| 仓库 | Skills |
|------|--------|
| [Wow](https://github.com/Ahoo-Wang/Wow) | [`wow`](./skills/wow/SKILL.md) |
| [CoApi](https://github.com/Ahoo-Wang/CoApi) | [`coapi-developer`](./skills/coapi-developer/SKILL.md) |
| [CoSec](https://github.com/Ahoo-Wang/CoSec) | [`cosec-custom-matcher`](./skills/cosec-custom-matcher/SKILL.md)、[`cosec-integration`](./skills/cosec-integration/SKILL.md)、[`cosec-policy-author`](./skills/cosec-policy-author/SKILL.md)、[`cosec-troubleshoot`](./skills/cosec-troubleshoot/SKILL.md) |
| [CosId](https://github.com/Ahoo-Wang/CosId) | [`cosid-manual-integration`](./skills/cosid-manual-integration/SKILL.md)、[`cosid-sharding`](./skills/cosid-sharding/SKILL.md)、[`cosid-spring-boot`](./skills/cosid-spring-boot/SKILL.md)、[`cosid-strategy-guide`](./skills/cosid-strategy-guide/SKILL.md) |
| [FluentAssert](https://github.com/Ahoo-Wang/FluentAssert) | [`fluent-assert`](./skills/fluent-assert/SKILL.md) |
| [Fetcher](https://github.com/Ahoo-Wang/fetcher) | [`fetcher-cosec-auth`](./skills/fetcher-cosec-auth/SKILL.md)、[`fetcher-decorator-service`](./skills/fetcher-decorator-service/SKILL.md)、[`fetcher-eventbus`](./skills/fetcher-eventbus/SKILL.md)、[`fetcher-integration`](./skills/fetcher-integration/SKILL.md)、[`fetcher-llm-streaming`](./skills/fetcher-llm-streaming/SKILL.md)、[`fetcher-openai-client`](./skills/fetcher-openai-client/SKILL.md)、[`fetcher-openapi-generator`](./skills/fetcher-openapi-generator/SKILL.md)、[`fetcher-openapi-types`](./skills/fetcher-openapi-types/SKILL.md)、[`fetcher-react-hooks`](./skills/fetcher-react-hooks/SKILL.md)、[`fetcher-storage`](./skills/fetcher-storage/SKILL.md)、[`fetcher-viewer-components`](./skills/fetcher-viewer-components/SKILL.md)、[`fetcher-wow-cqrs`](./skills/fetcher-wow-cqrs/SKILL.md) |
| [CoCache](https://github.com/Ahoo-Wang/CoCache) | [`cocache`](./skills/cocache/SKILL.md) |
| [Simba](https://github.com/Ahoo-Wang/Simba) | [`simba`](./skills/simba/SKILL.md)、[`simba-testing`](./skills/simba-testing/SKILL.md) |

## 安装

```bash
/plugin install ahoo-skills@github
```

## 工作原理

- `repos.json` — 源仓库配置
- `.github/workflows/sync-skills.yml` — 同步工作流（每 6 小时运行）
- 对每个源仓库 shallow clone 后 rsync 到 `skills/` 目录

添加新源仓库：编辑 `repos.json` 并推送即可。

## 技能结构

```
skills/<skill-name>/
├── SKILL.md          # 技能定义（YAML frontmatter + markdown）
├── references/       # 参考文档（可选）
└── evals/            # 评估标准（可选）
```

## 许可证

[Apache License 2.0](./LICENSE)
