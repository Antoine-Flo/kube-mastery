// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Service ClusterIP
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Quel est le type de Service par défaut dans Kubernetes ?',
      options: ['NodePort', 'LoadBalancer', 'ClusterIP', 'ExternalName'],
      correctAnswer: 2
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: "D'où un Service ClusterIP peut-il être accessible ?",
      options: [
        "Seulement depuis l'extérieur du cluster",
        "Seulement depuis l'intérieur du cluster",
        "De n'importe où",
        'Seulement depuis le plan de contrôle'
      ],
      correctAnswer: 1
    }
  ]
}
