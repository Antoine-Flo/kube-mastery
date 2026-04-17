import type { Action } from './types'
import {
  AUTH_SUBCOMMAND_SPECS,
  CONFIG_SUBCOMMAND_SPECS
} from './subcommandSpecs'
import { map, pipe } from 'remeda'

export const CONFIG_SUBCOMMAND_ACTIONS = pipe(
  CONFIG_SUBCOMMAND_SPECS,
  map((spec) => {
    return spec.action
  })
) as readonly Extract<Action, `config-${string}`>[]

export const AUTH_SUBCOMMAND_ACTIONS = pipe(
  AUTH_SUBCOMMAND_SPECS,
  map((spec) => {
    return spec.action
  })
) as readonly Extract<Action, `auth-${string}`>[]

export const ACTIONS_WITHOUT_IMPLICIT_NAMESPACE = [
  'config',
  ...CONFIG_SUBCOMMAND_ACTIONS
] as const satisfies readonly Action[]
