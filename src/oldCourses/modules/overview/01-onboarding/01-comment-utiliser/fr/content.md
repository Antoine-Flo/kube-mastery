# Comment utiliser cette plateforme

```mermaid
flowchart LR
    A[Welcome] --> B[Kubernetes Course]
    B --> C[Interactive Terminal]
    C --> D[Learn & Practice]
```

Bienvenue sur KubeMastery ! Nous sommes ravis de vous accueillir. Cette plateforme vous permet d'apprendre Kubernetes dans un environnement rapide et sécurisé, le tout depuis votre navigateur.

## L'interface

Sur le côté droit de votre écran, vous trouverez un **terminal émulé**. Ce terminal vous permet d'exécuter des commandes et de manipuler un cluster Kubernetes simulé, exactement comme en production. C'est votre terrain de jeu pour expérimenter et apprendre.

Sous le terminal, vous trouverez des boutons : l'**icône télescope** ouvre le **visualiseur de cluster**, qui affiche votre cluster en diagramme (nœuds, pods, conteneurs) ; l'**icône chat** permet d'envoyer des retours, suggestions ou de signaler des bugs.

Sur le côté gauche, vous trouverez un **panneau de vue d'ensemble** qui vous permet de naviguer facilement entre les leçons. Vous pouvez l'afficher ou le masquer à tout moment avec le bouton en bas à gauche.

**Sur smartphone**, le layout est différent. Sachez que tous les claviers mobiles ne fonctionnent pas bien avec le terminal ; nous recommandons **Gboard**, qui a été testé.

## Tester l'environnement

Assurons-nous que tout fonctionne. Essayez cette commande dans le terminal :

Pour vérifier que kubectl fonctionne, exécutez :

```bash
kubectl version
```

Tout au long de ce cours, tout ce que nous expliquons ici est basé sur la documentation officielle de Kubernetes. Il est essentiel que vous appreniez à la naviguer efficacement, c'est un outil indispensable, surtout lors de la préparation aux examens de certification comme le CKA ou le CKAD.

## S'exercer avec les quiz

À la fin de chaque leçon, vous trouverez un **quiz** pour pratiquer ce que vous avez appris, vous devrez le compléter pour passer à la leçon suivante.
