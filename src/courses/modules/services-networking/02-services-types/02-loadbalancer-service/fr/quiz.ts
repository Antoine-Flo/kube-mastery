// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Service LoadBalancer
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz';

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: "Qu'est-ce qu'un Service LoadBalancer fournit ?",
      options: [
        'IP du cluster interne uniquement',
        'Équilibreur de charge externe pour accéder au Service',
        'Enregistrement DNS CNAME',
        'Fonctionnalité NodePort uniquement',
      ],
      correctAnswer: 1,
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: "Où les informations sur l'équilibreur de charge provisionné sont-elles publiées ?",
      options: [
        'Dans le spec du Service',
        'Dans le champ status.loadBalancer du Service',
        'Dans les annotations des Pods',
        'Dans les ConfigMaps',
      ],
      correctAnswer: 1,
    },
  ],
};
