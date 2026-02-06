// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Mettre à l'échelle un Deployment
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'terminal-command',
      question: "Mettez à l'échelle le nginx-deployment à 5 répliques",
      expectedCommand: 'kubectl scale deployment nginx-deployment --replicas=5',
      validationMode: 'contains',
      normalizeCommand: true
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: "Quel composant crée ou supprime réellement les Pods lors de la mise à l'échelle d'un Deployment ?",
      options: ['Le contrôleur de Deployment directement', 'Le contrôleur de ReplicaSet', 'Le kubelet', 'Le scheduler'],
      correctAnswer: 1
    }
  ]
}
