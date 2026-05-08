# Ahoo Skills

![Logo](./logo.jpg)

[Ahoo-Wang](https://github.com/Ahoo-Wang) 开源项目的 Claude Code Skills 聚合仓库。Skills 通过 GitHub Actions 每 6 小时自动从源仓库同步。

## 源仓库

| 仓库 | Skills |
|------|--------|
| [Wow](https://github.com/Ahoo-Wang/Wow) | `wow` |
| [CoApi](https://github.com/Ahoo-Wang/CoApi) | `coapi-developer` |
| [CoSec](https://github.com/Ahoo-Wang/CoSec) | `cosec-custom-matcher`、`cosec-integration`、`cosec-policy-author`、`cosec-troubleshoot` |
| [CosId](https://github.com/Ahoo-Wang/CosId) | `cosid-manual-integration`、`cosid-sharding`、`cosid-spring-boot`、`cosid-strategy-guide` |
| [FluentAssert](https://github.com/Ahoo-Wang/FluentAssert) | `fluent-assert` |
| [Fetcher](https://github.com/Ahoo-Wang/fetcher) | *（自动同步）* |

## 安装

在 Claude Code 中安装：

```bash
/plugin install ahoo-skills@github
```

## 工作原理

- `repos.json` — 列出需要同步的源仓库
- `.github/workflows/sync-skills.yml` — 每 6 小时运行的 GitHub Actions 工作流
- 从每个源仓库 shallow clone 后 rsync 到 `skills/` 目录

添加新源仓库：编辑 `repos.json` 并推送，下次同步时自动生效。

## 技能结构

每个技能位于 `skills/<skill-name>/`：

```
skills/<skill-name>/
├── SKILL.md          # 主技能文件（YAML frontmatter + markdown 内容）
├── references/       # 详细参考文档
│   └── *.md
└── evals/            # 技能验证评估标准
    └── evals.json
```

## 许可证

Apache License 2.0
