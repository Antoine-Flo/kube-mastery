# Artifacts pour l’audit

Commandes reproductibles et emplacements des rapports pour l’audit.

## Lint / qualité

| Commande | Description |
|----------|-------------|
| `npm run lint` | ESLint sur tout le projet |
| `npm run lint:fix` | ESLint avec correction automatique |
| `npm run knip` | Détection exports / fichiers inutilisés (déjà propre, pas d’action prévue dans le plan) |

**Note** : Le projet a les scripts `lint` et `lint:fix` qui appellent `eslint .`. Actuellement le package `eslint` n’est pas dans `devDependencies`, donc `npm run lint` échoue (commande non trouvée). Il n’y a pas de fichier de config ESLint à la racine. Pour l’audit : soit installer `eslint` et ajouter une config (ex. flat config), soit documenter que le lint n’est pas opérationnel et s’appuyer sur `tsc --noEmit` et `knip`.

## Tests

| Commande | Description |
|----------|-------------|
| `npm test` | Tous les tests unitaires (Vitest) |
| `npm run coverage` | Tests + rapport de couverture (Vitest, provider v8) |
| `npm run test-ui` | Interface Vitest (mode watch) |

**Rapport de couverture** : généré dans `coverage/` (sous-dossiers `html/`, fichier `coverage-final.json`). Config dans `vitest.config.ts` (exclusions : node_modules, paraglide, tests, .d.ts, configs, refs). **Seuil documenté (non bloquant)** : objectif ~94% (voir doc/context/spec.md).

## Tests de conformance OpenAPI

| Commande | Description |
|----------|-------------|
| `npm test -- tests/conformance/tests/` | Exécute uniquement les tests de conformité OpenAPI |

**Ressources couvertes** : Pod, ConfigMap, Secret, Deployment, ReplicaSet, Node.  
**Détails** : [tests/conformance/conformance_doc.md](../../tests/conformance/conformance_doc.md). Specs dans `tests/conformance/openapi/specs/`.

## Golden files (sorties kubectl)

- **Config** : `bin/config/golden-tests.ts` — liste des cas (commande, seed, catégorie : pods, events, version, cluster-info, api-resources, configmaps, secrets, describe, nodes).
- **Génération** : exécuter le script `bin/generate-golden-files.ts` (via `npx tsx bin/generate-golden-files.ts` ou équivalent) pour régénérer les golden files.
- **Comparaison** : les tests unitaires qui s’appuient sur ces golden files comparent la sortie du simulateur à ces fichiers. Pour l’audit : régénérer les golden files, lancer les tests ; tout échec indique un changement de comportement de la sortie kubectl.

## Build

| Commande | Description |
|----------|-------------|
| `npm run build` | Compilation Paraglide (i18n) + build Vinxi |

**Variables d’environnement optionnelles pour le build** : Paraglide ne requiert pas d’env obligatoire pour build. Sentry (entry-client, instrument.server) utilise `VITE_SENTRY_DSN` ; si absente, le build passe quand même (Sentry peut être désactivé ou ignoré). Aucune variable obligatoire documentée pour `npm run build` à ce jour.

## Récapitulatif des sorties / rapports

| Artifact | Emplacement |
|----------|-------------|
| Rapport couverture (HTML) | `coverage/html/` |
| Rapport couverture (JSON) | `coverage/coverage-final.json` (ou équivalent selon Vitest) |
| Sortie Knip | stdout (pas de fichier de rapport par défaut) |
| Résultats tests | stdout ; pas de rapport JUnit/XML par défaut |

## Nettoyage pré-audit (section 4 du plan)

- **npm audit** : À lancer manuellement (`npm audit`) ; requiert un accès réseau. Corriger ou documenter les exceptions. Dépendances critiques pour l’audit : Supabase (`@supabase/supabase-js`), Sentry (`@sentry/solidstart`), Drizzle (`drizzle-orm`, `drizzle-kit`), Postgres, Vinxi, Vite, Vitest.
- **Code legacy** : Vérification effectuée : aucune occurrence du terme « legacy » dans `src/`. Pas de blocs legacy non documentés identifiés.

## Références

- [entry-points.md](entry-points.md) — Entry points et surfaces.
- [scan-points.md](scan-points.md) — Zones à scanner.
- [security-inventory.md](security-inventory.md) — Inventaire sécurité.
