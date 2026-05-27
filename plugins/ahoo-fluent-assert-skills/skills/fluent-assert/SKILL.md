---
name: fluent-assert
description: Use when writing or refactoring Kotlin tests that need assertions, including JUnit tests, Wow/SagaSpec tests, JDK types, nullable values, collections, maps, time values, futures, predicates, custom data classes, or exception assertions with assertThrownBy.
---

# FluentAssert

Use FluentAssert for Kotlin assertions in this repository and in downstream Kotlin test examples. Prefer the Kotlin extension style over direct AssertJ calls.

## Core Rule

```kotlin
import me.ahoo.test.asserts.assert

actual.assert().isEqualTo(expected)
```

Avoid `assertThat(actual)` in ordinary test code. FluentAssert keeps nullable receivers natural:

```kotlin
val name: String? = null
name.assert().isNull()
```

## Common Patterns

| Need | Pattern |
|---|---|
| Primitive/string/object | `value.assert().isEqualTo(expected)` |
| Collection/list/map | `items.assert().hasSize(2).contains("a")` |
| Nullable value | `value.assert().isNull()` or `value.assert().isNotNull()` |
| Exception lambda | `assertThrownBy<IllegalArgumentException> { call() }.hasMessage("bad")` |
| Existing exception | `throwable.assert().hasMessageContaining("bad")` |
| Time month checks | `date.assert().hasMonth(Month.APRIL)` |
| Future success/failure | `future.assert().isCompletedWithValue(value)` / `.isCompletedExceptionally()` |
| Recursive comparison | `actual.assert().usingRecursiveComparison().isEqualTo(expected)` |

For exception lambdas, also import:

```kotlin
import me.ahoo.test.asserts.assertThrownBy
```

For month assertions, import `java.time.Month`; AssertJ expects `Month`, not an integer.

## Wow/Saga Tests

Use FluentAssert inside expectation blocks too:

```kotlin
expectCommandBody<UpdateDemo> {
    data.assert().isNotNull().isEqualTo("updated")
}
```

## AssertProvider

For types implementing AssertJ's `AssertProvider<A>`, `.assert()` returns the provider's custom assertion type:

```kotlin
provider.assert().isPositive()
```

Only use direct `assertThat` when implementing the provider's `assertThat()` method or when a project explicitly requires raw AssertJ.

## Avoid

- Do not chain `.assert()` after `assertThrownBy`; it already returns `ThrowableAssert<T>`.
- Do not assert contradictory states on one value, such as `Optional.of("x").assert().isPresent().isEmpty()`.
- Do not use unavailable AssertJ shortcuts like `OffsetDateTimeAssert.hasOffset(...)`.
- Do not use numeric `hasMonth(4)` for `LocalDate` or `YearMonth`; use `hasMonth(Month.APRIL)`.
- Do not switch to `assertThat(value).usingRecursiveComparison()`; keep chaining from `value.assert()`.

## References

- Read [`references/FULL-API.md`](references/FULL-API.md) when you need supported type coverage, installation snippets, or a fuller example.
- Use [`evals/evals.json`](evals/evals.json) as the regression prompt set when changing this skill.
