---
name: fluent-assert
description: Write and refactor Kotlin assertions with FluentAssert's AssertJ-backed `.assert()` extensions and `assertThrownBy`. Use when a project depends on `fluent-assert-core`, the user asks for FluentAssert, or the user asks to migrate direct AssertJ calls to FluentAssert; covers JUnit and Wow/SagaSpec tests, nullable values, supported JDK types, collections, time, futures, predicates, exceptions, recursive comparison, and custom `AssertProvider` types.
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
| Collection/list | `items.assert().hasSize(2).contains("a")` |
| Map | `map.assert().hasSize(2).containsEntry("a", 1)` |
| Nullable value | `value.assert().isNull()` or `value.assert().isNotNull()` |
| Exception lambda | `assertThrownBy<IllegalArgumentException> { call() }.hasMessage("bad")` |
| Existing exception | `throwable.assert().hasMessageContaining("bad")` |
| LocalDate/YearMonth month | `date.assert().hasMonth(Month.APRIL)` |
| CompletableFuture success/failure | `completableFuture.assert().isCompletedWithValue(value)` / `.isCompletedExceptionally()` |
| Recursive comparison | `actual.assert().usingRecursiveComparison().isEqualTo(expected)` |

For exception lambdas, also import:

```kotlin
import me.ahoo.test.asserts.assertThrownBy
```

For `LocalDate` and `YearMonth` month assertions, import `java.time.Month`; those assertions expect `Month`, not an integer.

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
- Do not call `.assert()` on primitive arrays (`IntArray`, `LongArray`, ...) — they fall back to `ObjectAssert` with no collection APIs. Convert first: `ints.toList().assert().hasSize(3).contains(42)`.
- Do not expect string assertions from non-`String` text receivers. A statically `CharSequence`-typed value resolves to `ObjectAssert`; `StringBuilder` (it implements `Comparable<StringBuilder>`) resolves to `GenericComparableAssert`. Use a `String` (`.toString()`) instead.
- There is no `CompletionStageAssert`; `stage.assert()` returns `CompletableFutureAssert`.

## References

- Read [`references/FULL-API.md`](references/FULL-API.md) when you need installation, the exact type-to-assertion mapping, overload-resolution rules, or special API examples.
- Use [`evals/evals.json`](evals/evals.json) as the regression prompt set when changing this skill.
