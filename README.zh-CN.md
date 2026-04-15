# Ahoo Skills

![Logo](./logo.jpg)

Ahoo Wang 的开源项目 skills 仓库，包含以下技能：

## Skills

### [wow](./skills/wow/SKILL.md)

DDD + Event Sourcing + CQRS 微服务框架技能。

**关键概念**：聚合根、命令/事件溯源、Saga、投影、命令网关

**技术栈**：Kotlin、Spring Boot、Gradle、MongoDB、Kafka

### [fluent-assert](./skills/fluent-assert/SKILL.md)

Kotlin 流畅断言库技能。

**导入**：`me.ahoo.test.asserts.assert`

**模式**：`value.assert().assertionMethod()` 而非 AssertJ 的 `assertThat(value)`

## 安装

在 Claude Code 中安装：

```bash
/plugin install ahoo-skills@github
```

## 技能结构

每个技能位于 `skills/<skill-name>/`：

```
skills/<skill-name>/
├── SKILL.md          # 主技能文件（YAML frontmatter + markdown 内容）
├── references/        # 详细参考文档
│   └── *.md
└── evals/           # 技能验证评估标准
    └── evals.json
```

## 许可证

Apache License 2.0
