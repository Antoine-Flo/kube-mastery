// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Évolution du déploiement
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz';

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Quel était le principal problème avec le déploiement traditionnel sur serveurs physiques ?',
      options: [
        'Trop coûteux à maintenir',
        'Aucun moyen de définir les limites des ressources, causant des problèmes d\'allocation',
        'Les applications ne pouvaient pas communiquer',
        'Trop lent à déployer',
      ],
      correctAnswer: 1,
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Quelle est la différence clé entre les conteneurs et les machines virtuelles ?',
      options: [
        'Les conteneurs sont plus chers',
        'Les conteneurs partagent le système d\'exploitation entre les applications',
        'Les VMs sont plus légères',
        'Les conteneurs nécessitent plus de matériel',
      ],
      correctAnswer: 1,
    },
  ],
};
