# Rapport d'Audit Complet - Kube Mastery

**Date** : 29 janvier 2026  
**Auditeur** : Claude (Cursor Agent)  
**Version** : 1.0

---

## Résumé Exécutif

| Catégorie        | Score      | Criticité          |
| ---------------- | ---------- | ------------------ |
| Sécurité         | 5/10       | 🔴 Critique        |
| Qualité du code  | 7/10       | 🟠 Moyenne         |
| Couverture tests | 6/10       | 🟠 Moyenne         |
| Maintenabilité   | 7/10       | 🟡 Basse           |
| UX/Accessibilité | 6/10       | 🟠 Moyenne         |
| **Score Global** | **6.2/10** | **Action requise** |

### Problèmes critiques identifiés

1. **23 vulnérabilités npm** dont 8 hautes (seroval RCE, h3 request smuggling, tar path traversal)
2. **XSS potentiel** dans le rendu Markdown (pas de sanitization avec DOMPurify)
3. **CORS wildcard** sur les Edge Functions Supabase
4. **Pas de rate limiting** sur les API publiques
5. **RLS trop permissif** sur les tables A/B test

---

## 1. Sécurité

### 1.1 Vulnérabilités des dépendances (npm audit)

| Sévérité    | Nombre | Packages concernés         |
| ----------- | ------ | -------------------------- |
| 🔴 High     | 8      | seroval, h3, tar           |
| 🟠 Moderate | 12     | esbuild, lodash, lodash-es |
| 🟡 Low      | 3      | diff, @supabase/auth-js    |

#### Vulnérabilités critiques

| Package                     | CVE                 | Impact                           | Action                 |
| --------------------------- | ------------------- | -------------------------------- | ---------------------- |
| `seroval` ≤1.4.0            | GHSA-3rxj-6cgf-8cfw | **RCE** via JSON Deserialization | ⚠️ `npm audit fix`     |
| `seroval` ≤1.4.0            | GHSA-hj76-42vx-jwp4 | Prototype Pollution              | ⚠️ `npm audit fix`     |
| `h3` ≤1.15.4                | GHSA-mp2g-9vg9-f4cg | Request Smuggling                | Mise à jour vinxi      |
| `tar` ≤7.5.6                | GHSA-8qq5-rm4j-mr97 | Arbitrary File Overwrite         | ⚠️ `npm audit fix`     |
| `@supabase/auth-js` <2.69.1 | GHSA-8r88-6cj9-9fh5 | Insecure Path Routing            | Override bloque la fix |

**Action immédiate** : `npm audit fix` corrige la majorité. L'override `@supabase/auth-js: 2.61.0` bloque la correction de la vulnérabilité auth — **à revoir en priorité**.

### 1.2 Vulnérabilités API Routes

| Route                     | Criticité | Problème                              | Recommandation         |
| ------------------------- | --------- | ------------------------------------- | ---------------------- |
| `/api/suggestions/submit` | 🔴 Haute  | Pas de limite de taille sur `text`    | Max 5000 chars         |
| `/api/survey/submit`      | 🔴 Haute  | `responses` sans validation structure | Validation Zod         |
| `/api/ab-test/track`      | 🔴 Haute  | Aucun rate limiting                   | 100 events/min/visitor |
| `/api/seeds/[name]`       | 🟡 Basse  | Liste les scénarios en erreur 404     | Message générique      |

**Code à ajouter dans chaque route** :

```typescript
import { z } from 'zod'

const MAX_BODY_SIZE = 10 * 1024 // 10KB
const contentLength = parseInt(request.headers.get('content-length') || '0')
if (contentLength > MAX_BODY_SIZE) {
  return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413 })
}

const SuggestionSchema = z.object({
  text: z.string().min(1).max(5000),
  lessonId: z.string().min(1).max(200),
  userId: z.string().uuid().optional(),
  visitorId: z.string().max(100).optional()
})
```

### 1.3 Vulnérabilités XSS Frontend

| Fichier                  | Ligne | Problème                           | Criticité   |
| ------------------------ | ----- | ---------------------------------- | ----------- |
| `lesson-content.tsx`     | 95    | `innerHTML` sans DOMPurify         | 🔴 Critique |
| `lesson-content.tsx`     | 17    | Mermaid `securityLevel: 'loose'`   | 🔴 Critique |
| `local-course-loader.ts` | 59    | `onclick` inline dans HTML généré  | 🟠 Haute    |
| `module-loader.ts`       | 53    | `marked.parse()` sans sanitization | 🟠 Haute    |

**Fix requis** :

```typescript
import DOMPurify from 'dompurify'

// Avant injection dans innerHTML
const sanitizedHtml = DOMPurify.sanitize(html, {
  ALLOWED_TAGS: [
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'li',
    'a',
    'code',
    'pre',
    'blockquote',
    'em',
    'strong',
    'img'
  ],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'class']
})
contentRef.innerHTML = sanitizedHtml

// Mermaid sécurisé
mermaid.initialize({ securityLevel: 'strict' })
```

### 1.4 Vulnérabilités Auth & Supabase

| Problème                     | Criticité   | Fichier                         |
| ---------------------------- | ----------- | ------------------------------- |
| CORS `*` sur Edge Functions  | 🔴 Critique | `supabase/functions/*/index.ts` |
| Pas de rate limiting auth    | 🔴 Haute    | `routes/[[lang]]/auth.tsx`      |
| Pas de protection CSRF       | 🟠 Haute    | `middleware.ts`                 |
| Cache subscriptions sans TTL | 🟡 Moyenne  | `get-user-subscription.ts`      |

**Fix CORS Edge Functions** :

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://votre-domaine.com', // Pas '*'
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}
```

### 1.5 Vulnérabilités RLS Database

| Table                 | Opération     | Risque                    | Recommandation               |
| --------------------- | ------------- | ------------------------- | ---------------------------- |
| `ab_test_assignments` | UPDATE (anon) | 🔴 Manipulation variantes | Supprimer policy UPDATE anon |
| `ab_test_events`      | INSERT (anon) | 🟠 DoS par spam           | Rate limit + trigger         |
| `survey`              | INSERT (anon) | 🟠 Spam                   | Rate limit                   |
| `suggestions`         | INSERT (anon) | 🟠 Spam                   | Rate limit                   |

---

## 2. Qualité du Code

### 2.1 Violations des Conventions

| Convention             | Violations | Fichiers                                               |
| ---------------------- | ---------- | ------------------------------------------------------ |
| Pas de `switch`        | 3          | DeploymentController, ReplicaSetController, ReplicaSet |
| Pas de `throw`         | 3          | TerminalManager, EmulatedEnvironmentManager, loader    |
| Return avec braces     | 5+         | TerminalManager, lazy.ts                               |
| Max 50 lignes/fonction | 5          | ClusterState (142), handleGet (71), describeFormatters |

#### Fichiers prioritaires à refactoriser

1. **`src/core/cluster/ClusterState.ts`** — 142 lignes dans `createClusterState`
   - Extraire : `createResourceFacade`, `createNodeFacade`, `setupEventHandling`

2. **`src/core/cluster/controllers/DeploymentController.ts`** — switch + duplication
   - Remplacer switch par object lookup `EVENT_HANDLERS`
   - Extraire helpers communs avec ReplicaSetController

3. **`src/core/terminal/TerminalManager.ts`** — throw + returns sans braces
   - Remplacer `throw` par `Result<T>`

### 2.2 Code Dupliqué

| Pattern              | Fichiers                                   | Action                          |
| -------------------- | ------------------------------------------ | ------------------------------- |
| `makeKey`/`parseKey` | DeploymentController, ReplicaSetController | Extraire dans `helpers.ts`      |
| `enqueueOwner*`      | Les 2 controllers                          | Créer `enqueueOwnerResource<T>` |
| Formatage JSON/YAML  | `get.ts` (4 fonctions similaires)          | Créer `formatResourceList<T>`   |
| Validation fichiers  | `FileSystem.ts` (2 fonctions)              | Créer `validateNodeCreation<T>` |

### 2.3 Couplage Fort

- `ClusterState.ts` dépend de ~15 modules (events, repositories, toutes les ressources)
- `TerminalController.ts` a un TODO `clusterState: {} as any`
- `kubectl/executor.ts` dépend de tous les handlers individuellement

**Recommandation** : Améliorer l'injection de dépendances, utiliser des interfaces.

---

## 3. Couverture de Tests

### 3.1 Métriques Actuelles

- **Tests passants** : 1320
- **Fichiers de tests** : 72
- **Couverture estimée** : ~70% (modules testés) mais ~40% (projet entier)

### 3.2 Modules Sans Tests (Priorité Haute)

| Module     | Fichier                                                                           | Impact              |
| ---------- | --------------------------------------------------------------------------------- | ------------------- |
| shared     | `result.ts`, `parsing.ts`, `formatter.ts`, `deepFreeze.ts`                        | Utilisé partout     |
| cluster    | `repositories/resourceRepository.ts`, `seeds/loader.ts`, `controllers/helpers.ts` | Base du cluster     |
| kubectl    | `yamlParser.ts`, `handlers/applyCreate.ts`, `handlers/describe.ts`                | Commandes critiques |
| emulated   | `EmulatedEnvironmentManager.ts`                                                   | Cycle de vie app    |
| storage    | `indexedDBAdapter.ts`                                                             | Persistence         |
| containers | `ImageRegistry.ts`                                                                | Validation images   |

### 3.3 Tests d'Intégration Manquants

1. **Cycle de vie Kubernetes** : Deployment → ReplicaSet → Pod → Scheduler
2. **Filesystem + Cluster** : `kubectl apply` avec YAML du filesystem
3. **Terminal E2E** : Exécution complète de commandes
4. **EventBus** : Propagation d'événements entre controllers
5. **Persistence** : Sauvegarde/restauration IndexedDB

### 3.4 Plan de Tests Prioritaires

| Phase              | Modules                                                             | Effort       |
| ------------------ | ------------------------------------------------------------------- | ------------ |
| Phase 1 (immédiat) | shared/\*, resourceRepository, yamlParser, controllers/helpers      | 2-3 jours    |
| Phase 2 (semaine)  | applyCreate, describe, EmulatedEnvironmentManager, indexedDBAdapter | 1 semaine    |
| Phase 3 (mois)     | Tests d'intégration, edge cases, error handling                     | 2-3 semaines |

---

## 4. Maintenabilité

### 4.1 Points Forts

- Architecture modulaire claire (`src/core/` bien structuré)
- Patterns cohérents (Factory, Result, EventBus)
- TypeScript strict
- Documentation contexte (`doc/context/`) à jour

### 4.2 Points d'Amélioration

| Aspect                | Problème                             | Solution                                             |
| --------------------- | ------------------------------------ | ---------------------------------------------------- |
| ESLint                | Package non installé                 | `npm install -D eslint @eslint/js typescript-eslint` |
| Injection dépendances | TODO avec `as any`                   | Passer les deps explicitement                        |
| Découplage            | ClusterState trop central            | Interface + injection                                |
| Documentation         | Pas de JSDoc sur fonctions publiques | Ajouter JSDoc                                        |

### 4.3 Alignement Doc/Code

- `doc/context/architecture.md` mentionne `src/lib/` qui n'existe pas
- Les conventions sont globalement respectées (~85%)

---

## 5. UX et Accessibilité

### 5.1 Problèmes d'Accessibilité

| Problème                  | Fichier              | Recommandation          |
| ------------------------- | -------------------- | ----------------------- |
| Boutons sans `aria-label` | `editor-overlay.tsx` | Ajouter aria-label      |
| Pas de focus trap         | `dialog.tsx`         | Implémenter focus trap  |
| Pas de skip links         | Layout               | Ajouter skip to content |
| Contraste non vérifié     | CSS                  | Audit de contraste      |

### 5.2 Améliorations UX Recommandées

| Amélioration                      | Priorité   | Effort    |
| --------------------------------- | ---------- | --------- |
| Skeleton loaders pour contenu     | 🟠 Haute   | 1-2 jours |
| Messages d'erreur user-friendly   | 🟠 Haute   | 1 jour    |
| Validation temps réel formulaires | 🟡 Moyenne | 2-3 jours |
| Retry logic erreurs réseau        | 🟡 Moyenne | 1 jour    |
| Feedback visuel actions longues   | 🟡 Moyenne | 1 jour    |

### 5.3 Regex ReDoS

```typescript
// src/components/quiz/questions/TerminalCommandQuestion.tsx:59
const regex = new RegExp(expectedCommand) // ⚠️ ReDoS si expectedCommand est complexe
```

**Fix** : Valider/limiter la complexité des patterns regex.

---

## 6. Actions Prioritaires

### 🔴 Immédiat (cette semaine)

| #   | Action                                              | Effort | Impact                     |
| --- | --------------------------------------------------- | ------ | -------------------------- |
| 1   | `npm audit fix`                                     | 10 min | Corrige 15+ vulnérabilités |
| 2   | Revoir override `@supabase/auth-js`                 | 1h     | Vulnérabilité auth         |
| 3   | Ajouter DOMPurify pour markdown                     | 2h     | XSS critique               |
| 4   | Changer Mermaid `securityLevel: 'strict'`           | 5 min  | XSS critique               |
| 5   | Restreindre CORS Edge Functions                     | 30 min | Sécurité critique          |
| 6   | Supprimer RLS UPDATE anon sur `ab_test_assignments` | 30 min | Manipulation data          |

### 🟠 Court terme (2 semaines)

| #   | Action                                     | Effort    | Impact         |
| --- | ------------------------------------------ | --------- | -------------- |
| 7   | Ajouter validation Zod sur API routes      | 1 jour    | Sécurité       |
| 8   | Implémenter rate limiting API              | 1-2 jours | DoS protection |
| 9   | Installer et configurer ESLint             | 2h        | Qualité code   |
| 10  | Tests pour shared/\* et resourceRepository | 2-3 jours | Couverture     |
| 11  | Remplacer switch par object lookup         | 1 jour    | Conventions    |

### 🟡 Moyen terme (1 mois)

| #   | Action                             | Effort    | Impact                 |
| --- | ---------------------------------- | --------- | ---------------------- |
| 12  | Refactoriser ClusterState          | 2-3 jours | Maintenabilité         |
| 13  | Tests d'intégration E2E            | 1 semaine | Robustesse             |
| 14  | Améliorer injection de dépendances | 2-3 jours | Testabilité            |
| 15  | Audit accessibilité complet        | 2-3 jours | Conformité             |
| 16  | Skeleton loaders et UX polish      | 1 semaine | Expérience utilisateur |

---

## 7. Métriques Cibles

| Métrique               | Actuel     | Cible | Délai     |
| ---------------------- | ---------- | ----- | --------- |
| Vulnérabilités npm     | 23         | 0     | 1 semaine |
| Couverture tests       | ~40%       | 80%   | 2 mois    |
| Violations conventions | ~11        | 0     | 1 mois    |
| Score accessibilité    | Non mesuré | AA    | 2 mois    |
| Score Lighthouse       | Non mesuré | >90   | 2 mois    |

---

## Annexes

### A. Commandes utiles

```bash
# Sécurité
npm audit                          # Voir vulnérabilités
npm audit fix                      # Corriger auto
npm audit fix --force              # Corriger avec breaking changes

# Tests
npm test                           # Tous les tests
npm run coverage                   # Avec couverture
npm test -- tests/unit/shared/     # Tests spécifiques

# Qualité
npm run tsc                        # Type check
npm run knip                       # Exports inutilisés
npm run lint                       # ESLint (après install)
```

### B. Fichiers à créer

1. `eslint.config.js` — Configuration ESLint flat config
2. `src/lib/sanitize.ts` — Wrapper DOMPurify
3. `src/middleware/rateLimit.ts` — Rate limiting
4. `tests/integration/` — Tests d'intégration

### C. Dépendances à ajouter

```bash
npm install dompurify
npm install -D @types/dompurify eslint @eslint/js typescript-eslint
```

---

## Conclusion

Le projet a une bonne base architecturale mais présente des vulnérabilités de sécurité critiques qui doivent être corrigées en priorité. L'exécution de `npm audit fix` et l'ajout de DOMPurify sont les actions les plus urgentes. La couverture de tests doit être améliorée, notamment sur les modules utilitaires partagés.

Le score global de 6.2/10 peut facilement atteindre 8/10 avec les corrections des 2 premières semaines.
