# Seeds

Système de définition des environnements (cluster Kubernetes + filesystem).

## Structure

```
seeds/
├── k8s/                    # Composants Kubernetes organisés par type
│   ├── node/              # Node manifests
│   ├── pod/               # Pod manifests
│   ├── deployment/        # Deployment manifests
│   ├── service/           # Service manifests
│   ├── configmap/         # ConfigMap manifests
│   └── secret/            # Secret manifests
└── scenarios/             # Scénarios TypeScript (compositions de composants)
```

## Composants K8s

Fichiers YAML Kubernetes standard organisés par type de ressource dans `seeds/k8s/{type}/`. 

Le nom du composant suit le format `{type}-{name}` :
- `pod-web` → `k8s/pod/web.yaml`
- `node-control-plane` → `k8s/node/control-plane.yaml`
- `deployment-nginx` → `k8s/deployment/nginx.yaml`
- `service-nginx` → `k8s/service/nginx.yaml`
- `configmap-app` → `k8s/configmap/app.yaml`
- `secret-db-credentials` → `k8s/secret/db-credentials.yaml`

Exemple :

```yaml
# seeds/k8s/pod/web.yaml
apiVersion: v1
kind: Pod
metadata:
  name: web
  namespace: default
spec:
  containers:
    - name: nginx
      image: nginx:1.21
```

## Scénarios

Définitions TypeScript dans `seeds/scenarios/`. Un scénario compose des composants K8s et une config filesystem.

```typescript
// seeds/scenarios/my-scenario.ts
import { scenario } from './types'
import minimal from './minimal'

export default scenario({
    name: 'my-scenario',
    description: 'Description du scénario',
    extends: minimal,
    k8s: {
        add: ['pod-my-app', 'configmap-app'],
        remove: []
    },
    fs: {
        files: { '/home/kube/examples/test.yaml': 'content' }
    }
})
```

### Convention de nommage

Format : `{type}-{description}` ou `{description}` pour les cas simples

### Scénarios disponibles

| Nom                         | Description                                                |
| --------------------------- | ---------------------------------------------------------- |
| `minimal`                   | Cluster minimal avec nodes et CoreDNS uniquement           |
| `pods-only`                 | Quelques pods simples sans orchestration                   |
| `deployment-simple`         | Un deployment simple sans service                          |
| `deployment-with-service`   | Deployment avec service ClusterIP                          |
| `deployment-with-secret`    | Deployment utilisant un secret                             |
| `deployment-with-configmap` | Deployment avec ConfigMap                                  |
| `full-stack`                | Application complète avec toutes les ressources            |
| `multi-namespace`           | Ressources dans plusieurs namespaces (production, staging) |
| `pods-errors`               | Pods en erreur pour exercices de troubleshooting           |
| `multi-node`                | Cluster avec plusieurs nodes (control-plane + worker)      |

**Noms legacy (compatibilité)** :
- `empty` → `minimal`
- `default` → `deployment-with-configmap`
- `showcase` → `full-stack`
- `troubleshooting` → `pods-errors`

### Héritage

`extends` permet d'hériter d'un autre scénario :
- `k8s.add` : Ajoute des composants
- `k8s.remove` : Retire des composants du parent
- `fs` : Merge avec la config du parent (optionnel)

### FsConfig

Le filesystem Debian de base inclut toujours l'utilisateur `kube` avec le répertoire `/home/kube` comme chemin par défaut.

```typescript
interface FsConfig {
    files?: Record<string, string>  // Fichiers additionnels (optionnel)
}
```

Si `fs` n'est pas spécifié dans un scénario, seul le filesystem Debian de base est utilisé (avec l'utilisateur kube et `/home/kube`).

## Utilisation

Dans `chapter.json` :

```json
{ "environment": "minimal" }
```

Si omis, `minimal` est utilisé par défaut.

## API

Endpoint : `GET /api/seeds/{name}`

Retourne :
```json
{
    "ok": true,
    "clusterStateData": { ... },
    "fsConfig": { ... }
}
```
