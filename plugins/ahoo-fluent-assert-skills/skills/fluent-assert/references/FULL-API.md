# FluentAssert API Reference

## Table of Contents

- [Installation](#installation)
- [Imports](#imports)
- [Extension Mapping](#extension-mapping)
- [Overload Resolution](#overload-resolution)
- [Special APIs](#special-apis)
- [Focused Examples](#focused-examples)

## Installation

### Gradle (Kotlin DSL)

```kotlin
testImplementation("me.ahoo.test:fluent-assert-core:1.1.0")
```

### Maven

```xml
<dependency>
    <groupId>me.ahoo.test</groupId>
    <artifactId>fluent-assert-core</artifactId>
    <version>1.1.0</version>
    <scope>test</scope>
</dependency>
```

FluentAssert requires Java 17 or later.

## Imports

```kotlin
import me.ahoo.test.asserts.assert
import me.ahoo.test.asserts.assertThrownBy
```

Import only the Java types each test uses. In this repository, `java.time.*` fails Detekt; follow the wildcard exceptions in `config/detekt/detekt.yml`.

## Extension Mapping

All value receivers below are nullable. `AssertProvider<A>.assert()` is the only non-nullable receiver.

### Core values and containers

| Receiver | Return type |
|---|---|
| `Boolean?` | `BooleanAssert` |
| `Byte?` | `ByteAssert` |
| `Short?` | `ShortAssert` |
| `Int?` | `IntegerAssert` |
| `Long?` | `LongAssert` |
| `Float?` | `FloatAssert` |
| `Double?` | `DoubleAssert` |
| `BigDecimal?` | `BigDecimalAssert` |
| `String?` | `StringAssert` |
| `Iterable<T>?` | `IterableAssert<T>` |
| `Iterator<T>?` | `IteratorAssert<T>` |
| `Collection<T>?` | `CollectionAssert<T>` |
| `Array<T>?` | `ObjectArrayAssert<T>` |
| `List<T>?` | `ListAssert<T>` |
| `Optional<T>?` | `OptionalAssert<T>` |
| `Map<K, V>?` | `MapAssert<K, V>` |
| `Stream<T>?` | `ListAssert<T>` |
| `<T : Comparable<T>?> T?` | `GenericComparableAssert<T>` |
| `<T> T?` | `ObjectAssert<T>` |

### Time

| Receiver | Return type |
|---|---|
| `Date?` | `DateAssert` |
| `ZonedDateTime?` | `ZonedDateTimeAssert` |
| `LocalDateTime?` | `LocalDateTimeAssert` |
| `OffsetDateTime?` | `OffsetDateTimeAssert` |
| `OffsetTime?` | `OffsetTimeAssert` |
| `LocalTime?` | `LocalTimeAssert` |
| `LocalDate?` | `LocalDateAssert` |
| `YearMonth?` | `YearMonthAssert` |
| `Instant?` | `InstantAssert` |
| `Duration?` | `DurationAssert` |
| `Period?` | `PeriodAssert` |
| `Temporal?` | `TemporalAssert` |

### I/O, concurrency, functions, and exceptions

| Receiver | Return type |
|---|---|
| `Path?` | `PathAssert` |
| `File?` | `FileAssert` |
| `URL?` | `UrlAssert` |
| `URI?` | `UriAssert` |
| `Future<V>?` | `FutureAssert<V>` |
| `CompletableFuture<V>?` | `CompletableFutureAssert<V>` |
| `CompletionStage<V>?` | `CompletableFutureAssert<V>` |
| `Predicate<T>?` | `PredicateAssert<T>` |
| `<T : Throwable> T?` | `ThrowableAssert<T>` |
| `AssertProvider<A>` | `A` |

## Overload Resolution

Kotlin selects an extension from the receiver's static type. Keep examples and fixes aligned with that type.

- Convert primitive arrays before using collection assertions. `IntArray`, `LongArray`, and the other primitive arrays are not `Array<T>` and resolve to `ObjectAssert`; use `ints.toList().assert()` or `ints.toTypedArray().assert()`.
- Box primitive streams before using stream assertions. Only `Stream<T>` has a dedicated overload; `IntStream`, `LongStream`, and `DoubleStream` resolve to `ObjectAssert`, so use `stream.boxed().assert()`.
- Convert non-`String` text before using string assertions. A `CharSequence` receiver resolves to `ObjectAssert`, while `StringBuilder` resolves to `GenericComparableAssert<StringBuilder>`; use `text.toString().assert()`.
- Keep a receiver statically typed as `Iterable<T>` to exercise `IterableAssert`; a `List<T>` receiver resolves to `ListAssert`.
- Keep a receiver statically typed as `Temporal` to exercise `TemporalAssert`; concrete time types resolve to their dedicated assertion classes.
- Expect `CompletionStage<V>.assert()` to return `CompletableFutureAssert<V>`; AssertJ has no `CompletionStageAssert`.
- Expect `String.assert()` to return `StringAssert`, not `GenericComparableAssert`, even though `String` is comparable.

## Special APIs

### Assert thrown exceptions

Prefer the reified overload:

```kotlin
assertThrownBy<IllegalArgumentException> {
    parse("")
}.hasMessage("invalid input")
```

Use the class overload when the expected type is available only as a `Class<T>`:

```kotlin
assertThrownBy(IllegalArgumentException::class.java) {
    parse("")
}.hasMessage("invalid input")
```

Both overloads return `ThrowableAssert<T>`; continue the assertion chain directly without another `.assert()`.

### Delegate custom assertions

For an AssertJ `AssertProvider<A>`, call `.assert()` to obtain `A`:

```kotlin
class StringAssertProvider(private val value: String) : AssertProvider<StringAssert> {
    override fun assertThat(): StringAssert = value.assert()
}

StringAssertProvider("ready").assert().isEqualTo("ready")
```

## Focused Examples

### Nullable values and collections

```kotlin
val name: String? = null
name.assert().isNull()

val items = listOf("a", "b")
items.assert().hasSize(2).containsExactly("a", "b")
```

### Comparable fallback

```kotlin
class Version(val value: Int) : Comparable<Version> {
    override fun compareTo(other: Version): Int = value.compareTo(other.value)
}

Version(2).assert().isGreaterThan(Version(1))
```

### Static receiver types

```kotlin
val values: Iterable<Int> = listOf(1, 2, 3)
values.assert().hasSize(3) // IterableAssert<Int>

val temporal: Temporal = Instant.parse("2024-01-01T00:00:00Z")
temporal.assert().isEqualTo(Instant.parse("2024-01-01T00:00:00Z")) // TemporalAssert

val stage: CompletionStage<String> = CompletableFuture.completedFuture("done")
stage.assert().isCompletedWithValue("done") // CompletableFutureAssert<String>
```

### Time, predicates, and recursive comparison

```kotlin
LocalDate.of(2024, 4, 15).assert().hasMonth(Month.APRIL)

val isEven = Predicate<Int> { it % 2 == 0 }
isEven.assert().accepts(2, 4).rejects(1, 3)

actual.assert().usingRecursiveComparison().isEqualTo(expected)
```
