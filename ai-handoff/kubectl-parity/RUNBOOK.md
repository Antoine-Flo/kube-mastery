# Boucle IA simple, kind parity stricte

Objectif:
- prendre une commande manquante
- l'implémenter
- comparer simulation vs kind
- corriger jusqu'au match strict
- supprimer la ligne de la liste des manques

Règle de done:
- exit code identique
- stdout identique (hors champs dynamiques autorisés)
- stderr identique (hors champs dynamiques autorisés)

Champs dynamiques autorisés:
- age
- timestamp
- uid
- ip
- resourceVersion

Boucle à appliquer pour chaque commande:
1. Lire la doc officielle kubectl ou helm.
2. Lire le code de référence dans `refs/`.
3. Implémenter dans la simulation.
4. Ajouter ou adapter les tests unitaires ciblés.
5. Exécuter la comparaison kind vs simulation avec la même commande exacte.
6. Corriger les diff.
7. Rejouer jusqu'au match strict.
8. Supprimer la commande de `MISSING_COVERAGE.txt`.
9. Ajouter la commande dans `COMMAND_INDEX.txt`.

Commandes utiles:
- `npm run parity:manual -- --cmd "kubectl ..."`
- `npm run conformance`
- `npm run test`

Règle d'arrêt:
- si un gap architectural majeur est détecté (famille ressource absente, sous-système manquant), noter le gap dans la liste des manques avant de continuer.

NetworkPolicy (trafic simulé):
- CRUD kubectl reste aligné sur l'API.
- Le trafic HTTP simulé via `curl` passe par `TrafficEngine.simulateHttpGet`, qui applique une union de règles ingress/egress (MVP: `matchLabels`, pairs `podSelector` dans le namespace de la policy, ports TCP numériques sur le `targetPort` du endpoint, identité source depuis `kubectl exec`, shell conteneur, ou `kubectl run --attach`).
- Hors périmètre actuel: enforcement sur `dig` / `nslookup`, `namespaceSelector`, `ipBlock`, `matchExpressions`, ports nommés, curl direct vers IP de pod sans routage service (voir commentaire en tête de `src/core/network/networkPolicyTrafficEvaluation.ts`).
