# Artifacts pour l’audit

Commandes reproductibles et emplacements des rapports pour l’audit.

## Lint / qualité

| Commande       | Description                             |
| -------------- | --------------------------------------- |
| `npm run knip` | Détection exports / fichiers inutilisés |

**Note** : Pas de ESLint dans le projet actuel. Pour l’audit : s’appuyer sur `tsc --noEmit` et `knip`. Si besoin, documenter que le lint formel n’est pas opérationnel.

## Tests

**À migrer (prévu)** — Cible documentée pour la migration :

| Commande           | Description (cible)                    |
| ------------------ | -------------------------------------- |
| `npm test`         | Tous les tests unitaires (Vitest)      |
| `npm run coverage` | Tests + rapport de couverture (Vitest) |
| `npm run test-ui`  | Interface Vitest (mode watch)          |

- **Tests unitaires** : `tests/unit/` (cible).
- **Conformance OpenAPI** : `tests/conformance/` (cible) — Pod, ConfigMap, Secret, Deployment, ReplicaSet, Node.
- **Golden files** : Config `bin/config/golden-tests.ts` ; génération `npx tsx bin/generate-golden-files.ts`. Les tests qui s’appuient sur ces golden files comparent la sortie kubectl du simulateur aux fichiers générés.

État actuel : golden files et script dans `bin/` ; migration des tests (Vitest, chemins vers `src/core/`) à venir.

**Rapports (après migration)** : Couverture dans `coverage/` (HTML, JSON). Seuil documenté (non bloquant) : ~94% (voir doc/context/spec.md).

## Build

| Commande        | Description                      |
| --------------- | -------------------------------- |
| `npm run build` | Build Astro (Cloudflare adapter) |

Variables d’environnement optionnelles pour le build : selon `astro.config.mjs` (ex. `site`). Aucune variable obligatoire documentée pour `npm run build` à ce jour.

## Récapitulatif des sorties / rapports

| Artifact                  | Emplacement                                           |
| ------------------------- | ----------------------------------------------------- |
| Rapport couverture (HTML) | `coverage/html/` (après migration tests)              |
| Rapport couverture (JSON) | `coverage/coverage-final.json` (ou équivalent Vitest) |
| Sortie Knip               | stdout                                                |
| Résultats tests           | stdout                                                |

## Nettoyage pré-audit

- **npm audit** : À lancer manuellement (`npm audit`) ; requiert un accès réseau. Dépendances critiques : Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Astro, Cloudflare. **À migrer** : Drizzle, Vitest (à documenter quand migrés).

## Références

- [entry-points.md](entry-points.md) — Entry points et surfaces.
- [scan-points.md](scan-points.md) — Zones à scanner.
- [security-inventory.md](security-inventory.md) — Inventaire sécurité.
