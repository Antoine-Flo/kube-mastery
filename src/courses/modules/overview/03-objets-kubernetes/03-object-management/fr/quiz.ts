// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Gestion des objets
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question:
        'Quelle technique de gestion détecte automatiquement les opérations de création, mise à jour et suppression ?',
      options: [
        'Commandes impératives',
        "Configuration d'objet impérative",
        "Configuration d'objet déclarative",
        'Toutes les réponses ci-dessus'
      ],
      correctAnswer: 2
    },
    {
      id: 'q2',
      type: 'terminal-command',
      question: "Créez un deployment nommé nginx en utilisant l'approche de commande impérative",
      expectedCommand: 'kubectl create deployment nginx --image nginx',
      validationMode: 'contains',
      normalizeCommand: true
    },
    {
      id: 'q3',
      type: 'multiple-choice',
      question: "Quelle est l'approche recommandée pour gérer les objets Kubernetes en production ?",
      options: [
        'Seulement les commandes impératives',
        "Seulement la configuration d'objet déclarative",
        'Mélanger les approches impératives et déclaratives',
        'Utiliser une seule technique par objet'
      ],
      correctAnswer: 3
    }
  ]
}
