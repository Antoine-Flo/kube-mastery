import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Which DNS name pattern resolves a Service in Kubernetes?',
      options: [
        '<service>.<namespace>.svc.cluster.local',
        '<namespace>.<service>.pod.local',
        '<service>.cluster.internal',
        '<service>.<namespace>.kube.local'
      ],
      correctAnswer: 0
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What file inside a Pod usually contains DNS resolver settings?',
      options: ['/etc/hosts', '/etc/resolv.conf', '/var/run/dns.conf', '/etc/kube-dns'],
      correctAnswer: 1
    }
  ]
}
