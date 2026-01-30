# Plan du Module Overview

## Chapitres

### 00-onboarding
Prise en main de la plateforme : navigation, environnement de pratique (kubectl, cluster), parcours vs modules.

### 01-kubernetes-overview
Introduction à Kubernetes : origine, pourquoi K8s, ce qu'il fait et ne fait pas.

### 02-evolution-deployment
Évolution du déploiement : serveurs physiques → VMs → conteneurs, avantages des conteneurs.

### 03-components-intro
Architecture du cluster : control plane (apiserver, etcd, scheduler, controller-manager), composants des nodes (kubelet, kube-proxy, runtime).

### 04-objects-intro
Modèle d'objets Kubernetes : entités persistantes, spec vs status, structure YAML (apiVersion, kind, metadata, spec).

### 05-object-management
Gestion des objets : commandes impératives vs configuration déclarative, kubectl apply, fichiers YAML.

### 06-namespaces-intro
Namespaces : isolation logique, namespaces par défaut (default, kube-system), quand utiliser plusieurs namespaces.

### 07-labels-intro
Labels : paires clé/valeur, syntaxe, sélecteurs (égalité, ensemble), utilisation pratique.

### 08-labels-avance
Labels avancés : matchLabels, matchExpressions, nodeSelector, labels recommandés (app.kubernetes.io/*).

### 09-annotations
Annotations : métadonnées non identifiantes, différence avec labels, cas d'usage.

### 10-names-uids
Identifiants : noms d'objets, contraintes DNS, UIDs uniques.

### 11-field-selectors
Sélecteurs de champs : filtrage par valeurs de champs, champs supportés, opérateurs.

### 12-api-intro
API Kubernetes : cœur du control plane, accès (kubectl, REST, clients), OpenAPI.

### 13-api-discovery
Découverte d'API : endpoints /api et /apis, OpenAPI v3, sérialisation Protobuf.

### 14-api-versioning
Versioning API : groupes d'API, versions (alpha, beta, stable), dépréciation, CRDs.

### 15-persistence-etcd
Persistance etcd : stockage clé-valeur, haute disponibilité, implications.

### 16-field-validation
Validation des champs : détection d'erreurs, niveaux (strict, warn, ignore).

### 17-finalizers
Finalisateurs : contrôle de suppression, nettoyage, kubernetes.io/pv-protection.

### 18-owners-dependents
Propriétaires et dépendants : ownerReferences, suppression en cascade, orphelins.

### 19-common-labels
Labels recommandés : app.kubernetes.io/*, conventions standard, exemples pratiques.

### 20-operations
Opérations quotidiennes : kubectl get/describe/edit/patch, gestion des namespaces, bonnes pratiques.
