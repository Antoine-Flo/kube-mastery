// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Qu'est-ce que Kubernetes ?
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Pour quoi Kubernetes est-il principalement conçu ?',
      options: [
        'Gérer des machines virtuelles',
        'Gérer des charges de travail et des services conteneurisés',
        'Construire des images de conteneurs',
        'Fournir une solution PaaS complète'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: "Laquelle des capacités suivantes n'est PAS fournie par Kubernetes ?",
      options: [
        'Découverte de services et équilibrage de charge',
        'Déploiements et retours en arrière automatisés',
        'Construction et compilation du code source',
        'Auto-guérison des conteneurs'
      ],
      correctAnswer: 2
    },
    {
      id: 'q3',
      type: 'multiple-choice',
      question: 'Kubernetes est mieux décrit comme :',
      options: [
        'Un système PaaS traditionnel tout-en-un',
        'Un ensemble de blocs de construction pour construire des plateformes développeur',
        "Un système d'orchestration monolithique",
        'Un outil de déploiement de code source'
      ],
      correctAnswer: 1
    }
  ]
}
