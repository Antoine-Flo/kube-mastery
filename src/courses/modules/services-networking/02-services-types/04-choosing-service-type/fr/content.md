# Choisir un type de Service

Chaque type de Service dans Kubernetes sert des objectifs différents et a des cas d'utilisation spécifiques. Comprendre quand utiliser chaque type vous aide à concevoir un réseau efficace et sécurisé pour vos applications.

## ClusterIP

Utilisez ClusterIP lorsque :

- Vous n'avez besoin que d'un accès interne au cluster (communication entre Pods)
- Vous utiliserez un Ingress ou Gateway pour l'accès externe
- Les Services communiquent au sein du cluster
- Vous voulez le type de Service par défaut, le plus simple

C'est le type par défaut et le plus courant pour les services internes. C'est parfait pour les architectures de microservices où les services communiquent entre eux au sein du cluster.

:::info
ClusterIP est le type de Service par défaut. Si vous ne spécifiez pas de type, votre Service sera un ClusterIP. <a target="_blank" href="https://kubernetes.io/docs/concepts/services-networking/service/#type-clusterip">En savoir plus sur ClusterIP</a>
:::

## NodePort

Utilisez NodePort lorsque :

- Vous avez besoin d'un accès externe mais n'avez pas d'équilibreur de charge de fournisseur de cloud
- Vous voulez configurer votre propre solution d'équilibrage de charge devant les nœuds
- Vous devez exposer des services dans des environnements non cloud (sur site, bare metal)
- Vous êtes dans un environnement de développement ou de test

NodePort expose votre Service sur chaque nœud à un port à numéro élevé (30000-32767), le rendant accessible depuis l'extérieur du cluster. Cependant, il est moins sécurisé et plus difficile à gérer que LoadBalancer en production.

## LoadBalancer

Utilisez LoadBalancer lorsque :

- Vous exécutez sur un fournisseur de cloud qui le prend en charge (AWS, GCP, Azure, etc.)
- Vous avez besoin d'une adresse IP externe stable
- Vous voulez un équilibrage de charge externe automatique géré par le fournisseur de cloud
- Vous avez besoin d'un accès externe de qualité production

C'est le moyen le plus simple d'exposer des services en externe sur les plateformes cloud. Le fournisseur de cloud provisionne et gère automatiquement l'équilibreur de charge pour vous.

:::info
Les Services LoadBalancer sont le moyen standard d'exposer des applications en externe sur les plateformes cloud. <a target="_blank" href="https://kubernetes.io/docs/concepts/services-networking/service/#loadbalancer">En savoir plus sur LoadBalancer</a>
:::

## ExternalName

Utilisez ExternalName lorsque :

- Vous devez pointer vers des services externes (bases de données, APIs en dehors du cluster)
- Vous migrez des charges de travail progressivement vers Kubernetes
- Vous voulez abstraire les dépendances externes derrière un nom de Service
- Vous devez basculer entre des backends internes et externes selon l'environnement

ExternalName fournit une redirection au niveau DNS sans proxy, le rendant utile pour référencer des ressources externes en utilisant des noms de Service Kubernetes.

## Guide de décision

Voici un arbre de décision simple :

1. **Interne uniquement ?** → Utilisez ClusterIP
2. **Accès externe sur cloud ?** → Utilisez LoadBalancer
3. **Accès externe sans cloud ?** → Utilisez NodePort (ou Ingress)
4. **Pointer vers un service externe ?** → Utilisez ExternalName

Rappelez-vous : Vous pouvez également combiner ClusterIP avec Ingress ou Gateway API pour un routage plus avancé et une terminaison TLS.

Visualisez tous les Services et leurs types :

```bash
kubectl get services
```

La colonne `TYPE` montre si chaque Service est ClusterIP, NodePort, LoadBalancer ou ExternalName.

:::info
Le champ type de Service est conçu comme une fonctionnalité imbriquée, chaque niveau s'ajoute au précédent. LoadBalancer inclut la fonctionnalité NodePort, qui inclut la fonctionnalité ClusterIP. <a target="_blank" href="https://kubernetes.io/docs/concepts/services-networking/service/#publishing-services-service-types">En savoir plus sur les types de Service</a>
:::
