# Coding Conventions - Kube Mastery

## Programming Paradigm

- **Functional** : Logique métier pure, transformations de données
- **Object-Oriented** : Encapsulation d'état complexe, polymorphisme
- **Hybrid** : Combiner selon les besoins

### Core Principles
- Pure functions pour la logique métier
- Immutability avec `Object.freeze()` quand approprié
- Discriminated unions (Result types) pour gestion d'erreurs
- Pas d'exceptions

## Code Structure

### Indentation & Control Flow
- **Max indentation**: 3 levels
- **No switch**: Object lookup ou if/else
- **No nested ifs**: Early returns (guard clauses)
- **Always braces**: Même pour one-liners, no return without braces. Interdit : `return` sans accolade (jamais de one-liner avec `return`, nulle part).

```typescript
// good: Early returns with braces
if (!value) { 
  return error('Null') 
}
if (value.length === 0) { 
  return error('Empty') 
}
return process(value)

// bad: Early returns without braces
if (!value) return error('Null')
if (value.length === 0) return error('Empty')
return process(value)
```

### Function Length
- **Ideal**: 20-30 lines
- **Max**: 50 lines

## Naming Conventions

- **Explicit names** over abbreviations
- **SCREAMING_SNAKE_CASE** for constants: `MAX_DEPTH`, `MAX_LOG_ENTRIES`
- **camelCase** for config objects
- **Validation prefixes**: `validate`, `is`, `has`, `can`

## Comment Conventions

### Structural Comments
```typescript
// ═══════════════════════════════════════════════════════════════════════════
// MODULE NAME
// ═══════════════════════════════════════════════════════════════════════════
```

### What to Comment
- JSDoc for public exports
- Kubernetes behaviors
- Spec constraints
- Edge cases, side effects
- TODOs with context

### What NOT to Comment
- Obvious code
- Commented-out code

## SOLID Principles

| Principle | Functional | OOP |
|-----------|------------|-----|
| **SRP** | Factories spécialisées | Classes séparées |
| **OCP** | Object lookup + handlers | Interface + classes |
| **LSP** | Discriminated unions | Interfaces |
| **ISP** | Types séparés | Interfaces séparées |
| **DIP** | Injection via paramètres | Constructor injection |

## Error Handling

```typescript
type Result<T> = { ok: true; value: T } | { ok: false; error: string }

// ✅ Use Result types
const readFile = (path: string): Result<string> => {
  if (!exists(path)) return error('File not found')
  return success(content)
}
// ❌ Never throw exceptions
```

## Anti-Patterns

```typescript
// ❌ Hidden mutation
arr.push(42)
// ✅ Return new array
return [...arr, 42]

// ❌ Boolean params
deleteFile('/path', true, false, true)
// ✅ Named params
deleteFile('/path', { recursive: true, force: false })
```

## Testing Strategy

- **Pure functions**: Simple tests, no setup
- **Factories**: Tests with DI
- **Coverage**: >80%
- **TDD**: Red → Green → Refactor

```bash
npm test              # All tests
npm run coverage      # Coverage report
```

## Styling

### Color System (`src/styles/variables.css`)

| Couleur | Usage |
|---------|-------|
| **cyan** | Actions, liens, interactif |
| **ruby** | Erreurs, suppressions |
| **green** | Succès, validations |

Échelle 1-12 + alpha (a1-a12). Tokens: `solid`, `subtle`, `surface`, `outline`, `plain`.

## Internationalization

### Usage
```typescript
import { useLang, useLangNavigate } from '~/lang/core'

const { messages, locale } = useLang()
messages().home_title()  // Format: section_key

const navigate = useLangNavigate()  // Préserve la langue
navigate('/courses/...')
```

### Rules
- Type `AvailableLanguage` (pas `Locale`)
- Clés avec underscores: `courses_title` (pas `courses.title`)
- Toujours `useLangNavigate()` dans routes `[[lang]]`

## References

- `architecture.md` - Structure technique
- `spec.md` - Requirements
