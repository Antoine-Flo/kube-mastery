# Plan : Système de Drills CKA

> Rapport issu de la session de conception du 9 avril 2026.

---

## Contexte et décision

L'objectif est d'ajouter un mode d'entraînement distinct des cours — orienté **répétition, vitesse, et muscle memory** pour préparer le CKA. Ce mode s'appelle **Drill** (terme pédagogique standard pour les exercices de pratique procédurale).

L'infrastructure de base existe déjà sous le nom `tasks` (pages, content layer, progress tracking, terminal interactif). Le premier chantier est donc un **renommage complet** `tasks → drills`, suivi de l'implémentation des nouvelles fonctionnalités.

---

## Principes pédagogiques retenus

### Le modèle de scaffolding progressif ("vanishing cues")

Pour construire de la mémoire procédurale sur des commandes CLI, la progression optimale documentée est en 4 phases :

| Phase | Format | Objectif |
|---|---|---|
| **Observé** | Solution complète lisible | Encoder le pattern complet |
| **Guidé** | Solution visible, l'utilisateur retape | Activer la mémoire motrice |
| **Partiel** | Commandes avec blancs | Forcer le rappel actif |
| **Libre** | Énoncé seul, aucune aide | Test de rappel total (mode exam) |

La phase "Partiel" est le pont critique souvent sauté — le cerveau confond **familiarité** (je reconnais) avec **récupération** (je sais produire).

### Point d'entrée avec choix de mode

À l'ouverture d'un drill, deux options sont proposées :

```
┌────────────────────────────────────────────────────┐
│  Drill: Pod Basics                                 │
│                                                    │
│  [ Commencer guidé (bouton principal) ]            │
│    Avec les solutions — idéal pour débuter         │
│                                                    │
│  [ Mode exam ⏱ (bouton secondaire) ]               │
│    Direct, chronométré — je connais déjà           │
└────────────────────────────────────────────────────┘
```

- **Bouton primaire** : mode guidé (évite l'échec décourageant pour les débutants)
- **Bouton secondaire** : mode exam direct (légitime pour les utilisateurs confiants)
- Pas de "skip" avec connotation négative — c'est un **choix de niveau**, pas un raccourci

Cette approche est validée par la recherche (études Coursera/Khan Academy) : les apprenants avancés abandonnent les exercices trop scaffoldés, et ceux qui sautent trop tôt et échouent reviennent d'eux-mêmes au mode guidé.

### Timer et objectif CKA

Le CKA est chronométré (2h, 17 questions). La vraie compétence n'est pas "je me souviens" mais "je complète en moins de X minutes". Le timer doit être **visible pendant l'exercice** et le résultat comparé à un objectif CKA-réaliste affiché à la fin.

### Variantes paramétrées (interleaving)

Pour éviter la mémorisation de surface, chaque drill peut être rejoué avec des valeurs mutées (image, namespace, labels, noms). L'interleaving force la compréhension du pattern plutôt que la mémorisation de la commande exacte.

---

## Étape 1 : Renommage `tasks → drills`

### Dossiers à renommer

| Avant | Après |
|---|---|
| `src/pages/[lang]/tasks/` | `src/pages/[lang]/drills/` |
| `src/content/tasks/` | `src/content/drills/` |
| `tests/unit/content/tasks/` | `tests/unit/content/drills/` |
| `src/courses/tasks/` (glob target) | `src/courses/drills/` |

### Fichiers à modifier (contenu)

#### `src/content/drills/glob-adapter.ts`
- Chemins glob : `../../courses/tasks/` → `../../courses/drills/`
- `parts.indexOf('tasks')` → `parts.indexOf('drills')`
- Renommer les fonctions/exports : `createTaskGlobAdapter` → `createDrillGlobAdapter`

#### `src/content/drills/types.ts`
- `TaskLocation` → `DrillLocation`
- `TaskOverview` → `DrillOverview`
- `TaskGroupOverview` → `DrillGroupOverview`
- `TaskGroupListItem` → `DrillGroupListItem`
- `TaskGroupMeta` → `DrillGroupMeta`

#### `src/content/drills/port.ts`
- `TaskIndexPort` → `DrillIndexPort`
- `TaskContentPort` → `DrillContentPort`
- `TaskGlobAdapter` → `DrillGlobAdapter`
- Toutes les méthodes `getTask*` → `getDrill*`

#### `src/content/drills/domain.ts`
- `buildTaskGroupOverview` → `buildDrillGroupOverview`
- `buildTaskGroupList` → `buildDrillGroupList`

#### `src/content/drills/facade.ts`
- `getTaskGroups` → `getDrillGroups`
- `getTaskGroupOverview` → `getDrillGroupOverview`
- `getTaskContent` → `getDrillContent`

#### `src/content/drills/constants.ts`
- `DEMO_TASK_GROUP_ID` → `DEMO_DRILL_GROUP_ID`
- `DEMO_TASK_ID` → `DEMO_DRILL_ID`

#### `src/middleware.ts`
```ts
// Avant
if (/^\/(en|fr)\/tasks(?:\/|$)/.test(pathname)) {
// Après
if (/^\/(en|fr)\/drills(?:\/|$)/.test(pathname)) {
```

#### `src/lib/progress/port.ts`
```ts
// Avant
export type CompletionType = 'lesson' | 'task'
// Après
export type CompletionType = 'lesson' | 'drill'
```

#### `src/lib/progress/server.ts`
```ts
// Avant
export async function getCompletedTaskIds(...)
  return repo.getCompletedItemIds(user.id, 'task')
// Après
export async function getCompletedDrillIds(...)
  return repo.getCompletedItemIds(user.id, 'drill')
```

#### `src/lib/progress/sendProgressBeacon.ts`
```ts
// Avant
| { type: 'task'; targetId: string }
// Après
| { type: 'drill'; targetId: string }
```

#### `messages/en.json` et `messages/fr.json`
| Clé avant | Clé après |
|---|---|
| `taskComplete_congrats` | `drillComplete_congrats` |
| `tasks_doneButton` | `drills_doneButton` |

#### Pages Astro
- Mettre à jour tous les imports depuis `content/tasks/` → `content/drills/`
- Mettre à jour les routes `localePath('/tasks/...')` → `localePath('/drills/...')`
- Mettre à jour les `data-task-*` attributes → `data-drill-*`

#### Tests
- `tests/unit/content/tasks/domain.test.ts` → `tests/unit/content/drills/domain.test.ts`
- Mettre à jour tous les imports internes

#### CSS (mineure)
- `src/components/lesson/ContentWithTerminalLayout.astro` : `.lp__task-complete` → `.lp__drill-complete`

### Point d'attention : Supabase

Le `CompletionType` `'task'` est probablement persisté en base (colonne `type` dans la table de progress). **Avant le renommage**, vérifier si des données existantes ont la valeur `'task'` et prévoir une migration SQL si nécessaire.

---

## Étape 2 : Nouvelles fonctionnalités Drills

### 2.1 Mode guidé vs mode exam

Ajouter un écran d'entrée pour chaque drill avec le choix du mode. Deux approches possibles :

**Option A — Query param** (plus simple, recommandé pour commencer)
```
/en/drills/pod-basics/01-create-pod?mode=guided
/en/drills/pod-basics/01-create-pod?mode=exam
```

**Option B — Page intermédiaire dédiée** (UX plus riche, effort plus élevé)
```
/en/drills/pod-basics/01-create-pod  →  écran de choix de mode
/en/drills/pod-basics/01-create-pod/guided
/en/drills/pod-basics/01-create-pod/exam
```

### 2.2 Mode guidé : affichage de la solution

Dans le contenu markdown des drills, utiliser une convention de bloc pour marquer les solutions :

```md
## Tâche 1 — Créer le namespace

Crée un namespace `exercise-01`.

:::solution
kubectl create namespace exercise-01
:::
```

Le composant de rendu gère l'affichage conditionnel :
- En mode guidé : les blocs `:::solution` sont affichés sous forme d'accordéon `<details>` (révélation à la demande)
- En mode exam : les blocs `:::solution` sont complètement masqués

### 2.3 Timer côté client

- Démarré à l'ouverture de la page du drill
- Affiché en continu (ex: `03:42`)
- À la complétion : affiche le temps total et un objectif CKA cible (ex: `Objectif CKA : < 5 min`)
- Stocké localement pour afficher les meilleurs temps sur la page de liste

### 2.4 Variantes paramétrées (v2)

Données mutables dans les métadonnées du drill :
```ts
interface DrillGroupMeta {
  title: { en: string; fr: string }
  description?: { en?: string; fr?: string }
  environment?: string
  variants?: DrillVariant[]  // nouveau
}

interface DrillVariant {
  namespace?: string
  image?: string
  labels?: Record<string, string>
}
```

Un bouton "Rejouer avec variantes" sur la page de complétion charge aléatoirement une des variantes définies.

---

## Ordre d'implémentation recommandé

1. **Renommage complet** `tasks → drills` (mécanique, aucun risque fonctionnel)
2. **Vérification et migration Supabase** si des données `'task'` existent
3. **Écran d'entrée** avec choix guidé / exam (query param `?mode=`)
4. **Blocs `:::solution`** dans le rendu markdown + affichage conditionnel
5. **Timer client** + affichage du résultat à la complétion
6. **Variantes** (v2, après validation de l'expérience de base)

---

## Périmètre du renommage en résumé

| Catégorie | Nombre de fichiers |
|---|---|
| Dossiers à renommer | 4 |
| Fichiers TS/Astro à modifier | ~12 |
| Clés i18n à renommer | 2 |
| Tests à mettre à jour | 1 |
| Point d'attention DB | 1 (migration Supabase) |
