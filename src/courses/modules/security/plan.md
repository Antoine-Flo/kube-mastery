# Plan du Module Security

## Chapitres

### 01-cloud-native-security
Modèle de sécurité : les 4C (Cloud, Cluster, Container, Code), défense en profondeur, principes de base.

### 02-controlling-access
Contrôle d'accès API : transport security (TLS), authentication, authorization, admission control (vue d'ensemble).

### 03-service-accounts-intro
Introduction aux ServiceAccounts : concept, ServiceAccount par défaut, association à un Pod.

### 04-service-accounts-avance
ServiceAccounts avancés : tokens projetés, désactivation de l'automount, bonnes pratiques.

### 05-rbac-intro
Introduction au RBAC : concept, Roles, RoleBindings, permissions basiques dans un namespace.

### 06-rbac-avance
RBAC avancé : ClusterRoles, ClusterRoleBindings, aggregated roles, kubectl auth can-i, bonnes pratiques.

### 07-pod-security-standards
Standards de sécurité Pod : Privileged, Baseline, Restricted, comparaison et choix.

### 08-pod-security-admission
Application des standards : PodSecurity admission controller, modes (enforce, audit, warn), configuration par namespace.

### 09-secrets-best-practices
Bonnes pratiques Secrets : encryption at rest, external secret managers, rotation, audit.

### 10-linux-security-intro
Sécurité Linux basique : runAsUser, runAsNonRoot, readOnlyRootFilesystem.

### 11-linux-security-avance
Sécurité Linux avancée : capabilities, seccomp profiles, AppArmor, SELinux.

### 12-multi-tenancy
Multi-locataires : isolation par namespace, network policies, resource quotas, stratégies de séparation.

### 13-security-checklist
Checklist de sécurité : audit de cluster, hardening, vérifications recommandées.

### 14-api-server-bypass-risks
Risques de contournement : accès direct aux nodes, runtime socket, etcd, atténuation.
