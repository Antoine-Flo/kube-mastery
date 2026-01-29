# Résultats d'Audit — Actions Détaillées

**Date** : 2026-01-29  
**Objectif** : Liste exhaustive et détaillée des actions à réaliser suite à l'audit

---

## 1. Sécurité — Actions Critiques

### 1.1 Vulnérabilités npm à corriger

**Commande** : `npm audit fix`

| Package | Sévérité | Vulnérabilité | Action |
|---------|----------|---------------|--------|
| `seroval` | HIGH | RCE via JSON Deserialization (GHSA-3rxj-6cgf-8cfw) | `npm audit fix` |
| `seroval` | HIGH | Prototype Pollution (GHSA-hj76-42vx-jwp4) | `npm audit fix` |
| `seroval` | HIGH | DoS via Array/RegExp/Nested Objects | `npm audit fix` |
| `h3` | HIGH | Request Smuggling TE.TE (GHSA-mp2g-9vg9-f4cg) | `npm audit fix --force` (breaking change vinxi) |
| `tar` | HIGH | Arbitrary File Overwrite (GHSA-8qq5-rm4j-mr97) | `npm audit fix` |
| `tar` | HIGH | Symlink Poisoning (GHSA-r6q2-hw4h-h46w) | `npm audit fix` |
| `tar` | HIGH | Hardlink Path Traversal (GHSA-34x7-hfp2-rc4v) | `npm audit fix` |
| `@supabase/auth-js` | MODERATE | Insecure Path Routing (GHSA-8r88-6cj9-9fh5) | `npm audit fix` |
| `lodash` | MODERATE | Prototype Pollution in unset/omit (GHSA-xxjr-mmjv-4gpg) | `npm audit fix` |
| `lodash-es` | MODERATE | Prototype Pollution (GHSA-xxjr-mmjv-4gpg) | `npm audit fix --force` (mermaid breaking) |
| `esbuild` | MODERATE | Dev server request leaking (GHSA-67mh-4wv8-2f99) | `npm audit fix --force` (drizzle-kit breaking) |
| `diff` | LOW | DoS in parsePatch (GHSA-73rr-hh4g-fpgx) | `npm audit fix` |

**Étapes** :
1. `npm audit fix` — corrige les vulnérabilités sans breaking changes
2. Tester l'application après fix
3. Si OK, `npm audit fix --force` pour les breaking changes restants
4. Vérifier que vinxi, mermaid, drizzle-kit fonctionnent toujours

---

### 1.2 Validation des entrées API

#### `/api/suggestions/submit` — `src/routes/api/suggestions/submit.ts`

**Problèmes actuels** :
- Ligne 17-29 : validation basique mais pas de limite de taille
- Pas de rate-limiting
- `text` peut être arbitrairement long

**Actions** :
```typescript
// Ajouter après ligne 16 :
import { z } from 'zod'

const suggestionSchema = z.object({
  text: z.string().min(1).max(5000),
  lessonId: z.string().min(1).max(200),
  userId: z.string().uuid().optional(),
  visitorId: z.string().max(100).optional(),
})

// Dans POST(), remplacer la validation manuelle par :
const parseResult = suggestionSchema.safeParse(body)
if (!parseResult.success) {
  return new Response(
    JSON.stringify({ ok: false, error: 'Invalid input' }),
    { status: 400, headers: { 'Content-Type': 'application/json' } }
  )
}
const { text, lessonId, userId, visitorId } = parseResult.data
```

**Rate-limiting à ajouter** : Implémenter une vérification similaire à survey/submit.ts (1 suggestion par visitorId par lessonId par 24h)

---

#### `/api/ab-test/track` — `src/routes/api/ab-test/track.ts`

**Problèmes actuels** :
- Ligne 18-32 : validation basique
- `metadata` peut être un objet arbitrairement profond/large
- Pas de rate-limiting
- Retourne toujours 200 même en cas d'erreur (ligne 82-87)

**Actions** :
```typescript
// Ajouter schema zod :
const abTestEventSchema = z.object({
  testName: z.string().min(1).max(100),
  variant: z.string().min(1).max(50),
  eventType: z.enum(['impression', 'click', 'conversion']),
  visitorId: z.string().min(1).max(100),
  userId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional().default({}),
  timestamp: z.string().datetime().optional(),
})

// Limiter la taille de metadata :
const metadataSize = JSON.stringify(body.metadata || {}).length
if (metadataSize > 10000) {
  return new Response(
    JSON.stringify({ ok: false, error: 'Metadata too large' }),
    { status: 400, headers: { 'Content-Type': 'application/json' } }
  )
}
```

---

#### `/api/survey/submit` — `src/routes/api/survey/submit.ts`

**Problèmes actuels** :
- Ligne 19-24 : validation basique
- `responses` et `metadata` sans limite de taille

**Actions** :
```typescript
const surveySchema = z.object({
  name: z.string().min(1).max(100),
  responses: z.record(z.unknown()),
  userId: z.string().uuid().optional(),
  visitorId: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional().default({}),
})

// Vérifier la taille totale :
const totalSize = JSON.stringify(body).length
if (totalSize > 50000) {
  return new Response(
    JSON.stringify({ ok: false, error: 'Payload too large' }),
    { status: 400, headers: { 'Content-Type': 'application/json' } }
  )
}
```

---

### 1.3 Validation DATABASE_URL

**Fichier** : `src/db/index.ts`

**Problème ligne 7** :
```typescript
const client = postgres(process.env.DATABASE_URL!);
```

**Action** :
```typescript
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required')
}
const client = postgres(databaseUrl);
```

---

### 1.4 Sanitisation des erreurs API

**Fichier** : `src/routes/api/seeds/[name].ts`

**Problème ligne 68** : expose les messages d'erreur internes
```typescript
const errorMessage = err instanceof Error ? err.message : 'Unknown error'
```

**Action** :
```typescript
// Logger l'erreur côté serveur
console.error('Seed loading error:', err)

// Retourner un message générique
return new Response(
  JSON.stringify({ ok: false, error: 'Failed to load scenario' }),
  { status: 500, headers: { 'Content-Type': 'application/json' } }
)
```

---

## 2. Tests — Actions Prioritaires

### 2.1 Tests ClusterState.ts (CRITIQUE)

**Fichier à tester** : `src/core/cluster/ClusterState.ts`

**Créer** : `tests/unit/cluster/ClusterState.test.ts`

**Cas de test à couvrir** :
```typescript
describe('ClusterState', () => {
  describe('createClusterState', () => {
    it('should create empty cluster state')
    it('should create cluster state from existing data')
  })

  describe('pod operations', () => {
    it('should add a pod')
    it('should update a pod')
    it('should delete a pod')
    it('should find pod by name and namespace')
    it('should list pods by namespace')
    it('should emit PodCreated event on add')
    it('should emit PodDeleted event on delete')
  })

  describe('deployment operations', () => {
    it('should add a deployment')
    it('should update a deployment')
    it('should delete a deployment')
    it('should emit events correctly')
  })

  describe('replicaset operations', () => {
    // Idem
  })

  describe('service operations', () => {
    // Idem
  })

  describe('configmap operations', () => {
    // Idem
  })

  describe('secret operations', () => {
    // Idem
  })

  describe('node operations', () => {
    // Idem
  })

  describe('toJSON', () => {
    it('should serialize all resources')
    it('should be deserializable')
  })
})
```

**Estimation** : ~30 tests, ~2-3h de travail

---

### 2.2 Tests EmulatedEnvironmentManager.ts (CRITIQUE)

**Fichier à tester** : `src/core/emulatedEnvironment/EmulatedEnvironmentManager.ts`

**Créer** : `tests/unit/emulatedEnvironment/EmulatedEnvironmentManager.test.ts`

**Cas de test** :
```typescript
describe('EmulatedEnvironmentManager', () => {
  describe('initialization', () => {
    it('should create environment from scenario')
    it('should restore environment from storage')
    it('should handle missing scenario gracefully')
  })

  describe('auto-save', () => {
    it('should save periodically')
    it('should save on changes')
    it('should not save if disabled')
  })

  describe('reset', () => {
    it('should reset to initial state')
    it('should clear storage on reset')
  })

  describe('cleanup', () => {
    it('should stop auto-save on destroy')
    it('should cleanup resources')
  })
})
```

**Estimation** : ~15 tests, ~1-2h de travail

---

### 2.3 Tests API Routes

**Fichiers à créer** :
- `tests/unit/routes/api/seeds.test.ts`
- `tests/unit/routes/api/suggestions.test.ts`
- `tests/unit/routes/api/survey.test.ts`
- `tests/unit/routes/api/ab-test.test.ts`

**Cas de test par route** :
```typescript
describe('POST /api/suggestions/submit', () => {
  it('should return 400 for missing text')
  it('should return 400 for missing lessonId')
  it('should return 400 for text too long')
  it('should return 200 for valid submission')
  it('should store suggestion in database')
})

describe('POST /api/survey/submit', () => {
  it('should return 400 for missing fields')
  it('should return 429 for duplicate submission')
  it('should return 200 for valid submission')
})

describe('POST /api/ab-test/track', () => {
  it('should return 400 for invalid eventType')
  it('should return 400 for missing required fields')
  it('should return 200 for valid event')
  it('should handle impression assignment')
})

describe('GET /api/seeds/[name]', () => {
  it('should return 400 for missing name')
  it('should return 404 for unknown scenario')
  it('should return 200 with cluster data for valid scenario')
})
```

**Estimation** : ~20 tests, ~2h de travail

---

### 2.4 Tests TerminalManager.ts

**Fichier à tester** : `src/core/terminal/TerminalManager.ts`

**Créer** : `tests/unit/terminal/TerminalManager.test.ts`

**Cas de test** :
```typescript
describe('TerminalManager', () => {
  it('should initialize terminal')
  it('should handle concurrent initialization')
  it('should cleanup on destroy')
  it('should handle xterm attachment')
  it('should process commands')
})
```

**Estimation** : ~10 tests, ~1h de travail

---

### 2.5 Conformance test Service

**Fichier à créer** : `tests/conformance/tests/service-conformance.test.ts`

**Modèle** : Copier `secret-conformance.test.ts` et adapter pour Service

---

## 3. Qualité du Code — Actions

### 3.1 Remplacer les `any` par des types stricts

| Fichier | Ligne | Remplacement suggéré |
|---------|-------|---------------------|
| `src/learnable/module-queries.ts` | 40 | `Record<string, unknown>` ou interface spécifique |
| `src/learnable/module-queries.ts` | 135, 142 | Typer le résultat Supabase |
| `src/learnable/course-queries.ts` | 27, 153 | Interface CourseRow |
| `src/core/kubectl/yamlParser.ts` | 59, 72 | `Record<string, unknown>` pour YAML parsé |
| `src/core/cluster/events/handlers.ts` | 59, 64, 75, 86, 93 | Discriminated union pour events |
| `src/core/cluster/ClusterState.ts` | 320 | Generic `Resource` type |
| `src/core/terminal/autocomplete/types.ts` | 9 | Import depuis `cluster/ClusterState` |

**Priorité** : Commencer par `events/handlers.ts` (utilisé partout)

---

### 3.2 Extraire les fonctions longues

#### `ClusterState.ts` — `createClusterState()` (~140 lignes)

**Action** : Extraire en sous-fonctions
```typescript
// Avant (monolithique)
export const createClusterState = () => {
  // 140 lignes...
}

// Après (composé)
const createPodOperations = (state, eventBus) => ({ ... })
const createDeploymentOperations = (state, eventBus) => ({ ... })
const createServiceOperations = (state, eventBus) => ({ ... })
// etc.

export const createClusterState = () => {
  const state = { pods: [], deployments: [], ... }
  const eventBus = createEventBus()
  
  return {
    ...createPodOperations(state, eventBus),
    ...createDeploymentOperations(state, eventBus),
    ...createServiceOperations(state, eventBus),
    // etc.
  }
}
```

#### `clusterInfo.ts` — `handleDump()` (~90 lignes)

**Action** : Extraire les sections de formatage
```typescript
const formatNodesDump = (nodes) => { ... }
const formatPodsDump = (pods) => { ... }
const formatServicesDump = (services) => { ... }

const handleDump = () => {
  return [
    formatNodesDump(nodes),
    formatPodsDump(pods),
    formatServicesDump(services),
  ].join('\n')
}
```

---

### 3.3 Résoudre les TODOs

| TODO | Fichier:Ligne | Action |
|------|---------------|--------|
| Récupérer clusterState | `TerminalController.ts:76` | Passer via context ou DI |
| Migrer ClusterState type | `autocomplete/types.ts:9` | `import type { ClusterState } from '~/core/cluster/ClusterState'` |
| Implement debug logs | `system/debug.ts:25` | Créer issue ou implémenter |
| FileSystem listDirectory | `FileAutocompleteProvider.ts:21` | Implémenter la méthode ou créer issue |
| Immutable structural sharing | `FileSystem.ts:120` | Créer issue pour Phase 2 |
| clusterState placeholder | `TerminalController.ts:78` | Résoudre avec TODO ligne 76 |

---

### 3.4 Standardiser gestion d'erreurs

**Fichiers à refactorer** (throw → Result) :

| Fichier | Action |
|---------|--------|
| `src/learnable/module-loader.ts` | Retourner `Result<Module, LoadError>` |
| `src/routes/[[lang]]/survey.tsx:197` | Gérer avec Result et UI d'erreur |
| `src/components/quiz/Quiz.tsx:98` | Retourner Result et afficher erreur UI |
| `src/components/quiz/QuestionRenderer.tsx:36` | Retourner Result |

**Pattern à suivre** :
```typescript
// Avant
const loadModule = (id: string) => {
  if (!id) throw new Error('Module ID required')
  // ...
}

// Après
const loadModule = (id: string): Result<Module, string> => {
  if (!id) return error('Module ID required')
  // ...
  return success(module)
}
```

---

## 4. UX / Accessibilité — Actions

### 4.1 Ajouter ARIA labels

| Composant | Fichier:Ligne | Action |
|-----------|---------------|--------|
| Quiz options | `MultipleChoiceQuestion.tsx:67-75` | `aria-label={option.label}` |
| Quiz hint button | `MultipleChoiceQuestion.tsx:81-88` | `aria-label="Afficher un indice"` |
| Quiz hint button | `TerminalCommandQuestion.tsx:105-112` | `aria-label="Afficher un indice"` |
| Navigation Previous | `[lessonId].tsx:624-631` | `aria-label={messages().previous_lesson()}` |
| Navigation Next | `[lessonId].tsx:632-642` | `aria-label={messages().next_lesson()}` |
| Logout button | `navbar.tsx:35-41` | `aria-label={messages().logout()}` |
| Survey scale | `survey.tsx:294-300` | `aria-label={\`Note ${value} sur 5\`}` |

### 4.2 Ajouter role="alert" sur les erreurs

| Fichier | Ligne | Action |
|---------|-------|--------|
| `Quiz.tsx` | 219-221 | `<div role="alert">...</div>` |
| `[lessonId].tsx` | 534-544 | `<div role="alert">...</div>` |
| `terminal.tsx` | 193-198 | `<div role="alert">...</div>` |

### 4.3 Internationaliser les messages hardcodés

| Message | Fichier:Ligne | Clé à créer |
|---------|---------------|-------------|
| "Erreur: Question introuvable" | `Quiz.tsx:220` | `quiz_error_question_not_found` |
| "Next Question" | `[lessonId].tsx:218` | `quiz_next_question` |
| "Previous" | `[lessonId].tsx:629` | `lesson_previous` |
| "Next" | `[lessonId].tsx:639` | `lesson_next` |
| "Course or module not found" | `[lessonId].tsx:521` | `error_course_not_found` |
| Terminal error | `terminal.tsx:180-183` | `terminal_error` |

**Fichiers messages à modifier** :
- `messages/en.json`
- `messages/fr.json`

### 4.4 Améliorer feedback de validation

**Auth form** (`src/routes/[[lang]]/auth.tsx`) :
- Ajouter indicateur de loading sur bouton (Spinner au lieu de "...")
- Ajouter validation email en temps réel
- Ajouter indicateur de force du mot de passe

**Survey form** (`src/routes/[[lang]]/survey.tsx`) :
- Indiquer les champs requis avec `*`
- Ajouter limite de caractères visible sur textarea
- Afficher message d'erreur inline sous les champs

---

## 5. Documentation — Actions

### 5.1 Mettre à jour architecture.md

**Fichier** : `doc/context/architecture.md`

**Action** : Supprimer la mention de `src/lib/` qui n'existe pas, ou documenter où sont les utilities actuellement (répartis dans `src/account/`, `src/types/`, `src/learnable/`, etc.)

### 5.2 Documenter les patterns de test

**Créer** : `doc/context/testing.md`

**Contenu** :
- Comment lancer les tests (`npm test`, `npm run coverage`)
- Structure des tests (unit, conformance, golden)
- Comment ajouter un test
- Conventions de nommage

---

## Récapitulatif par Priorité

### P0 — Critique (à faire immédiatement)
- [ ] `npm audit fix` pour les vulnérabilités
- [ ] Validation zod sur les 4 API routes
- [ ] Validation DATABASE_URL

### P1 — Haute (cette semaine)
- [ ] Tests ClusterState.ts
- [ ] Tests EmulatedEnvironmentManager.ts
- [ ] Tests API routes
- [ ] Rate-limiting sur suggestions et ab-test

### P2 — Moyenne (prochaines semaines)
- [ ] Remplacer les `any` critiques
- [ ] Ajouter ARIA labels
- [ ] Internationaliser les messages
- [ ] Extraire les fonctions longues

### P3 — Basse (backlog)
- [ ] Résoudre tous les TODOs
- [ ] Standardiser throw → Result partout
- [ ] Tests composants UI
- [ ] Améliorer feedback validation
