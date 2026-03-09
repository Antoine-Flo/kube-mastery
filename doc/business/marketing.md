# Marketing & Outils - KubeMastery

## Positionnement & Ton

### Esprit boutique, projet solo

- **Projet de dev solo** : un seul créateur derrière le produit. Le communiquer clairement crée un lien de proximité et une relation plus personnelle.
- **Mission** : rendre l'apprentissage de Kubernetes plus accessible. Message à mettre en avant sur la landing et dans les copy.
- **Effet** : les gens ont plus envie de soutenir un projet humain et une mission claire qu'une "plateforme" anonyme. Utiliser "je", "mon objectif", "ce que je propose" pour renforcer ce lien.

### Transparence : limitations et inconvénients (page d'accueil / landing)

- **Principe** : afficher clairement les **limitations** et **inconvénients** sur la page d'accueil (ou une page dédiée "Ce que KubeMastery n'est pas" / "Limitations").
- **Pourquoi** : des études montrent que la transparence sur les limites augmente la confiance et la **propension à payer plus** ; les utilisateurs savent à quoi s'attendre et valorisent l'honnêteté.
- **À indiquer** (exemples) :
  - Simulateur local uniquement (pas de vrais clusters cloud).
  - Pas de certification officielle (CKA/CKAD) incluse, seulement la préparation.
  - Contenu en évolution (bêta), certaines leçons peuvent changer.
  - Support = communauté / email, pas de hotline 24/7.
- **Formulation** : ton factuel, pas défensif. Ex. : "Ce que vous obtenez — et ce que vous n'obtenez pas."

---

## Modèle Économique

### Modèle retenu : Lifetime Access (one-time payment)

- **Un seul plan** : accès à vie à tous les cours (actuels et futurs), cheat sheet, visualisation cluster, et toutes les futures features Pro.
- **Pas d'abonnement, pas de free trial** : paiement unique, accès permanent.
- **Tarif préférentiel** : un second prix réduit disponible pour les étudiants, demandeurs d'emploi ou personnes avec peu de moyens. Pas de vérification, basé sur la confiance. L'option est discrète (non mise en avant) et accompagnée d'un texte expliquant la démarche d'accessibilité.
- **Garantie 30 jours satisfait ou remboursé** : remboursement intégral sur demande dans les 30 jours, sans justification. Géré via Paddle. Remplace avantageusement le free trial.
- **Early Access** : prix barré affiché pour créer la perception d'une réduction honnête durant le lancement.

---

## Offres & Prix (page d'accueil / pricing)

### Affichage prix : early access

- **Prix barré + offre early access** : afficher l'ancien prix (ou le prix "normal" futur) barré, et le prix actuel avec un bandeau type **"Offre spéciale Early Access"** (ex. "Prix normal 49€ → 25€ pendant l'early access").
- Crée l'urgence et la perception d'une réduction, tout en restant honnête.

### Garantie 30 jours money-back

- **30 jours satisfait ou remboursé** : remboursement intégral sur demande dans les 30 jours, sans justification. Géré via Paddle (politique de remboursement).
- Message : "Zéro risque : tu essaies, et si ça ne te convient pas, tu es remboursé."

### Tiers & grille (résumé)

| Tier / Offre   | Public            | Idée de prix / détail                                                          |
| -------------- | ----------------- | ------------------------------------------------------------------------------ |
| **Individuel** | Devs, apprenants  | One-time lifetime (+ tarif préférentiel discret), 30 jours money-back          |
| **Business**   | Équipes, startups | Accès multi-utilisateurs, facturation dédiée, pas de support 24/7 (à préciser) |
| **Formation**  | Bootcamps, écoles | Voir B2B ci-dessous (Starter / Pro / Enterprise)                               |

### Sources de Revenus

#### 1. Accès payant (one-time payment)

- Accès à tous les cours, lifetime
- Paiement unique via **Paddle** (Merchant of Record : TVA, factures, litiges gérés par Paddle)
- Revenus ponctuels, pas d'abonnement → moins de pression support / remboursements

#### 2. Tier Business (équipes & startups)

Pour équipes dev, startups, PME qui veulent former plusieurs personnes :

| Offre    | Public            | Idée de prix / inclus                                                                                                                                    |
| -------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Business | 5–20 utilisateurs | Prix fixe mensuel ou annuel (ex. 99€/mois ou prépay annuel avec 2 mois offerts), accès complet pour l'équipe, facture unique, pas de SSO (ou en option). |

- **Différence avec Formation** : Business = usage interne (monter en compétence Kubernetes) ; Formation = centres de formation qui forment des étudiants (comptes dédiés, dashboard formateur).

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

### Paiement : Paddle (Merchant of Record)

- **One-time payment** : Paddle gère checkout, TVA, factures, litiges
- Pas d'abonnement → pas de relances, moins de charge support et remboursements
- Frais typiques : ~5 % + 0,50 € par vente (tout inclus)

## Projections

### Hypothèses conservatrices

- 1000 inscrits/mois (SEO + bouche-à-oreille)
- 5% convertissent (achat accès)
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

Donc pour te faire une paye avec du one-time : compter **environ 60–100 ventes/mois** selon le prix. Partir plus bas (ex. 17€) et monter progressivement une fois que tu as du trafic et des avis est une stratégie classique : les premiers acheteurs gardent l'accès, tu augmentes le prix pour les nouveaux.

## Différenciation vs Concurrence

| Aspect       | KubeMastery                       | Killer.sh | KodeKloud  |
| ------------ | --------------------------------- | --------- | ---------- |
| Modèle       | One-time lifetime, 30j money-back | Sessions  | Abonnement |
| Simulateur   | Local (rapide, sans latence)      | N/A       | Payant     |
| Points forts | Zéro friction, accès permanent    | Officiel  | Contenu    |

## Principes Directeurs

1. **One-time, accès permanent** : pas d'abonnement, pas de free trial. La garantie 30 jours remplace le trial.
2. **Accessibilité** : tarif préférentiel discret pour ceux qui en ont besoin, basé sur la confiance.
3. **Transparence** : limitations et inconvénients visibles sur la landing pour renforcer la confiance et la volonté de payer.
4. **Esprit boutique** : projet solo, mission "rendre Kubernetes accessible", ton personnel pour créer proximité et soutien.
5. **Early Access** : prix barré durant le lancement.
6. **Prix abordables** : moins cher que la concurrence.
7. **B2B** : Business (équipes) + Centres de formation = revenus récurrents stables.

## References

- See `spec.md` for feature details
- See `architecture.md` for technical structure
- See `roadmap.md` for timeline
