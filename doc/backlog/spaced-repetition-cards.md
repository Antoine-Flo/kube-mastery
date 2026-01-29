# Spaced Repetition System (Flashcards)

## Overview

Système de cartes de révision avec répétition espacée pour mémoriser les concepts Kubernetes. Utilise l'algorithme FSRS (Free Spaced Repetition Scheduler) via [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs).

## Algorithme

**FSRS** (Free Spaced Repetition Scheduler) - algorithme moderne plus précis que SM-2 (Anki).

Librairie : `ts-fsrs`
- Support TypeScript natif
- Léger (~10kb)
- Calcul des intervalles basé sur : stabilité, difficulté, temps écoulé

### Ratings

L'utilisateur évalue sa réponse avec 4 niveaux :
- **Again** : Je ne savais pas → révision immédiate
- **Hard** : Difficile → intervalle court
- **Good** : Correct → intervalle normal
- **Easy** : Facile → intervalle long

## Source des cartes (Hybride)

### 1. Cartes générées automatiquement

Générées à partir des cours/quiz complétés :
- Chaque question de quiz devient une carte potentielle
- Extraction des concepts clés des leçons (titres, définitions)
- Tags automatiques basés sur le chapitre/leçon

### 2. Deck Kubernetes dédié

Cartes prédéfinies couvrant :
- Commandes kubectl essentielles
- Concepts K8s (Pods, Deployments, Services, etc.)
- Flags et options courantes
- Troubleshooting patterns

## Stockage (Supabase)

### Tables

```sql
-- Cartes de révision
CREATE TABLE flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Contenu
  front TEXT NOT NULL,           -- Question/Prompt
  back TEXT NOT NULL,            -- Réponse
  tags TEXT[],                   -- ['pods', 'kubectl', 'chapter-1']
  source_type TEXT,              -- 'quiz' | 'lesson' | 'deck'
  source_id TEXT,                -- ID du quiz/leçon d'origine
  
  -- FSRS state
  due TIMESTAMPTZ NOT NULL,      -- Prochaine révision
  stability FLOAT DEFAULT 0,
  difficulty FLOAT DEFAULT 0,
  elapsed_days INT DEFAULT 0,
  scheduled_days INT DEFAULT 0,
  reps INT DEFAULT 0,
  lapses INT DEFAULT 0,
  state INT DEFAULT 0,           -- New=0, Learning=1, Review=2, Relearning=3
  last_review TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_flashcards_user_due ON flashcards(user_id, due);
CREATE INDEX idx_flashcards_user_state ON flashcards(user_id, state);

-- Historique des révisions (optionnel, pour analytics)
CREATE TABLE flashcard_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flashcard_id UUID REFERENCES flashcards(id) ON DELETE CASCADE,
  rating INT NOT NULL,           -- 1=Again, 2=Hard, 3=Good, 4=Easy
  reviewed_at TIMESTAMPTZ DEFAULT now()
);
```

### Sync

- Les données FSRS sont stockées côté serveur (Supabase)
- Nécessite d'être connecté pour utiliser les flashcards
- Progression synchronisée entre appareils

## Moments d'affichage

### 1. Dashboard (après login)

Section dédiée "Révisions du jour" :
- Nombre de cartes à réviser
- Bouton "Commencer la révision"
- Stats rapides (streak, cartes maîtrisées)

### 2. Avant une leçon

Rappel contextuel :
- Afficher 3-5 cartes liées au chapitre avant de commencer
- "Rafraîchissez vos connaissances avant de continuer"
- Optionnel (skip possible)

## Architecture

```
src/
├── lib/
│   └── flashcards/
│       ├── fsrs.ts              # Wrapper ts-fsrs
│       ├── types.ts             # Types Flashcard, Review
│       └── flashcard-service.ts # CRUD Supabase
│
├── components/
│   └── flashcards/
│       ├── FlashcardReview.tsx  # UI de révision
│       ├── FlashcardStats.tsx   # Stats/progression
│       └── DeckSelector.tsx     # Sélection de deck
│
└── pages/
    └── flashcards.tsx           # Page dédiée /flashcards
```

## Flow utilisateur

1. **Nouveau utilisateur** : Reçoit le deck Kubernetes de base
2. **Complète un quiz** : Nouvelles cartes générées automatiquement
3. **Dashboard** : Voit les cartes dues, lance une session
4. **Avant leçon** : Révise les cartes du chapitre (optionnel)
5. **Session de révision** : Carte affichée → réponse → rating → next

## UI de révision

```
┌────────────────────────────────────────┐
│  Quelle commande liste tous les pods?  │
│                                        │
│         [Afficher la réponse]          │
└────────────────────────────────────────┘

        ↓ (après clic)

┌────────────────────────────────────────┐
│  Quelle commande liste tous les pods?  │
│  ─────────────────────────────────────  │
│  kubectl get pods --all-namespaces     │
│  ou kubectl get pods -A                │
│                                        │
│  [Again] [Hard] [Good] [Easy]          │
└────────────────────────────────────────┘
```

## Priorités d'implémentation

1. **MVP** : Deck Kubernetes de base + révision manuelle
2. **V2** : Génération auto depuis quiz
3. **V3** : Stats avancées, rappels, gamification

## Références

- [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) - Librairie FSRS
- [FSRS Algorithm](https://github.com/open-spaced-repetition/fsrs4anki/wiki/Algorithm-Overview) - Détails de l'algorithme

