// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Créer un Deployment
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question:
        'Quelle est la version apiVersion correcte pour un objet Deployment ?',
      options: ['v1', 'apps/v1', 'v1beta1', 'batch/v1'],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'terminal-command',
      question:
        "Créez un Deployment à partir d'un fichier YAML nommé deployment.yaml",
      expectedCommand: 'kubectl apply -f deployment.yaml',
      validationMode: 'contains',
      normalizeCommand: true
    }
  ]
}
