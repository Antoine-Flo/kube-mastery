# Seeds

Données de seed pour le terminal : état du cluster Kubernetes + filesystem.

- **Rôle** : fournir un environnement pré-défini (cluster + FS) sans appel API.
- **Usage** : importer directement le fichier seed voulu, ou utiliser `getSeed(name)` depuis `./getSeed` pour les pages de leçon.
- **Structure** : chaque seed exporte `clusterStateData` (type `ClusterStateData`) et optionnellement `fsConfig` (type `FsConfig`).

## Chapitres (chapter.json)

Dans chaque `chapter.json` des modules, la clé **`environment`** indique le seed à utiliser pour les leçons du chapitre :

- `"minimal"` : seed minimal (1 nœud, fs vide) — **défaut** si absent ou `"empty"`.
- `"demo"` : seed démo (nodes + pods + fichier exemple).
- `"empty"` ou absent : traité comme `"minimal"`.

Le registry dans `getSeed.ts` mappe ces noms vers les fichiers `minimal.ts` et `demo.ts`. Pour ajouter un seed, créer le fichier puis l’ajouter dans `getSeed.ts`.

## Ajouter un seed

1. Créer `src/courses/seeds/<nom>.ts` qui exporte `clusterStateData` et `fsConfig`.
2. Dans `getSeed.ts`, importer le seed et ajouter un cas pour le nom (ex. `if (name === 'mon-seed') return { ... }`).

Pas de barrel `index.ts` : imports directs depuis le fichier du seed (ex. `seeds/demo`) ou via `getSeed(name)`.
