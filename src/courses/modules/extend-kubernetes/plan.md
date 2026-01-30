# Plan du Module Extend-Kubernetes

## Chapitres

### 01-extension-overview
Vue d'ensemble des extensions : configuration vs extensions, points d'extension, patterns.

### 02-custom-resources
Custom Resources : CRDs, création, validation, versioning, conversion webhooks.

### 03-api-aggregation
API Aggregation Layer : extension servers, service référence, intégration avec le control plane.

### 04-kubectl-plugins
Extensions kubectl : création de plugins, distribution, krew package manager.

### 05-authentication-webhooks
Webhooks d'authentification : token review, intégration avec systèmes externes (LDAP, OIDC).

### 06-authorization-webhooks
Webhooks d'autorisation : SubjectAccessReview, intégration avec des systèmes de policy externes.

### 07-admission-webhooks
Webhooks d'admission : validating webhooks, mutating webhooks, création, bonnes pratiques.

### 08-device-plugins
Device plugins : exposition de hardware (GPU, FPGA), architecture, implémentation.

### 09-network-plugins
Plugins réseau : CNI, implémentation, plugins populaires (Calico, Cilium, Flannel).

### 10-storage-plugins
Plugins de stockage : CSI drivers, architecture, développement, migration depuis in-tree.

### 11-scheduler-extensions
Extensions du scheduler : scheduler plugins, profiles, extenders, custom schedulers.

### 12-operators
Pattern Operator : concept, frameworks (Operator SDK, Kubebuilder), cas d'usage, bonnes pratiques.
