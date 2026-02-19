# Plan du Module Services-Networking

## Chapitres

### 01-services-intro

Introduction aux Services : pourquoi les Services, concept de découverte, ClusterIP, premier Service.

### 02-services-types

Types de Services : NodePort, LoadBalancer, ExternalName, choix du type selon le cas d'usage.

### 03-services-avance

Services avancés : session affinity, traffic policies (Cluster vs Local), headless services, external IPs.

### 04-endpoints

EndpointSlices et Endpoints : fonctionnement interne, endpoints manuels, debugging.

### 05-dns-intro

DNS dans Kubernetes : découverte par DNS, résolution de noms de services, FQDN.

### 06-dns-avance

DNS avancé : pods DNS policy, configuration personnalisée, dnsConfig, debugging DNS.

### 07-ingress-intro

Introduction à Ingress : concept, règles basiques, routing par path, premier Ingress.

### 08-ingress-avance

Ingress avancé : routing par host, TLS termination, annotations, rewrite rules.

### 09-ingress-controllers

Implémentations Ingress : NGINX, Traefik, HAProxy, cloud providers, choix et configuration.

### 10-gateway-api

Gateway API : Gateway, HTTPRoute, GRPCRoute, différences avec Ingress, cas d'usage avancés.

### 11-network-policies-intro

Introduction aux Network Policies : concept d'isolation, règles ingress basiques, default deny.

### 12-network-policies-avance

Network Policies avancées : règles egress, selectors complexes, namespaces, CIDR blocks, bonnes pratiques.

### 13-cluster-ip-allocation

Allocation d'IPs : plages CIDR, allocation statique vs dynamique, éviter les conflits.

### 14-dual-stack

IPv4 et IPv6 : configuration dual-stack, services dual-stack, migration.

### 15-topology-aware-routing

Routage intelligent : topology keys, zone-aware routing, réduction de la latence et des coûts.
