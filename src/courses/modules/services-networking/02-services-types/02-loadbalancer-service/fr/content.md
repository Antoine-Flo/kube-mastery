# Service LoadBalancer

Un Service LoadBalancer expose votre Service en externe en utilisant un équilibreur de charge externe fourni par votre fournisseur de cloud. C'est comme avoir un portier professionnel (l'équilibreur de charge cloud) qui route les visiteurs externes vers votre application, gérant toute la complexité pour vous.

## Comment fonctionne LoadBalancer

Sur les fournisseurs de cloud qui prennent en charge les équilibreurs de charge externes, définir `type: LoadBalancer` provisionne un équilibreur de charge pour votre Service. La création réelle se produit de manière asynchrone, et les informations sur l'équilibreur provisionné sont publiées dans le champ `.status.loadBalancer` du Service.

Le fournisseur de cloud décide comment l'équilibreur de charge distribue le trafic. Typiquement, il transfère le trafic vers les Pods backend, que Kubernetes gère automatiquement.

## Exemple LoadBalancer

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  type: LoadBalancer
  selector:
    app.kubernetes.io/name: MyApp
  ports:
    - name: http
      protocol: TCP
      port: 80
      targetPort: 9376
status:
  loadBalancer:
    ingress:
    - ip: 192.0.2.127
```

Dans cet exemple :
- Le type de Service est défini sur `LoadBalancer`
- Il cible les Pods avec le label `app.kubernetes.io/name: MyApp`
- Le champ `status.loadBalancer.ingress` montre l'adresse IP externe assignée par le fournisseur de cloud
- Une fois provisionné, vous pouvez accéder à votre Service en utilisant cette IP externe

:::command
Vérifiez si l'IP externe a été assignée :

```bash
kubectl get service my-service
```

La colonne `EXTERNAL-IP` affiche `<pending>` jusqu'à ce que le fournisseur de cloud provisionne l'équilibreur de charge, puis affiche l'adresse IP externe.

<a target="_blank" href="https://kubernetes.io/docs/reference/kubectl/generated/kubectl_get/">En savoir plus sur kubectl get</a>
:::

## Détails d'implémentation

Pour implémenter un Service LoadBalancer, Kubernetes commence généralement par faire des changements équivalents à vous demander un Service de `type: NodePort`. Le composant cloud-controller-manager configure ensuite l'équilibreur de charge externe pour transférer le trafic vers ce port de nœud assigné.

Cela signifie qu'un Service LoadBalancer inclut toute la fonctionnalité d'un Service NodePort, plus la configuration de l'équilibreur de charge externe.

## Intégration avec le fournisseur de cloud

Le comportement des Services LoadBalancer dépend de votre fournisseur de cloud. Chaque fournisseur a sa propre implémentation pour créer et configurer l'équilibreur de charge externe :
- **AWS** : Crée un Elastic Load Balancer (ELB)
- **GCP** : Crée un Network Load Balancer
- **Azure** : Crée un Azure Load Balancer

Le trafic depuis l'équilibreur de charge externe est dirigé vers les Pods backend. Le fournisseur de cloud gère les vérifications de santé, la terminaison SSL et d'autres fonctionnalités avancées selon leur implémentation.

:::info
Les Services LoadBalancer sont le moyen standard d'exposer des applications en externe sur les plateformes cloud. Ils provisionnent et configurent automatiquement l'équilibreur de charge du fournisseur de cloud pour vous. <a target="_blank" href="https://kubernetes.io/docs/concepts/services-networking/service/#loadbalancer">En savoir plus sur les Services LoadBalancer</a>
:::

:::warning
Les Services LoadBalancer nécessitent un fournisseur de cloud qui prend en charge les équilibreurs de charge externes. Si vous exécutez Kubernetes sur site ou dans un environnement sans intégration de fournisseur de cloud, les Services LoadBalancer peuvent ne pas fonctionner. Dans de tels cas, envisagez d'utiliser NodePort ou Ingress.
:::
