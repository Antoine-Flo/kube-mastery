# Plan du Module Containers

## Chapitres

### 01-images
Images container : registries, image pull policy, image names et tags, digests, pre-pulling.

### 02-container-runtime
Container Runtime Interface (CRI) : architecture, containerd, CRI-O, sélection du runtime.

### 03-container-environment
Environnement container : filesystem, hostname, informations disponibles, variables injectées par Kubernetes.

### 04-lifecycle-hooks
Hooks de cycle de vie : PostStart, PreStop, handlers (exec, HTTP), cas d'usage, bonnes pratiques.

### 05-runtime-class
Classes de runtime : RuntimeClass, sandboxed containers (gVisor, Kata), scheduling avec runtimeClassName.
