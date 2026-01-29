# Helm Virtuel - Kube Simulator

Documentation pour l'implémentation d'un Helm éducatif dans le simulateur.

## 🎯 Objectifs

- **Apprentissage** : Permettre aux utilisateurs d'apprendre Helm sans cluster réel
- **Cours dédiés** : Créer des modules d'apprentissage Helm (charts, values, templating)
- **Usage interne** : Utiliser Helm pour la génération de seeds composables
- **Compatibilité** : Supporter un subset suffisant de la syntaxe Go templates

---

## 📊 Analyse de Helm

### Ce que fait Helm

1. **Templating** : Remplace `{{ .Values.xxx }}` par des valeurs
2. **Packaging** : Charts = templates + values.yaml + Chart.yaml
3. **Releases** : Gère installations/upgrades/rollbacks
4. **Repositories** : Télécharge des charts (non prioritaire)

### Complexité par fonctionnalité

| Fonctionnalité                           | Difficulté    | Utilité pédagogique |
| ---------------------------------------- | ------------- | ------------------- |
| Templating basique (`{{ .Values.x }}`)   | ⭐ Facile      | Très haute          |
| Fonctions (`default`, `quote`, `toYaml`) | ⭐⭐ Moyen      | Haute               |
| Conditionnels (`if`, `range`)            | ⭐⭐ Moyen      | Haute               |
| `helm install/upgrade/uninstall`         | ⭐ Facile      | Très haute          |
| `helm template` (dry-run)                | ⭐ Facile      | Très haute          |
| Values merging (values.yaml + --set)     | ⭐⭐ Moyen      | Haute               |
| Release history/rollback                 | ⭐⭐ Moyen      | Moyenne             |
| Hooks (pre-install, post-upgrade)        | ⭐⭐⭐ Difficile | Moyenne             |
| Dependencies (subcharts)                 | ⭐⭐⭐ Difficile | Moyenne             |
| Repositories                             | ⭐⭐⭐⭐ Complexe | Basse               |

---

## 🚀 Phase 1 - MVP (Commandes de base)

### Commandes à implémenter

```bash
helm template <release> <chart>     # Rendre un chart en YAML (dry-run)
helm install <release> <chart>      # Installer un chart
helm list                           # Lister les releases
helm uninstall <release>            # Supprimer une release
helm get values <release>           # Afficher les values d'une release
helm get manifest <release>         # Afficher le manifest généré
```

### Templating basique

Variables supportées :
- `{{ .Values.xxx }}` : Valeurs du fichier values.yaml
- `{{ .Release.Name }}` : Nom de la release
- `{{ .Release.Namespace }}` : Namespace de la release
- `{{ .Chart.Name }}` : Nom du chart
- `{{ .Chart.Version }}` : Version du chart

Fonctions essentielles :
- `default` : Valeur par défaut
- `quote` : Entoure de guillemets
- `| indent N` : Indentation
- `| nindent N` : Nouvelle ligne + indentation

### Structure d'un chart

```
mychart/
├── Chart.yaml          # Métadonnées du chart
├── values.yaml         # Valeurs par défaut
└── templates/
    ├── deployment.yaml
    ├── service.yaml
    └── _helpers.tpl    # Templates partiels (optionnel)
```

### Implémentation

```typescript
// src/core/helm/
├── HelmEngine.ts       // Moteur principal
├── TemplateEngine.ts   // Parser de templates Go
├── ChartLoader.ts      // Chargement des charts
├── ReleaseManager.ts   // Gestion des releases
└── commands/
    ├── install.ts
    ├── template.ts
    ├── list.ts
    └── uninstall.ts
```

### Stockage des releases

```typescript
interface HelmRelease {
  name: string
  namespace: string
  chart: string
  version: number        // Revision number
  values: Record<string, any>
  manifest: string       // YAML généré
  status: 'deployed' | 'uninstalled' | 'failed'
  installedAt: Date
}
```

---

## 🔧 Phase 2 - Templating avancé

### Conditionnels

```yaml
{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
...
{{- end }}
```

### Boucles

```yaml
{{- range .Values.ports }}
- port: {{ .port }}
  targetPort: {{ .targetPort }}
{{- end }}
```

### Fonctions supplémentaires

- `toYaml` : Convertit en YAML
- `include` : Inclut un template partiel
- `required` : Valeur obligatoire
- `lookup` : Recherche dans le cluster (simulé)
- `tpl` : Évalue une string comme template

### Commandes supplémentaires

```bash
helm upgrade <release> <chart>      # Mise à jour
helm rollback <release> <revision>  # Retour arrière
helm history <release>              # Historique des révisions
helm show values <chart>            # Afficher values par défaut
helm create <name>                  # Créer un chart vide
```

---

## 📚 Phase 3 - Cours Helm

### Module 1 : Introduction à Helm

1. Qu'est-ce que Helm ?
2. Concepts : Charts, Releases, Values
3. Premier `helm install`
4. `helm list` et `helm uninstall`

### Module 2 : Templating basique

1. Syntaxe `{{ .Values.xxx }}`
2. Variables built-in (Release, Chart)
3. Fonction `default`
4. `quote` et `indent`

### Module 3 : Templating avancé

1. Conditionnels `if/else`
2. Boucles `range`
3. Templates partiels `_helpers.tpl`
4. Fonction `include`

### Module 4 : Créer son propre chart

1. Structure d'un chart
2. Chart.yaml et values.yaml
3. Best practices
4. Exercice : Créer un chart pour une app web

### Module 5 : Gestion des releases

1. `helm upgrade` et `--set`
2. Historique et rollback
3. Hooks (pre-install, post-upgrade)
4. Tests de chart

---

## 🔗 Usage interne : Seeds composables

Helm peut être utilisé pour générer les seeds du simulateur :

```
seeds/
├── charts/
│   ├── nginx/
│   │   ├── Chart.yaml
│   │   ├── values.yaml
│   │   └── templates/
│   │       ├── deployment.yaml
│   │       ├── service.yaml
│   │       └── configmap.yaml
│   └── redis/
│       └── ...
│
├── scenarios/
│   ├── default.yaml        # helm install nginx ./charts/nginx
│   ├── troubleshooting.yaml
│   └── multi-namespace.yaml
```

Avantage : Un seul chart nginx réutilisable avec différentes values pour chaque scénario.

---

## 🛠️ Approche technique

### Option retenue : Subset de Go templates

Implémenter un parser custom qui supporte les cas d'usage courants (80/20).

Raisons :
- Contrôle total sur le comportement
- Pas de dépendance externe
- Permet des messages d'erreur pédagogiques
- Cohérent avec l'approche kubectl

### Parser de templates

```typescript
// Tokenizer : {{ ... }} → tokens
// Parser : tokens → AST
// Evaluator : AST + context → string

interface TemplateContext {
  Values: Record<string, any>
  Release: { Name: string; Namespace: string }
  Chart: { Name: string; Version: string }
}

function renderTemplate(template: string, context: TemplateContext): string
```

### Intégration avec le cluster

```typescript
// helm install applique les ressources au cluster simulé
const manifest = helmEngine.template(chart, values)
const resources = parseYamlManifest(manifest)
for (const resource of resources) {
  clusterState.apply(resource)
}
```

---

## 📋 Priorisation

### Phase 1 - MVP
1. ✅ Structure de base (HelmEngine, ChartLoader)
2. ✅ Templating basique (Values, Release, Chart)
3. ✅ `helm template`
4. ✅ `helm install` / `helm uninstall`
5. ✅ `helm list`

### Phase 2 - Templating avancé
6. ✅ Fonctions : `default`, `quote`, `toYaml`, `indent`
7. ✅ Conditionnels `if/else`
8. ✅ Boucles `range`
9. ✅ `helm upgrade` / `helm rollback`

### Phase 3 - Cours
10. ✅ Module 1 : Introduction
11. ✅ Module 2 : Templating basique
12. ✅ Module 3 : Templating avancé
13. ✅ Module 4 : Créer un chart

### Phase 4 - Avancé (optionnel)
14. ✅ Helpers `_helpers.tpl` et `include`
15. ✅ Hooks
16. ✅ Subcharts / dependencies

---

## 🔗 Références

- Documentation Helm : https://helm.sh/docs/
- Go template syntax : https://pkg.go.dev/text/template
- Chart best practices : https://helm.sh/docs/chart_best_practices/
