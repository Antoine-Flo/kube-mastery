// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Créer votre premier Pod
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Quelle est la version apiVersion correcte pour un objet Pod ?',
      options: ['apps/v1', 'v1', 'v1beta1', 'batch/v1'],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Quelle est la première étape que Kubernetes effectue lorsque vous appliquez un manifest de Pod ?',
      options: [
        "Récupérer l'image du conteneur",
        'Planifier le Pod sur un nœud',
        'Validation du manifest',
        'Démarrer le conteneur'
      ],
      correctAnswer: 2
    },
    {
      id: 'q3',
      type: 'multiple-choice',
      question:
        'Que se passe-t-il si vous essayez de créer un Pod avec un nom qui existe déjà dans le même namespace ?',
      options: [
        'Le Pod existant est remplacé',
        'Un nouveau Pod est créé avec un suffixe',
        'Kubernetes rejette la demande',
        'Les Pods sont fusionnés ensemble'
      ],
      correctAnswer: 2
    }
  ]
}
