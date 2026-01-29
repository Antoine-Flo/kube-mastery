# Marketing & Outils - Kube Mastery

## Modèle Économique

### Phase Bêta (Actuel)

- ✅ Tous les cours et leçons gratuits
- ✅ Simulateur Kubernetes complet
- ✅ Terminal avec kubectl, nano/vim
- ✅ Lab local (IndexedDB) - pas de persistance entre sessions

**Objectif** : Feedback utilisateurs, validation produit

### Après Bêta

#### Gratuit (sans inscription)
- Premier cours complet accessible sans compte
- Simulateur local
- Progression sauvegardée en local (localStorage)

#### Inscription (gratuite)
- Sauvegarde de la progression dans le cloud
- Accès aux cours payants (achat individuel ou abonnement)

#### Achat Individuel
- Cours individuels payants

#### Abonnement Pro
- Lab persistant (synchronisé avec compte)
- Accès à tous les cours
- Support prioritaire

### Stratégie d'acquisition

**Principe : Valeur d'abord, inscription après.**

```
1. Landing → "Commencer maintenant" (pas de signup)
2. Premier cours accessible immédiatement
3. Utilisateur progresse, apprécie le contenu
4. Prompt → "Inscris-toi pour sauvegarder ta progression"
5. Signup → progression sync + accès cours payants
```

**Avantages** :
- Zéro friction à l'entrée
- Leads qualifiés (ceux qui s'inscrivent sont engagés)
- Démo de qualité avant de demander quoi que ce soit

### Sources de Revenus

#### 1. Abonnement Pro
- Lab persistant + accès tous cours
- Revenus récurrents

#### 2. Achat de Cours Individuels
- Cours à l'unité
- Revenus ponctuels

#### 3. Sessions K8s Réel (Pay-as-you-go)

Pour la pratique sur vrai cluster Kubernetes :

| Option          | Prix | Description          |
| --------------- | ---- | -------------------- |
| Session 30min   | 2€   | Pratique libre       |
| Session 2h      | 5€   | Examen blanc         |
| Pack 5 sessions | 15€  | Préparation complète |

#### 4. Certification Badge Maison

- Examen chronométré sur vrai K8s
- Badge vérifiable (lien unique pour LinkedIn)
- Prix : 10-20€

#### 5. Abonnement Centres de Formation (B2B)

Pour bootcamps, écoles, entreprises :

| Offre      | Prix      | Inclus                           |
| ---------- | --------- | -------------------------------- |
| Starter    | 50€/mois  | 20 comptes étudiants             |
| Pro        | 150€/mois | 100 comptes, dashboard formateur |
| Enterprise | Sur devis | Illimité, support, SSO           |

**Cibles** : Le Wagon, OpenClassrooms, Orsys, écoles d'ingé, AFPA

#### 6. Sponsoring Cloud Providers

- Programmes startup : AWS Activate, GCP for Startups, Azure for Startups
- Jusqu'à 100k$ de crédits pour réduire les coûts infra

#### 7. Affiliation

- Linux Foundation (CKA/CKAD) : 10-15% sur inscriptions
- Hébergeurs (DigitalOcean, Linode) : 25-100$ par nouveau client

## Stack Technique

### Email & CRM : Brevo

- **Plan gratuit** : 300 emails/jour (suffisant jusqu'à 500+ users)
- **Plan payant** : 16€/mois (quand nécessaire)

### Feedback Utilisateur : Tally.so

- Formulaire pour Bug/Feature/Question
- Notifications email à chaque soumission

### Hébergement

- **Frontend** : Cloudflare Pages
- **Auth** : Supabase (25€/100k users authentifiés)

## Projections

### Hypothèses conservatrices

- 1000 inscrits/mois (SEO + bouche-à-oreille)
- 5% convertissent vers sessions payantes
- Pack moyen à 15€

| Mois | Inscrits cumulés | Conversions (5%) | Revenus |
| ---- | ---------------- | ---------------- | ------- |
| 3    | 3000             | 150              | 2250€   |
| 6    | 6000             | 300              | 4500€   |
| 12   | 12000            | 600              | 9000€   |

### Coûts

| Poste                   | Coût mensuel |
| ----------------------- | ------------ |
| Cloudflare              | 0€           |
| Supabase (< 100k users) | 25€          |
| AWS (sessions K8s)      | ~2€/session  |
| Brevo (> 500 users)     | 16€          |

## Différenciation vs Concurrence

| Aspect            | Kube Mastery        | Killer.sh     | KodeKloud |
| ----------------- | ------------------- | ------------- | --------- |
| Essai sans compte | ✅ 1er cours complet | ❌             | ❌         |
| Simulateur        | Local (rapide)      | N/A           | Payant    |
| Lab persistant    | Abonnement          | Inclus        | Payant    |
| Vrai K8s          | Pay-as-you-go       | Inclus examen | Payant    |
| Points forts      | Zéro friction       | Officiel      | Contenu   |

## Principes Directeurs

1. **Valeur d'abord** : Premier cours sans inscription
2. **Zéro friction** : Pas de signup pour essayer
3. **Prix abordables** : Moins cher que la concurrence
4. **B2B** : Centres de formation = revenus récurrents stables

## References

- See `spec.md` for feature details
- See `architecture.md` for technical structure
- See `roadmap.md` for timeline
