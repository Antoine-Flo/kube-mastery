---
title: ConfigMap and Secret
description: Create ConfigMap and Secret data, inject them into a pod, and verify env plus mounted files.
tag: cluster_architecture_installation
environment: minimal
ckaTargetMinutes: 8
---

## Create namespace `my-db`

### Solution

```bash
k create namespace my-db
```

All resources in this drill must be created in the same namespace. <a href="https://kubemastery.com/en/courses/common-core/what-are-namespaces" target="_blank" rel="noopener noreferrer">What are namespaces</a>

### Validation

```yaml
- type: clusterResourceExists
  kind: Namespace
  name: my-db
  onFail: "Le namespace `my-db` n'existe pas. Vérifiez la commande `k create namespace`."
```

## Create ConfigMap `app-config` in namespace `my-db` with keys `APP_MODE=production` and `LOG_LEVEL=debug`

### Solution

```bash
k create configmap app-config -n my-db --from-literal=APP_MODE=production --from-literal=LOG_LEVEL=debug
```

Use literals for fast creation when key values are short and deterministic.

### Validation

```yaml
- type: clusterFieldEquals
  kind: ConfigMap
  namespace: my-db
  name: app-config
  path: '{.data.APP_MODE}'
  value: 'production'
  onFail: "La clé `APP_MODE=production` est absente de `app-config`. Vérifiez les `--from-literal`."
- type: clusterFieldEquals
  kind: ConfigMap
  namespace: my-db
  name: app-config
  path: '{.data.LOG_LEVEL}'
  value: 'debug'
  onFail: "La clé `LOG_LEVEL=debug` est absente de `app-config`. Vérifiez les `--from-literal`."
```

## Create Secret `db-creds` in namespace `my-db` with keys `DB_USER=admin` and `DB_PASS=s3cretP@ss`

### Solution

```bash
k create secret generic db-creds -n my-db --from-literal=DB_USER=admin --from-literal=DB_PASS=s3cretP@ss
```

Keep the secret name and key names exact, pod references are case-sensitive.

### Validation

```yaml
- type: clusterResourceExists
  kind: Secret
  namespace: my-db
  name: db-creds
  onFail: "Le secret `db-creds` n'existe pas dans `my-db`. Vérifiez la commande de création."
- type: clusterFieldNotEmpty
  kind: Secret
  namespace: my-db
  name: db-creds
  path: '{.data.DB_USER}'
  onFail: "La clé `DB_USER` est absente du secret `db-creds`."
- type: clusterFieldNotEmpty
  kind: Secret
  namespace: my-db
  name: db-creds
  path: '{.data.DB_PASS}'
  onFail: "La clé `DB_PASS` est absente du secret `db-creds`."
```

## Create pod `app` in namespace `my-db` with image `busybox:1.36`, command `sleep 3600`, env from ConfigMap and Secret, and ConfigMap mounted at `/etc/config`

### Solution

Generate a base manifest quickly:

```bash
k run app -n my-db --image=busybox:1.36 --dry-run=client -o yaml -- sleep 3600 > app-pod.yaml
```

Then edit `app-pod.yaml` so it matches this final manifest:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app
  namespace: my-db
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ["sleep", "3600"]
      envFrom:
        - configMapRef:
            name: app-config
        - secretRef:
            name: db-creds
      volumeMounts:
        - name: config-vol
          mountPath: /etc/config
  volumes:
    - name: config-vol
      configMap:
        name: app-config
```

```bash
k apply -f app-pod.yaml
k wait --for=condition=Ready pod/app -n my-db --timeout=60s
k exec app -n my-db -- env | grep -E 'APP_MODE|LOG_LEVEL|DB_USER|DB_PASS'
k exec app -n my-db -- ls /etc/config
k exec app -n my-db -- cat /etc/config/APP_MODE
```

The last three commands are support checks, they confirm env injection and mounted config files. <a href="https://kubemastery.com/en/courses/common-core/creating-your-first-pod" target="_blank" rel="noopener noreferrer">Creating your first pod</a>

### Validation

```yaml
- type: clusterResourceExists
  kind: Pod
  namespace: my-db
  name: app
  onFail: "Le pod `app` n'existe pas dans `my-db`. Vérifiez que `app-pod.yaml` a bien été appliqué."
- type: clusterFieldEquals
  kind: Pod
  namespace: my-db
  name: app
  path: '{.status.phase}'
  value: 'Running'
  onFail: "Le pod `app` n'est pas Running. Vérifiez les références `app-config` et `db-creds`."
- type: clusterFieldContains
  kind: Pod
  namespace: my-db
  name: app
  path: '{.spec.containers[0].envFrom[*].configMapRef.name}'
  value: 'app-config'
  onFail: "Le pod `app` ne charge pas `app-config` via `envFrom.configMapRef`."
- type: clusterFieldContains
  kind: Pod
  namespace: my-db
  name: app
  path: '{.spec.containers[0].envFrom[*].secretRef.name}'
  value: 'db-creds'
  onFail: "Le pod `app` ne charge pas `db-creds` via `envFrom.secretRef`."
- type: clusterFieldContains
  kind: Pod
  namespace: my-db
  name: app
  path: '{.spec.containers[0].volumeMounts[*].mountPath}'
  value: '/etc/config'
  onFail: "Le ConfigMap n'est pas monté dans `app` au chemin `/etc/config`."
```

## Optional clean up, delete namespace `my-db`

### Solution

```bash
k delete namespace my-db
```

This removes all resources created by the drill in one command.
