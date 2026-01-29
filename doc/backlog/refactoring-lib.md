# Refactoring lib – Règles et backlog

Chantier de refactoring de `src/lib` (et de l’organisation des domaines) pour une structure par domaine, un découplage IO / logique métier, et des conventions de nommage claires. On avance petit à petit ; à chaque nouvelle interface ou module, on ajoute des tests sur les éléments testables.

---

## 1. Règles générales

### 1.1 Trois couches

| Couche | Rôle | Peut importer | Ne fait pas |
|--------|------|----------------|-------------|
| **IO (adapters)** | Appels externes uniquement (Supabase, fetch). Retourne `{ data, error }` ou promesse brute. | `~/db/supabase` | Pas de règle métier, pas de cache, pas de mapping métier |
| **Domain** | Logique métier pure. Entrées/sorties en types métier. | `~/types/*` ou types du domaine | Jamais d’appel Supabase/fetch |
| **Application** | Orchestration : appelle l’IO, mappe (DB → métier), cache, gestion d’erreur. Expose les cas d’usage. | `~/supabase/*`, domain, types | Pas de JSX (sauf si contexte dédié UI) |

Les composants et hooks importent l’application (ou les contextes), pas directement `~/supabase/*`.

### 1.2 Organisation par domaine

- Regrouper par **domaine** sous `src/<domaine>/` :
  - **`learnable/`** : tout le parcours d’apprentissage (course, module, chapitre, leçon) + progress. Un seul domaine pour la structure et la progression.
  - **`account/`** : auth + subscription (compte utilisateur, session, abonnement).
  - **`theme/`** : préférence thème (localStorage, système).
- Chaque domaine peut contenir : `types.ts`, logique pure (ex. `access.ts`, `mappers.ts`), orchestration (ex. `loaders.ts`, `progress.ts`), `context.tsx`, `hooks/`.
- **Pas de barrel** : pas de `index.ts` qui ne fait qu’exporter. Importer directement depuis le fichier concerné (ex. `~/learnable/hooks/useLearnable`, pas `~/learnable/hooks`).
- `src/supabase/` reste la couche IO unique pour Supabase. `src/errors/` pour le partagé (AppError, catalogue).
- Éviter les noms vagues : pas de `*-utils.ts`, `*-service.ts`, `*-queries.ts` sans préciser le rôle. Préférer des noms par concept : `lesson-status.ts`, `access.ts`, `mappers.ts`, `loaders.ts`.

### 1.3 Get vs Set (IO / adapters Supabase)

- **Distinction nette** entre opérations de **lecture** (get) et d’**écriture** (set : insert, upsert, update, delete).
- **Get** : `select*`, `get*`. Retour = état tel que retourné par la DB (snake_case, types DB). Le mapping vers le type métier (camelCase, modèle code) se fait dans la couche **application**, pas dans l’adapter.
- **Set** : `insert*`, `upsert*`, `update*`. Paramètres = payload **explicitement typé** pour l’écriture (souvent snake_case pour Supabase). L’interface d’écriture peut différer de l’interface de lecture (ex. champs optionnels, valeurs par défaut, contraintes).
- Dans `src/supabase/`, un même fichier par ressource peut exporter à la fois des get et des set, mais **séparer clairement** les fonctions (ex. `selectX`, `insertX`, `upsertX`) et **documenter** le format attendu pour les set (payload = état “écriture”, pas forcément identique à l’état “lecture”).
- Le **parsing** (validation, transformation) des payloads d’écriture peut être différent du parsing des réponses de lecture : à faire dans l’application si besoin, ou dans l’adapter si c’est uniquement format DB (snake_case, dates, etc.).

### 1.4 Tests

- À chaque nouveau **interface** (port) ou **module de domaine** (logique pure, petit use-case), ajouter des **tests** sur les parties facilement testables (fonctions pures, mappers, règles d’accès).
- Les adapters Supabase (IO) peuvent rester sans tests unitaires directs ; privilégier les tests sur la logique métier et l’orchestration (en mockant l’IO si besoin).

---

## 2. Conventions de nommage

### 2.1 Couche IO (`src/supabase/`)

- Fichier par ressource ou API : `courses.ts`, `user-progress.ts`, `auth.ts`, `edge-functions.ts`.
- **Lecture** : `select*`, `get*` (ex. `selectAllActive()`, `selectById(id)`, `selectCompletedLessonsByUserId(userId)`).
- **Écriture** : `insert*`, `upsert*`, `update*` (ex. `insertSuggestion(payload)`, `upsertUserProgress(payload)`).
- Les types des **payloads d’écriture** (insert/upsert) sont définis en snake_case pour coller à la DB, ou documentés à côté de la fonction.

### 2.2 Couche domain

- Fichiers nommés par **concept** : `lesson-status.ts`, `access.ts`, `mappers.ts`, `routes.ts` (génération de routes).

### 2.3 Couche application

- **Loaders / get** : `loaders.ts` ou `get-<quoi>.ts` (ex. `get-course-by-id.ts`, `get-user-subscription.ts`).
- **Actions / set** : `mark-*.ts`, `create-*.ts` ou regroupés dans un fichier d’actions (ex. `mark-lesson-completed.ts`).

### 2.4 Contextes UI

- Un seul point d’entrée par domaine : `context.tsx` ou `AuthProvider.tsx` dans le dossier du domaine (ex. `auth/context.tsx`, `theme/context.tsx`).

---

## 3. Liste des fichiers à refactorer (lib)

À traiter progressivement. Chaque fichier doit finir dans un domaine clair, avec séparation IO / domain / application et respect get vs set.

**État actuel** : domaines **learnable/** (mappers, lesson-status, routes, progress, format-description, course-queries, module-queries, module-loader, lesson-ids-loader, local-course-loader, hooks), **account/** (context auth, get-user-subscription, access, types), **theme/** (context thème selon projet) en place. **Types** : `src/types/learnable.ts`, `src/types/course.ts`, `src/types/quiz.ts`. Supprimés de lib : auth, theme, subscription-service, progress-service, hooks/, routes, learnable-utils, types/, course-service, quiz-types, course-queries, module-queries, module-loader, lesson-ids-loader, local-course-loader. **Reste dans lib** : `errors/` uniquement.

### 3.1 Racine lib

| Fichier | Rôle actuel | Cible / remarque |
|---------|-------------|------------------|
| ~~`auth.tsx`~~ | — | Fait : `account/context.tsx`. Lib supprimé. |
| ~~`theme.tsx`~~ | — | Fait ou à la racine : `theme/context.tsx` ou `src/theme.tsx`. Lib supprimé. |
| `course-queries.ts` | Lecture courses + mapping + logique “current lesson” | Domaine **`learnable/`** : IO dans supabase ; logique "current lesson" en pur ; orchestration loaders. |
| ~~`course-service.ts`~~ | — | Fait : `src/types/course.ts`. Lib supprimé. |
| `module-queries.ts` | Lecture modules/chapters/lessons + mapping + cache + “current lesson” | Domaine **`learnable/`** : IO dans supabase ; logique + orchestration loaders. |
| ~~`module-loader.ts`~~ | — | Fait : `learnable/module-loader.ts`. Lib supprimé. |
| ~~`lesson-ids-loader.ts`~~ | — | Fait : `learnable/lesson-ids-loader.ts`. Lib supprimé. |
| ~~`local-course-loader.ts`~~ | — | Fait : `learnable/local-course-loader.ts`. Lib supprimé. |
| ~~`learnable-utils.tsx`~~ | — | Fait : learnable/format-description, mappers, lesson-status. Lib supprimé. |
| ~~`progress-service.ts`~~ | — | Fait : `learnable/progress.ts`. Lib supprimé. |
| ~~`subscription-service.ts`~~ | — | Fait : `account/get-user-subscription.ts`, `access.ts`, `types.ts`. Lib supprimé. |
| ~~`routes.ts`~~ | — | Fait : `learnable/routes`. Lib supprimé. |
| ~~`quiz-types.ts`~~ | — | Fait : `src/types/quiz.ts`. Lib supprimé. |

### 3.2 errors/

**`src/errors/`** (hors lib) : `AppError.ts`, `Errors.ts`. Rester partagé.

### 3.3 hooks/

**`lib/hooks/`** a été supprimé. Tous les hooks (useLearnable, useLearnableProgress, useLearnableGrouping, useLearnableActions, useEmulatedEnvironmentLoader) sont dans **`learnable/hooks/`**.

### 3.4 types/ (sous lib)

**`lib/types/`** supprimé. LearnableItem est dans **`src/types/learnable.ts`**.

---

## 4. Ordre suggéré (par petits pas)

1. **Domaine learnable** : fait (mappers, lesson-status, routes, progress, format-description, course-queries, module-queries, module-loader, lesson-ids-loader, local-course-loader, hooks).
2. **Domaine account** : fait. **Reste** : tests sur `access.ts` (isSubscriptionActive).
3. **Domaine theme** : selon projet — soit `src/theme.tsx`, soit `theme/context.tsx`. Aligner imports sur un seul chemin (`~/theme/...`).
4. **Nettoyage** : fait. **Reste dans lib** : `errors/` uniquement (AppError, Errors). Optionnel : déplacer errors vers `src/errors/`.

---

## 5. Rappel get vs set (résumé)

- **Supabase (IO)** : fonctions `select*` / `get*` pour la lecture ; fonctions `insert*` / `upsert*` / `update*` pour l’écriture. Payload d’écriture typé et documenté (interface peut différer de la réponse de lecture).
- **Application** : couche qui appelle ces fonctions, fait le mapping DB → métier pour les get, et prépare les payloads pour les set (éventuellement métier → DB). Bien séparer les cas d’usage “get” et “set” dans les noms et fichiers.
