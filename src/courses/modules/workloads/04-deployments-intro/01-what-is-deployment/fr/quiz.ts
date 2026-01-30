// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Qu'est-ce qu'un Deployment ?
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz';

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: "Qu'est-ce qu'un Deployment gère ?",
      options: [
        'Seulement les Pods directement',
        'Les ReplicaSets, qui gèrent les Pods',
        'Les Services',
        'Les ConfigMaps',
      ],
      correctAnswer: 1,
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: "Pour quel type d'applications les Deployments sont-ils le mieux adaptés ?",
      options: [
        'Applications avec état',
        'Applications sans état',
        'Applications de base de données',
        'Seulement les jobs par lots',
      ],
      correctAnswer: 1,
    },
  ],
};
