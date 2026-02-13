# Checklist de refactor - `kubectl create`

## P1 - Fiabilité fonctionnelle (à faire en premier)

- [ ] **Validation stricte des nombres**
  - Refuser `--replicas=3abc`, `--port=80x`, `--replicas=-1`.
  - Accepter uniquement des entiers valides (`replicas >= 0`, `1 <= port <= 65535`).
- [ ] **Unicité des noms de containers**
  - Garantir des noms uniques pour multi `--image` (même image répétée).
  - Ajouter suffixes déterministes (`nginx`, `nginx-2`, `nginx-3`).
- [ ] **Messages d'erreur explicites et cohérents**
  - Uniformiser les erreurs `create deployment` (nom manquant, image manquante, valeur invalide).
  - Conserver le préfixe `error:` pour homogénéité CLI.

## P2 - Maintenabilité et architecture

- [ ] **Source unique pour les flags à valeur**
  - Centraliser la liste des flags (`image`, `replicas`, `port`, `namespace`, etc.).
  - Réutiliser la même définition dans parser et transformer.
- [ ] **Extraire une validation métier dédiée**
  - Créer un module `validateCreateDeploymentOptions()` pur, testable, sans effets de bord.
  - Déplacer les règles de validation hors du handler principal.
- [ ] **Réduire le couplage parser/transformer**
  - Clarifier les responsabilités:
    - parser: tokens -> structure,
    - handler: règles métier + orchestration.

## P3 - Qualité produit et couverture tests

- [ ] **Compléter les tests négatifs**
  - `--replicas` invalide, `--port` invalide, images dupliquées, nom manquant.
- [ ] **Ajouter tests de non-régression**
  - `create -f` continue de fonctionner.
  - `create deployment -n ns my-dep --image=...` parse le bon nom.
- [ ] **Ajouter tests de propriétés minimales**
  - Pour plusieurs combinaisons de flags, vérifier invariants:
    - containers non vides,
    - noms uniques,
    - selector/template labels cohérents.

## P4 - Évolutions fonctionnelles (optionnel)

- [ ] Supporter des options supplémentaires de `kubectl create deployment` selon le scope du projet:
  - `--dry-run`,
  - `-o yaml|json`,
  - autres commandes impératives (`create service`, `create job`) si nécessaire.

## Definition of Done

- [ ] Tous les tests unitaires/integration ciblés passent.
- [ ] Aucune régression sur `create -f`.
- [ ] Lints propres sur les fichiers modifiés.
- [ ] API et messages d'erreur documentés dans les tests.
