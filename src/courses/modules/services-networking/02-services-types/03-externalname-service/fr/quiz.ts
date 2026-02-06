// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Service ExternalName
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Vers quoi un Service ExternalName mappe-t-il ?',
      options: ['Un ensemble de Pods', 'Un nom DNS', 'Une IP de cluster', 'Un port de nœud'],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Comment un Service ExternalName redirige-t-il le trafic ?',
      options: [
        'Via un proxy',
        'Au niveau DNS en utilisant des enregistrements CNAME',
        "Via l'équilibrage de charge",
        'Via le transfert de port'
      ],
      correctAnswer: 1
    }
  ]
}
