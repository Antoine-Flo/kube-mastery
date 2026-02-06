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
- Accès aux cours payants (one-time payment)

#### Achat Individuel

- Cours individuels payants

#### Accès payant (contenu)

- Accès à tous les cours
- Progression sauvegardée dans le cloud (Supabase)
- Support (optionnel)

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

#### 1. Accès payant (one-time payment)

- Accès à tous les cours, lifetime
- Paiement unique via **Paddle** (Merchant of Record : TVA, factures, litiges gérés par Paddle)
- Revenus ponctuels, pas d’abonnement → moins de pression support / remboursements

#### 2. Achat de Cours Individuels

- Cours à l'unité
- Revenus ponctuels

#### 3. Abonnement Centres de Formation (B2B)

Pour bootcamps, écoles, entreprises :

| Offre      | Prix      | Inclus                           |
| ---------- | --------- | -------------------------------- |
| Starter    | 50€/mois  | 20 comptes étudiants             |
| Pro        | 150€/mois | 100 comptes, dashboard formateur |
| Enterprise | Sur devis | Illimité, support, SSO           |

**Cibles** : Le Wagon, OpenClassrooms, Orsys, écoles d'ingé, AFPA

#### 4. Sponsoring Cloud Providers

- Programmes startup : AWS Activate, GCP for Startups, Azure for Startups
- Jusqu'à 100k$ de crédits pour réduire les coûts infra

#### 5. Affiliation

- Linux Foundation (CKA/CKAD) : 10-15% sur inscriptions
- Hébergeurs (DigitalOcean, Linode) : 25-100$ par nouveau client

## Stack Technique

### Email & CRM : Brevo

- **Plan gratuit** : 300 emails/jour (suffisant jusqu'à 500+ users)
- **Plan payant** : 16€/mois (quand nécessaire)

### Feedback Utilisateur : Tally.so

- Formulaire pour Bug/Feature/Question
- Notifications email à chaque soumission

### Paiement : Paddle (Merchant of Record)

- **One-time payment** : Paddle gère checkout, TVA, factures, litiges
- Pas d’abonnement → pas de relances, moins de charge support et remboursements
- Frais typiques : ~5 % + 0,50 € par vente (tout inclus)

### Hébergement

- **Frontend** : Cloudflare Pages
- **Auth** : Supabase (25€/100k users authentifiés)

## Projections

### Hypothèses conservatrices

- 1000 inscrits/mois (SEO + bouche-à-oreille)
- 5% convertissent (achat accès / cours)
- Panier moyen à définir (ex. 17–25€ one-time)

| Mois | Inscrits cumulés | Conversions (5%) | Revenus (ex. 20€/user) |
| ---- | ---------------- | ---------------- | ---------------------- |
| 3    | 3000             | 150              | 3000€                  |
| 6    | 6000             | 300              | 6000€                  |
| 12   | 12000            | 600              | 12000€                 |

### Coûts

| Poste                   | Coût mensuel |
| ----------------------- | ------------ |
| Cloudflare              | 0€           |
| Supabase (< 100k users) | 25€          |
| Brevo (> 500 users)     | 16€          |

### Objectif : une paye (ordre de grandeur)

Hypothèse : ~1500€ net/mois visés, coûts fixes ~40€, Paddle ~5 % + 0,50 € par vente.

| Prix one-time | Net après frais Paddle (~) | Ventes/mois pour ~1500€ |
| ------------- | -------------------------- | ----------------------- |
| 17€           | ~16€                       | ~95                     |
| 25€           | ~23€                       | ~65                     |
| 30€           | ~28€                       | ~55                     |

Donc pour te faire une paye avec du one-time : compter **environ 60–100 ventes/mois** selon le prix. 17€ c’est peu par vente mais plus facile à vendre ; 25–30€ réduit le nombre de ventes nécessaires. Partir plus bas (ex. 17€) et monter progressivement une fois que tu as du trafic et des avis est une stratégie classique : les premiers acheteurs gardent l’accès, tu augmentes le prix pour les nouveaux.

## Différenciation vs Concurrence

| Aspect            | Kube Mastery           | Killer.sh | KodeKloud |
| ----------------- | ---------------------- | --------- | --------- |
| Essai sans compte | ✅ 1er cours complet   | ❌        | ❌        |
| Simulateur        | Local (rapide)         | N/A       | Payant    |
| Points forts      | Zéro friction, contenu | Officiel  | Contenu   |

## Principes Directeurs

1. **Valeur d'abord** : Premier cours sans inscription
2. **Zéro friction** : Pas de signup pour essayer
3. **Prix abordables** : Moins cher que la concurrence
4. **B2B** : Centres de formation = revenus récurrents stables

## References

- See `spec.md` for feature details
- See `architecture.md` for technical structure
- See `roadmap.md` for timeline
