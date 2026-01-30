# Spec et Status

Presque tous les objets Kubernetes ont deux champs imbriqués importants qui fonctionnent ensemble : `spec` et `status`. Comprendre ces deux champs est la clé pour comprendre comment Kubernetes fonctionne.

## Spec d'objet

Le `spec` (abréviation de "specification") décrit l'**état souhaité** de votre objet. C'est ce que vous voulez, l'objectif que vous visez. Lorsque vous créez un objet, vous définissez le spec pour indiquer à Kubernetes quelles caractéristiques vous voulez que la ressource ait.

Par exemple, un spec de Deployment pourrait spécifier :
- Trois répliques de votre application
- Quelle image de conteneur utiliser
- Les limites de ressources pour chaque conteneur
- Les variables d'environnement à définir

Pensez au spec comme à votre liste de souhaits. Vous dites à Kubernetes : "Je veux que mon application ressemble à ça."

## Status d'objet

Le `status` décrit l'**état actuel** de votre objet, ce qui se passe réellement en ce moment. Contrairement au spec, vous ne définissez pas le status vous-même. Kubernetes et ses composants remplissent et mettent à jour automatiquement ce champ pendant qu'ils travaillent pour rendre votre état souhaité réalité.

Le status pourrait montrer :
- Combien de répliques sont actuellement en cours d'exécution
- Quels Pods sont prêts à servir le trafic
- Toutes les erreurs ou avertissements qui se sont produits
- La santé actuelle de votre application

Pensez au status comme à un rapport de progression. Il vous dit : "Voici ce qui se passe réellement en ce moment."

## Comment ils fonctionnent ensemble

La relation entre spec et status est au cœur du fonctionnement de Kubernetes. Voici comment cela fonctionne :

1. **Vous définissez le spec** : Vous créez un objet avec un spec demandant trois répliques de votre application.

2. **Kubernetes lit le spec** : Le plan de contrôle voit votre état souhaité et commence à travailler pour l'atteindre.

3. **Kubernetes met à jour le status** : Au fur et à mesure que les Pods démarrent, Kubernetes met à jour le status pour montrer "3 répliques sur 3 en cours d'exécution."

4. **Surveillance continue** : Kubernetes compare constamment spec et status. S'ils ne correspondent pas, Kubernetes prend des mesures.

5. **Correction automatique** : Si un Pod plante (le status change pour montrer seulement 2 en cours d'exécution), Kubernetes remarque l'inadéquation et démarre un Pod de remplacement pour ramener le status en ligne avec votre spec.

Cette comparaison et correction continues s'appelle la **boucle de réconciliation**. C'est comme avoir un thermostat qui vérifie constamment la température et ajuste le chauffage pour correspondre à votre réglage souhaité.

:::command
Pour voir le spec et le status d'un Deployment, exécutez :

```bash
kubectl get deployment <name> -o yaml
```

Remplacez `<name>` par un nom de deployment réel pour voir les champs spec et status côte à côte.

<a target="_blank" href="https://kubernetes.io/docs/concepts/workloads/controllers/deployment/">En savoir plus</a>
:::

:::info
Le modèle spec/status est fondamental pour Kubernetes. Vous déclarez ce que vous voulez (spec), et Kubernetes travaille sans relâche pour le réaliser, mettant continuellement à jour le status pour refléter la réalité. C'est ce qui rend Kubernetes auto-guérissant et fiable.
:::

:::warning
Vous ne devriez jamais modifier manuellement le champ status. Kubernetes gère cela automatiquement. Si vous essayez de le changer, Kubernetes rejettera vos modifications ou les écrasera.
:::

## Un exemple réel

Imaginez que vous créez un Deployment avec ce spec :

```yaml
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: web
        image: nginx:latest
```

Kubernetes lit cela et démarre trois Pods. Le status pourrait ressembler à :

```yaml
status:
  replicas: 3
  readyReplicas: 3
  availableReplicas: 3
```

Si un Pod plante, le status change pour montrer `readyReplicas: 2`. Kubernetes détecte cette inadéquation avec votre spec (qui dit toujours `replicas: 3`) et démarre automatiquement un nouveau Pod pour restaurer l'état souhaité.

:::command
Pour observer le changement de status en temps réel, vous pouvez utiliser :

```bash
kubectl get deployment <name> -w
```

Remplacez `<name>` par un nom de deployment réel. Appuyez sur Ctrl+C pour arrêter l'observation.

<a target="_blank" href="https://kubernetes.io/docs/reference/kubectl/kubectl-commands#get">En savoir plus</a>
:::
