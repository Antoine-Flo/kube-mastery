# Créer votre premier Pod

Créons votre premier Pod en utilisant un manifest YAML. Cela vous aidera à comprendre comment les Pods sont définis et comment Kubernetes les crée.

## Un manifest de Pod simple

Voici un manifest de Pod de base qui exécute le serveur web nginx :

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
spec:
  containers:
  - name: nginx
    image: nginx:1.14.2
    ports:
    - containerPort: 80
```

Ce manifest indique à Kubernetes de créer un Pod nommé `nginx-pod` avec un seul conteneur exécutant l'image du serveur web nginx.

## Comprendre les champs

Décomposons chaque partie de ce manifest :

- **apiVersion: v1** : Cela indique à Kubernetes quelle version de l'API utiliser. Pour les Pods, c'est toujours `v1`
- **kind: Pod** : Cela spécifie que nous créons un objet Pod
- **metadata.name** : Un nom unique pour le Pod dans son namespace. Ce nom doit suivre les règles de nommage DNS (minuscules, alphanumériques, tirets autorisés)
- **spec.containers** : Une liste de conteneurs à exécuter dans ce Pod. Même si c'est une liste, nous n'avons qu'un seul conteneur ici
- **spec.containers[].name** : Un nom pour le conteneur (utile lorsque vous avez plusieurs conteneurs)
- **spec.containers[].image** : L'image de conteneur à récupérer et exécuter
- **spec.containers[].ports** : Informations optionnelles sur les ports sur lesquels le conteneur écoute (aide à la découverte de services)

## Créer le Pod

D'abord, créez un fichier vide pour votre manifest :

```bash
touch nginx-pod.yaml
```

Ensuite, ouvrez le fichier avec nano :

```bash
nano nginx-pod.yaml
```

Copiez le manifest ci-dessus et collez-le dans l'éditeur. Appuyez sur `Ctrl+S` pour sauvegarder le fichier.

Maintenant, appliquez votre manifest en utilisant kubectl :

```bash
kubectl apply -f nginx-pod.yaml
```

Kubernetes lira votre manifest, le validera et créera le Pod. Vous devriez voir une sortie comme :

```
pod/nginx-pod created
```

## Vérifier votre Pod

Après avoir créé le Pod, vous pouvez vérifier son statut :

```bash
kubectl get pods
```

Cela montre tous les Pods dans votre namespace actuel. Vous devriez voir `nginx-pod` avec un statut comme `Running` ou `ContainerCreating`. S'il y a un problème, le statut indiquera ce qui s'est mal passé.

Pour voir plus de détails sur votre Pod :

```bash
kubectl describe pod nginx-pod
```

Cela montre des informations complètes incluant les événements, le statut des conteneurs et l'utilisation des ressources.

## Ce qui se passe lorsque vous créez un Pod

Lorsque vous appliquez un manifest de Pod, voici ce que Kubernetes fait :

1. **Validation** : Kubernetes vérifie que votre manifest est valide et que tous les champs requis sont présents
2. **Planification** : Le scheduler trouve un nœud approprié dans votre cluster pour exécuter le Pod
3. **Création du conteneur** : Le kubelet sur ce nœud récupère l'image du conteneur et démarre le conteneur
4. **Mises à jour du statut** : Kubernetes met continuellement à jour le statut du Pod pour refléter son état actuel

Si quelque chose ne va pas à n'importe quelle étape, Kubernetes mettra à jour le statut du Pod pour montrer l'erreur, et vous pourrez enquêter en utilisant `kubectl describe`.

:::info
Le nom du Pod doit être unique dans un namespace. Si vous essayez de créer un Pod avec un nom qui existe déjà, Kubernetes rejettera votre demande. Vous pouvez utiliser différents namespaces pour avoir des Pods avec le même nom.
:::

:::warning
Bien que vous puissiez créer des Pods directement comme cela, il est généralement recommandé d'utiliser des ressources de charge de travail comme les Deployments pour les applications de production. Les Deployments fournissent la mise à l'échelle automatique, les mises à jour progressives, l'auto-guérison et d'autres fonctionnalités que les Pods autonomes n'ont pas. La création directe de Pods est principalement utile pour l'apprentissage, le débogage ou les tâches ponctuelles.
:::

## Prochaines étapes

Une fois que votre Pod fonctionne, vous avez fait votre premier pas dans le monde des charges de travail Kubernetes. En production, vous utiliserez généralement des Deployments ou d'autres ressources de charge de travail qui gèrent les Pods pour vous, mais comprendre comment les Pods fonctionnent est fondamental pour utiliser Kubernetes efficacement.
