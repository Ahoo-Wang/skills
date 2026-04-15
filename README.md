# Ahoo Skills

Ahoo Wang's open source project skills repository, containing skills for:

## Skills

### [wow](./skills/wow/SKILL.md)

DDD + Event Sourcing + CQRS microservice framework skill.

**Key Concepts**: Aggregate Roots, Command/Event Sourcing, Saga, Projections, Command Gateway

**Tech Stack**: Kotlin, Spring Boot, Gradle, MongoDB, Kafka

### [fluent-assert](./skills/fluent-assert/SKILL.md)

Kotlin fluent assertion library skill.

**Import**: `me.ahoo.test.asserts.assert`

**Pattern**: `value.assert().assertionMethod()` instead of AssertJ's `assertThat(value)`

## Installation

In Claude Code:

```bash
/plugin install ahoo-skills@github
```

## Skill Structure

Each skill lives in `skills/<skill-name>/`:

```
skills/<skill-name>/
├── SKILL.md          # Main skill file (YAML frontmatter + markdown content)
├── references/        # Detailed reference documentation
│   └── *.md
└── evals/           # Evaluation criteria for skill validation
    └── evals.json
```

## License

Apache License 2.0
