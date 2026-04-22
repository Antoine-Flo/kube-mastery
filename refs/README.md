# refs - Index de references Kubernetes

```yaml
schema_version: 1
index_type: kubernetes_reference_catalog
root_path: refs
owner: kube-mastery
purpose:
  - local_reference_for_engineers
  - local_reference_for_ai_assistant
default_namespace: refs/k8s
update_strategy: git_submodule
```

## Catalog

| key                    | path                          | upstream                                                  | focus                                                  | tags                           |
| ---------------------- | ----------------------------- | --------------------------------------------------------- | ------------------------------------------------------ | ------------------------------ |
| k8s-api                | `refs/k8s/api`                | https://github.com/kubernetes/api.git                     | Types API Kubernetes (group/version/kind)              | api, types, schemas            |
| k8s-apimachinery       | `refs/k8s/apimachinery`       | https://github.com/kubernetes/apimachinery.git            | Primitives communes (runtime, meta, labels, selectors) | runtime, meta, conversion      |
| k8s-client-go          | `refs/k8s/client-go`          | https://github.com/kubernetes/client-go.git               | Client Go officiel Kubernetes                          | client, informers, workqueue   |
| k8s-kubectl            | `refs/k8s/kubectl`            | https://github.com/kubernetes/kubectl.git                 | Logique de la CLI kubectl                              | cli, commands, printers        |
| k8s-controller-runtime | `refs/k8s/controller-runtime` | https://github.com/kubernetes-sigs/controller-runtime.git | Base pour operators/controllers                        | controller, reconcile, manager |
| k8s-kubernetes         | `refs/k8s/kubernetes`         | https://github.com/kubernetes/kubernetes.git              | Monorepo Kubernetes (kubectl, apiserver, controllers)  | core, apiserver, scheduler     |

## Prompt hints (IA)

Utiliser ces formats pour guider une recherche:

- `search_scope=refs/k8s/client-go topic=informer lister watcher`
- `search_scope=refs/k8s/controller-runtime topic=reconcile loop retries`
- `compare_scopes=refs/k8s/apimachinery,refs/k8s/api topic=object metadata`

## Operational commands

```bash
# Initialiser les sous-modules
git submodule update --init --recursive

# Mettre a jour les refs distantes
git submodule update --remote --merge

# Verifier les commits de sous-modules
git submodule status
```

## Contract

- `refs/` contient des references externes, pas le code applicatif principal.
- Eviter les modifications locales dans les sous-modules.
- Toute nouvelle reference doit etre ajoutee dans le `Catalog` ci-dessus.

## JSON index (optionnel pour scripts)

```json
{
  "schema_version": 1,
  "root_path": "refs",
  "entries": [
    {
      "key": "k8s-api",
      "path": "refs/k8s/api",
      "upstream": "https://github.com/kubernetes/api.git",
      "focus": "Kubernetes API object definitions",
      "tags": ["api", "types", "schemas"]
    },
    {
      "key": "k8s-apimachinery",
      "path": "refs/k8s/apimachinery",
      "upstream": "https://github.com/kubernetes/apimachinery.git",
      "focus": "Shared machinery and runtime primitives",
      "tags": ["runtime", "meta", "conversion"]
    },
    {
      "key": "k8s-client-go",
      "path": "refs/k8s/client-go",
      "upstream": "https://github.com/kubernetes/client-go.git",
      "focus": "Official Go client",
      "tags": ["client", "informers", "workqueue"]
    },
    {
      "key": "k8s-kubectl",
      "path": "refs/k8s/kubectl",
      "upstream": "https://github.com/kubernetes/kubectl.git",
      "focus": "kubectl command implementation",
      "tags": ["cli", "commands", "printers"]
    },
    {
      "key": "k8s-controller-runtime",
      "path": "refs/k8s/controller-runtime",
      "upstream": "https://github.com/kubernetes-sigs/controller-runtime.git",
      "focus": "Controller/operator framework",
      "tags": ["controller", "reconcile", "manager"]
    },
    {
      "key": "k8s-kubernetes",
      "path": "refs/k8s/kubernetes",
      "upstream": "https://github.com/kubernetes/kubernetes.git",
      "focus": "Kubernetes core monorepo",
      "tags": ["core", "apiserver", "scheduler"]
    }
  ]
}
```
