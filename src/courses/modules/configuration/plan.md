# Plan du Module Configuration

## Chapitres

### 01-configmaps-intro
Introduction aux ConfigMaps : concept, création (literal, fichier), utilisation via variables d'environnement.

### 02-configmaps-avance
ConfigMaps avancés : montage en volume, subPath, immutabilité, hot reload patterns.

### 03-secrets-intro
Introduction aux Secrets : concept, création basique, utilisation via env vars, différence avec ConfigMaps.

### 04-secrets-avance
Secrets avancés : types de secrets (Opaque, TLS, dockerconfigjson), montage en volume, limitations.

### 05-resource-management-intro
Gestion des ressources basique : requests et limits, unités CPU et mémoire, premier exemple.

### 06-resource-management-avance
Gestion des ressources avancée : QoS classes, OOM killer, impact sur le scheduling, bonnes pratiques.

### 07-probes-intro
Introduction aux probes : concept, liveness probe basique, readiness probe basique.

### 08-probes-avance
Probes avancées : startup probes, configuration fine (HTTP, TCP, exec, gRPC), timing, bonnes pratiques.

### 09-container-environment
Environnement container : variables d'environnement, informations injectées, dependent environment variables.

### 10-kubeconfig
Accès au cluster : structure kubeconfig, contextes, users, clusters, gestion multi-cluster.
