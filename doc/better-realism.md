# Plan d'amelioration du realisme (simulateur vs kind)

## Objectif

Rapprocher le simulateur du comportement reel de Kubernetes (profil `kind`) sans cluster reel dans le produit final, sans "forcer" les tests via normalizers, sauf normalisation des identifiants dynamiques (hash/suffixes/UIDs).

## Principes directeurs

- Verite fonctionnelle avant verite cosmetique: prioriser les regles de comportement (exit codes, erreurs, validation des flags, transition d'etats).
- Les normalizers ne doivent pas masquer des ecarts de moteur: conserver uniquement la normalisation des IDs dynamiques.
- Chaque lot d'amelioration doit faire baisser le diff conformance "naturellement".
- Garder des sorties proches de `kubectl` (shape, sections, ordre, vocabulaire).

## Etat d'avancement (mis a jour)

### Deja implemente

- Bootstrap kind-like minimum en code (nodes + objets systeme minimum + pods systeme).
- Bootstrap centralise avec un point unique de verite: `createClusterState(...)`.
- Policy explicite de bootstrap: profil + mode (`kind-like|none` et `always|missing-only|never`).
- Parite `kubectl get -o yaml/json`:
  - mode structure pour listes vides (`kind: List`, `apiVersion`, `items`, `metadata.resourceVersion`),
  - objet unique pour `kubectl get <resource> <name> -o yaml/json`.
- Ajustements de fidelite sur le rendu:
  - indentation JSON alignee (4 espaces),
  - tabulation table `kubectl get` amelioree (spacing coherent).

### Reste a traiter (prochaines vagues)

- Validation stricte des combinaisons de flags `create/scale/delete`.
- Surface help globale et sous-commandes (`-h`, `--help`).
- Parite `api-resources` (catalogue + tri + formats).
- `cluster-info dump` plus complet.
- `describe pod` runtime/events plus proches kubelet.

### Avancement recent (Lots C a F)

- Lot C (create/delete semantics):
  - `create deployment` renvoie des references kind-like (`deployment.apps/...`),
  - `delete` namespaced ajoute le suffixe `from <namespace> namespace`,
  - `delete deployments <name>` renvoie `NotFound` + `exitCode=1` si absent.
- Lot D (validation parser/create):
  - `create deployment --image --image -- <cmd>` est maintenant refuse avec erreur kubectl-like,
  - absence de `--image` renvoie un message de flag requis plus proche de kubectl.
- Lot E (cluster-info / describe):
  - `cluster-info` inclut la ligne CoreDNS et une URL control-plane plus proche de kind,
  - `cluster-info dump --output-directory <path>` ne retourne plus une erreur "not supported".
- Lot F (formats get / api-resources):
  - `kubectl get pods -o wide` expose IP/NODE/NOMINATED NODE/READINESS GATES,
  - tri stable des deployments en sortie tabulaire,
  - `api-resources --output wide` expose `categories: all` pour les workloads principaux.

### Execution en cours: Lot A / Lot B

#### Lot A - Help CLI (`-h`, `--help`)

- Objectif:
  - pre-parser des flags help avant validation metier pour eviter les faux "Invalid or missing ...",
  - `exitCode=0` sur les chemins help, sans executer la logique de commande.
- Risques:
  - regressions de parsing si la priorite help est injectee trop tard,
  - duplication des textes d'aide entre commandes.
- Criteres d'acceptation:
  - `kubectl -h`, `kubectl --help`, `kubectl get --help`, `kubectl create --help`, `kubectl api-resources --help` passent en mode aide,
  - baisse nette des mismatches sur `errors-help-cmd-9..23`.
- Metriques cibles:
  - diminution visible du volume `(missing)` dans la famille `errors-help-*`,
  - zero erreur de type "Invalid or missing action/resource" pour les commandes `--help`.

#### Lot B - `kubectl api-resources` parity

- Objectif:
  - separer "ressources supportees par le moteur" et "ressources exposees par discovery",
  - aligner default/wide/name/json/yaml + options `--namespaced`, `--sort-by`, `--no-headers`.
- Risques:
  - derive entre format table et format structure (json/yaml) si la source n'est pas unique,
  - erreurs d'ordering si tri et filtrage ne s'appliquent pas dans le meme ordre que kubectl.
- Criteres d'acceptation:
  - baisse nette des mismatches `platform-cmd-9..18`,
  - shape `APIResourceList` conforme et `groupVersion` aligne en JSON/YAML.
- Metriques cibles:
  - baisse du mismatch count dans la famille `platform-cmd-*`,
  - exact match sur les validations deja bonnes (`--sort-by=age` reste une erreur specifique).

## Resume des ecarts majeurs observes

- `kubectl get ... -o yaml/json`: shape incorrecte pour les listes vides et ressources unitaires.
- `kubectl get nodes`: noeuds absents dans l'etat simule.
- `kubectl describe pod`: sortie trop simplifiee vs kubelet/kubectl.
- `kubectl create deployment`: certaines validations de flags ne matchent pas `kubectl`.
- `kubectl -h` et `--help` des sous-commandes non supportes ou mal routes.
- `kubectl api-resources`: catalogue trop partiel et ordering/format differents.
- `kubectl cluster-info` / `dump`: donnees trop simplifiees, options partielles.

## Plan en vagues

## Vague 1 - Realisme structurel (impact fort, risque faible)

### 1) Bootstrap cluster kind-like coherent

#### Cible

Produire un etat initial proche d'un cluster kind juste apres bootstrap.

#### Travaux

- Ajouter des `Node` systeme au demarrage (`control-plane`, `worker`, `worker2`) avec status/roles/version coherent.
- Ajouter les objets systeme minimaux attendus (ex: `kube-root-ca.crt` dans chaque namespace utile).
- Aligner la chronologie initiale des pods systeme: `Pending` / `ContainerCreating` / `Running` selon une timeline courte, pas directement `Running`.

#### Approche

- Creer un module `systemClusterBootstrap` (nodes + ressources de base + pods systeme).
- Utiliser un horodatage central de seed pour garantir des ages relatifs credibles.
- Conserver l'event bus pour les transitions d'etat, sans mutation cachee.

#### Critere d'acceptation

- `kubectl get nodes` n'affiche plus `No resources found`.
- `kubectl get pods -A` montre des etats initiaux proches de kind.

### 2) Parite de shape `get -o yaml/json`

#### Cible

Respecter les structures `List` et `Object` attendues par `kubectl`.

#### Travaux

- Pour `get` en `-o yaml/json`:
  - retourner `kind: List`, `apiVersion`, `items`, `metadata.resourceVersion` pour les collections.
  - retourner un objet unique pour `get pod <name> -o yaml/json`.
- Ne pas renvoyer "No resources found..." quand un format structurel est demande (`yaml/json`), meme si `items` est vide.

#### Approche

- Introduire des formatters de sortie par mode: `table`, `yaml-list`, `yaml-object`, `json-list`, `json-object`.
- Factoriser la serialisation par ressource (pods, services, nodes, etc.).

#### Critere d'acceptation

- `kubectl get pods -o yaml` et `-o json` matchent le shape attendu (y compris vide).
- `kubectl get pod web -o yaml` sort un objet `Pod` et non un tableau.

### 3) Parite des validations `create/scale/delete`

#### Cible

Aligner les combinaisons valides/invalides de flags et les erreurs.

#### Travaux

- Reproduire les erreurs kubectl pour `create deployment` (ex: combinaisons d'images/commande incompatibles).
- Harmoniser les messages et codes de sortie NotFound avec prefixes `Error from server (...)`.
- Aligner les messages de `delete` sur le format `resource.group "name" deleted from namespace`.

#### Approche

- Ajouter une couche `command validators` avant execution des handlers.
- Introduire des tests golden sur stderr/stdout exacts pour les scenarios d'erreur cle.

#### Critere d'acceptation

- Les cas `errors-help` principaux ont meme exit code et meme semantique de message que kind.

## Vague 2 - Surface CLI et diagnostic (impact fort, risque moyen)

### 4) Support help global et sous-commandes

#### Cible

Gerer `kubectl -h`, `kubectl --help`, `<cmd> --help`.

#### Travaux

- Router les flags help avant la validation "action obligatoire".
- Ajouter une table de contenu help pour commandes implementees.
- Pour commandes non supportees, afficher un message explicite compatible kubectl (sans faux positif).

#### Approche

- Ajouter un `help pre-parser` (global flags) avant le parser actuel.
- Generer le help depuis metadata de commandes pour eviter duplication.

#### Critere d'acceptation

- Les scenarios `-h` / `--help` ne tombent plus sur "Invalid or missing action".

### 5) `api-resources` plus proche du serveur

#### Cible

Elargir le catalogue et aligner tri/format par defaut.

#### Travaux

- Etendre la liste des API resources visibles dans un cluster kind standard.
- Aligner `--output wide/name/json/yaml`, `--namespaced`, `--sort-by`, `--no-headers`.
- Verifier `groupVersion` et champs JSON attendus.

#### Approche

- Introduire un registre `ApiDiscoveryCatalog` versionne (par version Kubernetes cible).
- Distinguer "resources supportees par le moteur" et "resources exposees par discovery".

#### Critere d'acceptation

- Diminution significative des mismatches sur toutes les variantes `api-resources`.

### 6) `cluster-info` et `cluster-info dump`

#### Cible

Aligner la forme de sortie et les sections dump principales.

#### Travaux

- Aligner URL control plane/proxy services pour profil kind.
- Enrichir `dump` avec NodeList/PodList/... non vides quand pertinent.
- Supporter `--output-directory` (mode simulation de fichiers) ou reproduire strictement le comportement equivalent.

#### Approche

- Introduire un `dump renderer` par format (`json`, `yaml`) et par ressource.
- Isoler la partie "file export simulation" derriere une abstraction FS.

#### Critere d'acceptation

- Les scenarios `cluster-info*` convergent sur la structure et les options.

## Vague 3 - Realisme runtime (impact moyen, valeur long terme)

### 7) `describe pod` kubelet-like

#### Cible

Rendre `describe` utile pour troubleshooting CKA et proche du reel.

#### Travaux

- Ajouter sections manquantes: `Priority`, `Service Account`, `Node`, `Start Time`, `IPs`, `QoS`, `Tolerations`, `Events`.
- Completer details conteneur: `Container ID`, `Image ID`, `Host Port`, `Mounts`.
- Integrer evenements derives de transitions scheduler/startup.

#### Approche

- Creer un `PodStatusProjection` pour calculer les champs derives.
- Construire un mini `EventStore` pour afficher les derniers evenements pertinents.

#### Critere d'acceptation

- Le diff sur `kubectl describe pod web` passe de "ecart massif" a "ecarts mineurs".

### 8) Simulation de transitions d'etat plus realiste

#### Cible

Mieux simuler l'enchainement Pending -> ContainerCreating -> Running et les readiness.

#### Travaux

- Introduire une machine d'etats par pod (avec causes visibles).
- Differencier pods systeme et pods user (timings, causes de pending).
- Relier scheduler, startup simulator, et events dans une timeline unique.

#### Approche

- Finite State Machine legere + horloge injectable pour tests deterministes.
- Tests de scenario "timeline" (snapshot par t+N secondes).

#### Critere d'acceptation

- Sorties `get pods -A` et `describe` montrent des transitions plausibles, pas des bascules immediates uniformes.

## Normalization policy (stricte)

## Autorise

- IDs dynamiques: suffixes de noms, UIDs, hashes, IDs runtime.

## Interdit (a terme)

- Masquage des ecarts de comportement: timestamps, IPs, ports, ordering, sections manquantes.

## Plan de reduction des normalizers

- Etape 1: conserver normalizer actuel le temps de corriger le moteur.
- Etape 2: retirer progressivement timestamp/IP/port normalization.
- Etape 3: garder uniquement IDs dynamiques.

## Strategie de livraison

## Decoupage en PRs

- PR1: bootstrap kind-like + nodes + objets systeme.
- PR2: `get -o yaml/json` shape correctness.
- PR3: validations commandes et erreurs.
- PR4: help global/sous-commandes.
- PR5: api-resources parity.
- PR6: cluster-info dump parity.
- PR7: describe pod runtime + events.

## Definition of done (par PR)

- Les tests unitaires existants passent.
- Nouveaux tests golden conformance ajoutes pour les commandes touchees.
- Le nombre de mismatches `artifacts/conformance/diff.log` baisse sans ajout de normalizers.
- Aucune regression sur commandes deja conformes.

## Metriques de progression

- Mismatch count global (baseline -> cible).
- Mismatch count par famille de commande (`get`, `api-resources`, `help`, `cluster-info`, `describe`).
- Taux de commandes "exact match" en mode `raw` (hors IDs normalises).

## Priorite immediate recommandee

1. Completer la parite `cluster-info dump` (structure detaillee des listes + ordering fin).
2. Rapprocher `describe pod` des sections kubelet (mounts/events/container details complets).
3. Finaliser les ecarts cosmetiques tabulaires (`get`/`api-resources`) restants.
4. Rejouer la conformance complete et mesurer le delta par famille.
