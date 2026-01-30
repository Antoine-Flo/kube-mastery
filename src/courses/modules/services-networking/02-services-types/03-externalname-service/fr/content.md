# Service ExternalName

Un Service ExternalName mappe un Service vers un nom DNS au lieu de mapper vers des Pods en utilisant des selectors. Pensez-y comme à un alias DNS qui pointe vers un service externe, vous permettant de référencer des ressources externes en utilisant des noms de Service Kubernetes.

## Comment fonctionne ExternalName

Les Services de type ExternalName mappent un Service vers un nom DNS. Vous spécifiez ces Services avec le paramètre `spec.externalName`. Contrairement aux autres types de Services, les Services ExternalName n'utilisent pas de selectors et ne proxy pas le trafic, ils fournissent simplement une redirection au niveau DNS.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
  namespace: prod
spec:
  type: ExternalName
  externalName: my.database.example.com
```

Dans cet exemple, le Service `my-service` dans le namespace `prod` mappe vers le nom DNS externe `my.database.example.com`.

## Résolution DNS

Lors de la recherche de l'hôte `my-service.prod.svc.cluster.local`, le Service DNS du cluster retourne un enregistrement CNAME avec la valeur `my.database.example.com`. Accéder à `my-service` fonctionne de la même manière que les autres Services, mais la redirection se produit au niveau DNS plutôt que via un proxy ou un transfert.

Cela signifie :
- Aucun proxy ou transfert n'est configuré
- Le serveur DNS gère la redirection
- Les clients se connectent directement au service externe
- Aucun équilibrage de charge n'est effectué par Kubernetes

## Cas d'utilisation

Les Services ExternalName sont utiles pour :
- **Bases de données externes** : Pointer vers un cluster de base de données externe en production tout en utilisant des bases de données locales dans les environnements de test
- **Services inter-clusters** : Référencer des Services dans différents namespaces ou sur un autre cluster
- **Migration progressive** : Migrer des charges de travail vers Kubernetes progressivement, où seule une partie des backends fonctionne dans Kubernetes
- **Abstraction** : Fournir un nom de Service cohérent qui peut pointer vers différents backends (internes ou externes) selon l'environnement

## Considérations importantes

Les Services ExternalName peuvent avoir des problèmes avec certains protocoles courants comme HTTP et HTTPS. C'est parce que le nom d'hôte utilisé par les clients à l'intérieur de votre cluster (par ex., `my-service.prod.svc.cluster.local`) est différent du nom que l'ExternalName référence (par ex., `my.database.example.com`).

Pour les requêtes HTTP, cela signifie :
- L'en-tête `Host:` contiendra le nom du Service, que le serveur d'origine peut ne pas reconnaître
- Les serveurs TLS peuvent ne pas être en mesure de fournir un certificat correspondant au nom d'hôte auquel le client s'est connecté

Pour ces raisons, ExternalName est mieux adapté aux services qui ne dépendent pas du routage basé sur le nom d'hôte ou de la validation de certificat TLS.

:::info
Les Services ExternalName fournissent une redirection au niveau DNS sans proxy. <a target="_blank" href="https://kubernetes.io/docs/concepts/services-networking/service/#externalname">En savoir plus sur les Services ExternalName</a>
:::

:::warning
Vous pourriez avoir des difficultés à utiliser ExternalName pour certains protocoles courants, notamment HTTP et HTTPS, car le nom d'hôte utilisé par les clients diffère du nom que l'ExternalName référence. Envisagez d'utiliser des Services headless avec des EndpointSlices créés manuellement pour plus de contrôle.
:::
