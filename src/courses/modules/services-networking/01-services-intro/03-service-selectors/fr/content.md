# Selectors de Service

Les Services utilisent des selectors de labels pour déterminer quels Pods ils doivent cibler. Pensez aux selectors comme à un filtre qui indique au Service : "Envoyez le trafic à tous les Pods qui ont ces labels spécifiques."

## Comment fonctionnent les selectors

Le champ `.spec.selector` du Service définit quels Pods le Service cible en utilisant la correspondance de labels. Par exemple :

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  selector:
    app.kubernetes.io/name: MyApp
    tier: backend
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
```

Ce Service routera le trafic vers tous les Pods qui ont les deux labels : `app.kubernetes.io/name: MyApp` et `tier: backend`. Le selector agit comme une requête qui trouve les Pods correspondants.

## EndpointSlices

Lorsqu'un Service a un selector, Kubernetes crée automatiquement des objets EndpointSlice. Ces objets représentent les points de terminaison réseau (Pods) qui correspondent au selector du Service.

Le contrôleur de Service scanne continuellement les Pods qui correspondent au selector et met à jour les EndpointSlices en conséquence. Cela se produit automatiquement, vous n'avez pas besoin de gérer les EndpointSlices manuellement lors de l'utilisation de selectors.

## Association Pod-Service

Les Pods sont associés à un Service en fonction de leurs labels correspondant au selector du Service. Lorsque les labels d'un Pod correspondent à un selector de Service, ce Pod devient un point de terminaison pour le Service et reçoit le trafic envoyé à l'IP du cluster du Service.

Par exemple, si vous avez trois Pods avec le label `app.kubernetes.io/name: MyApp`, tous les trois recevront le trafic du Service, et Kubernetes équilibrera la charge des requêtes entre eux.

## Plusieurs Pods et équilibrage de charge

Un Service peut cibler plusieurs Pods. Le trafic envoyé à l'IP du cluster du Service est automatiquement équilibré entre tous les Pods qui correspondent au selector. Si un Pod devient malsain ou est supprimé, le Service arrête automatiquement d'envoyer du trafic vers lui et continue de router vers les Pods sains restants.

:::command
Listez les Pods qui correspondent au selector de votre Service :

```bash
kubectl get pods -l app.kubernetes.io/name=MyApp,tier=backend
```

<a target="_blank" href="https://kubernetes.io/docs/reference/kubectl/generated/kubectl_get/">En savoir plus sur les selectors de labels</a>
:::

:::info
L'ensemble des Pods ciblés par un Service est généralement déterminé par un selector. <a target="_blank" href="https://kubernetes.io/docs/concepts/services-networking/service/#defining-a-service">En savoir plus sur les selectors de Service</a>
:::
