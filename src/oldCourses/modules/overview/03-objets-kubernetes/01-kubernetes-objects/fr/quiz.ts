// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Objets Kubernetes
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Que sont les objets Kubernetes ?',
      options: [
        "Des entités temporaires qui n'existent que pendant l'exécution",
        "Des entités persistantes qui représentent l'état de votre cluster",
        'Seulement des images de conteneurs',
        'Des configurations réseau'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        "Lequel des champs suivants n'est PAS un champ requis dans un manifest d'objet Kubernetes ?",
      options: ['apiVersion', 'kind', 'metadata', 'status'],
      correctAnswer: 3
    },
    {
      id: 'q3',
      type: 'multiple-choice',
      question: 'Que spécifie le champ "kind" dans un objet Kubernetes ?',
      options: [
        "La version de l'API à utiliser",
        "Le type d'objet à créer (Pod, Deployment, etc.)",
        "Le nom de l'objet",
        "L'état souhaité"
      ],
      correctAnswer: 1
    }
  ]
}
