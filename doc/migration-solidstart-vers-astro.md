# Plan de migration : SolidStart → Astro

## État de la migration

- **Fait** : Stack Astro, pages `[lang]`, `[type]/[id]/[lessonId]`, API auth et progress/complete, core (terminal, cluster, kubectl), seeds dans `src/courses/seeds/` (sans API), layout, i18n (`messages/*.json` + `src/i18n/`), contenu cours (content collections, facades).
- **À migrer** : Drizzle / `src/db/` (schéma, client Postgres) ; tests (Vitest, `tests/unit/`, `tests/conformance/`, golden files dans `bin/`).

Référence structure actuelle : `doc/context/architecture.md`, `doc/audit/entry-points.md`.

---

**Objectif** : Migrer Kube Mastery de SolidStart (SolidJS) vers Astro, de façon incrémentale, en profitant pour améliorer l’existant.

**Contexte** : Le nouveau projet Astro est à la racine. i18n via `messages/*.json` et `src/i18n/` (sans Paraglide).

---

## Principes

- **Pas de `:global`** : ne pas utiliser `:global()` dans les styles Astro. C’est moche, difficile à lire et souvent inutile (on met les styles au bon endroit : là où les classes sont définies, pas dans un composant parent qui reçoit du slot).
- **Petit à petit** : une étape à la fois, validée avant la suivante.
- **Améliorer en migrant** : simplifier, renommer, supprimer le mort (pas de copier-coller aveugle).
- **Ne pas garder de legacy** : pas de code de compatibilité SolidStart dans Astro.
- **Références** : `doc/context/architecture.md`, `spec.md`, `conventions.md`.

---

## Vue d’ensemble des étapes

| Phase | Contenu                                | Risque | État                                           |
| ----- | -------------------------------------- | ------ | ---------------------------------------------- |
| 0     | Préparation & structure                | Faible | Fait                                           |
| 1     | Pages statiques / marketing            | Faible | Fait (partiel : pricing, privacy, terms)       |
| 2     | Layout, UI de base, thème              | Faible | Fait                                           |
| 3     | i18n & routing par langue              | Moyen  | Fait                                           |
| 4     | Contenu cours (markdown)               | Moyen  | Fait                                           |
| 5     | Routes learn (type/id/lessons)         | Moyen  | Fait                                           |
| 6     | Terminal + cluster (îlots interactifs) | Élevé  | Fait (terminal + cluster viewer)               |
| 7     | Quiz, auth, API                        | Élevé  | Fait (auth, quiz, user progress) ; API à faire |
| 8     | Tests, CI, nettoyage                   | Moyen  | À faire                                        |

---

## Phase 0 : Préparation & structure

**But** : Aligner la structure du projet Astro avec ce dont on aura besoin, sans casser l’existant.

1. **Structure des dossiers**
   - Créer `src/pages/[lang]/` pour le routing i18n (on détaillera en phase 3).
   - Décider où mettre le “core” (terminal, cluster, kubectl) : par ex. `src/core/` en copie adaptée depuis `old/src/core/` au moment voulu.
   - Garder `old/` en lecture seule comme référence ; ne pas y toucher sauf pour extraire du code.

2. **Styles**
   - Copier `old/src/styles/variables.css` (et éventuellement `reset.css`) vers `src/styles/`.
   - Vérifier que les variables (couleurs, tokens) sont utilisables depuis les composants Astro.
   - **Amélioration** : supprimer les CSS inutilisés de l’ancien projet avant de s’en inspirer.

3. **Config & env**
   - Reproduire les variables d’environnement utiles (Supabase, etc.) dans `.env.example` et doc.
   - Vérifier `astro.config.mjs` (adapter node, output, Paraglide déjà en place).

**Validation** : `npm run build` passe, la home Astro s’affiche avec les bons styles de base.

---

## Phase 1 : Pages statiques / marketing

**But** : Avoir en Astro les pages sans logique métier lourde.

**Pages cibles (dans `old/src/routes/[[lang]]/`)** :

- `index.tsx` → `src/pages/[lang]/index.astro` (ou `src/pages/index.astro` + redirection i18n selon choix phase 3).
- `contact.tsx`, `pricing.tsx`, `privacy-policy.tsx`, `terms-of-service.tsx`, `survey.tsx`.

**Pricing** : Migrée dans `src/pages/[lang]/pricing.astro`. Politique mise à jour : **one-time full access** (paiement unique, accès à vie), toujours « coming soon » ; section « Coming Soon » (liste de fonctionnalités à venir) et ses traductions supprimées.

**Étapes :**

1. Choisir une page simple (ex. `contact` ou `terms-of-service`).
2. Lire le contenu et les textes dans l’ancien composant (et les clés i18n dans `messages/`).
3. Créer la page en `.astro`, en utilisant les clés Paraglide (déjà configuré).
4. Reproduire le contenu et les liens, sans réutiliser de composants Solid.
5. Répéter pour chaque page statique.
6. **Amélioration** : uniformiser les titres (meta), le format des textes, et supprimer le superflu.

**Validation** : Chaque page est accessible, rendue correctement, et les textes viennent de Paraglide.

---

## Phase 2 : Layout & UI de base

**But** : Un layout commun (navbar, footer, thème) et des composants UI réutilisables.

1. **Layout**
   - Créer `src/layouts/MainLayout.astro` (ou équivalent) : structure HTML, Navbar, main, Footer.
   - S’inspirer de `old/src/app.tsx` (structure) et des composants `navbar.tsx`, `footer.tsx`.
   - En Astro : pas de “providers” Solid ; le thème peut être géré par classe sur `<html>` + CSS (voir `old/src/theme.tsx` pour le comportement attendu).

2. **Composants UI**
   - Lister les primitives utilisées dans l’ancien projet : `old/src/components/ui/` (button, dialog, input, card, etc.).
   - Les recréer en `.astro` (ou en composants d’îlot si besoin d’interactivité forte) au fur et à mesure des besoins.
   - **Amélioration** : réduire le nombre de variantes, nommer clairement (ex. `Button.astro`, `IconButton.astro`).

3. **Navbar & Footer**
   - Implémenter en Astro avec les liens vers les pages déjà migrées.
   - Liens “langue” : préparer le pattern `[lang]` (détail en phase 3).

**Validation** : Toutes les pages statiques utilisent le même layout ; navbar/footer et thème fonctionnent.

---

## Phase 3 : i18n & routing par langue

**But** : URLs par langue (ex. `/fr/`, `/en/`) et Paraglide cohérent.

1. **Stratégie de routes**
   - Option A : `src/pages/[lang]/index.astro`, `[lang]/contact.astro`, etc. + middleware qui définit la langue pour Paraglide (déjà partiellement en place dans `src/middleware.js`).
   - Option B : pas de segment `[lang]` dans l’URL, langue en cookie/header uniquement (plus simple mais moins SEO).
   - S’aligner sur l’ancien comportement : `old` utilise `[[lang]]` (optional lang), donc URLs du type `/fr/contact`, `/en/contact`.

2. **Middleware**
   - Vérifier que le middleware actuel (Paraglide) lit la langue depuis l’URL (segment `[lang]`) ou depuis un cookie et appelle l’API Paraglide en conséquence.
   - Redirection depuis `/` vers `/fr/` ou `/en/` (locale par défaut).

3. **Composants**
   - Toutes les chaînes côté serveur : utiliser les fonctions Paraglide (ex. `* as m from '@/paraglide/messages'`).
   - Pas d’équivalent à `useLang()` / `useLangNavigate()` : en Astro on utilise la locale du request et les liens manuels `/${lang}/...`.

**Validation** : `/fr/` et `/en/` affichent la bonne langue ; les liens internes conservent la langue.

---

## Phase 4 : Contenu des cours (markdown)

**But** : Servir les leçons et modules comme dans l’ancien projet, en s’appuyant sur le contenu dans `old/src/courses/`.

**État : Fait.**

1. **Données**
   - Les cours vivent dans `src/courses/` : `en.md` et `fr.md` par cours (frontmatter + description markdown), `course-structure.ts`, `src/courses/modules/{moduleId}/{chapterDir}/{lessonDir}/{lang}/content.md`.
   - Données build-time : `src/data/courses.ts` (getCourses, getModules, getCourseMarkdown), `src/data/overview.ts` (getCourseOverview, getModuleOverview, getLessonLocation, getLessonContent).

2. **Rendu markdown**
   - Pas de `marked` : Astro charge les `.md` via `import.meta.glob` et fournit le composant `Content` (markdown compilé).
   - Mermaid : intégration `astro-mermaid` dans `astro.config.mjs` ; les blocs mermaid dans le markdown sont transformés au build.
   - Callouts : plugin remark `src/plugins/remark-callout-colons.ts` pour la syntaxe `:::info`, `:::warning`, `:::important` (équivalent de l'ancien `local-course-loader.ts` avec marked). Les commandes sont en blocs de code normaux pour le syntax highlighting (astro-expressive-code).

3. **Pages “structure”**
   - Liste cours/modules : `src/pages/[lang]/courses.astro`.
   - Overview d’un cours ou module : `src/pages/[lang]/[type]/[id]/index.astro` (type = `courses` | `modules`). Description longue parsée en markdown via `<Content />`.
   - Terminal et quiz non branchés ; uniquement contenu markdown.

**Validation** : Navigation dans la structure des cours ; lecture d’une leçon en markdown avec rendu, mermaid et callouts.

---

## Phase 5 : Routes learn (type, id, lessons)

**But** : URLs pour overview et leçon, cohérentes avec la structure des cours.

**État : Fait.**

**Décision** : Pas de segment `learn` ni `lessons` dans l’URL. Routes actuelles :

- `/[lang]/[type]/[id]` : overview d’un cours ou module (type = `courses` | `modules`).
- `/[lang]/[type]/[id]/[lessonId]` : page d’une leçon (ex. `/fr/modules/overview/comment-utiliser`).

1. **Routing**
   - Overview : `src/pages/[lang]/[type]/[id]/index.astro`.
   - Leçon : `src/pages/[lang]/[type]/[id]/[lessonId]/index.astro`.
   - Données : `getLessonContent(type, id, lessonId, lang)` dans `src/data/overview.ts` (glob des `content.md` compilés par Astro).

2. **Composants**
   - Contenu leçon : `<Content />` (instance Markdown d’Astro), pas de sidebar “plan du cours” pour l’instant.
   - Styles : `src/styles/components/lesson-content.css`.

3. **Navigation**
   - Liens “retour au cours/module”, “leçon précédente”, “leçon suivante” sur la page leçon ; liens depuis l’overview vers chaque leçon (`lessonBaseUrl` = `/${type}/${id}`).

4. **User progress — fait (détail en phase 7)**
   - La page overview reste en SSG ; le progress (leçons complétées, "Continue", leçon courante) est résolu côté serveur via `getProgressContext` + Supabase, puis passé aux composants (OverviewStructure, CourseOutline) pour checkmarks et CTA.

**Validation** : Navigation complète overview ↔ leçon par URL ; contenu markdown + mermaid correct.

---

## Phase 6 : Terminal & cluster (îlots interactifs)

**But** : Réutiliser la logique métier (core) et avoir un terminal interactif + visualisation cluster dans Astro.

**État : Fait (terminal + cluster viewer).**

### Réalisé

1. **Core**
   - Le core (`src/core/`) est en TS pur : terminal, cluster, kubectl, filesystem, emulated environment. Pas d’îlot framework : le terminal est monté via script client dans des composants Astro.

2. **Terminal**
   - **Page d’accueil** : `Terminal.astro` → `TerminalWindow.astro`, bandeau (top prompt) via `messages` (`terminal_topPrompt`), seed démo (sans API).
   - **Page de leçon** : `LessonTerminal.astro` → `TerminalWindow.astro` en pleine hauteur, seed par chapitre (`chapter.json` → `environment`), pas de top prompt.
   - **Montage** : `src/components/terminal-mount.ts` — `mountTerminal(container, { rows, lang, seedName?, topPrompt? })`, synchrone, `createEmulatedEnvironment` + seed (pas de lazy, pas d’API).
   - **Persistance** : même seed entre leçons/chapitres → `transition:persist` (id `terminal-${seedName}`), pas de remontage ; changement de seed → cleanup puis nouveau terminal.

3. **Seeds**
   - `src/courses/seeds/` : pas de barrel. Fichiers `minimal.ts` (défaut), `demo.ts`, `getSeed.ts` (registry : nom → `{ clusterStateData, fsConfig }`). Seed = `chapter.environment` dans `chapter.json` (ex. `"minimal"`, `"demo"`), défaut `"minimal"` si absent ou `"empty"`.
   - Aucun appel API : tout en statique, import direct.

4. **Layout page leçon**
   - `src/pages/[lang]/[type]/[id]/[lessonId]/index.astro` : deux colonnes (contenu scrollable | terminal pleine hauteur), `LessonTerminal` avec `seedName` dérivé du chapitre courant.

5. **Cluster viewer**
   - Composant : `LessonClusterViewer.astro` + `LessonClusterPanel.astro` ; montage client via `src/components/cluster-viewer-mount.ts` — `mountClusterViewer(container, { env })` consomme l’`EmulatedEnvironment`, s’abonne à l’event bus du cluster et affiche nodes → pods → containers (vue imbriquée, tooltips). Styles : `cluster-visualization.css`, `lesson-cluster-viewer.css`.

**Validation** : Sur la home et sur une leçon, le terminal répond aux commandes kubectl/shell ; sur une leçon, le panneau cluster viewer affiche l’état du cluster (nodes, pods, containers).

---

## Phase 7 : Quiz, auth, API

**But** : Quiz en fin de leçon, compte utilisateur (Supabase), et routes API si nécessaires.

1. **User progress (overview cours) — fait**
   - **Principe** : les pages overview cours/module restent en SSG ; le progress (leçons complétées, "Continue", leçon courante) est résolu côté serveur pour l’utilisateur connecté.
   - **Mise en œuvre** : `src/lib/progress/server.ts` — `getProgressContext(locals, request, cookies)` récupère la session Supabase et les leçons complétées via `createSupabaseProgressRepository` (table `user_progress`). `src/lib/progress/domain.ts` — `computeProgress` / `computeProgressMap` pour currentLessonId, hasStarted, CTA. Pages overview : `[lang]/[type]/[id]/index.astro` et `[lang]/courses.astro` appellent `getProgressContext` puis passent `completed` et `progress` à `OverviewStructure.astro` / `CourseOutline.astro` (classes `progress-completed`, `progress-current`, bouton Continue). Marquer une leçon complétée : `LessonQuizNav.astro` redirige vers `GET /api/progress/complete?lessonId=...&redirect=...` ; `src/pages/api/progress/complete.ts` enregistre en Supabase puis redirige.

2. **Auth — fait**
   - Supabase : client `src/lib/supabase.ts` (PKCE pour OAuth).
   - API routes : `src/pages/api/auth/register.ts`, `signin.ts`, `signout.ts`, `callback.ts` (email/password + GitHub, session gérée par @supabase/ssr via cookies, redirect `/${lang}/courses` ou page d’accueil après signout).
   - Page auth : `src/pages/[lang]/auth/index.astro` (login/signup toggle + GitHub, formulaires avec `data-astro-reload`).
   - Navbar : lien Connexion / Déconnexion selon session Supabase (getUser) ; bouton thème (Button plain sm).

3. **Quiz — fait**
   - Types : `src/types/quiz.ts` (MultipleChoiceQuestion, TerminalCommandQuestion, CommandQuestion, OrderQuestion).
   - Données : `src/data/overview.ts` → `getLessonQuiz(type, id, lessonId, lang)` charge les `quiz.ts` par leçon via `import.meta.glob`.
   - Composant : `src/components/lesson/lesson-quiz-nav.ts` — script client vanilla TS (pas d'îlot React/Solid). Gère quiz multiple-choice + navigation prev/next lesson.
   - Styles : `src/styles/components/quiz.css`.
   - Intégration terminal (questions command/terminal-command) : **non implémentée** (laissée de côté volontairement).

4. **API**
   - Les routes API sont dans `old/src/routes/api/` (ab-test, seeds, suggestions, survey).
   - Les recréer en `src/pages/api/` (Astro endpoints) avec la même signature si besoin pour le front.

**Validation** : Quiz opérationnel sur une leçon ; connexion/déconnexion ; appels API nécessaires fonctionnels.

---

## Phase 8 : Tests, CI, nettoyage

1. **Tests**
   - Les tests du core (`old/tests/unit/`, `old/tests/conformance/`) ciblent du TS pur. Une fois le core copié dans `src/core/`, faire pointer les tests vers `src/core/` et lancer Vitest.
   - Adapter les chemins et les mocks (ex. Supabase, env).
   - Pas d’obligation de tester les composants Astro en E2E tout de suite ; à ajouter si besoin.

2. **CI**
   - Reproduire la CI existante (lint, test, build) pour le nouveau projet.
   - Build Astro : `npm run build` (avec Paraglide).

3. **Nettoyage**
   - Supprimer tout ce qui reste de l’ancien projet à la racine (fichiers SolidStart, vinxi, etc.) une fois la migration validée.
   - Garder `old/` en archive ou le supprimer après une dernière relecture.

**Validation** : CI verte, build OK, plus de dépendances SolidStart dans le projet principal.

---

## Ordre recommandé

Respecter l’ordre des phases ; valider chaque phase avant de passer à la suivante. En cas de blocage sur une phase (ex. 6), il est possible de livrer un site “lecture seule” (phases 0–5) puis d’ajouter le terminal et le quiz ensuite.

---

## Fichiers de référence rapide

| Besoin                   | Ancien (old/)                          | Nouveau (racine)                                                                                                                                                      |
| ------------------------ | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routing i18n             | `src/routes/[[lang]]/`                 | `src/pages/[lang]/` + middleware                                                                                                                                      |
| Layout                   | `src/app.tsx`, navbar, footer          | `src/layouts/Layout.astro`                                                                                                                                            |
| Styles                   | `src/styles/`                          | `src/styles/`                                                                                                                                                         |
| i18n                     | `src/lang/core.tsx`, Paraglide         | Paraglide + `src/i18n/utils.ts`                                                                                                                                       |
| Core (terminal, cluster) | `src/core/`                            | `src/core/` (copie adaptée)                                                                                                                                           |
| Cours (données)          | `src/courses/`                         | `src/courses/` (en.md/fr.md par cours, course-structure.ts)                                                                                                           |
| Overview / leçons (data) | —                                      | `src/data/overview.ts`, `src/data/courses.ts`                                                                                                                         |
| Pages cours / leçons     | `learn/[type]/[id]/lessons/[lessonId]` | `[lang]/[type]/[id]/index.astro`, `[lang]/[type]/[id]/[lessonId]/index.astro`                                                                                         |
| Terminal (home)          | `old/` + fetch seeds API               | `Terminal.astro` → `TerminalWindow.astro`, `terminal-mount.ts`, seed demo, top prompt dans `messages`                                                                 |
| Terminal (leçon)         | —                                      | `LessonTerminal.astro` → `TerminalWindow.astro`, seed par chapitre (`chapter.json` environment), `transition:persist` par seed                                        |
| Seeds                    | `old/seeds/`, API `/api/seeds/[name]`  | `src/courses/seeds/` (minimal, demo, getSeed), pas d’API                                                                                                              |
| Auth                     | `src/account/`, `src/lib/auth.tsx`     | `src/lib/supabase.ts`, `src/pages/api/auth/`, `[lang]/auth/index.astro`, Navbar ; user progress : `src/lib/progress/`, `getProgressContext`, `/api/progress/complete` |
| API                      | `src/routes/api/`                      | `src/pages/api/` (à faire)                                                                                                                                            |

---

_Document mis à jour au fil de la migration. Dernière mise à jour : phase 6 cluster viewer et phase 7 user progress marqués comme faits ; il reste API (phase 7) et phase 8 (tests, CI, nettoyage)._
