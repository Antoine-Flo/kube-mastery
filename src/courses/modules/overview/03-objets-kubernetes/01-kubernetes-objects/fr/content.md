# Objets Kubernetes

Les objets Kubernetes sont des entités persistantes qui représentent l'état de votre cluster. Pensez-y comme à des plans qui indiquent à Kubernetes à quoi vous voulez que vos applications ressemblent et comment elles doivent se comporter.

## Ce que représentent les objets

Les objets Kubernetes décrivent trois aspects principaux de vos applications :

- **Ce qui s'exécute** : Quelles applications conteneurisées s'exécutent et où (sur quels nœuds)
- **Quelles ressources elles ont** : CPU, mémoire, stockage et accès réseau disponibles pour ces applications
- **Comment elles se comportent** : Politiques concernant le comportement de redémarrage, les mises à niveau, la tolérance aux pannes, et plus encore

Imaginez que vous construisez une maison. L'objet Kubernetes est comme le plan architectural. Il spécifie quelles pièces vous voulez, comment elles doivent être connectées et quels matériaux utiliser. Kubernetes agit ensuite comme l'équipe de construction, s'assurant que votre maison correspond au plan.

## Structure des objets

Un objet Kubernetes est un "enregistrement d'intention". Une fois que vous le créez, Kubernetes travaille continuellement pour garantir que l'objet existe et correspond à vos spécifications. En créant un objet, vous dites à Kubernetes à quoi vous voulez que la charge de travail de votre cluster ressemble. C'est l'**état souhaité** de votre cluster.

Le plan de contrôle Kubernetes lit votre état souhaité et prend des mesures pour le réaliser. Si quelque chose ne va pas, comme un conteneur qui plante, Kubernetes remarque la différence entre ce que vous voulez et ce qui existe réellement, puis le corrige automatiquement.

## Travailler avec les objets

Pour créer, modifier ou supprimer des objets Kubernetes, vous utilisez l'API Kubernetes. Lorsque vous utilisez des commandes `kubectl`, l'outil effectue ces appels API pour vous en arrière-plan. Vous pouvez également utiliser l'API directement dans vos propres programmes en utilisant des bibliothèques client.

Le plus souvent, vous décrirez les objets dans des fichiers YAML appelés **manifests**. Ces fichiers sont comme des recettes qui indiquent exactement à Kubernetes quoi créer.

Pour voir tous les objets dans votre cluster, essayez :

```bash
kubectl get all
```

Cela liste les pods, services et deployments dans le namespace par défaut.

## Champs requis

Chaque manifest d'objet Kubernetes doit inclure quatre champs essentiels :

- **apiVersion** : Quelle version de l'API Kubernetes vous utilisez pour créer cet objet (comme `v1` ou `apps/v1`)
- **kind** : Quel type d'objet vous voulez créer (Pod, Deployment, Service, ConfigMap, etc.)
- **metadata** : Informations qui identifient de manière unique l'objet, incluant un `name` (requis), `UID` (auto-généré), et optionnellement un `namespace`
- **spec** : L'état souhaité que vous voulez pour l'objet, à quoi il devrait ressembler et comment il devrait se comporter

Le format du `spec` est différent pour chaque type d'objet. Un spec de Pod décrit les conteneurs et leurs images, tandis qu'un spec de Service décrit comment exposer les Pods au réseau. La référence de l'API Kubernetes documente la structure exacte pour chaque type d'objet.

Pour voir la structure d'un objet existant, exécutez :

```bash
kubectl get pod <pod-name> -o yaml
```

Remplacez `<pod-name>` par un nom de pod réel pour voir son manifest complet avec tous les champs.

:::info
Lorsque vous créez un objet, Kubernetes lui assigne automatiquement un identifiant unique (UID) qui ne change jamais, même si vous supprimez et recréez un objet avec le même nom. Cela aide Kubernetes à suivre les objets tout au long de leur cycle de vie.
:::

## Exemple de manifest

Voici un exemple simple d'un manifest de Pod montrant les champs requis :

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-demo
spec:
  containers:
  - name: nginx
    image: nginx:1.14.2
    ports:
    - containerPort: 80
```

Ce manifest indique à Kubernetes de créer un Pod nommé `nginx-demo` exécutant le serveur web nginx. Une fois que vous appliquez cela avec `kubectl apply -f nginx-demo.yaml`, Kubernetes travaillera pour le réaliser.
