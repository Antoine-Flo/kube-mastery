# Drills CKA : référence produit et technique

> Document de conception initial (avril 2026), mis à jour pour refléter l’implémentation dans le dépôt.

---

## Contexte

Mode d’entraînement distinct des cours, orienté **répétition, vitesse et mémoire procédurale** pour le CKA. Le produit utilise le terme **Drill** pour ces exercices.

---

## Principes pédagogiques

### Scaffolding progressif (« vanishing cues »)

| Phase       | Format                                 | Objectif                                                   |
| ----------- | -------------------------------------- | ---------------------------------------------------------- |
| **Observé** | Solution complète lisible              | Encoder le pattern complet                                 |
| **Guidé**   | Solution visible, l’utilisateur retape | Activer la mémoire motrice                                 |
| **Partiel** | Commandes avec blancs                  | Forcer le rappel actif (non implémenté comme format dédié) |
| **Libre**   | Énoncé seul, aucune aide               | Test de rappel total (**mode exam** dans l’app)            |

### Point d’entrée : choix de mode

Sans `?mode=`, la page drill affiche un **écran de choix** (guidé vs exam chronométré). Avec `?mode=guided` ou `?mode=exam`, le terminal et le contenu s’affichent.

### Timer et objectif CKA

Chronomètre visible pendant l’exercice ; à la fin, comparaison possible avec un objectif défini dans les métadonnées du groupe (`ckaTargetMinutes` dans `group.ts`).

### Variantes paramétrées (v2, non livré)

Rejouer avec des valeurs mutées (namespace, image, labels) pour de l’interleaving : prévu côté métadonnées et bootstrap, pas encore branché en produit.

---

## Référence technique : ce qui est en place

### URLs et routes

| Rôle                                  | Exemple (`en`)                               |
| ------------------------------------- | -------------------------------------------- |
| Liste d’un groupe                     | `/en/drills/{groupId}`                       |
| Drill (choix de mode si pas de query) | `/en/drills/{groupId}/{drillId}`             |
| Drill en mode guidé                   | `/en/drills/{groupId}/{drillId}?mode=guided` |
| Drill en mode exam                    | `/en/drills/{groupId}/{drillId}?mode=exam`   |
| Complétion (après « Terminé »)        | `/en/drills/{groupId}/{drillId}/complete`    |

Redirections HTTP : `/en/tasks/[...path]` et `/fr/tasks/[...path]` vers les chemins équivalents sous `/drills/` (voir `astro.config.mjs`).

`middleware` : en-tête `noindex` sur les chemins `/(en|fr)/drills/`.

### Structure des dossiers

| Chemin                                         | Rôle                                                                              |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/content/drills/`                          | Couche contenu : `facade`, `glob-adapter`, `domain`, `types`, `port`, `constants` |
| `src/courses/drills/{groupId}/`                | Données éditoriales : `group.ts`, `{drillDir}/en\|fr/content.md`                  |
| `src/pages/[lang]/drills/[groupId]/`           | Liste du groupe (`index.astro`)                                                   |
| `src/pages/[lang]/drills/[groupId]/[drillId]/` | Page drill (`index.astro`) et page fin (`complete.astro`)                         |
| `tests/unit/content/drills/`                   | Tests du domaine (ex. `domain.test.ts`)                                           |

Globs Vite : préfixe de chemins `../../courses/drills/` ; segment de répertoire **`drills`** dans les chemins logiques (pas `tasks`).

Identifiants démo publics (sans compte pour le groupe démo) : `DEMO_DRILL_GROUP_ID`, `DEMO_DRILL_ID` dans `src/content/drills/constants.ts`.

### API et persistance

- **Type applicatif** (`src/lib/progress/port.ts`) : `CompletionType = 'lesson' | 'drill'`.
- **Beacon** (`sendProgressBeacon`) : `{ type: 'drill', targetId }` avec `targetId` au format `groupId/drillId`.
- **POST `/api/progress/complete`** : accepte `type: 'drill'` ; **`type: 'task'`** est encore accepté temporairement pour d’anciens clients, stocké en base comme **`drill`**.
- **Schéma Drizzle** (`src/db/schema.ts`) : table `completions`, colonne `type` en texte libre ; la constante `COMPLETION_TYPES` inclut **`drill`** à des fins de documentation. Les **migrations SQL** (y compris renommage éventuel d’anciennes lignes `task` → `drill`) sont gérées **via Drizzle** par l’équipe, pas via des fichiers SQL ad hoc dans ce dépôt.

### Markdown drills

- Blocs **`:::solution` … `:::`** : plugin Remark `src/plugins/remark-drill-solution-blocks.ts`, enregistré dans `astro.config.mjs`.
- Rendu : bloc repliable (`<details>`) avec classe `.drill-solution` ; en **mode exam**, masquage par CSS sur `article.lesson-content[data-drill-mode="exam"]` (voir `src/styles/components/lesson-content.css`).

### UI

- Barre de temps et enregistrement du temps avant navigation vers la page `complete` (sessionStorage).
- Page `complete` : affichage du temps, objectif CKA si défini, sondage avec `name: 'drill'` et `drillId` (API survey accepte aussi l’ancien couple `task` / `taskId`).
- Liste groupe : meilleur temps local quand disponible (`localStorage`, clés `drillBestSeconds:{groupId}/{drillId}`).

### i18n (extraits)

Clés dédiées incluent notamment : `drillComplete_congrats`, `drills_doneButton`, `drills_mode_*`, `drills_timer_label`, `drillComplete_timeLabel`, `drillComplete_ckaTarget`, `drills_list_bestTime` (fichiers `messages/en.json` et `messages/fr.json`).

### Styles

- Bloc actions fin de page : `.lp__drill-complete` dans `ContentWithTerminalLayout.astro`.

---

## Métadonnées groupe (`group.ts`)

Champs typiques : `title` (en/fr), `description`, `environment` (sélection du seed cluster), `ckaTargetMinutes` (optionnel, objectif affiché en fin de parcours).

---

## Suite possible (hors périmètre actuel)

1. Variantes `DrillVariant[]` sur le groupe et intégration au bootstrap du simulateur.
2. Format « partiel » (blancs dans les commandes) si vous voulez une étape explicite entre guidé et exam.
3. Retrait définitif du corps JSON `type: 'task'` côté `/api/progress/complete` une fois les clients à jour.

---

## Historique de conception

Décision initiale : renommer mécaniquement `tasks` → `drills`, puis ajouter modes, solutions markdown, timer et objectifs. Le tableau ci-dessous reste une trace du mapping des symboles (état **après** renommage, pour lecture archive).

| Ancien (`tasks`)                          | Actuel (`drills`)                          |
| ----------------------------------------- | ------------------------------------------ |
| `TaskGroupOverview`, `getTaskContent`, …  | `DrillGroupOverview`, `getDrillContent`, … |
| `localePath('/tasks/...')`                | `localePath('/drills/...')`                |
| `data-task-*`                             | `data-drill-*`                             |
| Clés `taskComplete_*`, `tasks_doneButton` | `drillComplete_*`, `drills_*`              |
