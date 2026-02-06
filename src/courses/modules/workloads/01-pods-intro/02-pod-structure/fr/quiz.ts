// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Structure d'un Pod
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Comment les conteneurs dans le même Pod communiquent-ils entre eux ?',
      options: [
        'En utilisant des adresses IP externes',
        'En utilisant localhost',
        'Ils ne peuvent pas communiquer',
        'En utilisant des IP de Service'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Quelles ressources partagées les Pods fournissent-ils à leurs conteneurs ?',
      options: [
        'Seulement le réseau',
        'Seulement le stockage',
        'Le réseau et le stockage',
        'Ni le réseau ni le stockage'
      ],
      correctAnswer: 2
    }
  ]
}
