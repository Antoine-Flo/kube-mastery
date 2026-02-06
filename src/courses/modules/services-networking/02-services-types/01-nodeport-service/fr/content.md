# Service NodePort

Un Service NodePort expose votre Service sur l'adresse IP de chaque Nœud à un port statique, le rendant accessible depuis l'extérieur du cluster. Pensez-y comme à ouvrir la même porte sur chaque bâtiment (nœud) de votre cluster, tous utilisant le même numéro de porte (port).

## Comment fonctionne NodePort

Lorsque vous définissez `type: NodePort`, Kubernetes :

- Alloue un port depuis une plage spécifiée par le flag `--service-node-port-range` (par défaut : 30000-32767)
- Chaque nœud du cluster se configure pour écouter sur ce port assigné
- Chaque nœud proxy le trafic de ce port vers l'un des points de terminaison prêts associés au Service
- Le Service rapporte le port alloué dans son champ `.spec.ports[*].nodePort`

Pour un Service NodePort, Kubernetes alloue en plus un port (TCP, UDP ou SCTP pour correspondre au protocole du Service). Cela signifie que vous pouvez accéder à votre Service depuis l'extérieur du cluster en vous connectant à n'importe quel nœud en utilisant le protocole et le port appropriés.

## Exemple NodePort

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  type: NodePort
  selector:
    app.kubernetes.io/name: MyApp
  ports:
    - name: http
      protocol: TCP
      port: 80
      targetPort: 80
      nodePort: 30007 # Optionnel : spécifier un port personnalisé
```

Dans cet exemple :

- Le Service écoute sur le port 80 en interne (le port du Service)
- Il transfère vers le port 80 sur les Pods (le port cible)
- Il est exposé sur le port 30007 sur chaque nœud (le port de nœud)
- Si vous ne spécifiez pas `nodePort`, Kubernetes en assignera automatiquement un depuis la plage

## Accéder aux Services NodePort

Vous pouvez contacter le Service NodePort depuis l'extérieur du cluster en vous connectant à n'importe quel nœud en utilisant le protocole approprié et le port assigné. Par exemple : `<NodeIP>:30007`. Le trafic sera automatiquement transféré vers l'un des Pods sains qui supportent le Service.

Le Service est visible comme `<NodeIP>:spec.ports[*].nodePort` et `.spec.clusterIP:spec.ports[*].port`. Cela signifie que vous pouvez y accéder soit via le port de nœud, soit via l'IP du cluster depuis l'intérieur du cluster.

Visualisez le port de nœud assigné pour votre Service :

```bash
kubectl get service my-service -o wide
```

## Cas d'utilisation

NodePort est utile lorsque vous voulez :

- Configurer votre propre solution d'équilibrage de charge devant les nœuds
- Configurer des environnements qui ne sont pas entièrement supportés par Kubernetes
- Exposer une ou plusieurs adresses IP de nœuds directement
- Tester des services dans des environnements de développement

:::info
Utiliser un NodePort vous donne la liberté de configurer votre propre solution d'équilibrage de charge. <a target="_blank" href="https://kubernetes.io/docs/concepts/services-networking/service/#type-nodeport">En savoir plus sur les Services NodePort</a>
:::

:::warning
Les Services NodePort exposent votre application sur l'adresse IP de chaque nœud à un port à numéro élevé. Cela peut être un problème de sécurité dans les environnements de production. Envisagez d'utiliser des Services LoadBalancer ou des contrôleurs Ingress pour une meilleure sécurité et gestion.
:::
