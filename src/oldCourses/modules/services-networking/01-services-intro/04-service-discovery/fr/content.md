# Découverte de Services

Kubernetes prend en charge deux modes principaux pour trouver un Service : les variables d'environnement et le DNS. Les deux méthodes permettent aux Pods de découvrir et de se connecter aux Services sans coder en dur les adresses IP.

## Variables d'environnement

Lorsqu'un Pod s'exécute sur un Nœud, le kubelet ajoute automatiquement des variables d'environnement pour chaque Service actif dans le même namespace. Pour un Service nommé `redis-primary` qui expose le port TCP 6379 avec l'IP du cluster 10.0.0.11, il crée :

```bash
REDIS_PRIMARY_SERVICE_HOST=10.0.0.11
REDIS_PRIMARY_SERVICE_PORT=6379
REDIS_PRIMARY_PORT=tcp://10.0.0.11:6379
REDIS_PRIMARY_PORT_6379_TCP=tcp://10.0.0.11:6379
REDIS_PRIMARY_PORT_6379_TCP_PROTO=tcp
REDIS_PRIMARY_PORT_6379_TCP_PORT=6379
REDIS_PRIMARY_PORT_6379_TCP_ADDR=10.0.0.11
```

Le nom du Service est converti en majuscules, et les tirets deviennent des underscores. Cela fournit plusieurs façons d'accéder aux informations du Service depuis votre code d'application.

:::warning
Si vous utilisez des variables d'environnement pour la découverte de services, vous devez créer le Service **avant** les Pods clients. Sinon, ces Pods n'auront pas leurs variables d'environnement remplies. Cette exigence d'ordre peut être problématique dans certains scénarios.
:::

## Découverte DNS

Le DNS est la méthode recommandée et plus flexible pour la découverte de services. Un serveur DNS conscient du cluster (comme CoreDNS) surveille l'API Kubernetes pour les nouveaux Services et crée automatiquement des enregistrements DNS pour chacun.

Pour un Service nommé `my-service` dans le namespace `my-ns` :

- Les Pods dans le même namespace (`my-ns`) peuvent le résoudre simplement comme `my-service`
- Les Pods dans d'autres namespaces doivent utiliser le nom complet : `my-service.my-ns`
- Le nom DNS se résout en l'adresse IP du cluster du Service

## Avantages du DNS

La découverte DNS ne nécessite pas que les Services soient créés avant les Pods, cela fonctionne indépendamment de l'ordre de création. C'est plus flexible, ne nécessite pas de modifications de code pour lire les variables d'environnement, et est la méthode préférée pour la découverte de services dans Kubernetes.

De plus, Kubernetes prend en charge les enregistrements DNS SRV (Service) pour les ports nommés. Si votre Service a un port nommé `http` avec le protocole TCP, vous pouvez interroger `_http._tcp.my-service.my-ns` pour découvrir à la fois le numéro de port et l'adresse IP.

:::info
Le DNS est la méthode recommandée pour la découverte de services dans Kubernetes. <a target="_blank" href="https://kubernetes.io/docs/concepts/services-networking/service/#discovering-services">En savoir plus sur la découverte de services</a>
:::
