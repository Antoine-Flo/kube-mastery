# Plan du Module Architecture

## Chapitres

### 01-nodes

Anatomie d'un node Kubernetes : composants (kubelet, kube-proxy, container runtime), gestion des nodes, enregistrement, statut, heartbeats, conditions et capacité.

### 02-control-plane-node-communication

Communication entre le control plane et les nodes : API server vers kubelet, tunnels SSH, Konnectivity service, sécurisation des communications.

### 03-controllers

Pattern controller dans Kubernetes : boucles de contrôle, réconciliation état désiré/actuel, controllers intégrés vs custom controllers.

### 04-cloud-controller-manager

Intégration cloud : node controller, route controller, service controller pour les environnements cloud (AWS, GCP, Azure, etc.).

### 05-garbage-collection

Nettoyage automatique des ressources : suppression en cascade (foreground, background, orphan), owners et dependents, garbage collection des images et containers.

### 06-leases

Coordination distribuée : node heartbeats via Leases, leader election pour les composants HA, API server identity.

### 07-cgroups

Gestion des ressources Linux : cgroups v2, migration depuis v1, impact sur la gestion des ressources containers.

### 08-self-healing

Auto-guérison du cluster : détection des pannes, récupération automatique, mécanismes de résilience intégrés.
