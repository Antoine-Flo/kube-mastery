# Prompt IA, ajouter une nouvelle ressource cluster

Objectif: ajouter une ressource Kubernetes simulée et la connecter correctement.

Fais exactement ces étapes, dans cet ordre.

## 1) Créer le modèle ressource

- Crée `src/core/cluster/ressources/<Kind>.ts`
- Expose au minimum:
  - type/interface `<Kind>`
  - config type `<Kind>Config`
  - factory `create<Kind>()`
  - parser `parse<Kind>Manifest()`
- Respecte les conventions déjà utilisées dans les autres fichiers de `src/core/cluster/ressources/`.

## 2) Déclarer la ressource dans le manifest source de vérité

- Édite `src/core/cluster/clusterResources.manifest.yaml`
- Ajoute l’entrée dans `resources:`
- Renseigne correctement:
  - `kind`
  - `apiVersion`
  - `collectionKey`
  - `typeName`
  - `importPath`
  - `repoKindArg`
  - `facade`
  - `bootstrapEmpty`
  - `facadeSingular`
  - `facadePlural`
- Si la ressource doit être exposée kubectl:
  - `kubectlShortAliases` si utile
  - `kubectlDeleteSupported: true` si supprimable
  - `kubectlYamlSupported: true` si parser YAML attendu
  - `kubectlGetSupported: true` si visible dans `kubectl get`
- Si l’OpenAPI standard ne couvre pas la ressource:
  - ajoute `openapiSource: external-crd`

## 3) Régénérer le code

Exécute:

- `npm run cluster:resources:generate`
- `npm run openapi:types:generate` si nécessaire
- ou `npm run codegen:generate`

Ne modifie pas manuellement les fichiers `*.generated.ts`.

## 4) Vérifier les fichiers générés attendus

Confirme que la ressource est propagée dans:

- `src/core/cluster/generated/clusterResourceModels.generated.ts`
- `src/core/cluster/generated/clusterResourceTypes.generated.ts`
- `src/core/cluster/generated/clusterRegistry.generated.ts`
- `src/core/cluster/events/types.generated.ts`
- `src/core/kubectl/commands/resourceCatalog.generated.ts`
- `src/core/kubectl/generated/yamlManifestParsers.generated.ts`
- `src/core/kubectl/commands/handlers/internal/get/resourceHandlerRegistry.generated.ts`
- `src/core/terminal/kubectl/watch/clusterEventWatchMeta.generated.ts`

Si absent, le manifest est incomplet ou invalide.

## 5) Connecter les parties non générées si nécessaire

Selon le scope, ajoute le wiring manuel:

- `kubectl describe`: registry + formatter
  - `src/core/kubectl/describe/registry.ts`
  - `src/core/kubectl/describe/describers/*`
- handlers spécifiques (create/auth/config/etc) si requis
  - `src/core/kubectl/commands/handlers/*`
- validations sémantiques si la commande impose des flags/contraintes
  - `src/core/kubectl/commands/parser.ts`
- mapping OpenAPI explain si cas spécial non couvert
  - `src/core/kubectl/explain/openapiResourceMapper.ts`

Règle: préfère la source déclarative/générée, ajoute du manuel uniquement si nécessaire.

## 6) Vérifier le comportement

Exécute au minimum:

- `npm run check`
- tests unitaires kubectl impactés

Si la ressource touche la parité kubectl:

- `npm run parity:manual -- "<commande kubectl>"`

## 7) Mettre à jour la traçabilité parité

Si la ressource couvre des commandes listées:

- `doc/ai-handoff/kubectl-parity/COMMAND_INDEX.txt`
- `doc/ai-handoff/kubectl-parity/MISSING_COVERAGE.txt`

## 8) Règles strictes

- Ne pas court-circuiter le manifest.
- Ne pas ajouter de logique test-specific.
- Ne pas éditer les fichiers générés à la main.
- Garder messages d’erreur et formats de sortie kubectl-like.
