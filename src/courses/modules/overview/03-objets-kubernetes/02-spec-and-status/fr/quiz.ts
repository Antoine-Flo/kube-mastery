// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Spec et Status
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz';

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Que représente le champ "spec" dans un objet Kubernetes ?',
      options: [
        'L\'état actuel de l\'objet',
        'L\'état souhaité de l\'objet',
        'Les métadonnées de l\'objet',
        'Le status de l\'objet',
      ],
      correctAnswer: 1,
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Qui met à jour le champ "status" d\'un objet Kubernetes ?',
      options: [
        'L\'utilisateur qui a créé l\'objet',
        'Le système Kubernetes et ses composants',
        'Le runtime de conteneur',
        'L\'outil kubectl',
      ],
      correctAnswer: 1,
    },
  ],
};
