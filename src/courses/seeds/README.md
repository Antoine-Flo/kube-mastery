# Seeds

Données de seed pour le terminal : état du cluster Kubernetes + filesystem.

- **Rôle** : fournir un environnement pré-défini (cluster + FS) sans appel API.
- **Usage** : importer directement le fichier seed voulu, ex. `import { clusterStateData, fsConfig } from '../courses/seeds/demo';`
- **Structure** : chaque seed exporte `clusterStateData` (type `ClusterStateData`) et optionnellement `fsConfig` (type `FsConfig`).

## Ajouter un seed

Créer un fichier `src/courses/seeds/<nom>.ts` qui exporte :

- `clusterStateData` : construit avec `createClusterStateData()` depuis `../../core/cluster/ClusterState`, et des ressources (ex. `createNode()` depuis `../../core/cluster/ressources/Node`).
- `fsConfig` (optionnel) : objet `FsConfig` depuis `../../core/filesystem/debianFileSystem`, ex. `{ files: { '/home/kube/example.txt': 'content' } }`.

Pas de barrel `index.ts` : les composants importent depuis le fichier du seed (ex. `seeds/demo`).
