// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Architecture du cluster
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: "Quel est le rôle d'etcd dans un cluster Kubernetes ?",
      options: [
        'Planifie les Pods sur les nœuds',
        'Stocke toutes les données du serveur API comme un magasin clé-valeur',
        'Exécute les conteneurs',
        'Gère les règles réseau'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        "Quel composant est responsable d'assigner les Pods aux nœuds ?",
      options: ['kubelet', 'kube-scheduler', 'kube-apiserver', 'kube-proxy'],
      correctAnswer: 1
    },
    {
      id: 'q3',
      type: 'multiple-choice',
      question: 'Que fait le kubelet sur les nœuds de travail ?',
      options: [
        "Expose l'API Kubernetes",
        'Garantit que les Pods et leurs conteneurs fonctionnent',
        'Planifie les Pods',
        "Stocke l'état du cluster"
      ],
      correctAnswer: 1
    }
  ]
}
