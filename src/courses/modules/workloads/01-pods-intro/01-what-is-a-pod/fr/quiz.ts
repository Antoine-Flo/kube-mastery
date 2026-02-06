// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Qu'est-ce qu'un Pod ?
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Quelle est la plus petite unité déployable dans Kubernetes ?',
      options: ['Conteneur', 'Pod', 'Nœud', 'Service'],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Quel est le modèle de Pod le plus courant dans Kubernetes ?',
      options: [
        'Plusieurs conteneurs par Pod',
        'Un conteneur par Pod',
        'Aucun conteneur dans les Pods',
        'Pods sans conteneurs'
      ],
      correctAnswer: 1
    }
  ]
}
