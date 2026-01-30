// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Votre environnement de pratique (kubectl + cluster)
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz';

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'terminal-command',
      question: 'Créez un nouveau fichier appelé "test.txt"',
      expectedCommand: 'touch test.txt',
      validationMode: 'contains',
      normalizeCommand: true,
      hint: 'Tapez "touch test.txt" dans le terminal sur le côté droit de l\'écran.',
    },
  ],
};
