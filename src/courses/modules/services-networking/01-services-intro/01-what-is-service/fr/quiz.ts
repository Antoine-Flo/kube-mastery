// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Qu'est-ce qu'un Service ?
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz';

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Quel problème les Services résolvent-ils dans Kubernetes ?',
      options: [
        'Gestion des images de conteneurs',
        'Accès réseau stable aux Pods dynamiques',
        'Planification des Pods',
        'Limites de ressources',
      ],
      correctAnswer: 1,
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: "Qu'est-ce qu'un Service fournit ?",
      options: [
        'Une adresse IP stable et un nom DNS pour un ensemble de Pods',
        'Runtime de conteneur',
        'Planification des Pods',
        "Registre d'images",
      ],
      correctAnswer: 0,
    },
  ],
};
