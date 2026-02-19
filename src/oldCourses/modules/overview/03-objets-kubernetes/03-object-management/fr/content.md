# Gestion des objets

Kubernetes offre trois façons différentes de créer et gérer des objets. Chaque approche a ses forces et est adaptée à différentes situations. Pensez-y comme à différents outils dans votre boîte à outils, vous utiliserez différents outils selon ce que vous essayez d'accomplir.

:::warning
Un objet Kubernetes devrait être géré en utilisant une seule technique. Mélanger les techniques pour le même objet peut conduire à un comportement inattendu et à des conflits. Une fois que vous choisissez une méthode pour un objet, tenez-vous-en à celle-ci.
:::

## Commandes impératives

Les **commandes impératives** vous permettent d'opérer directement sur des objets en direct dans votre cluster en utilisant des commandes simples à action unique. Vous dites exactement à Kubernetes quoi faire maintenant.

```bash
kubectl create deployment nginx --image nginx
kubectl scale deployment nginx --replicas=3
kubectl delete deployment nginx
```

Cette approche est comme donner des instructions directes : "Créez ceci maintenant," "Mettez à l'échelle à trois," "Supprimez cela."

**Idéal pour** : Apprendre, expériences rapides ou tâches ponctuelles. C'est le moyen le plus rapide de faire fonctionner quelque chose lorsque vous explorez simplement.

**Limitations** : Les commandes ne laissent pas de trace de ce que vous avez fait. Il n'y a pas de fichier de configuration à examiner, de contrôle de version ou à partager avec les coéquipiers. Si vous devez recréer quelque chose plus tard, vous devrez vous souvenir des commandes exactes que vous avez exécutées.

Pour voir quels objets vous avez créés, exécutez :

```bash
kubectl get all
```

Cela liste toutes les ressources dans le namespace par défaut.

## Configuration d'objet impérative

La **configuration d'objet impérative** utilise des fichiers (YAML ou JSON) qui contiennent des définitions d'objets complètes, mais vous dites toujours explicitement à kubectl quelle opération effectuer.

```bash
kubectl create -f nginx.yaml
kubectl replace -f nginx.yaml
kubectl delete -f nginx.yaml
```

C'est comme avoir un plan et dire au constructeur : "Construisez ceci," "Remplacez par ceci," ou "Démolissez ceci."

**Idéal pour** : Environnements de production où vous voulez que les fichiers de configuration soient stockés dans le contrôle de version. Vous obtenez les avantages d'avoir votre infrastructure en tant que code tout en gardant les opérations explicites et prévisibles.

**Considération importante** : La commande `replace` écrase complètement l'objet existant. Si Kubernetes ou un autre processus a apporté des modifications à l'objet en direct (comme ajouter une IP externe à un Service LoadBalancer), ces modifications seront perdues lorsque vous remplacez l'objet.

## Configuration d'objet déclarative

La **configuration d'objet déclarative** est l'approche la plus puissante. Vous fournissez des fichiers de configuration, et kubectl détermine automatiquement quelles opérations sont nécessaires pour faire correspondre le cluster à vos fichiers.

```bash
kubectl apply -f configs/
kubectl diff -f configs/  # Voir ce qui changerait
```

C'est comme montrer à Kubernetes une image de ce que vous voulez et dire : "Faites que ça ressemble à ça." Kubernetes compare l'état actuel à votre état souhaité et détermine les étapes nécessaires.

**Idéal pour** : Environnements de production, surtout lorsque plusieurs personnes travaillent sur le même cluster. Cela fonctionne très bien avec des répertoires de fichiers et gère automatiquement les opérations de création, mise à jour et suppression par objet.

**Avantage clé** : La configuration déclarative préserve les modifications apportées directement aux objets en direct, même si ces modifications ne sont pas dans vos fichiers de configuration. C'est utile lorsque Kubernetes met automatiquement à jour des champs (comme les endpoints de Service) ou lorsque vous devez faire des corrections rapides.

:::info
La configuration déclarative utilise l'opération API `patch`, qui ne met à jour que les différences entre votre état souhaité et l'état actuel. Cela signifie que les modifications apportées par d'autres processus ou par Kubernetes lui-même sont préservées, ce qui la rend plus sûre pour les environnements collaboratifs.
:::

Avant d'appliquer des modifications, vous pouvez les prévisualiser avec :

```bash
kubectl diff -f <file>
```

Remplacez `<file>` par le chemin de votre fichier YAML pour voir ce qui changerait sans faire de modifications.

## Choisir la bonne approche

Voici un guide simple :

- **Apprentissage ou tests rapides** : Utilisez les commandes impératives
- **Configuration de production simple** : Utilisez la configuration d'objet impérative
- **Production complexe ou environnements d'équipe** : Utilisez la configuration d'objet déclarative

La plupart des équipes de production migrent finalement vers la configuration déclarative car elle offre le meilleur équilibre entre sécurité, collaboration et automatisation. C'est comme la différence entre conduire manuellement une voiture versus utiliser le régulateur de vitesse, les deux fonctionnent, mais l'un est meilleur pour les longs trajets.
