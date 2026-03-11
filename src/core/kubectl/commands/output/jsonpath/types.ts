export type TemplateNode =
  | {
      type: 'text'
      value: string
    }
  | {
      type: 'literal'
      value: string
    }
  | {
      type: 'expression'
      value: string
    }
  | {
      type: 'range'
      expression: string
      children: TemplateNode[]
    }
