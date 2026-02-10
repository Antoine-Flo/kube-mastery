# Tests de Conformité OpenAPI

## Objectif

Valider que les ressources Kubernetes créées par le simulateur sont conformes aux spécifications OpenAPI officielles. **Les tests échouent si les ressources ne sont pas conformes.**

## Spécifications OpenAPI

Les specs sont téléchargées depuis : https://github.com/kubernetes/kubernetes/tree/master/api/openapi-spec/v3

Fichiers utilisés :

- `api__v1_openapi.json` - Core v1 (Pods, ConfigMaps, Secrets, Services, Namespaces)
- `apis__apps__v1_openapi.json` - Apps v1 (Deployments, ReplicaSets, StatefulSets)

## Architecture

```
Tests → Loader (charge specs) → Validator (Ajv) → Validation JSON Schema → Résultat
```

- **loader.ts** : Charge et parse les specs OpenAPI JSON
- **validator.ts** : Utilise Ajv pour valider contre les schémas (résolution automatique des $ref)
- **tests/** : Tests de conformité par type de ressource

## Ajouter un test de conformité

### 1. Créer le fichier de test

```typescript
// tests/conformance/tests/ressource-conformance.test.ts
import { beforeAll, describe, expect, it } from 'vitest'
import { createRessource } from '../../../src/core/cluster/ressources/Ressource'
import { loadOpenAPISpec } from '../openapi/loader'
import { createOpenAPIValidator } from '../openapi/validator'

describe('Ressource OpenAPI Conformance', () => {
  let validator: ReturnType<typeof createOpenAPIValidator>

  beforeAll(async () => {
    const specResult = await loadOpenAPISpec('api__v1_openapi.json')
    if (!specResult.ok) {
      throw new Error(`Failed to load spec: ${specResult.error}`)
    }
    validator = createOpenAPIValidator(specResult.value)
  })

  describe('valid ressources', () => {
    it('should validate minimal ressource', () => {
      const ressource = createRessource({
        /* ... */
      })

      // Convertir en objet simple (retirer champs internes)
      const ressourceForValidation = {
        apiVersion: ressource.apiVersion,
        kind: ressource.kind,
        metadata: {
          /* ... */
        },
        spec: {
          /* ... */
        }
      }

      const result = validator.validateResource(ressourceForValidation, 'v1', 'Ressource')
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      expect(result.value.valid).toBe(true)
    })
  })

  describe('invalid ressources', () => {
    it('should reject ressource with invalid type', () => {
      const invalidRessource = {
        apiVersion: 'v1',
        kind: 'Ressource',
        metadata: { name: 'test', namespace: 'default' },
        spec: { field: 123 } // Invalid: should be string
      }

      const result = validator.validateResource(invalidRessource, 'v1', 'Ressource')
      expect(result.ok).toBe(true)
      if (result.ok) {
        // Le test échoue si la ressource est valide
        expect(result.value.valid).toBe(false)
        expect(result.value.errors).toBeDefined()
        expect(result.value.errors?.length).toBeGreaterThan(0)
      }
    })
  })
})
```

### 2. Mapping API version → schéma

Le validator mappe automatiquement :

- `v1` → `io.k8s.api.core.v1.{Kind}`
- `apps/v1` → `io.k8s.api.apps.v1.{Kind}`

Pour d'autres versions, modifier `getSchemaName()` dans `validator.ts`.

### 3. Conversion ADT → OpenAPI

Si votre modèle utilise des ADT (discriminated unions), convertir avant validation :

```typescript
// Exemple : Secret.type est un ADT, OpenAPI attend un string
const secretForValidation = {
  ...secret,
  type: secret.type.type // Convertir ADT en string
}
```

## Points importants

- **Les tests échouent si `result.value.valid === false`** : C'est le comportement attendu pour les tests "should reject"
- **`result.ok`** : Indique si la validation s'est exécutée (pas si la ressource est valide)
- **`result.value.valid`** : Indique si la ressource est conforme (`true`) ou non (`false`)
- **`result.value.errors`** : Liste des erreurs de validation (champ, message, type attendu/reçu)

## Exécution

```bash
npm test -- tests/conformance/tests/
```
