export type QuestionType =
  | 'multiple-choice'
  | 'terminal-command'
  | 'command'
  | 'order'

export interface BaseQuestion {
  id: string
  type: QuestionType
  question: string
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multiple-choice'
  options: string[]
  correctAnswer: number
  hint?: string
}

export interface TerminalCommandQuestion extends BaseQuestion {
  type: 'terminal-command'
  expectedCommand: string
  validationMode?: 'exact' | 'contains' | 'regex'
  normalizeCommand?: boolean
  hint?: string
}

export interface CommandQuestion extends BaseQuestion {
  type: 'command'
  expectedCommand: string
}

export interface OrderQuestion extends BaseQuestion {
  type: 'order'
  items: string[]
  correctOrder: number[]
}

export type Question =
  | MultipleChoiceQuestion
  | TerminalCommandQuestion
  | CommandQuestion
  | OrderQuestion

export interface Quiz {
  questions: Question[]
}
