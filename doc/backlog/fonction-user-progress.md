# Fonction PostgreSQL pour calculer la progression utilisateur

## Problème actuel

Ce doc décrit un flux où le calcul de progression se faisait côté client. **État actuel (Astro)** : la progression est résolue côté serveur via `getProgressContext` et `src/lib/progress/` (domain, server, supabase-adapter) ; les pages overview appellent `getProgressContext` et passent `completed` / `progress` aux composants. L’optimisation ci‑dessous (fonction PostgreSQL ou vue) reste pertinente si on veut réduire encore les appels ou déplacer du calcul en base.

### Ancien flux (référence)

1. **Chargement de toutes les lesson IDs** : `loadAllLessonIds` depuis la base
2. **Chargement des relations cours/chapitres** : `course_chapters`, `chapters`
3. **Calcul côté client** : mapping des lesson IDs par cours/module en JavaScript
4. **Comparaison avec progression** : comparaison avec `user_progress.completed_lessons` (JSONB)
5. **Calcul du pourcentage** : pourcentage de complétion par cours/module

### Inconvénients

- **Beaucoup de données transférées** : On charge toutes les lesson IDs même si on n'en a besoin que pour calculer des pourcentages
- **Calculs côté client** : Toute la logique de mapping et de calcul se fait en JavaScript, ce qui peut être lent
- **Code complexe** : Plusieurs fonctions (`loadAllLessonIds`, `getCoursesLessonIds`, `getModulesLessonIds`) et plusieurs `createMemo` pour orchestrer tout ça
- **Pas optimisé** : On fait des boucles et des filtres sur des Maps/Arrays côté client alors que la base de données pourrait faire ça directement

## Solutions possibles

### Solution 1 : Fonction PostgreSQL avec paramètre user_id

Créer une fonction PostgreSQL qui prend un `user_id` en paramètre et retourne directement les progressions pour cet utilisateur.

**Avantages :**
- Calcul côté serveur, beaucoup plus rapide
- Moins de données transférées (juste le résultat final)
- Logique centralisée en base de données
- Simple côté client : un seul appel de fonction

**Inconvénients :**
- Nécessite d'appeler une fonction plutôt qu'une table simple
- Moins flexible si on veut changer la logique de calcul

**Structure de retour :**
```sql
RETURNS TABLE (
    learnable_id TEXT,        -- course_id ou module_id
    learnable_type TEXT,       -- 'course' ou 'module'
    total_lessons INTEGER,
    completed_lessons INTEGER,
    percentage INTEGER,
    has_started BOOLEAN
)
```

**Utilisation côté client :**
```typescript
const { data } = await supabase.rpc('get_user_progress', { user_id: userId });
```

### Solution 2 : View matérialisée avec filtre

Créer une view qui calcule la progression pour tous les utilisateurs, puis filtrer côté client avec `WHERE user_id = ?`.

**Avantages :**
- Simple à utiliser (requête SQL classique)
- Peut être matérialisée pour de meilleures performances

**Inconvénients :**
- Calcule pour tous les utilisateurs même si on n'en a besoin que d'un
- Peut être lourd si beaucoup d'utilisateurs
- Nécessite un refresh périodique si matérialisée

### Solution 3 : Table de cache avec trigger

Créer une table `user_progress_cache` qui stocke les progressions calculées, avec des triggers pour la mettre à jour automatiquement.

**Avantages :**
- Très rapide à lire (table simple)
- Mise à jour automatique via triggers

**Inconvénients :**
- Plus complexe à maintenir
- Nécessite des triggers sur plusieurs tables
- Risque de désynchronisation si les triggers échouent

## Recommandation

**Solution 1 (Fonction PostgreSQL)** semble être le meilleur compromis :
- Performant (calcul côté serveur)
- Simple à utiliser côté client
- Flexible (on peut facilement modifier la logique SQL)
- Pas de maintenance de cache ou de triggers

## Implémentation future

### Étape 1 : Créer la fonction PostgreSQL

```sql
CREATE OR REPLACE FUNCTION get_user_progress(p_user_id UUID)
RETURNS TABLE (
    learnable_id TEXT,
    learnable_type TEXT,
    total_lessons INTEGER,
    completed_lessons INTEGER,
    percentage INTEGER,
    has_started BOOLEAN
) AS $$
BEGIN
    -- Calcul pour les cours
    RETURN QUERY
    SELECT 
        c.id as learnable_id,
        'course'::TEXT as learnable_type,
        COUNT(DISTINCT l.id)::INTEGER as total_lessons,
        COUNT(DISTINCT CASE WHEN up.completed_lessons ? l.id THEN l.id END)::INTEGER as completed_lessons,
        CASE 
            WHEN COUNT(DISTINCT l.id) = 0 THEN 0
            ELSE ROUND((COUNT(DISTINCT CASE WHEN up.completed_lessons ? l.id THEN l.id END)::NUMERIC / COUNT(DISTINCT l.id)::NUMERIC) * 100)::INTEGER
        END as percentage,
        COUNT(DISTINCT CASE WHEN up.completed_lessons ? l.id THEN l.id END) > 0 as has_started
    FROM courses c
    JOIN course_chapters cc ON cc.course_id = c.id
    JOIN lessons l ON l.module_id = cc.module_id AND l.chapter_id = cc.chapter_id
    LEFT JOIN user_progress up ON up.user_id = p_user_id
    WHERE c.is_active = true
    GROUP BY c.id;

    -- Calcul pour les modules
    RETURN QUERY
    SELECT 
        m.id as learnable_id,
        'module'::TEXT as learnable_type,
        COUNT(DISTINCT l.id)::INTEGER as total_lessons,
        COUNT(DISTINCT CASE WHEN up.completed_lessons ? l.id THEN l.id END)::INTEGER as completed_lessons,
        CASE 
            WHEN COUNT(DISTINCT l.id) = 0 THEN 0
            ELSE ROUND((COUNT(DISTINCT CASE WHEN up.completed_lessons ? l.id THEN l.id END)::NUMERIC / COUNT(DISTINCT l.id)::NUMERIC) * 100)::INTEGER
        END as percentage,
        COUNT(DISTINCT CASE WHEN up.completed_lessons ? l.id THEN l.id END) > 0 as has_started
    FROM modules m
    JOIN chapters ch ON ch.module_id = m.id
    JOIN lessons l ON l.module_id = m.id AND l.chapter_id = ch.id
    LEFT JOIN user_progress up ON up.user_id = p_user_id
    GROUP BY m.id;
END;
$$ LANGUAGE plpgsql;
```

### Étape 2 : Simplifier le code côté client

Remplacer toute la logique de `loadAllLessonIds`, `getCoursesLessonIds`, `getModulesLessonIds` et les `createMemo` de progression par un simple appel :

```typescript
const [userProgress] = createResource(
    () => user()?.id,
    async (userId) => {
        if (!userId) return new Map();
        const { data, error } = await supabase.rpc('get_user_progress', { user_id: userId });
        if (error) return new Map();
        
        // Convertir en Map pour compatibilité avec le code existant
        const progressMap = new Map();
        for (const row of data || []) {
            progressMap.set(row.learnable_id, {
                percentage: row.percentage,
                hasStarted: row.has_started
            });
        }
        return progressMap;
    }
);
```

### Étape 3 : Supprimer le code obsolète

- Supprimer `src/lib/lesson-ids-loader.ts` (plus nécessaire)
- Simplifier les pages overview (`src/pages/[lang]/courses.astro`, `[type]/[id]/index.astro`) en déléguant le calcul à une fonction PostgreSQL (ou vue) au lieu de le faire en JS
- Garder juste l'appel à la fonction PostgreSQL

## Notes

- La fonction utilise l'opérateur `?` de PostgreSQL pour vérifier si une clé existe dans le JSONB `completed_lessons`
- On peut ajouter des index sur `user_progress.user_id` et sur les foreign keys pour optimiser les jointures
- Si les performances ne sont pas suffisantes, on pourra toujours matérialiser la fonction ou créer une table de cache plus tard
