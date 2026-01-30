// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Service NodePort
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz';

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Quelle est la plage de ports par défaut pour les Services NodePort ?',
      options: [
        '1000-2000',
        '30000-32767',
        '8000-9000',
        '50000-60000',
      ],
      correctAnswer: 1,
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Comment accédez-vous à un Service NodePort depuis l\'extérieur du cluster ?',
      options: [
        'En utilisant l\'IP du cluster du Service',
        'En utilisant <NodeIP>:<nodePort>',
        'En utilisant uniquement le DNS',
        'Vous ne pouvez pas y accéder depuis l\'extérieur',
      ],
      correctAnswer: 1,
    },
  ],
};
