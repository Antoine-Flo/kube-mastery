// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Choisir un type de Service
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Quel type de Service devriez-vous utiliser pour la communication interne au cluster uniquement ?',
      options: ['NodePort', 'LoadBalancer', 'ClusterIP', 'ExternalName'],
      correctAnswer: 2
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Quel type de Service est le meilleur pour exposer des services en externe sur les plateformes cloud ?',
      options: ['ClusterIP', 'NodePort', 'LoadBalancer', 'ExternalName'],
      correctAnswer: 2
    }
  ]
}
