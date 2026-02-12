// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Découverte de Services
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question:
        'Quelle est la méthode recommandée pour la découverte de services dans Kubernetes ?',
      options: [
        "Variables d'environnement uniquement",
        'DNS',
        'Adresses IP codées en dur',
        'ConfigMaps'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        "Si vous utilisez des variables d'environnement pour la découverte de services, quand le Service doit-il être créé ?",
      options: [
        'Après les Pods clients',
        'Avant les Pods clients',
        'En même temps',
        "Cela n'a pas d'importance"
      ],
      correctAnswer: 1
    }
  ]
}
